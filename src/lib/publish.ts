import "server-only";
import { and, eq, inArray, lte, sql } from "drizzle-orm";
import { decrypt, encrypt } from "./crypto";
import { db, schema } from "./db";
import type { Connection, PublishResult } from "./db/schema";
import { getPlatform } from "./platforms";
import { splitParts } from "./thread";

async function freshAccessToken(conn: Connection) {
  const adapter = getPlatform(conn.platform)!;
  const expiringSoon = conn.expiresAt && conn.expiresAt.getTime() < Date.now() + 60_000;
  if (!expiringSoon) return decrypt(conn.accessToken);

  const refreshed = conn.refreshToken ? await adapter.refresh(decrypt(conn.refreshToken)) : null;
  if (!refreshed) throw new Error(`${adapter.name} session expired. Reconnect it in Settings.`);

  await db
    .update(schema.connections)
    .set({
      accessToken: encrypt(refreshed.accessToken),
      // X rotates refresh tokens on every use, so always persist the new one.
      refreshToken: refreshed.refreshToken ? encrypt(refreshed.refreshToken) : conn.refreshToken,
      expiresAt: refreshed.expiresAt,
    })
    .where(eq(schema.connections.id, conn.id));
  return refreshed.accessToken;
}

/** Publish a post that has already been claimed (status = "publishing"). */
async function publishClaimed(postId: string) {
  const post = await db.query.posts.findFirst({ where: eq(schema.posts.id, postId) });
  if (!post) return;

  const conns = await db.query.connections.findMany({
    where: and(eq(schema.connections.userId, post.userId), inArray(schema.connections.platform, post.platforms)),
  });

  const previous = post.results ?? {};
  const results: Record<string, PublishResult> = { ...previous };

  for (const platformId of post.platforms) {
    if (previous[platformId]?.ok) continue;
    const adapter = getPlatform(platformId);
    const conn = conns.find((c) => c.platform === platformId);
    try {
      if (!adapter) throw new Error(`Unknown platform ${platformId}`);
      if (!conn) throw new Error(`${adapter.name} is not connected`);
      const parts = adapter.supportsThreads
        ? splitParts(post.content, post.thread)
        : [splitParts(post.content, post.thread).join("\n\n")];
      const tooLong = parts.find((p) => p.length > adapter.maxLength);
      if (tooLong) {
        throw new Error(`A part is ${tooLong.length} characters; ${adapter.name} allows ${adapter.maxLength}`);
      }
      const accessToken = await freshAccessToken(conn);
      const out = await adapter.publish({
        accessToken,
        account: { accountId: conn.accountId, handle: conn.handle },
        parts,
      });
      results[platformId] = { ok: true, ...out };
    } catch (err) {
      results[platformId] = { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  if (post.platforms.length === 0) results.none = { ok: false, error: "No platforms selected. Edit the post first." };
  const allOk = post.platforms.length > 0 && post.platforms.every((p) => results[p]?.ok);
  await db
    .update(schema.posts)
    .set({
      results,
      status: allOk ? "published" : "failed",
      publishedAt: allOk ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(schema.posts.id, postId));
}

/** Publish one post immediately (used by "Post now" and "Retry"). */
export async function publishNow(postId: string, userId: string) {
  const claimed = await db
    .update(schema.posts)
    .set({ status: "publishing", updatedAt: new Date() })
    .where(
      and(
        eq(schema.posts.id, postId),
        eq(schema.posts.userId, userId),
        inArray(schema.posts.status, ["draft", "scheduled", "failed"]),
      ),
    )
    .returning({ id: schema.posts.id });
  if (claimed[0]) await publishClaimed(claimed[0].id);
}

/** Claim and publish every scheduled post that is due. Safe to call concurrently. */
export async function publishDue(limit = 25) {
  const due = await db
    .update(schema.posts)
    .set({ status: "publishing", updatedAt: new Date() })
    .where(
      inArray(
        schema.posts.id,
        db
          .select({ id: schema.posts.id })
          .from(schema.posts)
          .where(and(eq(schema.posts.status, "scheduled"), lte(schema.posts.scheduledAt, new Date())))
          .orderBy(schema.posts.scheduledAt)
          .limit(limit)
          .for("update", { skipLocked: true }),
      ),
    )
    .returning({ id: schema.posts.id });

  for (const { id } of due) await publishClaimed(id);

  // Posts stuck in "publishing" mean a run crashed mid-way. Mark them failed rather than
  // re-queueing, since some platforms may already have the post; Retry skips those.
  await db
    .update(schema.posts)
    .set({ status: "failed" })
    .where(and(eq(schema.posts.status, "publishing"), lte(schema.posts.updatedAt, sql`now() - interval '15 minutes'`)));

  return due.length;
}

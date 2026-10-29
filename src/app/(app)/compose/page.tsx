import { and, desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db, schema } from "@/lib/db";
import { platformSummaries } from "@/lib/platforms";
import { requireUser } from "@/lib/session";
import { Composer } from "./composer";

export const metadata: Metadata = { title: "Write" };

const UUID = /^[0-9a-f-]{36}$/i;

export default async function ComposePage({ searchParams }: PageProps<"/compose">) {
  const user = await requireUser();
  const { id: rawId, at } = await searchParams;
  const id = typeof rawId === "string" && UUID.test(rawId) ? rawId : undefined;
  if (rawId !== undefined && !id) notFound();

  const [post, prompts, connections] = await Promise.all([
    id ? db.query.posts.findFirst({ where: and(eq(schema.posts.id, id), eq(schema.posts.userId, user.id)) }) : undefined,
    db.query.prompts.findMany({
      where: eq(schema.prompts.userId, user.id),
      orderBy: [desc(schema.prompts.isDefault), schema.prompts.name],
    }),
    db.query.connections.findMany({ where: eq(schema.connections.userId, user.id) }),
  ]);
  if (id && !post) notFound();

  const platforms = platformSummaries().map((p) => {
    const conn = connections.find((c) => c.platform === p.id);
    return { ...p, connected: Boolean(conn), handle: conn?.handle ?? null };
  });
  const initialAt = typeof at === "string" && !Number.isNaN(Date.parse(at)) ? at : null;

  return (
    <Composer
      key={post?.id ?? "new"}
      author={{ name: user.name ?? user.login, login: user.login, avatarUrl: user.avatarUrl }}
      post={
        post && {
          id: post.id,
          content: post.content,
          thread: post.thread,
          kind: post.kind,
          sourceType: post.sourceType,
          sourceRef: post.sourceRef,
          platforms: post.platforms,
          status: post.status,
          scheduledAt: post.scheduledAt?.toISOString() ?? null,
        }
      }
      initialAt={initialAt}
      prompts={prompts.map((p) => ({ id: p.id, name: p.name, isDefault: p.isDefault }))}
      platforms={platforms}
    />
  );
}

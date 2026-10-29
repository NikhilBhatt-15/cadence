"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { decrypt, encrypt } from "@/lib/crypto";
import { db, schema } from "@/lib/db";
import { listRepos } from "@/lib/github";
import { assertPublicUrl } from "@/lib/link-preview";
import { getPlatform } from "@/lib/platforms";
import { POST_KINDS, SOURCE_TYPES } from "@/lib/post-options";
import { publishNow } from "@/lib/publish";
import { requireUser } from "@/lib/session";
import { splitParts } from "@/lib/thread";

function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

// ---------- GitHub ----------

export async function listReposAction() {
  const user = await requireUser();
  try {
    return { repos: await listRepos(decrypt(user.githubToken)) };
  } catch (err) {
    return { repos: [], error: errorMessage(err) };
  }
}

// ---------- Posts ----------

const postSchema = z
  .object({
    id: z.uuid().optional(),
    content: z.string().trim().min(1, "Write something first.").max(20_000),
    thread: z.boolean(),
    kind: z.enum(POST_KINDS.map((k) => k.id) as [string, ...string[]]),
    sourceType: z.enum(SOURCE_TYPES.map((s) => s.id) as [string, ...string[]]),
    sourceRef: z.string().max(500).optional(),
    platforms: z.array(z.string()),
    intent: z.enum(["draft", "schedule", "now"]),
    scheduledAt: z.iso.datetime().optional(),
  })
  .refine((p) => p.intent === "draft" || p.platforms.length > 0, "Pick at least one account to publish to.");

export type SavePostResult = { ok: true; id: string; status: string; error?: undefined } | { ok?: false; error: string };

export async function savePostAction(input: z.input<typeof postSchema>): Promise<SavePostResult> {
  const user = await requireUser();
  const parsed = postSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid post" };
  const { id, content, thread, kind, sourceType, sourceRef, platforms, intent, scheduledAt } = parsed.data;

  const parts = splitParts(content, thread);
  for (const p of platforms) {
    const adapter = getPlatform(p);
    if (!adapter) return { error: `Unknown platform ${p}` };
    const checked = adapter.supportsThreads ? parts : [parts.join("\n\n")];
    const over = checked.findIndex((part) => part.length > adapter.maxLength);
    if (over >= 0) {
      const which = checked.length > 1 ? `Part ${over + 1}` : "This post";
      return { error: `${which} is ${checked[over].length} characters; ${adapter.name} allows ${adapter.maxLength}.` };
    }
  }

  let when: Date | null = null;
  if (intent === "schedule") {
    if (!scheduledAt) return { error: "Pick a date and time." };
    when = new Date(scheduledAt);
    if (when.getTime() < Date.now() - 60_000) return { error: "That time has already passed. Pick a later one." };
  }

  const values = {
    userId: user.id,
    content,
    thread: thread && parts.length > 1,
    kind,
    sourceType,
    sourceRef: sourceRef || null,
    platforms,
    status: intent === "schedule" ? ("scheduled" as const) : ("draft" as const),
    scheduledAt: when,
    results: null,
    updatedAt: new Date(),
  };

  let postId = id;
  if (id) {
    const updated = await db
      .update(schema.posts)
      .set(values)
      .where(and(eq(schema.posts.id, id), eq(schema.posts.userId, user.id)))
      .returning({ id: schema.posts.id });
    if (!updated[0]) return { error: "That post no longer exists." };
  } else {
    const [created] = await db.insert(schema.posts).values(values).returning({ id: schema.posts.id });
    postId = created.id;
  }

  if (intent === "now") await publishNow(postId!, user.id);
  const saved = await db.query.posts.findFirst({ where: eq(schema.posts.id, postId!) });

  revalidatePath("/dashboard");
  return { ok: true, id: postId!, status: saved?.status ?? values.status };
}

export async function publishNowAction(postId: string) {
  const user = await requireUser();
  await publishNow(postId, user.id);
  revalidatePath("/dashboard");
  const post = await db.query.posts.findFirst({ where: eq(schema.posts.id, postId) });
  return { status: post?.status };
}

export async function reschedulePostAction(postId: string, iso: string) {
  const user = await requireUser();
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return { error: "Invalid time." };
  if (when.getTime() < Date.now()) return { error: "Can't move a post into the past." };
  const updated = await db
    .update(schema.posts)
    .set({ scheduledAt: when, status: "scheduled", updatedAt: new Date() })
    .where(
      and(
        eq(schema.posts.id, postId),
        eq(schema.posts.userId, user.id),
        inArray(schema.posts.status, ["scheduled", "draft", "failed"]),
      ),
    )
    .returning({ id: schema.posts.id, platforms: schema.posts.platforms });
  if (!updated[0]) return { error: "That post can't be moved." };
  if (updated[0].platforms.length === 0) {
    await db.update(schema.posts).set({ status: "draft" }).where(eq(schema.posts.id, postId));
    return { error: "Pick an account for this post before scheduling it." };
  }
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function unschedulePostAction(postId: string) {
  const user = await requireUser();
  await db
    .update(schema.posts)
    .set({ status: "draft", scheduledAt: null, updatedAt: new Date() })
    .where(and(eq(schema.posts.id, postId), eq(schema.posts.userId, user.id), eq(schema.posts.status, "scheduled")));
  revalidatePath("/dashboard");
}

export async function deletePostAction(postId: string) {
  const user = await requireUser();
  await db.delete(schema.posts).where(and(eq(schema.posts.id, postId), eq(schema.posts.userId, user.id)));
  revalidatePath("/dashboard");
}

export async function setWeeklyGoalAction(goal: number) {
  const user = await requireUser();
  const value = Math.max(1, Math.min(21, Math.round(goal)));
  await db.update(schema.users).set({ weeklyGoal: value }).where(eq(schema.users.id, user.id));
  revalidatePath("/dashboard");
}

// ---------- Prompt templates ----------

const promptSchema = z.object({
  id: z.uuid().optional().or(z.literal("")),
  name: z.string().trim().min(1, "Give the voice a name.").max(100),
  instructions: z.string().trim().min(1, "Describe how this voice writes.").max(5000),
  isDefault: z.boolean(),
});

export async function savePromptAction(input: z.input<typeof promptSchema>) {
  const user = await requireUser();
  const parsed = promptSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid template" };
  const { id, ...values } = parsed.data;

  await db.transaction(async (tx) => {
    if (values.isDefault) {
      await tx.update(schema.prompts).set({ isDefault: false }).where(eq(schema.prompts.userId, user.id));
    }
    if (id) {
      await tx
        .update(schema.prompts)
        .set(values)
        .where(and(eq(schema.prompts.id, id), eq(schema.prompts.userId, user.id)));
    } else {
      await tx.insert(schema.prompts).values({ ...values, userId: user.id });
    }
  });

  revalidatePath("/prompts");
  return { ok: true };
}

export async function deletePromptAction(promptId: string) {
  const user = await requireUser();
  await db.delete(schema.prompts).where(and(eq(schema.prompts.id, promptId), eq(schema.prompts.userId, user.id)));
  revalidatePath("/prompts");
}

// ---------- Settings ----------

const aiSchema = z.object({
  provider: z.enum(["google", "openai", "anthropic", "openai-compatible"]),
  model: z.string().trim().min(1, "Enter a model name.").max(200),
  apiKey: z.string().trim().max(500),
  baseUrl: z.url("Base URL must be a full URL.").optional().or(z.literal("")),
});

export async function saveAiSettingsAction(_prev: unknown, form: FormData) {
  const user = await requireUser();
  const parsed = aiSchema.safeParse({
    provider: form.get("provider"),
    model: form.get("model"),
    apiKey: form.get("apiKey") ?? "",
    baseUrl: form.get("baseUrl") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid settings", ok: false };
  const { provider, model, apiKey, baseUrl } = parsed.data;

  // The server calls this URL, so in a shared deployment it must not reach internal hosts.
  if (provider === "openai-compatible" && baseUrl && process.env.ALLOW_PRIVATE_AI_BASE_URL !== "true") {
    try {
      await assertPublicUrl(baseUrl);
    } catch (err) {
      return { ok: false, error: `Base URL: ${errorMessage(err)}` };
    }
  }

  const existing = await db.query.aiSettings.findFirst({ where: eq(schema.aiSettings.userId, user.id) });
  // An empty key field means "keep the saved key" unless the provider changed.
  const keepKey = !apiKey && existing?.provider === provider;
  const values = {
    provider,
    model,
    baseUrl: baseUrl || null,
    apiKey: apiKey ? encrypt(apiKey) : keepKey ? existing!.apiKey : null,
  };

  await db
    .insert(schema.aiSettings)
    .values({ userId: user.id, ...values })
    .onConflictDoUpdate({ target: schema.aiSettings.userId, set: values });

  revalidatePath("/settings");
  return { ok: true, error: null };
}

export async function disconnectAction(platform: string) {
  const user = await requireUser();
  await db
    .delete(schema.connections)
    .where(and(eq(schema.connections.userId, user.id), eq(schema.connections.platform, platform)));
  revalidatePath("/settings");
}

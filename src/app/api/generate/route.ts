import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { describeAiError, resolveAi, streamPost, type GenerationSource } from "@/lib/ai";
import { decrypt } from "@/lib/crypto";
import { db, schema } from "@/lib/db";
import { getRepoContext } from "@/lib/github";
import { fetchLinkContext } from "@/lib/link-preview";
import { getPlatform } from "@/lib/platforms";
import { POST_KINDS, SOURCE_TYPES } from "@/lib/post-options";
import { getUser } from "@/lib/session";

export const maxDuration = 60;

const bodySchema = z.object({
  kind: z.enum(POST_KINDS.map((k) => k.id) as [string, ...string[]]),
  sourceType: z.enum(SOURCE_TYPES.map((s) => s.id) as [string, ...string[]]),
  sourceRef: z.string().max(500).default(""),
  sourceText: z.string().max(8000).default(""),
  promptId: z.uuid().optional(),
  direction: z.string().max(2000).default(""),
  platform: z.string(),
  thread: z.boolean().default(false),
});

const fail = (message: string, status = 400) => Response.json({ error: message }, { status });

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return fail("Sign in again to continue.", 401);

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Some of the brief is invalid.");
  const b = parsed.data;

  const platform = getPlatform(b.platform);
  if (!platform) return fail("Unknown platform.");

  const settings = await db.query.aiSettings.findFirst({ where: eq(schema.aiSettings.userId, user.id) });
  const ai = resolveAi(settings);
  if (!ai) return fail("Add an AI provider and key in Settings to generate drafts.");

  const template = b.promptId
    ? await db.query.prompts.findFirst({
        where: and(eq(schema.prompts.id, b.promptId), eq(schema.prompts.userId, user.id)),
      })
    : undefined;

  let source: GenerationSource;
  try {
    switch (b.sourceType) {
      case "github":
        if (!b.sourceRef) return fail("Pick a repository first.");
        source = { type: "github", repo: await getRepoContext(decrypt(user.githubToken), b.sourceRef) };
        break;
      case "link":
        if (!b.sourceRef) return fail("Paste a link first.");
        source = { type: "link", link: await fetchLinkContext(b.sourceRef) };
        break;
      case "notes":
      case "rewrite":
        if (!b.sourceText.trim()) return fail(b.sourceType === "notes" ? "Add some notes first." : "Paste the post to rewrite.");
        source = { type: b.sourceType, text: b.sourceText };
        break;
      default:
        if (!b.direction.trim()) return fail("Say what the post is about first.");
        source = { type: "idea" };
    }
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Couldn't read the source.");
  }

  try {
    const result = streamPost({
      ai,
      kind: b.kind,
      styleInstructions: template?.instructions ?? "",
      platform,
      thread: b.thread && platform.supportsThreads,
      source,
      direction: b.direction,
      author: user.name ?? user.login,
    });
    // Wait for the first event so a bad key or model comes back as a readable error
    // instead of an empty 200 stream.
    const events = result.fullStream[Symbol.asyncIterator]();
    let first = "";
    for (;;) {
      const { done, value } = await events.next();
      if (done) break;
      if (value.type === "error") return fail(describeAiError(value.error, ai), 502);
      if (value.type === "text-delta" && value.text) {
        first = value.text;
        break;
      }
    }

    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        if (first) controller.enqueue(encoder.encode(first));
      },
      async pull(controller) {
        for (;;) {
          const { done, value } = await events.next();
          if (done || value.type === "error") return controller.close();
          if (value.type === "text-delta" && value.text) return controller.enqueue(encoder.encode(value.text));
        }
      },
      async cancel() {
        await events.return?.();
      },
    });
    return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  } catch (err) {
    return fail(describeAiError(err, ai), 500);
  }
}

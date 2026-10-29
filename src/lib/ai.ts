import "server-only";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogle } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText, type LanguageModel } from "ai";
import type { AiSettings } from "./db/schema";
import { decrypt } from "./crypto";
import { env } from "./env";
import type { RepoContext } from "./github";
import type { LinkContext } from "./link-preview";
import type { PlatformAdapter } from "./platforms";
import { POST_KINDS } from "./post-options";

export const AI_PROVIDERS = [
  { id: "google", name: "Google Gemini", defaultModel: "gemini-2.5-flash", note: "Free tier available." },
  { id: "openai", name: "OpenAI", defaultModel: "gpt-5-mini", note: "" },
  { id: "anthropic", name: "Anthropic Claude", defaultModel: "claude-haiku-4-5", note: "" },
  {
    id: "openai-compatible",
    name: "OpenAI-compatible (Groq, OpenRouter, Ollama)",
    defaultModel: "llama-3.3-70b-versatile",
    note: "Groq has a free tier: https://api.groq.com/openai/v1",
  },
] as const;

export type AiProviderId = (typeof AI_PROVIDERS)[number]["id"];

type ResolvedAi = { provider: string; model: string; apiKey: string; baseUrl: string | null };

/** User's own settings win; otherwise fall back to the server-wide default key, if any. */
export function resolveAi(settings: AiSettings | undefined): ResolvedAi | null {
  if (settings?.apiKey) {
    return {
      provider: settings.provider,
      model: settings.model,
      apiKey: decrypt(settings.apiKey),
      baseUrl: settings.baseUrl,
    };
  }
  const d = env.defaultAi;
  if (d.provider && d.apiKey) {
    const fallbackModel = AI_PROVIDERS.find((p) => p.id === d.provider)?.defaultModel ?? "";
    return { provider: d.provider, model: d.model ?? fallbackModel, apiKey: d.apiKey, baseUrl: d.baseUrl ?? null };
  }
  return null;
}

function languageModel({ provider, model, apiKey, baseUrl }: ResolvedAi): LanguageModel {
  switch (provider) {
    case "openai":
      return createOpenAI({ apiKey })(model);
    case "anthropic":
      return createAnthropic({ apiKey })(model);
    case "google":
      return createGoogle({ apiKey })(model);
    case "openai-compatible":
      if (!baseUrl) throw new Error("OpenAI-compatible provider needs a base URL");
      return createOpenAI({ apiKey, baseURL: baseUrl }).chat(model);
    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }
}

export type GenerationSource =
  | { type: "idea" }
  | { type: "github"; repo: RepoContext }
  | { type: "link"; link: LinkContext }
  | { type: "notes"; text: string }
  | { type: "rewrite"; text: string };

function describeRepo(ctx: RepoContext) {
  const lines = [
    `Repository: ${ctx.fullName} (${ctx.url})`,
    ctx.description && `Description: ${ctx.description}`,
    ctx.homepage && `Homepage: ${ctx.homepage}`,
    ctx.language && `Primary language: ${ctx.language}`,
    ctx.topics.length > 0 && `Topics: ${ctx.topics.join(", ")}`,
    `Stars: ${ctx.stars}`,
    ctx.latestRelease &&
      `Latest release: ${ctx.latestRelease.tag}${ctx.latestRelease.name ? ` - ${ctx.latestRelease.name}` : ""}\n${(ctx.latestRelease.body ?? "").slice(0, 1500)}`,
    ctx.commits.length > 0 &&
      `Recent commits (newest first):\n${ctx.commits.map((c) => `- ${c.message} (${c.date.slice(0, 10)})`).join("\n")}`,
    ctx.readme && `README (truncated):\n${ctx.readme.slice(0, 6000)}`,
  ];
  return lines.filter(Boolean).join("\n\n");
}

function describeSource(source: GenerationSource) {
  switch (source.type) {
    case "idea":
      return null;
    case "github":
      return `Project context:\n${describeRepo(source.repo)}`;
    case "link":
      return [
        `Source link: ${source.link.url}`,
        source.link.title && `Title: ${source.link.title}`,
        source.link.description && `Description: ${source.link.description}`,
        `Page text (truncated):\n${source.link.text}`,
        "Include the link in the post.",
      ]
        .filter(Boolean)
        .join("\n");
    case "notes":
      return `The author's rough notes. Turn them into the post, keeping their facts and intent:\n${source.text}`;
    case "rewrite":
      return `An existing post to rewrite. Keep the core message, improve it, and fit the target format:\n${source.text}`;
  }
}

export function streamPost(opts: {
  ai: ResolvedAi;
  kind: string;
  styleInstructions: string;
  platform: PlatformAdapter;
  thread: boolean;
  source: GenerationSource;
  direction: string;
  author: string;
}) {
  const kind = POST_KINDS.find((k) => k.id === opts.kind) ?? POST_KINDS[0];
  const format = opts.thread
    ? `Write a thread of 3 to 6 parts. Separate parts with a line containing only "---". Each part must stand on its own and be at most ${opts.platform.maxLength} characters. The first part is the hook.`
    : "Write a single post.";

  const instructions = [
    `You write social media posts on behalf of ${opts.author}. Write in first person as the author.`,
    `Post type: ${kind.label}. ${kind.hint}`,
    format,
    opts.platform.styleHint,
    "Never invent facts, numbers, quotes or links that aren't in the provided context.",
    "Output only the post text: no preamble, no surrounding quotes, no markdown headings or bold.",
    opts.styleInstructions && `The author's voice and style rules (follow these closely):\n${opts.styleInstructions}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const prompt = [
    describeSource(opts.source),
    opts.direction ? `What the author wants this post to say:\n${opts.direction}` : "Pick the most interesting angle.",
  ]
    .filter(Boolean)
    .join("\n\n");

  return streamText({
    model: languageModel(opts.ai),
    instructions,
    prompt,
    onError: ({ error }) => console.error("generation failed", error),
  });
}

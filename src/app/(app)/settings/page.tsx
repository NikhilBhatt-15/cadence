import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { PlatformIcon } from "@/components/platform-icon";
import { AI_PROVIDERS } from "@/lib/ai";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { platformSummaries } from "@/lib/platforms";
import { requireUser } from "@/lib/session";
import { AiSettingsForm, DisconnectButton, Flash } from "./settings-forms";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  const user = await requireUser();
  const { connected, error } = await searchParams;
  const [connections, ai] = await Promise.all([
    db.query.connections.findMany({ where: eq(schema.connections.userId, user.id) }),
    db.query.aiSettings.findFirst({ where: eq(schema.aiSettings.userId, user.id) }),
  ]);
  const hasServerDefault = Boolean(env.defaultAi.provider && env.defaultAi.apiKey);

  let flash: { tone: "success" | "error"; text: string } | null = null;
  if (typeof connected === "string") flash = { tone: "success", text: `Connected ${connected === "x" ? "X" : "LinkedIn"}.` };
  if (typeof error === "string") {
    flash = {
      tone: "error",
      text: error.endsWith("_not_configured")
        ? "That platform isn't set up on this server yet. Add its client ID and secret to the environment."
        : error.endsWith("_denied")
          ? "Connection was cancelled or expired. Try connecting again."
          : "Connecting failed. Check that the app's callback URL matches this site, then try again.",
    };
  }

  return (
    <div className="max-w-3xl space-y-10">
      <h1 className="font-display text-4xl font-semibold tracking-[-0.03em] [font-variation-settings:'wdth'_90]">Settings</h1>
      {flash && <Flash tone={flash.tone} text={flash.text} />}

      <section aria-labelledby="accounts-title" className="space-y-4">
        <div>
          <h2 id="accounts-title" className="font-display text-xl font-semibold tracking-tight">
            Accounts
          </h2>
          <p className="text-ink-2">Cadence publishes on your behalf through these.</p>
        </div>
        <ul className="divide-y divide-line overflow-hidden rounded-[14px] border border-line bg-paper">
          {platformSummaries().map((p) => {
            const conn = connections.find((c) => c.platform === p.id);
            return (
              <li key={p.id} className="flex items-center gap-4 px-5 py-4">
                <span className={`grid size-10 place-items-center rounded-full ${conn ? "bg-ink text-white" : "bg-fog-2 text-ink-2"}`}>
                  <PlatformIcon id={p.id} size={16} />
                </span>
                <div className="min-w-0">
                  <p className="font-medium">{p.name}</p>
                  <p className="truncate text-sm text-mute">
                    {conn
                      ? `Connected as ${p.id === "x" ? "@" : ""}${conn.handle}`
                      : p.configured
                        ? "Not connected"
                        : "Not available on this server yet"}
                  </p>
                </div>
                <div className="ml-auto flex gap-1">
                  {p.configured && (
                    <a href={`/api/connect/${p.id}`} className={conn ? "btn-ghost" : "btn-secondary"}>
                      {conn ? "Reconnect" : "Connect"}
                    </a>
                  )}
                  {conn && <DisconnectButton platform={p.id} name={p.name} />}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="ai-title" className="space-y-4">
        <div>
          <h2 id="ai-title" className="font-display text-xl font-semibold tracking-tight">
            AI drafting
          </h2>
          <p className="text-ink-2">
            Use your own key; it&apos;s encrypted before it&apos;s stored. Gemini and Groq both have free tiers.
            {hasServerDefault && !ai?.apiKey && " Until you add one, this server's shared key is used."}
          </p>
        </div>
        <AiSettingsForm
          providers={AI_PROVIDERS.map((p) => ({ ...p }))}
          current={ai && { provider: ai.provider, model: ai.model, baseUrl: ai.baseUrl, hasKey: Boolean(ai.apiKey) }}
        />
      </section>
    </div>
  );
}

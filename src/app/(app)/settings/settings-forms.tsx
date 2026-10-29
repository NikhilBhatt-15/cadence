"use client";

import { motion } from "motion/react";
import { useActionState, useEffect, useState, useTransition } from "react";
import { disconnectAction, saveAiSettingsAction } from "@/app/actions";
import { useToast } from "@/components/toast";

type Provider = { id: string; name: string; defaultModel: string; note: string; keyUrl: string };

export function Flash({ tone, text }: { tone: "success" | "error"; text: string }) {
  return (
    <motion.p
      role={tone === "error" ? "alert" : "status"}
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-[10px] px-4 py-3 text-sm ${tone === "error" ? "bg-bad-soft text-bad" : "bg-ok-soft text-ok"}`}
    >
      {text}
    </motion.p>
  );
}

export function AiSettingsForm({
  providers,
  current,
}: {
  providers: Provider[];
  current?: { provider: string; model: string; baseUrl: string | null; hasKey: boolean };
}) {
  const toast = useToast();
  const [state, action, pending] = useActionState(saveAiSettingsAction, null);
  const [provider, setProvider] = useState(current?.provider ?? providers[0].id);
  const [model, setModel] = useState(current?.model ?? providers[0].defaultModel);
  const info = providers.find((p) => p.id === provider)!;
  const keySaved = current?.hasKey && current.provider === provider;

  useEffect(() => {
    if (state?.ok) toast("AI settings saved", { tone: "success" });
  }, [state, toast]);

  return (
    <form action={action} className="panel grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
      <fieldset className="sm:col-span-2">
        <legend className="field-label">Provider</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {providers.map((p) => (
            <label
              key={p.id}
              className={`relative flex cursor-pointer flex-col rounded-[12px] sm:last:odd:col-span-2 border px-4 py-3 transition-colors duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-tempo ${
                provider === p.id ? "border-tempo bg-tempo-soft/40" : "border-line hover:border-ink-2/30"
              }`}
            >
              <input
                type="radio"
                name="provider"
                value={p.id}
                checked={provider === p.id}
                onChange={() => {
                  setProvider(p.id);
                  setModel(p.defaultModel);
                }}
                className="sr-only"
              />
              <span className="font-medium">{p.name}</span>
              {p.note && <span className="text-sm text-mute">{p.note}</span>}
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label className="field-label" htmlFor="model">
          Model
        </label>
        <input
          id="model"
          name="model"
          className="field"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        {info.defaultModel && (
          <p className="mt-1 text-sm text-mute">Default for {info.name}: {info.defaultModel}</p>
        )}
      </div>
      <div>
        <label className="field-label" htmlFor="apiKey">
          API key
        </label>
        <input
          id="apiKey"
          name="apiKey"
          type="password"
          autoComplete="off"
          spellCheck={false}
          className="field"
          placeholder={keySaved ? "Saved. Leave blank to keep it." : "Paste your API key…"}
        />
        {info.keyUrl && (
          <p className="mt-1 text-sm text-mute">
            <a href={info.keyUrl} target="_blank" rel="noopener noreferrer" className="text-tempo underline-offset-2 hover:underline">
              Get a {info.name} key
            </a>
          </p>
        )}
      </div>
      {provider === "openai-compatible" && (
        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="baseUrl">
            Base URL
          </label>
          <input
            id="baseUrl"
            name="baseUrl"
            type="url"
            inputMode="url"
            className="field"
            defaultValue={current?.baseUrl ?? ""}
            placeholder="https://openrouter.ai/api/v1…"
            spellCheck={false}
          />
        </div>
      )}
      {state?.error && (
        <p role="alert" className="rounded-[10px] bg-bad-soft px-3 py-2 text-sm text-bad sm:col-span-2">
          {state.error}
        </p>
      )}
      <div className="sm:col-span-2">
        <button className="btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Save AI settings"}
        </button>
      </div>
    </form>
  );
}

export function DisconnectButton({ platform, name }: { platform: string; name: string }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button className="btn-danger" onClick={() => setConfirming(true)}>
        Disconnect
      </button>
    );
  }
  return (
    <span className="flex items-center gap-1">
      <button
        className="btn bg-bad text-white hover:bg-bad/90"
        disabled={pending}
        onClick={() =>
          start(async () => {
            await disconnectAction(platform);
            toast(`Disconnected ${name}. Scheduled posts for it will fail until you reconnect.`);
          })
        }
      >
        Disconnect
      </button>
      <button className="btn-ghost" onClick={() => setConfirming(false)}>
        Keep
      </button>
    </span>
  );
}

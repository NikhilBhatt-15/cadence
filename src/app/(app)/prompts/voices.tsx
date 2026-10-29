"use client";

import { Plus } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState, useTransition } from "react";
import { deletePromptAction, savePromptAction } from "@/app/actions";
import { useToast } from "@/components/toast";

type Voice = { id: string; name: string; instructions: string; isDefault: boolean };

const STARTERS = [
  "Write like I talk: short sentences, plain words.",
  "Never use hashtags or emoji.",
  "Always end with a question to the reader.",
  "Mention numbers when the source has them.",
  "Avoid the words: excited, thrilled, journey, leverage.",
];

export function Voices({ voices }: { voices: Voice[] }) {
  const [selectedId, setSelectedId] = useState<string | "new">(voices[0]?.id ?? "new");
  const selected = voices.find((v) => v.id === selectedId);

  return (
    <div className="space-y-8">
      <div className="max-w-2xl">
        <h1 className="font-display text-4xl font-semibold tracking-[-0.03em] [font-variation-settings:'wdth'_90]">Voices</h1>
        <p className="mt-2 text-ink-2">
          A voice is a set of style rules the AI follows when it drafts: tone, length, words to avoid, how to end. Pick
          one per post. Your default is preselected.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)]">
        <ul className="space-y-1.5" aria-label="Your voices">
          {voices.map((v) => {
            const active = v.id === selectedId;
            return (
              <li key={v.id}>
                <button
                  onClick={() => setSelectedId(v.id)}
                  aria-current={active ? "true" : undefined}
                  className={`relative w-full rounded-[14px] px-4 py-3 text-left transition-colors duration-150 ${
                    active ? "" : "hover:bg-fog-2"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="voice-active"
                      className="absolute inset-0 rounded-[14px] border border-line bg-paper shadow-[0_8px_24px_-18px_rgb(23_26_35/0.5)]"
                    />
                  )}
                  <span className="relative flex items-center gap-2">
                    <span className="font-medium">{v.name}</span>
                    {v.isDefault && <span className="rounded-full bg-tempo-soft px-2 py-0.5 text-xs text-tempo-deep">Default</span>}
                  </span>
                  <span className="relative mt-0.5 line-clamp-2 block text-sm text-mute">{v.instructions}</span>
                </button>
              </li>
            );
          })}
          <li>
            <button
              onClick={() => setSelectedId("new")}
              className={`flex w-full items-center gap-2 rounded-[14px] border border-dashed px-4 py-3 text-left text-sm transition-colors duration-150 ${
                selectedId === "new" ? "border-tempo bg-tempo-soft/50 text-tempo-deep" : "border-line text-ink-2 hover:border-ink-2/30"
              }`}
            >
              <Plus size={16} aria-hidden /> New voice
            </button>
          </li>
        </ul>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={selectedId}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8, transition: { duration: 0.12 } }}
          >
            <VoiceEditor voice={selected} onSaved={(isNew) => isNew && setSelectedId(voices[0]?.id ?? "new")} onDeleted={() => setSelectedId(voices.find((v) => v.id !== selectedId)?.id ?? "new")} />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function VoiceEditor({
  voice,
  onSaved,
  onDeleted,
}: {
  voice?: Voice;
  onSaved: (isNew: boolean) => void;
  onDeleted: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(voice?.name ?? "");
  const [instructions, setInstructions] = useState(voice?.instructions ?? "");
  const [isDefault, setIsDefault] = useState(voice?.isDefault ?? false);
  const [error, setError] = useState<string>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      const res = await savePromptAction({ id: voice?.id ?? "", name, instructions, isDefault });
      if (res.error) {
        setError(res.error);
        return;
      }
      setError(undefined);
      toast(voice ? "Voice saved" : "Voice added", { tone: "success" });
      onSaved(!voice);
    });

  const addStarter = (line: string) =>
    setInstructions((text) => (text.trim() ? `${text.trimEnd()}\n${line}` : line));

  return (
    <form
      className="panel space-y-5 p-5 sm:p-6"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div>
        <label htmlFor="voice-name" className="field-label">
          Name
        </label>
        <input
          id="voice-name"
          name="name"
          className="field"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Casual builder…"
          autoComplete="off"
        />
      </div>
      <div>
        <label htmlFor="voice-instructions" className="field-label">
          How this voice writes
        </label>
        <textarea
          id="voice-instructions"
          name="instructions"
          className="field min-h-48 resize-y leading-relaxed"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="Tone, length, words to avoid, how to open and close…"
        />
        <div className="mt-3">
          <p className="mb-2 text-sm text-mute">Add a rule:</p>
          <div className="flex flex-wrap gap-1.5">
            {STARTERS.filter((s) => !instructions.includes(s)).map((s) => (
              <motion.button
                layout
                key={s}
                type="button"
                className="chip py-1 text-[13px]"
                onClick={() => addStarter(s)}
              >
                <Plus size={12} aria-hidden /> {s}
              </motion.button>
            ))}
          </div>
        </div>
      </div>
      <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="size-4 accent-tempo" />
        Use as my default voice
      </label>
      {error && (
        <p role="alert" className="rounded-[10px] bg-bad-soft px-3 py-2 text-sm text-bad">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-5">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Saving…" : voice ? "Save voice" : "Add voice"}
        </button>
        {voice && (
          <span className="ml-auto">
            {confirmDelete ? (
              <span className="flex items-center gap-1">
                <span className="mr-1 text-sm text-ink-2">Delete “{voice.name}”?</span>
                <button
                  type="button"
                  className="btn bg-bad px-3 py-1.5 text-white hover:bg-bad/90"
                  onClick={() =>
                    start(async () => {
                      await deletePromptAction(voice.id);
                      toast("Voice deleted");
                      onDeleted();
                    })
                  }
                >
                  Delete
                </button>
                <button type="button" className="btn-ghost px-3 py-1.5" onClick={() => setConfirmDelete(false)}>
                  Keep
                </button>
              </span>
            ) : (
              <button type="button" className="btn-danger" onClick={() => setConfirmDelete(true)}>
                Delete
              </button>
            )}
          </span>
        )}
      </div>
    </form>
  );
}

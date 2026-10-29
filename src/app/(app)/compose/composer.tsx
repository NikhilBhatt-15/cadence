"use client";

import { Lightbulb, Link2, NotebookPen, Plus, RefreshCcw, Sparkles, Square, X as XIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { listReposAction, savePostAction } from "@/app/actions";
import { CharRing } from "@/components/char-ring";
import { PlatformIcon } from "@/components/platform-icon";
import { useToast } from "@/components/toast";
import { toLocalInput } from "@/lib/dates";
import type { Repo } from "@/lib/github";
import type { PlatformSummary } from "@/lib/platforms";
import { POST_KINDS, SOURCE_TYPES, type SourceType } from "@/lib/post-options";
import { joinParts, splitParts } from "@/lib/thread";
import { Preview } from "./preview";

type Platform = PlatformSummary & { connected: boolean; handle: string | null };
export type Author = { name: string; login: string; avatarUrl: string | null };

type Props = {
  author: Author;
  post?: {
    id: string;
    content: string;
    thread: boolean;
    kind: string;
    sourceType: string;
    sourceRef: string | null;
    platforms: string[];
    status: string;
    scheduledAt: string | null;
  };
  initialAt: string | null;
  prompts: { id: string; name: string; isDefault: boolean }[];
  platforms: Platform[];
};

const SOURCE_ICONS: Record<SourceType, React.ReactNode> = {
  idea: <Lightbulb size={15} aria-hidden />,
  github: (
    <svg viewBox="0 0 16 16" width="15" height="15" fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  ),
  link: <Link2 size={15} aria-hidden />,
  notes: <NotebookPen size={15} aria-hidden />,
  rewrite: <RefreshCcw size={15} aria-hidden />,
};

function quickTimes(now: Date) {
  const at = (days: number, h: number, m = 0) =>
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, h, m);
  const inAnHour = new Date(Math.ceil((now.getTime() + 60 * 60_000) / (15 * 60_000)) * 15 * 60_000);
  const daysToMonday = ((8 - now.getDay()) % 7) || 7;
  return [
    { label: "In an hour", date: inAnHour },
    { label: "Tomorrow morning", date: at(1, 9) },
    { label: "Tomorrow evening", date: at(1, 18) },
    { label: "Monday morning", date: at(daysToMonday, 9) },
  ];
}

const noop = () => () => {};

/** Times and quick-pick chips depend on the viewer's clock and timezone, so render on the client only. */
export function Composer(props: Props) {
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  if (!mounted) {
    return (
      <div className="grid gap-8 lg:grid-cols-[5fr_7fr]" aria-busy="true" aria-label="Loading editor">
        <div className="h-[34rem] animate-pulse rounded-[18px] bg-fog-2" />
        <div className="h-[34rem] animate-pulse rounded-[18px] bg-fog-2" />
      </div>
    );
  }
  return <ComposerInner {...props} />;
}

function ComposerInner({ author, post, initialAt, prompts, platforms }: Props) {
  const router = useRouter();
  const toast = useToast();
  const usable = platforms.filter((p) => p.connected);

  const [kind, setKind] = useState(post?.kind ?? "thought");
  const [sourceType, setSourceType] = useState<SourceType>((post?.sourceType as SourceType) ?? "idea");
  const [sourceRef, setSourceRef] = useState(post?.sourceRef ?? "");
  const [sourceText, setSourceText] = useState("");
  const [promptId, setPromptId] = useState(prompts.find((p) => p.isDefault)?.id ?? prompts[0]?.id ?? "");
  const [direction, setDirection] = useState("");
  const [thread, setThread] = useState(post?.thread ?? false);
  const [parts, setParts] = useState<string[]>(() => (post ? splitParts(post.content, post.thread) : [""]));
  const [selected, setSelected] = useState<string[]>(post?.platforms ?? (usable[0] ? [usable[0].id] : []));
  const [when, setWhen] = useState(() => {
    const iso = post?.scheduledAt ?? initialAt;
    return iso ? toLocalInput(new Date(iso)) : "";
  });
  const [view, setView] = useState<"write" | "preview">("write");
  const [repos, setRepos] = useState<Repo[] | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string>();
  const [confirmNow, setConfirmNow] = useState(false);
  const [saving, startSaving] = useTransition();
  const abortRef = useRef<AbortController | null>(null);
  const dirty = useRef(false);

  const [now] = useState(() => new Date());
  const chips = useMemo(() => quickTimes(now), [now]);

  const content = thread ? joinParts(parts) : parts[0];
  const selectedPlatforms = platforms.filter((p) => selected.includes(p.id));
  const threadCapable = selectedPlatforms.some((p) => p.supportsThreads) || selected.length === 0;
  const limit = Math.min(...selectedPlatforms.map((p) => p.maxLength), Infinity);
  const effectiveLimit = Number.isFinite(limit) ? limit : 280;
  // LinkedIn joins thread parts into one post, so check the joined length too.
  const joinedTooLong = selectedPlatforms.some(
    (p) => !p.supportsThreads && parts.join("\n\n").length > p.maxLength,
  );
  const partTooLong = parts.some((p) => p.length > effectiveLimit);
  const tooLong = partTooLong || joinedTooLong;
  const empty = !content.trim();

  useEffect(() => {
    if (sourceType !== "github" || repos) return;
    listReposAction().then((res) => {
      setRepos(res.repos);
      if (res.error) setError(`Couldn't load your repos: ${res.error}`);
    });
  }, [sourceType, repos]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const updatePart = (i: number, value: string) => {
    dirty.current = true;
    setParts((ps) => ps.map((p, j) => (j === i ? value : p)));
  };

  async function generate() {
    if (streaming) {
      abortRef.current?.abort();
      return;
    }
    setError(undefined);
    setView("write");
    const strictest = [...selectedPlatforms].sort((a, b) => a.maxLength - b.maxLength)[0]?.id ?? "x";
    const controller = new AbortController();
    abortRef.current = controller;
    setStreaming(true);
    let text = "";
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          kind,
          sourceType,
          sourceRef,
          sourceText,
          promptId: promptId || undefined,
          direction,
          platform: strictest,
          thread: thread && threadCapable,
        }),
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Generation failed. Try again.");
      }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      setParts([""]);
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += value;
        const live = thread ? splitParts(text, true) : [text];
        setParts(live.length ? live : [""]);
      }
      const cleaned = text.trim().replace(/^"([\s\S]*)"$/, "$1");
      if (!cleaned) throw new Error("The AI returned nothing. Check the API key and model in Settings.");
      setParts(thread ? splitParts(cleaned, true) : [cleaned]);
      dirty.current = true;
    } catch (err) {
      if (controller.signal.aborted) {
        if (text.trim()) setParts(thread ? splitParts(text, true) : [text.trim()]);
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function save(intent: "draft" | "schedule" | "now") {
    setError(undefined);
    startSaving(async () => {
      const res = await savePostAction({
        id: post?.id,
        content,
        thread: thread && parts.length > 1,
        kind,
        sourceType,
        sourceRef: sourceType === "github" || sourceType === "link" ? sourceRef : undefined,
        platforms: selected,
        intent,
        scheduledAt: intent === "schedule" && when ? new Date(when).toISOString() : undefined,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      dirty.current = false;
      if (intent === "now") {
        if (res.status === "published") toast("Published", { tone: "success" });
        else toast("Couldn't publish. The reason is on the post.", { tone: "error" });
      } else if (intent === "schedule") {
        const label = new Intl.DateTimeFormat(undefined, {
          weekday: "long",
          hour: "numeric",
          minute: "2-digit",
        }).format(new Date(when));
        toast(`Scheduled for ${label}`, { tone: "success" });
      } else {
        toast("Draft saved");
      }
      router.push(intent === "draft" ? "/dashboard?tab=drafts" : "/dashboard");
    });
  }

  const toggleThread = () => {
    setThread((t) => {
      const next = !t;
      setParts((ps) => (next ? ps : [ps.filter(Boolean).join("\n\n")]));
      return next;
    });
  };

  const sourceInfo = SOURCE_TYPES.find((s) => s.id === sourceType)!;
  const kindInfo = POST_KINDS.find((k) => k.id === kind)!;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-8">
      {/* ---------- Brief ---------- */}
      <section
        aria-labelledby="brief-title"
        className="space-y-6 lg:sticky lg:top-24 lg:self-start"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            generate();
          }
        }}
      >
        <div>
          <h1 id="brief-title" className="font-display text-3xl font-semibold tracking-[-0.03em] [font-variation-settings:'wdth'_90]">
            {post ? "Edit post" : "What do you want to say?"}
          </h1>
          <p className="mt-1 text-ink-2">Brief the AI, or skip it and write the post yourself.</p>
        </div>

        <fieldset>
          <legend className="field-label">Kind of post</legend>
          <div className="flex flex-wrap gap-1.5">
            {POST_KINDS.map((k) => (
              <label
                key={k.id}
                className={`chip has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-tempo ${
                  kind === k.id ? "border-ink bg-ink text-white hover:border-ink hover:text-white" : ""
                }`}
              >
                <input type="radio" name="kind" value={k.id} checked={kind === k.id} onChange={() => setKind(k.id)} className="sr-only" />
                {k.label}
              </label>
            ))}
          </div>
          <p className="mt-2 text-sm text-mute">{kindInfo.hint}</p>
        </fieldset>

        <fieldset>
          <legend className="field-label">Start from</legend>
          <div className="grid grid-cols-5 gap-1 rounded-[12px] bg-fog-2 p-1">
            {SOURCE_TYPES.map((s) => (
              <label
                key={s.id}
                className="relative flex cursor-pointer flex-col items-center gap-1 rounded-[9px] px-1 py-2 text-center text-xs text-ink-2 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-tempo"
              >
                <input
                  type="radio"
                  name="source"
                  value={s.id}
                  checked={sourceType === s.id}
                  onChange={() => setSourceType(s.id)}
                  className="sr-only"
                />
                {sourceType === s.id && (
                  <motion.span layoutId="source-pill" className="absolute inset-0 rounded-[9px] bg-paper shadow-[0_1px_2px_rgb(23_26_35/0.12)]" />
                )}
                <span className={`relative ${sourceType === s.id ? "text-tempo" : ""}`}>{SOURCE_ICONS[s.id]}</span>
                <span className={`relative leading-tight ${sourceType === s.id ? "font-medium text-ink" : ""}`}>{s.label}</span>
              </label>
            ))}
          </div>
          <p className="mt-2 text-sm text-mute">{sourceInfo.hint}</p>

          <AnimatePresence mode="wait" initial={false}>
            {sourceType !== "idea" && (
            <motion.div
              key={sourceType}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4, transition: { duration: 0.1 } }}
              className="mt-3"
            >
              {sourceType === "github" && (
                <>
                  <label htmlFor="repo" className="sr-only">
                    Repository
                  </label>
                  <input
                    id="repo"
                    list="repo-options"
                    className="field"
                    placeholder={repos === null ? "Loading your repos…" : "Search your repos…"}
                    value={sourceRef}
                    onChange={(e) => setSourceRef(e.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <datalist id="repo-options">
                    {repos?.map((r) => (
                      <option key={r.fullName} value={r.fullName}>
                        {r.description ?? (r.private ? "Private" : "")}
                      </option>
                    ))}
                  </datalist>
                </>
              )}
              {sourceType === "link" && (
                <>
                  <label htmlFor="link" className="sr-only">
                    Link
                  </label>
                  <input
                    id="link"
                    type="url"
                    inputMode="url"
                    className="field"
                    placeholder="https://example.com/article…"
                    value={sourceRef}
                    onChange={(e) => setSourceRef(e.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </>
              )}
              {(sourceType === "notes" || sourceType === "rewrite") && (
                <>
                  <label htmlFor="source-text" className="sr-only">
                    {sourceType === "notes" ? "Notes" : "Post to rewrite"}
                  </label>
                  <textarea
                    id="source-text"
                    className="field min-h-28 resize-y"
                    placeholder={
                      sourceType === "notes"
                        ? "- moved auth to edge\n- p95 down from 420ms to 90ms\n- one weird cookie bug…"
                        : "Paste the post you want reworked…"
                    }
                    value={sourceText}
                    onChange={(e) => setSourceText(e.target.value)}
                  />
                </>
              )}
            </motion.div>
            )}
          </AnimatePresence>
        </fieldset>

        <div>
          <label htmlFor="direction" className="field-label">
            {sourceType === "idea" ? "The idea" : "Anything specific? (optional)"}
          </label>
          <textarea
            id="direction"
            className="field min-h-24 resize-y"
            placeholder={
              sourceType === "idea"
                ? "Most side projects die from scope, not bugs. Ship the boring version first…"
                : "Focus on the performance win, keep it under 3 sentences…"
            }
            value={direction}
            onChange={(e) => setDirection(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-44 flex-1">
            <label htmlFor="voice" className="field-label">
              Voice
            </label>
            <select id="voice" className="field" value={promptId} onChange={(e) => setPromptId(e.target.value)}>
              <option value="">No voice rules</option>
              {prompts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <label className={`chip mb-0.5 ${!threadCapable ? "pointer-events-none opacity-45" : ""} ${thread ? "border-tempo bg-tempo-soft text-tempo-deep" : ""}`}>
            <input type="checkbox" className="sr-only" checked={thread} onChange={toggleThread} disabled={!threadCapable} />
            <span aria-hidden className={`grid size-4 place-items-center rounded-[4px] border ${thread ? "border-tempo bg-tempo text-white" : "border-line"}`}>
              {thread && "✓"}
            </span>
            Write as a thread
          </label>
        </div>

        <div className="flex items-center gap-3">
          <button className={streaming ? "btn-ink flex-1 py-2.5" : "btn-primary flex-1 py-2.5"} onClick={generate}>
            {streaming ? (
              <>
                <Square size={14} fill="currentColor" aria-hidden /> Stop
              </>
            ) : (
              <>
                <Sparkles size={16} aria-hidden /> {empty ? "Draft it" : "Draft again"}
              </>
            )}
          </button>
          <kbd className="hidden text-xs text-mute sm:block">Ctrl&nbsp;+&nbsp;Enter</kbd>
        </div>
        <p className="text-sm text-mute">
          Voices live in{" "}
          <Link href="/prompts" className="text-ink underline underline-offset-2">
            Voices
          </Link>
          . The AI only uses facts from your brief and source.
        </p>
      </section>

      {/* ---------- Post ---------- */}
      <section aria-label="Post" className="panel flex flex-col overflow-hidden lg:min-h-[36rem]">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3 sm:px-5">
          <div role="tablist" aria-label="Editor view" className="flex gap-1 rounded-full bg-fog-2 p-1">
            {(["write", "preview"] as const).map((v) => (
              <button
                key={v}
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={`relative rounded-full px-3 py-1 text-sm capitalize ${view === v ? "text-ink" : "text-mute hover:text-ink"}`}
              >
                {view === v && <motion.span layoutId="view-pill" className="absolute inset-0 rounded-full bg-paper shadow-[0_1px_2px_rgb(23_26_35/0.12)]" />}
                <span className="relative">{v}</span>
              </button>
            ))}
          </div>
          <div className="ml-auto flex flex-wrap justify-end gap-1.5">
            {platforms.map((p) => {
              const on = selected.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={on}
                  disabled={!p.connected}
                  title={p.connected ? `Publish to ${p.name}` : `Connect ${p.name} in Settings first`}
                  onClick={() => setSelected((s) => (on ? s.filter((x) => x !== p.id) : [...s, p.id]))}
                  className={`chip py-1 ${on ? "border-ink bg-ink text-white hover:border-ink hover:text-white" : ""} ${
                    !p.connected ? "cursor-not-allowed opacity-45" : ""
                  }`}
                >
                  <PlatformIcon id={p.id} size={13} />
                  <span className="hidden sm:inline">{p.connected && p.handle ? (p.id === "x" ? `@${p.handle}` : p.handle) : p.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-h-[18rem] flex-1 px-4 py-5 sm:px-5">
          <AnimatePresence mode="wait" initial={false}>
            {view === "write" ? (
              <motion.ol key="write" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-0">
                <AnimatePresence initial={false}>
                  {parts.map((part, i) => (
                    <motion.li
                      key={i}
                      layout="position"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="relative"
                    >
                      {thread && i < parts.length - 1 && (
                        <span className="absolute top-9 bottom-0 left-[11px] w-0.5 bg-line" aria-hidden />
                      )}
                      <div className={`flex gap-3 ${thread ? "pb-4" : ""}`}>
                        {thread && (
                          <span className="tabular mt-2 grid size-6 shrink-0 place-items-center rounded-full bg-fog-2 text-xs font-medium text-ink-2">
                            {i + 1}
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <label htmlFor={`part-${i}`} className="sr-only">
                            {thread ? `Part ${i + 1}` : "Post text"}
                          </label>
                          <div className={streaming && i === parts.length - 1 ? "relative" : ""}>
                            <textarea
                              id={`part-${i}`}
                              value={part}
                              readOnly={streaming}
                              onChange={(e) => updatePart(i, e.target.value)}
                              placeholder={i === 0 ? "Write your post, or draft it from the brief…" : "Next part…"}
                              rows={thread ? 3 : 8}
                              className="field-sizing-content min-h-20 w-full resize-none bg-transparent text-[17px] leading-relaxed text-ink placeholder:text-mute/70 focus:outline-none"
                            />
                          </div>
                          <div className="mt-1 flex items-center justify-end gap-2">
                            {thread && parts.length > 1 && !streaming && (
                              <button
                                aria-label={`Remove part ${i + 1}`}
                                className="btn-ghost size-7 p-0 text-mute"
                                onClick={() => setParts((ps) => ps.filter((_, j) => j !== i))}
                              >
                                <XIcon size={14} />
                              </button>
                            )}
                            <CharRing length={part.length} limit={effectiveLimit} />
                          </div>
                        </div>
                      </div>
                    </motion.li>
                  ))}
                </AnimatePresence>
                {thread && !streaming && (
                  <li>
                    <button className="btn-ghost ml-9 text-tempo" onClick={() => setParts((ps) => [...ps, ""])}>
                      <Plus size={15} aria-hidden /> Add part
                    </button>
                  </li>
                )}
                {streaming && (
                  <li className="ml-1 flex items-center gap-2 pt-2 text-sm text-tempo" aria-live="polite">
                    <span className="streaming-caret">Writing</span>
                  </li>
                )}
              </motion.ol>
            ) : (
              <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Preview author={author} parts={parts.filter((p) => p.trim())} platforms={selectedPlatforms} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="space-y-4 border-t border-line bg-fog/60 px-4 py-4 sm:px-5">
          <div>
            <p className="field-label" id="when-label">
              When should it go out?
            </p>
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-labelledby="when-label">
              {chips.map((c) => {
                const value = toLocalInput(c.date);
                const on = when === value;
                return (
                  <button
                    key={c.label}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setWhen(value)}
                    className={`chip py-1 ${on ? "border-tempo bg-tempo-soft text-tempo-deep" : ""}`}
                  >
                    {c.label}
                  </button>
                );
              })}
              <label htmlFor="when" className="sr-only">
                Exact date and time
              </label>
              <input
                id="when"
                type="datetime-local"
                className="field w-auto py-1"
                value={when}
                min={toLocalInput(now)}
                onChange={(e) => setWhen(e.target.value)}
              />
            </div>
          </div>

          <AnimatePresence>
            {error && (
              <motion.p
                role="alert"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="rounded-[10px] bg-bad-soft px-3 py-2 text-sm text-bad"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>
          {tooLong && !error && (
            <p className="text-sm text-bad">
              {joinedTooLong
                ? "Too long for LinkedIn once the parts are joined. Trim it or post the thread to X only."
                : "A part is over the character limit. Trim it or split it into a thread."}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              className="btn-primary"
              disabled={saving || streaming || empty || tooLong || selected.length === 0 || !when}
              onClick={() => save("schedule")}
              title={!when ? "Pick a time first" : selected.length === 0 ? "Pick an account first" : undefined}
            >
              {saving ? "Saving…" : "Schedule"}
            </button>
            <AnimatePresence mode="wait" initial={false}>
              {confirmNow ? (
                <motion.span key="confirm" className="flex items-center gap-1" initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
                  <button className="btn-ink" disabled={saving} onClick={() => save("now")}>
                    Publish now
                  </button>
                  <button className="btn-ghost" onClick={() => setConfirmNow(false)}>
                    Cancel
                  </button>
                </motion.span>
              ) : (
                <motion.button
                  key="now"
                  className="btn-secondary"
                  disabled={saving || streaming || empty || tooLong || selected.length === 0}
                  onClick={() => setConfirmNow(true)}
                >
                  Post now
                </motion.button>
              )}
            </AnimatePresence>
            <button className="btn-ghost ml-auto" disabled={saving || streaming || empty} onClick={() => save("draft")}>
              Save draft
            </button>
          </div>
          {usable.length === 0 && (
            <p className="text-sm text-warn">
              No accounts connected. You can save drafts now and{" "}
              <Link href="/settings" className="font-medium underline underline-offset-2">
                connect X or LinkedIn
              </Link>{" "}
              to publish.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

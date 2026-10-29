"use client";

import { ExternalLink } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { deletePostAction, publishNowAction, unschedulePostAction } from "@/app/actions";
import { PlatformIcon } from "@/components/platform-icon";
import { useToast } from "@/components/toast";
import { relativeFromNow } from "@/lib/dates";
import { kindLabel, sourceLabel } from "@/lib/post-options";
import { boardTime, type BoardPost } from "./schedule";

const TABS = [
  { id: "upcoming", label: "Coming up" },
  { id: "drafts", label: "Drafts" },
  { id: "attention", label: "Needs attention" },
  { id: "published", label: "Published" },
] as const;

function filterFor(tab: string, posts: BoardPost[]) {
  switch (tab) {
    case "drafts":
      return posts.filter((p) => p.status === "draft");
    case "attention":
      return posts.filter((p) => p.status === "failed" || p.status === "publishing");
    case "published":
      return posts
        .filter((p) => p.status === "published")
        .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
    default:
      return posts
        .filter((p) => p.status === "scheduled")
        .sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""));
  }
}

const EMPTY: Record<string, { text: string; cta?: string }> = {
  upcoming: { text: "Nothing scheduled. Write something and give it a time.", cta: "Write a post" },
  drafts: { text: "No drafts. Ideas you save without a time land here.", cta: "Start a draft" },
  attention: { text: "Nothing failed. Posts that can't go out show up here with the reason." },
  published: { text: "Nothing published in the last 90 days." },
};

export function PostList({
  posts,
  now,
  tab,
  onTab,
}: {
  posts: BoardPost[];
  now: Date;
  tab: string;
  onTab: (tab: string) => void;
}) {
  const active = TABS.some((t) => t.id === tab) ? tab : "upcoming";
  const list = filterFor(active, posts);
  const attention = filterFor("attention", posts).length;

  return (
    <section aria-label="Posts">
      <div role="tablist" aria-label="Post lists" className="mb-4 flex gap-1 overflow-x-auto border-b border-line [scrollbar-width:none]">
        {TABS.map((t) => {
          const selected = t.id === active;
          const count = filterFor(t.id, posts).length;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={selected}
              onClick={() => onTab(t.id)}
              className={`relative flex items-center gap-2 px-3 pt-2 pb-3 text-[15px] whitespace-nowrap transition-colors duration-150 ${
                selected ? "text-ink" : "text-mute hover:text-ink"
              }`}
            >
              {t.label}
              {count > 0 && (
                <span
                  className={`tabular rounded-full px-1.5 text-xs ${
                    t.id === "attention" && attention > 0 ? "bg-bad text-white" : "bg-fog-2 text-ink-2"
                  }`}
                >
                  {count}
                </span>
              )}
              {selected && <motion.span layoutId="tab-underline" className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-ink" />}
            </button>
          );
        })}
      </div>

      {list.length === 0 ? (
        <div className="rounded-[14px] border border-dashed border-line px-6 py-10 text-center">
          <p className="text-ink-2">{EMPTY[active].text}</p>
          {EMPTY[active].cta && (
            <Link href="/compose" className="btn-secondary mt-4">
              {EMPTY[active].cta}
            </Link>
          )}
        </div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-[14px] border border-line bg-paper">
          <AnimatePresence initial={false}>
            {list.map((p) => (
              <motion.li
                key={p.id}
                layout="position"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, height: 0, transition: { duration: 0.2 } }}
              >
                <PostRow post={p} now={now} />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}

function PostRow({ post, now }: { post: BoardPost; now: Date }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const time = boardTime(post);
  const parts = post.thread ? post.content.split(/\n\s*-{3,}\s*\n/) : [post.content];

  const publish = () =>
    start(async () => {
      const res = await publishNowAction(post.id);
      if (res.status === "published") toast("Published", { tone: "success" });
      else toast("Couldn't publish. The reason is on the post.", { tone: "error" });
    });

  return (
    <div className="grid gap-3 px-4 py-4 sm:grid-cols-[9rem_1fr_auto] sm:gap-5 sm:px-5">
      <div className="text-sm">
        {time ? (
          <>
            <p className="tabular font-medium text-ink">
              {new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(time)}
            </p>
            <p className="tabular text-mute">
              {new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(time)}
              {post.status === "scheduled" && <span className="block text-xs">{relativeFromNow(time, now)}</span>}
            </p>
          </>
        ) : (
          <p className="text-mute">
            Edited {relativeFromNow(new Date(post.updatedAt), now)}
          </p>
        )}
      </div>

      <div className="min-w-0">
        <div className="mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-mute">
          <span className="flex items-center gap-1.5">
            {post.platforms.length ? post.platforms.map((p) => <PlatformIcon key={p} id={p} size={12} />) : "No account picked"}
          </span>
          <span>{kindLabel(post.kind)}</span>
          {post.thread && <span>Thread of {parts.length}</span>}
          {post.sourceType !== "idea" && (
            <span className="truncate">
              From {sourceLabel(post.sourceType).toLowerCase()}
              {post.sourceRef ? `: ${post.sourceRef}` : ""}
            </span>
          )}
        </div>
        <p className="line-clamp-3 break-words whitespace-pre-line text-[15px] leading-relaxed">{parts[0]}</p>
        {post.results && (
          <ul className="mt-2 space-y-1 text-sm">
            {Object.entries(post.results).map(([platform, r]) => (
              <li key={platform} className={`flex items-start gap-1.5 ${r.ok ? "text-ok" : "text-bad"}`}>
                <span className="mt-0.5">
                  <PlatformIcon id={platform} size={12} />
                </span>
                {r.ok ? (
                  <a href={r.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2">
                    View post <ExternalLink size={12} aria-hidden />
                  </a>
                ) : (
                  <span className="line-clamp-2 break-words">{r.error}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap items-start gap-1 sm:max-w-72 sm:justify-end">
        {post.status !== "published" && post.status !== "publishing" && (
          <>
            <Link href={`/compose?id=${post.id}`} className="btn-secondary px-3 py-1.5">
              Edit
            </Link>
            <button className="btn-ghost px-3 py-1.5" disabled={pending || post.platforms.length === 0} onClick={publish}>
              {pending ? "Publishing…" : post.status === "failed" ? "Retry now" : "Post now"}
            </button>
          </>
        )}
        {post.status === "scheduled" && (
          <button
            className="btn-ghost px-3 py-1.5"
            disabled={pending}
            onClick={() =>
              start(async () => {
                await unschedulePostAction(post.id);
                toast("Moved to drafts");
              })
            }
          >
            Unschedule
          </button>
        )}
        <AnimatePresence mode="wait" initial={false}>
          {confirming ? (
            <motion.span key="confirm" className="flex gap-1" initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
              <button
                className="btn px-3 py-1.5 bg-bad text-white hover:bg-bad/90"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    await deletePostAction(post.id);
                    toast(post.status === "published" ? "Removed from Cadence. The live post stays up." : "Deleted");
                  })
                }
              >
                Delete
              </button>
              <button className="btn-ghost px-3 py-1.5" onClick={() => setConfirming(false)}>
                Keep
              </button>
            </motion.span>
          ) : (
            <motion.button
              key="delete"
              className="btn-danger px-3 py-1.5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirming(true)}
            >
              Delete
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

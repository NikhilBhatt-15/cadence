"use client";

import { ChevronLeft, ChevronRight, GripVertical, Minus, Plus } from "lucide-react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { reschedulePostAction, setWeeklyGoalAction } from "@/app/actions";
import { PlatformIcon } from "@/components/platform-icon";
import { useToast } from "@/components/toast";
import type { PublishResult } from "@/lib/db/schema";
import { DAY_MS, addDays, relativeFromNow, sameDay, startOfWeek, withTimeOf } from "@/lib/dates";
import { kindLabel } from "@/lib/post-options";
import { PostList } from "./post-list";

export type BoardPost = {
  id: string;
  content: string;
  thread: boolean;
  kind: string;
  sourceType: string;
  sourceRef: string | null;
  platforms: string[];
  status: "draft" | "scheduled" | "publishing" | "published" | "failed";
  scheduledAt: string | null;
  publishedAt: string | null;
  updatedAt: string;
  results: Record<string, PublishResult> | null;
};

const noop = () => () => {};
const useMounted = () => useSyncExternalStore(noop, () => true, () => false);

function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/** When a post sits on the board: publish time for published posts, scheduled time otherwise. */
export function boardTime(p: BoardPost) {
  const iso = p.status === "published" ? (p.publishedAt ?? p.scheduledAt) : p.scheduledAt;
  return iso ? new Date(iso) : null;
}

const firstLine = (content: string) => content.split(/\n\s*-{3,}\s*\n/)[0];

export function Schedule({
  posts: serverPosts,
  weeklyGoal,
  firstName,
  hasConnections,
}: {
  posts: BoardPost[];
  weeklyGoal: number;
  firstName: string;
  hasConnections: boolean;
}) {
  const mounted = useMounted();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const toast = useToast();
  const now = useNow();
  const weekOffset = Number(params.get("week") ?? 0) || 0;

  // Local copy for optimistic drag-and-drop; resync whenever the server sends fresh data.
  const [posts, setPosts] = useState(serverPosts);
  const [synced, setSynced] = useState(serverPosts);
  if (synced !== serverPosts) {
    setSynced(serverPosts);
    setPosts(serverPosts);
  }

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value === null) next.delete(key);
    else next.set(key, value);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  async function move(post: BoardPost, target: Date) {
    const before = posts;
    const iso = target.toISOString();
    setPosts((list) => list.map((p) => (p.id === post.id ? { ...p, scheduledAt: iso, status: "scheduled" } : p)));
    const res = await reschedulePostAction(post.id, iso);
    if (res.error) {
      setPosts(before);
      toast(res.error, { tone: "error" });
      return;
    }
    const label = new Intl.DateTimeFormat(undefined, { weekday: "long", hour: "numeric", minute: "2-digit" }).format(
      target,
    );
    toast(post.status === "draft" ? `Scheduled for ${label}` : `Moved to ${label}`, {
      tone: "success",
      action:
        post.scheduledAt && boardTime(post)! > new Date()
          ? { label: "Undo", onClick: () => void move({ ...post, status: "scheduled" }, new Date(post.scheduledAt!)) }
          : undefined,
    });
  }

  if (!mounted) return <ScheduleSkeleton />;

  const weekStart = startOfWeek(now, weekOffset);
  const weekEnd = addDays(weekStart, 7);
  const inWeek = posts.filter((p) => {
    const t = boardTime(p);
    return t && p.status !== "draft" && t >= weekStart && t < weekEnd;
  });
  const drafts = posts.filter((p) => p.status === "draft");
  const counted = inWeek.filter((p) => p.status === "scheduled" || p.status === "published").length;
  const next = posts
    .filter((p) => p.status === "scheduled" && p.scheduledAt && new Date(p.scheduledAt) > now)
    .sort((a, b) => a.scheduledAt!.localeCompare(b.scheduledAt!))[0];

  const rangeLabel = `${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(weekStart)} – ${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(addDays(weekStart, 6))}`;
  const weekTitle = weekOffset === 0 ? "This week" : weekOffset === 1 ? "Next week" : weekOffset === -1 ? "Last week" : rangeLabel;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-mute">{greeting(now)}, {firstName}.</p>
          <h1 className="mt-1 font-display text-4xl font-semibold tracking-[-0.03em] [font-variation-settings:'wdth'_90]">
            {next ? (
              <>
                Next post goes out <span className="whitespace-nowrap">{relativeFromNow(new Date(next.scheduledAt!), now)}</span>
              </>
            ) : (
              "Nothing queued yet"
            )}
          </h1>
          {next && (
            <p className="mt-2 line-clamp-1 max-w-xl text-ink-2">
              <span className="mr-2 inline-flex translate-y-0.5 gap-1 text-mute">
                {next.platforms.map((p) => (
                  <PlatformIcon key={p} id={p} />
                ))}
              </span>
              {firstLine(next.content)}
            </p>
          )}
          {!hasConnections && (
            <p className="mt-3 text-sm text-warn">
              No accounts connected, so scheduled posts can&apos;t go out yet.{" "}
              <Link href="/settings" className="font-medium underline underline-offset-2">
                Connect X or LinkedIn
              </Link>
            </p>
          )}
        </div>
        <CadenceMeter count={counted} goal={weeklyGoal} weekLabel={weekOffset === 0 ? "this week" : "that week"} />
      </div>

      <section aria-labelledby="week-title" className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="week-title" className="font-display text-xl font-semibold tracking-tight">
            {weekTitle}
          </h2>
          <span className="tabular text-sm text-mute">{weekOffset === 0 || Math.abs(weekOffset) === 1 ? rangeLabel : ""}</span>
          <div className="ml-auto flex items-center gap-1">
            <button aria-label="Previous week" className="btn-ghost px-2" onClick={() => setParam("week", String(weekOffset - 1))}>
              <ChevronLeft size={18} />
            </button>
            <button
              className="btn-secondary px-3 py-1.5"
              disabled={weekOffset === 0}
              onClick={() => setParam("week", null)}
            >
              Today
            </button>
            <button aria-label="Next week" className="btn-ghost px-2" onClick={() => setParam("week", String(weekOffset + 1))}>
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <LayoutGroup>
          {drafts.length > 0 && <DraftTray drafts={drafts} />}
          <WeekBoard weekStart={weekStart} posts={inWeek} now={now} onDrop={move} allPosts={posts} />
        </LayoutGroup>
      </section>

      <PostList posts={posts} now={now} tab={params.get("tab") ?? "upcoming"} onTab={(t) => setParam("tab", t === "upcoming" ? null : t)} />
    </div>
  );
}

function greeting(now: Date) {
  const h = now.getHours();
  return h < 5 ? "Up late" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function CadenceMeter({ count, goal, weekLabel }: { count: number; goal: number; weekLabel: string }) {
  const [pending, start] = useTransition();
  const [localGoal, setLocalGoal] = useState(goal);
  const change = (delta: number) => {
    const next = Math.max(1, Math.min(21, localGoal + delta));
    setLocalGoal(next);
    start(() => setWeeklyGoalAction(next));
  };
  const bars = Math.max(localGoal, count);

  return (
    <div className="panel flex items-center gap-5 px-5 py-4">
      <div>
        <p className="tabular font-display text-3xl font-semibold tracking-tight">
          {count}
          <span className="text-mute">/{localGoal}</span>
        </p>
        <p className="text-sm text-mute">posts {weekLabel}</p>
      </div>
      <div className="flex h-10 items-end gap-1" aria-hidden>
        {Array.from({ length: bars }, (_, i) => (
          <motion.span
            key={i}
            className="w-2 rounded-full"
            initial={false}
            animate={{
              height: 14 + Math.round((i / Math.max(bars - 1, 1)) * 26),
              backgroundColor: i < count ? (i >= localGoal ? "var(--color-beat)" : "var(--color-tempo)") : "var(--color-fog-2)",
            }}
            transition={{ delay: i * 0.03 }}
          />
        ))}
      </div>
      <div className="flex flex-col gap-1 border-l border-line pl-4">
        <span className="text-xs text-mute">Weekly goal</span>
        <div className="flex items-center gap-1">
          <button aria-label="Lower weekly goal" className="btn-ghost size-7 p-0" disabled={pending || localGoal <= 1} onClick={() => change(-1)}>
            <Minus size={14} />
          </button>
          <span className="tabular w-5 text-center text-sm font-medium">{localGoal}</span>
          <button aria-label="Raise weekly goal" className="btn-ghost size-7 p-0" disabled={pending || localGoal >= 21} onClick={() => change(1)}>
            <Plus size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

function DraftTray({ drafts }: { drafts: BoardPost[] }) {
  return (
    <div className="flex items-center gap-3 overflow-x-auto rounded-[14px] border border-dashed [scrollbar-width:thin] border-line bg-paper/50 p-2 pl-4">
      <p className="shrink-0 text-sm text-mute">
        {drafts.length} draft{drafts.length === 1 ? "" : "s"}. Drag onto a day to schedule.
      </p>
      <div className="flex gap-2">
        {drafts.slice(0, 8).map((d) => (
          <motion.div key={d.id} layoutId={d.id}>
            <div
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("text/x-cadence-post", d.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              className="flex max-w-56 cursor-grab items-center gap-1.5 rounded-full border border-line bg-paper py-1.5 pr-3 pl-2 text-sm active:cursor-grabbing"
            >
              <GripVertical size={14} className="shrink-0 text-mute" aria-hidden />
              <Link href={`/compose?id=${d.id}`} className="truncate hover:underline" draggable={false}>
                {firstLine(d.content)}
              </Link>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function WeekBoard({
  weekStart,
  posts,
  allPosts,
  now,
  onDrop,
}: {
  weekStart: Date;
  posts: BoardPost[];
  allPosts: BoardPost[];
  now: Date;
  onDrop: (post: BoardPost, target: Date) => void;
}) {
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const [over, setOver] = useState<number | null>(null);

  return (
    <div className="panel grid overflow-hidden md:grid-cols-7">
      {days.map((day, i) => {
        const isToday = sameDay(day, now);
        const isPast = day.getTime() + DAY_MS <= now.getTime();
        const list = posts
          .filter((p) => sameDay(boardTime(p)!, day))
          .sort((a, b) => boardTime(a)!.getTime() - boardTime(b)!.getTime());
        const nowIndex = isToday ? list.findIndex((p) => boardTime(p)! > now) : -1;
        const addAt = isToday ? new Date(Math.ceil((now.getTime() + 30 * 60_000) / (30 * 60_000)) * 30 * 60_000) : withTimeOf(day, new Date(2000, 0, 1, 9, 0));

        return (
          <div
            key={day.toISOString()}
            onDragOver={(e) => {
              if (isPast || !e.dataTransfer.types.includes("text/x-cadence-post")) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setOver(i);
            }}
            onDragLeave={() => setOver((o) => (o === i ? null : o))}
            onDrop={(e) => {
              e.preventDefault();
              setOver(null);
              const id = e.dataTransfer.getData("text/x-cadence-post");
              const post = allPosts.find((p) => p.id === id);
              if (!post) return;
              const time = post.scheduledAt ? new Date(post.scheduledAt) : new Date(2000, 0, 1, 9, 0);
              let target = withTimeOf(day, time);
              if (target <= now) target = addAt;
              if (post.scheduledAt && target.getTime() === new Date(post.scheduledAt).getTime()) return;
              onDrop(post, target);
            }}
            className={`group/day relative flex min-h-36 flex-col border-line transition-colors duration-150 md:min-h-[22rem] ${
              i < 6 ? "border-b md:border-r md:border-b-0" : ""
            } ${isToday ? "bg-tempo-soft/35" : ""} ${isPast ? "bg-fog/50" : ""} ${over === i ? "bg-tempo-soft/70" : ""}`}
          >
            <div className="flex items-baseline justify-between px-3 pt-3 pb-2">
              <span className={`text-sm ${isToday ? "font-semibold text-tempo" : isPast ? "text-mute" : "text-ink-2"}`}>
                {new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(day)}
              </span>
              <span
                className={`tabular grid size-7 place-items-center rounded-full font-display text-sm ${
                  isToday ? "bg-tempo font-semibold text-white" : isPast ? "text-mute" : "text-ink"
                }`}
              >
                {day.getDate()}
              </span>
            </div>

            <div className="flex flex-1 flex-col gap-2 px-2 pb-2">
              {list.map((p, idx) => (
                <div key={p.id} className="contents">
                  {idx === nowIndex && <NowMarker now={now} />}
                  <BeatCard post={p} draggable={p.status === "scheduled" || p.status === "failed"} />
                </div>
              ))}
              {isToday && (nowIndex === -1 || list.length === 0) && <NowMarker now={now} />}
              {!isPast && (
                <Link
                  href={`/compose?at=${encodeURIComponent(addAt.toISOString())}`}
                  className={`mt-auto flex items-center justify-center gap-1 rounded-[10px] border border-dashed border-transparent py-2 text-sm text-mute transition-[opacity,border-color,color] duration-150 hover:border-line hover:text-ink focus-visible:opacity-100 ${
                    list.length ? "opacity-0 group-hover/day:opacity-100" : "opacity-100"
                  }`}
                >
                  <Plus size={14} aria-hidden /> Add
                </Link>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function NowMarker({ now }: { now: Date }) {
  return (
    <motion.div layout className="relative flex items-center gap-1.5 py-0.5" aria-label="Now">
      <span className="relative flex size-2.5">
        <span className="absolute inset-0 animate-ping rounded-full bg-beat/60" />
        <span className="relative size-2.5 rounded-full bg-beat" />
      </span>
      <span className="h-px flex-1 bg-beat" />
      <span className="tabular text-[11px] font-medium text-beat">
        {new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(now)}
      </span>
    </motion.div>
  );
}

const STATUS_RING: Record<BoardPost["status"], string> = {
  draft: "",
  scheduled: "border-line",
  publishing: "border-warn/50",
  published: "border-transparent bg-fog",
  failed: "border-bad/50 bg-bad-soft/60",
};

function BeatCard({ post, draggable }: { post: BoardPost; draggable: boolean }) {
  const time = boardTime(post)!;
  const firstResult = post.results ? Object.values(post.results).find((r) => r.ok) : undefined;
  const href = post.status === "published" && firstResult?.ok ? firstResult.url : `/compose?id=${post.id}`;
  const external = post.status === "published";

  return (
    <motion.div layoutId={post.id} transition={{ type: "spring", stiffness: 500, damping: 40 }}>
      <div
        draggable={draggable}
        onDragStart={(e) => {
          e.dataTransfer.setData("text/x-cadence-post", post.id);
          e.dataTransfer.effectAllowed = "move";
        }}
        className={`group/card rounded-[12px] border bg-paper p-2.5 transition-[box-shadow,border-color] duration-150 hover:border-ink-2/30 hover:shadow-[0_8px_20px_-14px_rgb(23_26_35/0.5)] ${
          STATUS_RING[post.status]
        } ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
      >
        <Link
          href={href}
          draggable={false}
          {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
          className="block focus-visible:outline-offset-4"
        >
          <div className="mb-1 flex items-center gap-1.5 text-[11px] text-mute">
            <span className="tabular font-medium text-ink-2">
              {new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(time)}
            </span>
            <span className="flex gap-1">
              {post.platforms.map((p) => (
                <PlatformIcon key={p} id={p} size={11} />
              ))}
            </span>
            <StatusDot status={post.status} />
          </div>
          <p className={`line-clamp-3 text-[13px] leading-snug ${post.status === "published" ? "text-ink-2" : "text-ink"}`}>
            {firstLine(post.content)}
          </p>
          <p className="mt-1 text-[11px] text-mute">
            {kindLabel(post.kind)}
            {post.thread ? ", thread" : ""}
          </p>
        </Link>
      </div>
    </motion.div>
  );
}

export function StatusDot({ status }: { status: BoardPost["status"] }) {
  const map = {
    draft: { label: "Draft", cls: "text-mute" },
    scheduled: { label: "Scheduled", cls: "text-tempo" },
    publishing: { label: "Publishing", cls: "text-warn" },
    published: { label: "Published", cls: "text-ok" },
    failed: { label: "Failed", cls: "text-bad" },
  }[status];
  return (
    <span className={`ml-auto inline-flex items-center gap-1 ${map.cls}`}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={status}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0 }}
          className="size-1.5 rounded-full bg-current"
          aria-hidden
        />
      </AnimatePresence>
      <span className="sr-only">{map.label}</span>
    </span>
  );
}

function ScheduleSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading schedule">
      <div className="h-24 max-w-xl animate-pulse rounded-[14px] bg-fog-2" />
      <div className="h-[24rem] animate-pulse rounded-[18px] bg-fog-2" />
    </div>
  );
}

"use client";

import { motion, useReducedMotion } from "motion/react";
import { PlatformIcon } from "@/components/platform-icon";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const START_HOUR = 7;
const END_HOUR = 23;

const BEATS = [
  { day: 0, hour: 9, platform: "x", kind: "Project update", text: "taskmon 1.4 is out: per-process GPU usage, finally." },
  { day: 1, hour: 18.5, platform: "x", kind: "Thread", text: "How I cut cold start from 900ms to 140ms (1/5)" },
  { day: 2, hour: 12, platform: "linkedin", kind: "Story", text: "The bug that only happened on Tuesdays." },
  { day: 3, hour: 8.5, platform: "x", kind: "Tip", text: "git worktree is the fastest way to review a PR without stashing." },
  { day: 4, hour: 16, platform: "linkedin", kind: "Announcement", text: "Open-sourcing the scheduler behind this app." },
  { day: 6, hour: 19, platform: "x", kind: "Question", text: "What's one tool you'd never give up?" },
];

const yFor = (hour: number) => ((hour - START_HOUR) / (END_HOUR - START_HOUR)) * 100;

export function RhythmTrack() {
  const reduce = useReducedMotion();
  // The playhead sweeps once, then rests on "Thursday afternoon".
  const restX = ((3 + 0.6) / 7) * 100;

  return (
    <div className="panel relative overflow-hidden p-0" aria-label="Example week of scheduled posts" role="img">
      <div className="grid grid-cols-7 border-b border-line text-[13px] text-mute">
        {DAYS.map((d, i) => (
          <div key={d} className={`px-1 py-2.5 text-center sm:px-3 sm:text-left ${i === 3 ? "font-semibold text-ink" : ""}`}>
            {d}
          </div>
        ))}
      </div>

      <div className="relative h-[240px] sm:h-[380px]">
        <div className="absolute inset-0 grid grid-cols-7" aria-hidden>
          {DAYS.map((d, i) => (
            <div key={d} className={`border-line ${i < 6 ? "border-r" : ""} ${i === 3 ? "bg-tempo-soft/40" : ""}`} />
          ))}
        </div>
        {[9, 12, 15, 18, 21].map((h) => (
          <div
            key={h}
            className="absolute inset-x-0 border-t border-dashed border-line/80"
            style={{ top: `${yFor(h)}%` }}
            aria-hidden
          >
            <span className="tabular absolute -top-2.5 right-2 bg-paper px-1 text-[11px] text-mute/80">
              {h > 12 ? h - 12 : h}
              {h >= 12 ? "pm" : "am"}
            </span>
          </div>
        ))}

        {BEATS.map((b, i) => (
          <motion.div
            key={i}
            className="absolute px-1.5"
            style={{ left: `${(b.day / 7) * 100}%`, width: `${100 / 7}%`, top: `${yFor(b.hour)}%` }}
            initial={reduce ? false : { opacity: 0, y: -28, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: reduce ? 0 : 0.35 + i * 0.22, type: "spring", stiffness: 420, damping: 24 }}
          >
            <div className="mx-auto size-3 -translate-y-1/2 rounded-full bg-tempo ring-4 ring-tempo/15 sm:hidden" />
            <div className="hidden -translate-y-1/2 rounded-[10px] sm:block border border-line bg-paper p-2 shadow-[0_6px_16px_-10px_rgb(23_26_35/0.35)]">
              <div className="mb-1 flex items-center gap-1.5 text-[11px] text-mute">
                <PlatformIcon id={b.platform} size={11} />
                <span className="truncate">{b.kind}</span>
              </div>
              <p className="line-clamp-3 text-[12px] leading-snug text-ink">{b.text}</p>
            </div>
          </motion.div>
        ))}

        <motion.div
          className="absolute inset-y-0 w-px bg-beat"
          initial={reduce ? { left: `${restX}%` } : { left: "0%" }}
          animate={{ left: [`0%`, `100%`, `${restX}%`] }}
          transition={reduce ? { duration: 0 } : { duration: 3.2, times: [0, 0.72, 1], ease: [0.45, 0, 0.2, 1], delay: 0.2 }}
          aria-hidden
        >
          <span className="absolute -top-1 -left-[5px] size-[11px] rounded-full bg-beat ring-4 ring-beat/20" />
        </motion.div>
      </div>
    </div>
  );
}

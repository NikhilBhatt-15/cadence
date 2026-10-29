"use client";

import { motion } from "motion/react";

/** X-style remaining-characters ring. Shows the count once you get close to the limit. */
export function CharRing({ length, limit }: { length: number; limit: number }) {
  const r = 9;
  const circumference = 2 * Math.PI * r;
  const ratio = Math.min(length / limit, 1);
  const remaining = limit - length;
  const color = remaining < 0 ? "var(--color-bad)" : remaining <= 20 ? "var(--color-warn)" : "var(--color-tempo)";
  const showCount = remaining <= 20;

  return (
    <span
      className="inline-flex items-center gap-1.5"
      aria-label={`${length} of ${limit} characters`}
      role="status"
    >
      {showCount && (
        <span className="tabular text-xs font-medium" style={{ color }}>
          {remaining}
        </span>
      )}
      <motion.svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        animate={{ scale: showCount ? 1.15 : 1 }}
        aria-hidden
      >
        <circle cx="12" cy="12" r={r} fill="none" stroke="var(--color-line)" strokeWidth="2.5" />
        <motion.circle
          cx="12"
          cy="12"
          r={r}
          fill="none"
          strokeWidth="2.5"
          strokeLinecap="round"
          transform="rotate(-90 12 12)"
          strokeDasharray={circumference}
          animate={{ strokeDashoffset: circumference * (1 - ratio), stroke: color }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        />
      </motion.svg>
    </span>
  );
}

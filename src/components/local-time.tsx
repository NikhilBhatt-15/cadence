"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

type Format = "full" | "time" | "day";

const OPTIONS: Record<Format, Intl.DateTimeFormatOptions> = {
  full: { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" },
  time: { hour: "numeric", minute: "2-digit" },
  day: { weekday: "short", month: "short", day: "numeric" },
};

/** Renders a timestamp in the viewer's timezone (server render falls back to UTC). */
export function LocalTime({ iso, format = "full" }: { iso: string; format?: Format }) {
  const text = useSyncExternalStore(
    subscribe,
    () => new Intl.DateTimeFormat(undefined, OPTIONS[format]).format(new Date(iso)),
    () => new Intl.DateTimeFormat("en-US", { ...OPTIONS[format], timeZone: "UTC" }).format(new Date(iso)),
  );
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {text}
    </time>
  );
}

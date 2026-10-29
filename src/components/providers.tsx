"use client";

import { MotionConfig } from "motion/react";
import { ToastProvider } from "./toast";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={{ type: "spring", stiffness: 520, damping: 38 }}>
      <ToastProvider>{children}</ToastProvider>
    </MotionConfig>
  );
}

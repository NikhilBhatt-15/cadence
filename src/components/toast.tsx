"use client";

import { AnimatePresence, motion } from "motion/react";
import { createContext, useCallback, useContext, useRef, useState } from "react";

type Tone = "neutral" | "success" | "error";
type Toast = { id: number; message: string; tone: Tone; action?: { label: string; onClick: () => void } };
type ShowToast = (message: string, opts?: { tone?: Tone; action?: Toast["action"]; duration?: number }) => void;

const ToastContext = createContext<ShowToast>(() => {});

export const useToast = () => useContext(ToastContext);

const DOT: Record<Tone, string> = {
  neutral: "bg-white/60",
  success: "bg-[#5ee0a0]",
  error: "bg-[#ff8a8a]",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const show = useCallback<ShowToast>(
    (message, { tone = "neutral", action, duration = 4500 } = {}) => {
      const id = ++nextId.current;
      setToasts((t) => [...t.slice(-2), { id, message, tone, action }]);
      setTimeout(() => dismiss(id), duration);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98, transition: { duration: 0.15 } }}
              className="pointer-events-auto flex max-w-[min(32rem,100%)] items-center gap-3 rounded-full bg-ink py-2 pr-2 pl-4 text-sm text-white shadow-[0_12px_32px_-12px_rgb(23_26_35/0.55)]"
            >
              <span className={`size-2 shrink-0 rounded-full ${DOT[t.tone]}`} aria-hidden />
              <span className="min-w-0 py-1">{t.message}</span>
              {t.action ? (
                <button
                  className="rounded-full px-3 py-1 font-medium text-[#b9b8ff] hover:bg-white/10"
                  onClick={() => {
                    t.action!.onClick();
                    dismiss(t.id);
                  }}
                >
                  {t.action.label}
                </button>
              ) : (
                <button
                  aria-label="Dismiss"
                  className="rounded-full px-2 py-1 text-white/60 hover:bg-white/10 hover:text-white"
                  onClick={() => dismiss(t.id)}
                >
                  ✕
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

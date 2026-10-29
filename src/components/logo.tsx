/** Cadence mark: four beats of rising height, the last one accented. */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg viewBox="0 0 22 18" width="22" height="18" aria-hidden>
        <rect x="0" y="10" width="4" height="8" rx="2" fill="var(--color-ink)" />
        <rect x="6" y="6" width="4" height="12" rx="2" fill="var(--color-ink)" />
        <rect x="12" y="2" width="4" height="16" rx="2" fill="var(--color-ink)" />
        <rect x="18" y="0" width="4" height="18" rx="2" fill="var(--color-tempo)" />
      </svg>
      <span className="font-display text-[19px] font-semibold tracking-[-0.02em] [font-variation-settings:'wdth'_92]">
        Cadence
      </span>
    </span>
  );
}

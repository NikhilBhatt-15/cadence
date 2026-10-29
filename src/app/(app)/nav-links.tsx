"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Schedule" },
  { href: "/compose", label: "Write" },
  { href: "/prompts", label: "Voices" },
  { href: "/settings", label: "Settings" },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="-mx-1 flex min-w-0 gap-0.5 overflow-x-auto text-[15px] [scrollbar-width:none]">
      {LINKS.map((l) => {
        const active = pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`relative rounded-full px-3 py-1.5 transition-colors duration-150 ${
              active ? "text-ink" : "text-mute hover:text-ink"
            }`}
          >
            {active && (
              <motion.span
                layoutId="nav-pill"
                className="absolute inset-0 rounded-full bg-paper shadow-[0_1px_0_rgb(23_26_35/0.06),0_0_0_1px_var(--color-line)]"
              />
            )}
            <span className="relative">{l.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

import { linkedin } from "./linkedin";
import type { PlatformAdapter } from "./types";
import { x } from "./x";

// Register new platforms here.
export const platforms: PlatformAdapter[] = [x, linkedin];

export function getPlatform(id: string) {
  return platforms.find((p) => p.id === id);
}

export function platformSummaries() {
  return platforms.map((p) => ({
    id: p.id,
    name: p.name,
    maxLength: p.maxLength,
    supportsThreads: p.supportsThreads,
    configured: p.isConfigured(),
  }));
}

export type PlatformSummary = ReturnType<typeof platformSummaries>[number];
export type { PlatformAdapter };

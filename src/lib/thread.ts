export const THREAD_SEPARATOR = "\n\n---\n\n";

export function splitParts(content: string, thread: boolean): string[] {
  if (!thread) return [content];
  return content
    .split(/\n\s*-{3,}\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function joinParts(parts: string[]) {
  return parts.map((p) => p.trim()).join(THREAD_SEPARATOR);
}

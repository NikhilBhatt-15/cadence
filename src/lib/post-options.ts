// Shared between client and server: what a post can be about and where it starts from.

export const POST_KINDS = [
  { id: "thought", label: "Thought", hint: "An observation or opinion, in your own words." },
  { id: "update", label: "Project update", hint: "What you shipped or changed, and why it matters." },
  { id: "tip", label: "Tip", hint: "One practical, specific thing others can use today." },
  { id: "story", label: "Story", hint: "A short narrative: a bug, a lesson, a turning point." },
  { id: "announcement", label: "Announcement", hint: "A launch, release or milestone." },
  { id: "question", label: "Question", hint: "Ask your audience something worth answering." },
  { id: "hot-take", label: "Hot take", hint: "A sharp, arguable opinion, stated plainly." },
] as const;

export const SOURCE_TYPES = [
  { id: "idea", label: "Idea", hint: "Start from a sentence about what you want to say." },
  { id: "github", label: "GitHub repo", hint: "Uses the README, recent commits and latest release." },
  { id: "link", label: "Link", hint: "An article, docs page or anything public." },
  { id: "notes", label: "Notes", hint: "Paste rough bullets; get a finished post." },
  { id: "rewrite", label: "Rewrite", hint: "Paste an existing post to rework or repurpose it." },
] as const;

export type PostKind = (typeof POST_KINDS)[number]["id"];
export type SourceType = (typeof SOURCE_TYPES)[number]["id"];

export const kindLabel = (id: string) => POST_KINDS.find((k) => k.id === id)?.label ?? id;
export const sourceLabel = (id: string) => SOURCE_TYPES.find((s) => s.id === id)?.label ?? id;

import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { getUser } from "@/lib/session";
import { RhythmTrack } from "./rhythm-track";

const ERRORS: Record<string, string> = {
  oauth_state: "That sign-in link expired. Sign in again.",
  github_token: "GitHub didn't finish signing you in. Try again.",
  github_profile: "Couldn't read your GitHub profile. Try again in a minute.",
};

const STEPS = [
  {
    title: "Brief it",
    body: "Start from a one-line idea, rough notes, a link you liked, or one of your GitHub repos.",
  },
  {
    title: "Shape it",
    body: "The AI drafts in your voice using the style rules you write. Edit freely, split it into a thread, preview it.",
  },
  {
    title: "Let it go out",
    body: "Drop it on your week. Cadence publishes to X and LinkedIn on time and tells you if anything fails.",
  },
];

export default async function Home({ searchParams }: PageProps<"/">) {
  if (await getUser()) redirect("/dashboard");
  const { error } = await searchParams;
  const message = typeof error === "string" ? ERRORS[error] : undefined;

  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Logo />
        <a href="/api/auth/github/login" className="btn-ghost">
          Sign in
        </a>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6">
        <section className="pt-10 pb-14 sm:pt-16">
          <h1 className="max-w-4xl font-display text-[clamp(2.6rem,6.4vw,5.2rem)] leading-[0.95] font-semibold tracking-[-0.035em] [font-variation-settings:'wdth'_88,'opsz'_96]">
            Keep a steady posting rhythm without living in the feed.
          </h1>
          <div className="mt-8 flex max-w-3xl flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <p className="max-w-[46ch] text-lg leading-relaxed text-ink-2">
              Cadence drafts posts from your ideas, notes, links and GitHub projects, in your voice. Then it publishes
              them to X and LinkedIn on the schedule you set.
            </p>
            <a href="/api/auth/github/login" className="btn-primary shrink-0 px-5 py-3 text-base">
              <GitHubIcon /> Sign in with GitHub
            </a>
          </div>
          {message && (
            <p role="alert" className="mt-6 max-w-xl rounded-[10px] bg-bad-soft px-4 py-3 text-sm text-bad">
              {message}
            </p>
          )}
        </section>

        <RhythmTrack />

        <section className="grid gap-x-10 gap-y-8 py-16 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <div key={s.title} className="border-t-2 border-ink pt-4">
              <p className="tabular font-display text-sm text-mute">{i + 1}</p>
              <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight">{s.title}</h2>
              <p className="mt-2 max-w-[38ch] text-ink-2">{s.body}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="mx-auto w-full max-w-6xl px-6 pb-8 text-sm text-mute">
        Open source. Bring your own AI key; Gemini and Groq both work on their free tiers.
      </footer>
    </div>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

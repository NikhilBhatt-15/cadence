# Cadence

Keep a steady posting rhythm without living in the feed. Cadence drafts posts from your ideas, notes, links and GitHub projects in a voice you define, then publishes them to X (and LinkedIn) on the schedule you set.

## Features

- **Any kind of post.** Pick a kind (thought, project update, tip, story, announcement, question, hot take) and a starting point: a one-line idea, a GitHub repo (README, recent commits, latest release), a link (title, description and article text), rough notes, or an existing post to rewrite.
- **Streaming AI drafts.** Drafts appear in the editor as they are written. Stop at any point, edit by hand, or draft again.
- **Threads.** Write single posts or X threads. Each part has its own character ring, and LinkedIn gets the parts joined into one post.
- **Voices.** Reusable style rules (tone, length, words to avoid, how to end) that the AI follows. Three starter voices are created on first sign-in; one is your default.
- **Bring your own AI.** Google Gemini (has a free tier), OpenAI, Anthropic, or any OpenAI-compatible API (Groq, OpenRouter, Ollama…). Keys are encrypted at rest. A server-wide fallback key is optional.
- **Week board scheduler.** See the week at a glance with a live "now" marker. Drag drafts onto a day to schedule them, drag posts between days to reschedule (with Undo), and track a weekly posting goal.
- **Queue views.** Coming up, Drafts, Needs attention (failed posts with the platform error and a Retry button) and Published, with links to the live posts.
- **Previews.** See how a post or thread will look on X or LinkedIn before it goes out.
- **Multi-user.** Anyone can sign in with GitHub; each user connects their own accounts.
- **Extensible platforms.** Each network is a small adapter (`src/lib/platforms`). X and LinkedIn ship today.

## Stack

Next.js 16 (App Router), React 19, Tailwind CSS v4, Motion, Drizzle ORM with Postgres, AI SDK, jose for sessions. Designed for Vercel's free tier plus a free hosted Postgres (Neon or Supabase).

## Install

You need Node.js 20+ and a Postgres database.

```bash
git clone https://github.com/NikhilBhatt-15/cadence.git
cd cadence
npm install
cp .env.example .env.local
```

Fill in `.env.local`:

1. `DATABASE_URL`: any Postgres. For local development, `docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=pw -e POSTGRES_DB=cadence postgres:17-alpine` works.
2. `SESSION_SECRET`, `ENCRYPTION_KEY`, `CRON_SECRET`: long random strings (the file shows a one-liner to generate them).
3. A **GitHub OAuth App** (Settings, Developer settings, OAuth Apps) with callback `{APP_URL}/api/auth/github/callback`. Set `GITHUB_SCOPES=read:user repo` if you want private repos as sources.
4. An **X app** in the developer portal: OAuth 2.0, type "Web App", permissions "Read and write", callback `{APP_URL}/api/connect/x/callback`. The free tier is enough for personal posting volumes.
5. Optional: a LinkedIn app with "Share on LinkedIn" and "Sign In with LinkedIn using OpenID Connect", callback `{APP_URL}/api/connect/linkedin/callback`.

Create the tables and start the app:

```bash
npm run db:push
npm run dev
```

Open http://localhost:3000, sign in with GitHub, connect X under Settings, and add an AI key (a free Gemini key from Google AI Studio is the cheapest way to start).

## Build and deploy

```bash
npm run typecheck
npm run lint
npm run build
npm start
```

On Vercel: import the repo, add the same environment variables (with `APP_URL` set to your deployment URL), and update the OAuth callback URLs to match.

### Publishing schedule

Due posts are published by `GET /api/cron/publish`, which requires `Authorization: Bearer $CRON_SECRET`. Vercel's free plan only allows daily crons, so the repo includes a GitHub Actions workflow (`.github/workflows/publish-cron.yml`) that calls it every 5 minutes. Add `APP_URL` and `CRON_SECRET` as repository secrets to turn it on. Any other scheduler that can send an HTTP request works too.

## How it works

- **Auth.** GitHub OAuth signs you in. The session is a signed JWT in an HTTP-only cookie. OAuth state and PKCE verifiers live in short-lived cookies.
- **Secrets.** GitHub, X and LinkedIn tokens and AI keys are encrypted with AES-256-GCM before they are stored.
- **Generation.** `/api/generate` gathers the source (GitHub API, a fetched page, or your text), combines it with the post kind, your voice and the platform's limits, and streams the model's output back as plain text. Threads come back as parts separated by `---`.
- **Link safety.** Fetching links and custom AI base URLs goes through a guard that resolves DNS and refuses private, loopback and link-local addresses, including on every redirect hop. Set `ALLOW_PRIVATE_AI_BASE_URL=true` only on a self-hosted instance that talks to a local model.
- **Publishing.** The cron claims due posts with `FOR UPDATE SKIP LOCKED`, so overlapping runs never double-post. Expired X tokens are refreshed (and the rotated refresh token saved). Threads are posted as a reply chain. Results are stored per platform, so a retry only re-sends to platforms that failed. Posts stuck in "publishing" for 15 minutes are marked failed.
- **Adding a platform.** Implement `PlatformAdapter` in `src/lib/platforms/` (OAuth URLs, token exchange and refresh, account lookup, publish) and register it in `src/lib/platforms/index.ts`. The composer, settings and scheduler pick it up automatically.

## License

MIT

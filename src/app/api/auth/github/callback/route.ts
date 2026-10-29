import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { encrypt } from "@/lib/crypto";
import { db, schema } from "@/lib/db";
import { DEFAULT_PROMPTS } from "@/lib/default-prompts";
import { env } from "@/lib/env";
import { finishOAuth } from "@/lib/oauth-state";
import { createSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const saved = await finishOAuth("github", req.nextUrl.searchParams.get("state"));
  if (!code || !saved) redirect("/?error=oauth_state");

  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: env.github.clientId,
      client_secret: env.github.clientSecret,
      code,
      redirect_uri: `${env.appUrl}/api/auth/github/callback`,
    }),
  });
  const token = (await tokenRes.json()) as { access_token?: string };
  if (!token.access_token) redirect("/?error=github_token");

  const profileRes = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${token.access_token}`, "User-Agent": "cadence" },
  });
  if (!profileRes.ok) redirect("/?error=github_profile");
  const profile = (await profileRes.json()) as { id: number; login: string; name: string | null; avatar_url: string };

  const values = {
    githubId: profile.id,
    login: profile.login,
    name: profile.name,
    avatarUrl: profile.avatar_url,
    githubToken: encrypt(token.access_token),
  };
  const [user] = await db
    .insert(schema.users)
    .values(values)
    .onConflictDoUpdate({ target: schema.users.githubId, set: values })
    .returning();

  const existingPrompt = await db.query.prompts.findFirst({ where: eq(schema.prompts.userId, user.id) });
  if (!existingPrompt) {
    await db.insert(schema.prompts).values(DEFAULT_PROMPTS.map((p) => ({ ...p, userId: user.id })));
  }

  await createSession(user.id);
  redirect("/dashboard");
}

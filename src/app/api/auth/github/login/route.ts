import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { env } from "@/lib/env";
import { beginOAuth } from "@/lib/oauth-state";

export async function GET(req: NextRequest) {
  // The state cookie must live on the same host GitHub redirects back to (APP_URL),
  // so preview and alias URLs hop over to it before starting.
  const appUrl = new URL(env.appUrl);
  if (req.nextUrl.host !== appUrl.host) redirect(`${env.appUrl}/api/auth/github/login`);

  if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) redirect("/?error=github_config");

  const { state } = await beginOAuth("github");
  const params = new URLSearchParams({
    client_id: env.github.clientId,
    redirect_uri: `${env.appUrl}/api/auth/github/callback`,
    scope: env.github.scopes,
    state,
  });
  redirect(`https://github.com/login/oauth/authorize?${params}`);
}

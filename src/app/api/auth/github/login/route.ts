import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { beginOAuth } from "@/lib/oauth-state";

export async function GET() {
  const { state } = await beginOAuth("github");
  const params = new URLSearchParams({
    client_id: env.github.clientId,
    redirect_uri: `${env.appUrl}/api/auth/github/callback`,
    scope: env.github.scopes,
    state,
  });
  redirect(`https://github.com/login/oauth/authorize?${params}`);
}

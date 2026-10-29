import "server-only";
import { cookies } from "next/headers";
import { env } from "./env";
import { randomToken } from "./crypto";

type OAuthState = { state: string; verifier: string };

// Short-lived cookie that binds the OAuth redirect back to this browser (CSRF + PKCE verifier).
export async function beginOAuth(name: string): Promise<OAuthState> {
  const value = { state: randomToken(16), verifier: randomToken(48) };
  (await cookies()).set(`pp_oauth_${name}`, JSON.stringify(value), {
    httpOnly: true,
    secure: env.appUrl.startsWith("https://"),
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return value;
}

export async function finishOAuth(name: string, returnedState: string | null) {
  const jar = await cookies();
  const raw = jar.get(`pp_oauth_${name}`)?.value;
  jar.delete(`pp_oauth_${name}`);
  if (!raw || !returnedState) return null;
  const saved = JSON.parse(raw) as OAuthState;
  return saved.state === returnedState ? saved : null;
}

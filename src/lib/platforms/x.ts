import { pkceChallenge } from "../crypto";
import { expiresIn, readError, type PlatformAdapter, type TokenSet } from "./types";

const SCOPES = ["tweet.read", "tweet.write", "users.read", "offline.access"];

function creds() {
  return { id: process.env.X_CLIENT_ID ?? "", secret: process.env.X_CLIENT_SECRET ?? "" };
}

function basicAuth() {
  const { id, secret } = creds();
  return `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
}

async function tokenRequest(body: Record<string, string>): Promise<TokenSet> {
  const res = await fetch("https://api.x.com/2/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: basicAuth() },
    body: new URLSearchParams({ client_id: creds().id, ...body }),
  });
  if (!res.ok) throw new Error(`X token request failed: ${await readError(res)}`);
  const data = (await res.json()) as { access_token: string; refresh_token?: string; expires_in?: number };
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt: expiresIn(data.expires_in),
  };
}

export const x: PlatformAdapter = {
  id: "x",
  name: "X (Twitter)",
  maxLength: 280,
  supportsThreads: true,
  styleHint:
    "Platform: X (Twitter). Hard limit 280 characters including spaces, links and hashtags. Punchy, conversational, at most 2 hashtags.",

  isConfigured: () => Boolean(creds().id && creds().secret),

  authorizeUrl({ state, verifier, redirectUri }) {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: creds().id,
      redirect_uri: redirectUri,
      scope: SCOPES.join(" "),
      state,
      code_challenge: pkceChallenge(verifier),
      code_challenge_method: "S256",
    });
    return `https://x.com/i/oauth2/authorize?${params}`;
  },

  exchangeCode: ({ code, verifier, redirectUri }) =>
    tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri, code_verifier: verifier }),

  refresh: (refreshToken) => tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken }),

  async getAccount(accessToken) {
    const res = await fetch("https://api.x.com/2/users/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`X users/me failed: ${await readError(res)}`);
    const { data } = (await res.json()) as { data: { id: string; username: string } };
    return { accountId: data.id, handle: data.username };
  },

  async publish({ accessToken, account, parts }) {
    let firstId = "";
    let replyTo: string | undefined;
    for (const [i, text] of parts.entries()) {
      const res = await fetch("https://api.x.com/2/tweets", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(replyTo ? { text, reply: { in_reply_to_tweet_id: replyTo } } : { text }),
      });
      if (!res.ok) {
        const where = parts.length > 1 ? ` (part ${i + 1} of ${parts.length})` : "";
        throw new Error(`X post failed${where}: ${await readError(res)}`);
      }
      const { data } = (await res.json()) as { data: { id: string } };
      firstId ||= data.id;
      replyTo = data.id;
    }
    return { id: firstId, url: `https://x.com/${account.handle}/status/${firstId}` };
  },
};

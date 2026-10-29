import { expiresIn, readError, type PlatformAdapter, type TokenSet } from "./types";

// Requires the "Share on LinkedIn" and "Sign In with LinkedIn using OpenID Connect" products on the app.
const SCOPES = ["openid", "profile", "w_member_social"];

function creds() {
  return { id: process.env.LINKEDIN_CLIENT_ID ?? "", secret: process.env.LINKEDIN_CLIENT_SECRET ?? "" };
}

function apiVersion() {
  return process.env.LINKEDIN_API_VERSION ?? "202601";
}

async function tokenRequest(body: Record<string, string>): Promise<TokenSet> {
  const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: creds().id, client_secret: creds().secret, ...body }),
  });
  if (!res.ok) throw new Error(`LinkedIn token request failed: ${await readError(res)}`);
  const data = (await res.json()) as { access_token: string; refresh_token?: string; expires_in?: number };
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt: expiresIn(data.expires_in),
  };
}

export const linkedin: PlatformAdapter = {
  id: "linkedin",
  name: "LinkedIn",
  maxLength: 3000,
  supportsThreads: false,
  styleHint:
    "Platform: LinkedIn. Up to 3000 characters, but aim for 600-1200. Professional but human, short paragraphs, a clear takeaway, 3-5 hashtags at the end.",

  isConfigured: () => Boolean(creds().id && creds().secret),

  authorizeUrl({ state, redirectUri }) {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: creds().id,
      redirect_uri: redirectUri,
      scope: SCOPES.join(" "),
      state,
    });
    return `https://www.linkedin.com/oauth/v2/authorization?${params}`;
  },

  exchangeCode: ({ code, redirectUri }) =>
    tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri }),

  async refresh(refreshToken) {
    // Refresh tokens are only issued to approved partner apps; others must reconnect every 60 days.
    if (!refreshToken) return null;
    return tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });
  },

  async getAccount(accessToken) {
    const res = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`LinkedIn userinfo failed: ${await readError(res)}`);
    const data = (await res.json()) as { sub: string; name?: string };
    return { accountId: data.sub, handle: data.name ?? data.sub };
  },

  async publish({ accessToken, account, parts }) {
    const text = parts.join("\n\n");
    const res = await fetch("https://api.linkedin.com/rest/posts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "LinkedIn-Version": apiVersion(),
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify({
        author: `urn:li:person:${account.accountId}`,
        commentary: text,
        visibility: "PUBLIC",
        distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
        lifecycleState: "PUBLISHED",
        isReshareDisabledByAuthor: false,
      }),
    });
    if (!res.ok) throw new Error(`LinkedIn post failed: ${await readError(res)}`);
    const id = res.headers.get("x-restli-id") ?? "";
    return { id, url: `https://www.linkedin.com/feed/update/${id}/` };
  },
};

export type TokenSet = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
};

export type AccountInfo = { accountId: string; handle: string };

export interface PlatformAdapter {
  id: string;
  name: string;
  /** Max characters per post (per part, for threads). */
  maxLength: number;
  /** Whether multi-part threads are published as a real thread. Otherwise parts are joined. */
  supportsThreads: boolean;
  /** Guidance appended to the AI prompt for this platform. */
  styleHint: string;
  /** True when the platform's OAuth credentials are configured. */
  isConfigured(): boolean;
  authorizeUrl(opts: { state: string; verifier: string; redirectUri: string }): string;
  exchangeCode(opts: { code: string; verifier: string; redirectUri: string }): Promise<TokenSet>;
  /** Return null if the platform doesn't support refresh. */
  refresh(refreshToken: string): Promise<TokenSet | null>;
  getAccount(accessToken: string): Promise<AccountInfo>;
  /** Publishes the post; returns the id/url of the first (or only) part. */
  publish(opts: { accessToken: string; account: AccountInfo; parts: string[] }): Promise<{ id: string; url: string }>;
}

export function expiresIn(seconds: number | undefined): Date | null {
  return seconds ? new Date(Date.now() + seconds * 1000) : null;
}

export async function readError(res: Response) {
  const body = await res.text();
  return `${res.status} ${body.slice(0, 400)}`;
}

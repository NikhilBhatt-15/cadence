import { notFound, redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { encrypt } from "@/lib/crypto";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { finishOAuth } from "@/lib/oauth-state";
import { getPlatform } from "@/lib/platforms";
import { requireUser } from "@/lib/session";

export async function GET(req: NextRequest, ctx: RouteContext<"/api/connect/[platform]/callback">) {
  const user = await requireUser();
  const { platform } = await ctx.params;
  const adapter = getPlatform(platform);
  if (!adapter) notFound();

  const code = req.nextUrl.searchParams.get("code");
  const saved = await finishOAuth(platform, req.nextUrl.searchParams.get("state"));
  if (!code || !saved) redirect(`/settings?error=${platform}_denied`);

  let message: string;
  try {
    const tokens = await adapter.exchangeCode({
      code,
      verifier: saved.verifier,
      redirectUri: `${env.appUrl}/api/connect/${platform}/callback`,
    });
    const account = await adapter.getAccount(tokens.accessToken);
    const values = {
      userId: user.id,
      platform,
      accountId: account.accountId,
      handle: account.handle,
      accessToken: encrypt(tokens.accessToken),
      refreshToken: tokens.refreshToken ? encrypt(tokens.refreshToken) : null,
      expiresAt: tokens.expiresAt,
    };
    await db
      .insert(schema.connections)
      .values(values)
      .onConflictDoUpdate({ target: [schema.connections.userId, schema.connections.platform], set: values });
    message = `connected=${platform}`;
  } catch (err) {
    console.error(`connect ${platform} failed`, err);
    message = `error=${platform}_failed`;
  }
  redirect(`/settings?${message}`);
}

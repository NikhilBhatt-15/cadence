import { notFound, redirect } from "next/navigation";
import { env } from "@/lib/env";
import { beginOAuth } from "@/lib/oauth-state";
import { getPlatform } from "@/lib/platforms";
import { requireUser } from "@/lib/session";

export async function GET(_req: Request, ctx: RouteContext<"/api/connect/[platform]">) {
  await requireUser();
  const { platform } = await ctx.params;
  const adapter = getPlatform(platform);
  if (!adapter) notFound();
  if (!adapter.isConfigured()) redirect(`/settings?error=${platform}_not_configured`);

  const { state, verifier } = await beginOAuth(platform);
  redirect(
    adapter.authorizeUrl({
      state,
      verifier,
      redirectUri: `${env.appUrl}/api/connect/${platform}/callback`,
    }),
  );
}

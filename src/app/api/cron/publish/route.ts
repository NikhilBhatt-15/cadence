import { env } from "@/lib/env";
import { publishDue } from "@/lib/publish";

export const maxDuration = 60;

// Triggered every few minutes by .github/workflows/publish-cron.yml (or any external cron).
export async function GET(req: Request) {
  const secret = env.cronSecret;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const published = await publishDue();
  return Response.json({ published });
}

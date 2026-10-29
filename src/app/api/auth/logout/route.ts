import { env } from "@/lib/env";
import { destroySession } from "@/lib/session";

export async function POST() {
  await destroySession();
  return Response.redirect(`${env.appUrl}/`, 303);
}

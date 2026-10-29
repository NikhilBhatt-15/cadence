import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { db, schema } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { Voices } from "./voices";

export const metadata: Metadata = { title: "Voices" };

export default async function VoicesPage() {
  const user = await requireUser();
  const prompts = await db.query.prompts.findMany({
    where: eq(schema.prompts.userId, user.id),
    orderBy: [desc(schema.prompts.isDefault), schema.prompts.createdAt],
  });

  return (
    <Voices
      voices={prompts.map((p) => ({ id: p.id, name: p.name, instructions: p.instructions, isDefault: p.isDefault }))}
    />
  );
}

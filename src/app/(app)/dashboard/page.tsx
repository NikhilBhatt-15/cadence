import { and, desc, eq, gte, inArray, or, sql } from "drizzle-orm";
import type { Metadata } from "next";
import { db, schema } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { Schedule, type BoardPost } from "./schedule";

export const metadata: Metadata = { title: "Schedule" };

export default async function DashboardPage() {
  const user = await requireUser();

  const [posts, connections] = await Promise.all([
    db.query.posts.findMany({
      where: and(
        eq(schema.posts.userId, user.id),
        or(
          inArray(schema.posts.status, ["draft", "scheduled", "publishing", "failed"]),
          gte(schema.posts.publishedAt, sql`now() - interval '90 days'`),
        ),
      ),
      orderBy: [desc(schema.posts.updatedAt)],
      limit: 500,
    }),
    db.query.connections.findMany({ where: eq(schema.connections.userId, user.id) }),
  ]);

  const board: BoardPost[] = posts.map((p) => ({
    id: p.id,
    content: p.content.slice(0, 600),
    thread: p.thread,
    kind: p.kind,
    sourceType: p.sourceType,
    sourceRef: p.sourceRef,
    platforms: p.platforms,
    status: p.status,
    scheduledAt: p.scheduledAt?.toISOString() ?? null,
    publishedAt: p.publishedAt?.toISOString() ?? null,
    updatedAt: p.updatedAt.toISOString(),
    results: p.results ?? null,
  }));

  return (
    <Schedule
      posts={board}
      weeklyGoal={user.weeklyGoal}
      firstName={(user.name ?? user.login).split(" ")[0]}
      hasConnections={connections.length > 0}
    />
  );
}

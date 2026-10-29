import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../env";
import * as schema from "./schema";

type Db = ReturnType<typeof createDb>;

function createDb() {
  // prepare:false keeps transaction-mode poolers (Neon, Supabase) happy.
  return drizzle({ client: postgres(env.databaseUrl, { prepare: false, max: 5 }), schema });
}

const globalForDb = globalThis as unknown as { db?: Db };

// Connect on first use so builds don't need DATABASE_URL.
export const db = new Proxy({} as Db, {
  get(_, prop) {
    globalForDb.db ??= createDb();
    return Reflect.get(globalForDb.db, prop);
  },
});

export { schema };

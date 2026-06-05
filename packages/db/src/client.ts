import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
import * as relations from "./relations";

function getConnectionString() {
  return (
    process.env.POSTGRES_URL ??
    process.env.DATABASE_URL ??
    process.env.DIRECT_URL
  );
}

let _client: postgres.Sql | undefined;
let _db: ReturnType<typeof createDb> | undefined;

function createDb(url: string) {
  const isSupabase = url.includes("supabase");
  const client = postgres(url, {
    prepare: false,
    max: 10,
    idle_timeout: 20,
    max_lifetime: 60 * 30,
    ...(isSupabase ? { ssl: "require" as const } : {}),
  });
  return drizzle(client, { schema: { ...schema, ...relations } });
}

export function getDb() {
  if (!_db) {
    const url = getConnectionString();
    if (!url) throw new Error("DATABASE_URL is not set.");
    _db = createDb(url);
  }
  return _db;
}

export const db = new Proxy({} as ReturnType<typeof createDb>, {
  get(_target, prop) {
    return Reflect.get(getDb(), prop);
  },
});

export type Db = ReturnType<typeof createDb>;

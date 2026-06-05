import postgres from "postgres";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

let _client: postgres.Sql | undefined;
let _db: PostgresJsDatabase<typeof schema> | undefined;

function getConnectionString() {
  return (
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.SUPABASE_DB_URL
  );
}

export function getDb(): PostgresJsDatabase<typeof schema> {
  if (!_db) {
    const url = getConnectionString();
    if (!url) {
      throw new Error(
        "DATABASE_URL is not set. Add the Supabase connection string to .env.local."
      );
    }

    const isSupabase = url.includes("supabase");
    _client = postgres(url, {
      prepare: false,
      ...(isSupabase ? { ssl: "require" as const } : {}),
    });
    _db = drizzle(_client, { schema });
  }
  return _db;
}

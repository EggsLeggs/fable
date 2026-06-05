import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

// Supabase: use DIRECT_URL for migrations (Session mode, port 5432).
// Pooled URLs (port 6543) often hang with drizzle-kit.
const url =
  process.env.DIRECT_URL ??
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.POSTGRES_URL ??
  process.env.DATABASE_URL;

if (!url) {
  throw new Error(
    "Set DIRECT_URL or POSTGRES_URL in .env.local (Supabase → Project Settings → Database)."
  );
}

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
});

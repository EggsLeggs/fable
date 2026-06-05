/**
 * Applies drizzle/0000_init.sql using DATABASE_URL (Supabase transaction pooler).
 * Use this when `drizzle-kit push` hangs — only needs the URL from Supabase's Drizzle guide.
 */
import { config } from "dotenv";
import { readFileSync } from "fs";
import { resolve } from "path";
import postgres from "postgres";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

const connectionString =
  process.env.DATABASE_URL ?? process.env.POSTGRES_URL;

if (!connectionString) {
  console.error("Missing DATABASE_URL in .env.local");
  process.exit(1);
}

const sql = postgres(connectionString, {
  prepare: false,
  ssl: connectionString.includes("supabase") ? "require" : undefined,
  max: 1,
});

const migrations = [
  "drizzle/0000_init.sql",
  "drizzle/0001_scenarios.sql",
  "drizzle/0002_decisions.sql",
  "drizzle/0003_decision_audit_log.sql",
  "drizzle/0004_templates.sql",
];

async function main() {
  for (const file of migrations) {
    const migrationPath = resolve(process.cwd(), file);
    console.log(`Applying schema from ${file} …`);
    await sql.unsafe(readFileSync(migrationPath, "utf8"));
  }
  await sql.end();
  console.log(
    "Done. Tables: user, workspace, campaign, campaign_scenario, decision, template, template_scenario"
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

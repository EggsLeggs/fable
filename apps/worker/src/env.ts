import { config } from "dotenv";
import { resolve } from "path";

// Resolve relative to the monorepo root (two levels up from apps/worker)
config({ path: resolve(process.cwd(), "../../.env.local") });
config({ path: resolve(process.cwd(), "../../.env") });

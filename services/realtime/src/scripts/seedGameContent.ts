// ─────────────────────────────────────────────────────────────────────────────
// Seed Game Content
//
// Use the SQL file instead — it's faster and simpler:
//   psql $DATABASE_URL -f services/api/src/db/migrations/003_game_content.sql
//   psql $DATABASE_URL -f services/api/src/db/migrations/003_game_content_seed.sql
//
// This script is kept as a fallback for programmatic use.
// ─────────────────────────────────────────────────────────────────────────────

import { Pool } from "pg";
import { execSync } from "child_process";
import path from "path";

const db = new Pool({ connectionString: process.env.DATABASE_URL, max: 3 });

async function main() {
  const root = path.resolve(__dirname, "../../../../");
  const schema = path.join(root, "services/api/src/db/migrations/003_game_content.sql");
  const seed   = path.join(root, "services/api/src/db/migrations/003_game_content_seed.sql");

  console.log("[seed] Running schema migration...");
  execSync(`psql "${process.env.DATABASE_URL}" -f "${schema}"`, { stdio: "inherit" });

  console.log("[seed] Running seed data...");
  execSync(`psql "${process.env.DATABASE_URL}" -f "${seed}"`, { stdio: "inherit" });

  console.log("[seed] Done.");
  await db.end();
}

main().catch((err) => {
  console.error("[seed] Fatal:", err);
  process.exit(1);
});

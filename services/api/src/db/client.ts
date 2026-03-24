import { Pool } from "pg";

// ─────────────────────────────────────────────────────────────────────────────
// PostgreSQL client — single pool shared across all API routes.
// Schema lives in src/db/schema.sql — run it once on first boot.
// ─────────────────────────────────────────────────────────────────────────────

export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

db.on("error", (err) => {
  console.error("[postgres] unexpected error on idle client", err);
});

import { Pool } from "pg";

export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

db.on("error", (err) => {
  console.warn("[realtime:db] idle client error:", err.message);
});

import { db } from "./client";

// ─────────────────────────────────────────────────────────────────────────────
// Startup migration — idempotent, safe to run on every boot.
// Uses CREATE TABLE IF NOT EXISTS / ALTER TABLE ... ADD COLUMN IF NOT EXISTS
// so it never fails on an already-provisioned database.
// ─────────────────────────────────────────────────────────────────────────────

export async function runMigrations(): Promise<void> {
  try {
    await db.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      CREATE EXTENSION IF NOT EXISTS "pg_trgm";

      -- Sessions table (party rooms — created on room create, snapshotted every 60s)
      CREATE TABLE IF NOT EXISTS sessions (
        id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        room_code               VARCHAR(10) NOT NULL,
        host_fingerprint        VARCHAR(64),
        vibe_preset             VARCHAR(20) NOT NULL DEFAULT 'open',
        started_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ended_at                TIMESTAMPTZ,
        total_tracks_played     INTEGER DEFAULT 0,
        total_guests_joined     INTEGER DEFAULT 0,
        peak_concurrent_guests  INTEGER DEFAULT 0,
        feature_flags           JSONB NOT NULL DEFAULT '{}',
        retained_until          TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '90 days')
      );

      ALTER TABLE sessions ADD COLUMN IF NOT EXISTS room_snapshot JSONB;
      ALTER TABLE sessions ADD COLUMN IF NOT EXISTS snapshot_at   TIMESTAMPTZ;

      CREATE INDEX IF NOT EXISTS idx_sessions_started_at     ON sessions(started_at);
      CREATE INDEX IF NOT EXISTS idx_sessions_retained_until ON sessions(retained_until);

      -- Vibe credits
      CREATE TABLE IF NOT EXISTS vibe_credits (
        guest_id    VARCHAR(64) PRIMARY KEY,
        balance     INTEGER NOT NULL DEFAULT 0,
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // ── Account system ────────────────────────────────────────────────────────
    await db.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        provider         VARCHAR(10)  NOT NULL CHECK (provider IN ('apple', 'google')),
        provider_id      VARCHAR(255) NOT NULL,
        email            VARCHAR(255),
        display_name     VARCHAR(100),
        primary_guest_id VARCHAR(36)  NOT NULL,
        created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_provider_pid
        ON accounts(provider, provider_id);

      CREATE INDEX IF NOT EXISTS idx_accounts_primary_guest_id
        ON accounts(primary_guest_id);

      CREATE TABLE IF NOT EXISTS account_sessions (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        account_id  UUID        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        jti         VARCHAR(36) NOT NULL UNIQUE,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '90 days'),
        revoked_at  TIMESTAMPTZ
      );

      CREATE INDEX IF NOT EXISTS idx_account_sessions_jti
        ON account_sessions(jti);

      CREATE INDEX IF NOT EXISTS idx_account_sessions_account_id
        ON account_sessions(account_id);
    `);

    console.log("[migrate] Migrations complete");
  } catch (err: any) {
    console.error("[migrate] Migration failed:", err.message);
    // Don't throw — a migration failure shouldn't kill the API
  }
}

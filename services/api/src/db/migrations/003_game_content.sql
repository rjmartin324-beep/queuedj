-- Migration 003 — game content tables (trivia questions + geo locations)
-- Run once on Railway Postgres:
--   psql $DATABASE_URL -f services/api/src/db/migrations/003_game_content.sql
--
-- Then seed with:
--   cd services/realtime && npx tsx src/scripts/seedGameContent.ts
--
-- Safe to run multiple times (CREATE TABLE IF NOT EXISTS).

-- ─── Trivia Questions ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS trivia_questions (
  id                  TEXT PRIMARY KEY,
  text                TEXT        NOT NULL,
  options             JSONB       NOT NULL,  -- [{id, text}, ...]
  correct_option_id   TEXT        NOT NULL,
  time_limit_seconds  INTEGER     NOT NULL DEFAULT 15,
  category            TEXT,
  difficulty          TEXT CHECK (difficulty IN ('easy', 'medium', 'hard'))
);

CREATE INDEX IF NOT EXISTS trivia_questions_category_idx  ON trivia_questions (category);
CREATE INDEX IF NOT EXISTS trivia_questions_difficulty_idx ON trivia_questions (difficulty);

-- ─── Geo Locations ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS geo_locations (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  lat        DECIMAL(9, 6) NOT NULL,
  lng        DECIMAL(9, 6) NOT NULL,
  hint       TEXT,
  image_url  TEXT
);

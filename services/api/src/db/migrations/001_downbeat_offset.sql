-- Migration 001 — add downbeat_offset_ms to tracks
-- Run once on Railway Postgres:
--   psql $DATABASE_URL -f services/api/src/db/migrations/001_downbeat_offset.sql
--
-- Safe to run multiple times (IF NOT EXISTS guard).
-- Existing tracks get NULL — the ML service will backfill on next analysis.

ALTER TABLE tracks
  ADD COLUMN IF NOT EXISTS downbeat_offset_ms INTEGER;

COMMENT ON COLUMN tracks.downbeat_offset_ms IS
  'Milliseconds from track start to the first downbeat (beat 1 of bar 1). '
  'Populated by Librosa beat tracker in the ML service. '
  'Used for phase-locked quantized launch between decks.';

-- Migration 002 — add phrase_boundaries_ms to tracks
-- Run once on Railway Postgres:
--   psql $DATABASE_URL -f services/api/src/db/migrations/002_phrase_boundaries.sql
--
-- Safe to run multiple times (IF NOT EXISTS guard).
-- Existing tracks get NULL — ML service backfills on next analysis.

ALTER TABLE tracks
  ADD COLUMN IF NOT EXISTS phrase_boundaries_ms INTEGER[];

COMMENT ON COLUMN tracks.phrase_boundaries_ms IS
  'Array of millisecond timestamps marking the start of each 4-bar phrase. '
  'Computed by Librosa beat tracker: beat_frames grouped into 16-beat chunks (4 bars × 4 beats). '
  'Used by the DJ engine to wait for a phrase boundary before firing a track transition, '
  'so transitions never cut mid-phrase. NULL = not yet analysed.';

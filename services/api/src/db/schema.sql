-- ─────────────────────────────────────────────────────────────────────────────
-- QueueDJ — PostgreSQL Schema
-- Run order matters. Extensions first, then tables, then indexes.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fuzzy track title search

-- ─── Tracks / ISRC Fingerprint DB ────────────────────────────────────────────
-- Central fingerprint database. Populated from:
--   1. AcoustID fingerprinting on local files
--   2. MusicBrainz metadata enrichment
--   3. Spotify audio features API (when available)
--   4. Librosa analysis fallback
-- Every track ever played in any session gets cached here.

CREATE TABLE tracks (
  isrc                  VARCHAR(12) PRIMARY KEY,  -- e.g. USUM71900604
  title                 TEXT NOT NULL,
  artist                TEXT NOT NULL,
  album                 TEXT,
  album_art_url         TEXT,
  duration_ms           INTEGER,
  bpm                   DECIMAL(6, 2),
  -- Camelot Wheel: 1–12 for number, 'A' for minor, 'B' for major
  camelot_key           INTEGER CHECK (camelot_key BETWEEN 1 AND 12),
  camelot_type          CHAR(1) CHECK (camelot_type IN ('A', 'B')),
  energy                DECIMAL(4, 3) CHECK (energy BETWEEN 0 AND 1),
  danceability          DECIMAL(4, 3) CHECK (danceability BETWEEN 0 AND 1),
  valence               DECIMAL(4, 3) CHECK (valence BETWEEN 0 AND 1),
  mood                  TEXT,
  artist_bio            TEXT,
  artist_image_url      TEXT,
  release_date          DATE,
  genre                 TEXT,
  -- similar_tracks: JSONB array of {artist, title, match} from Last.fm
  similar_tracks        JSONB,
  -- No-derivative flag: if true, stem separation is blocked for this track
  -- Populated from Audible Magic / Pex integration (Phase 6)
  -- Default false until we have a reliable source — flag conservatively
  no_derivative         BOOLEAN NOT NULL DEFAULT FALSE,
  analysis_confidence   DECIMAL(4, 3) NOT NULL DEFAULT 0,
  analysis_source       VARCHAR(20) NOT NULL DEFAULT 'unknown'
                          CHECK (analysis_source IN ('librosa', 'spotify', 'acoustid', 'manual', 'unknown')),
  -- Phrase structure (Phase 3+)
  intro_end_ms          INTEGER,
  first_drop_ms         INTEGER,
  outro_start_ms        INTEGER,
  -- AcoustID fingerprint for local file matching
  acoustid_fingerprint  TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tracks_bpm ON tracks(bpm);
CREATE INDEX idx_tracks_energy ON tracks(energy);
CREATE INDEX idx_tracks_camelot ON tracks(camelot_key, camelot_type);
CREATE INDEX idx_tracks_genre ON tracks(genre);
CREATE INDEX idx_tracks_title_trgm ON tracks USING gin(title gin_trgm_ops);
CREATE INDEX idx_tracks_artist_trgm ON tracks USING gin(artist gin_trgm_ops);

-- ─── Sessions ─────────────────────────────────────────────────────────────────
-- A party session. Created when host starts a room.
-- Anonymized — no personal data stored here.

CREATE TABLE sessions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Room code for display (ephemeral rooms are separate in Redis/DynamoDB)
  room_code             VARCHAR(10) NOT NULL,
  -- Hashed host identifier — never store raw guestId
  host_fingerprint      VARCHAR(64),
  vibe_preset           VARCHAR(20) NOT NULL DEFAULT 'open',
  started_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at              TIMESTAMPTZ,
  -- Aggregate stats (computed at session end)
  total_tracks_played   INTEGER DEFAULT 0,
  total_guests_joined   INTEGER DEFAULT 0,
  peak_concurrent_guests INTEGER DEFAULT 0,
  -- Feature flags active during this session (for debugging and A/B testing)
  feature_flags         JSONB NOT NULL DEFAULT '{}',
  -- GDPR: anonymized and retained for RLHF_DATA_RETENTION_DAYS days then deleted
  retained_until        TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '90 days')
);

-- Crash recovery: full room state snapshot written every 60s and on clean shutdown.
-- If Redis loses this room, server restores state from here on next join.
-- Nullable — only populated for active rooms.
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS room_snapshot JSONB;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS snapshot_at   TIMESTAMPTZ;

CREATE INDEX idx_sessions_started_at ON sessions(started_at);
CREATE INDEX idx_sessions_retained_until ON sessions(retained_until);

-- ─── Session Tracks ───────────────────────────────────────────────────────────
-- What was played in each session, in order.
-- Used for: session memory, RLHF signals, style DNA training

CREATE TABLE session_tracks (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id            UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  isrc                  VARCHAR(12) NOT NULL REFERENCES tracks(isrc) ON DELETE RESTRICT,
  position              INTEGER NOT NULL,  -- 0-indexed play order
  deck_id               CHAR(1) CHECK (deck_id IN ('A', 'B')),
  played_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  play_duration_ms      INTEGER,           -- Actual ms played before skip or end
  was_skipped           BOOLEAN NOT NULL DEFAULT FALSE,
  skip_at_ms            INTEGER,           -- Position in track when skipped
  transition_type       VARCHAR(20),       -- How this track transitioned IN
  transition_score      DECIMAL(4, 3),     -- Sandbox score at transition time
  crowd_state_at_play   VARCHAR(20),       -- Crowd state when this track started
  -- Compatibility with previous track (populated at transition time)
  compatibility_score   DECIMAL(4, 3)
);

CREATE INDEX idx_session_tracks_session ON session_tracks(session_id);
CREATE INDEX idx_session_tracks_isrc ON session_tracks(isrc);
CREATE INDEX idx_session_tracks_played_at ON session_tracks(played_at);

-- ─── RLHF Signals ─────────────────────────────────────────────────────────────
-- Reinforcement learning training signals.
-- GDPR: no guestId, no device fingerprint, no IP.
-- Retained for 90 days then deleted.
-- Feature flag: FEATURE_RLHF_LOGGING must be true for inserts.

CREATE TABLE rlhf_signals (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id            UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  signal_type           VARCHAR(30) NOT NULL
                          CHECK (signal_type IN ('skip', 'play_extended', 'crowd_energy_up', 'crowd_energy_down', 'vote_up', 'vote_down')),
  reward                DECIMAL(4, 2) NOT NULL,  -- -1.0 to +1.0
  isrc                  VARCHAR(12) REFERENCES tracks(isrc),
  -- Track pair context (for transition reward)
  from_isrc             VARCHAR(12) REFERENCES tracks(isrc),
  to_isrc               VARCHAR(12) REFERENCES tracks(isrc),
  crowd_state           VARCHAR(20),
  transition_type       VARCHAR(20),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  retained_until        TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '90 days')
);

CREATE INDEX idx_rlhf_session ON rlhf_signals(session_id);
CREATE INDEX idx_rlhf_signal_type ON rlhf_signals(signal_type);
CREATE INDEX idx_rlhf_retained_until ON rlhf_signals(retained_until);
-- Used to count signals for retrain trigger
CREATE INDEX idx_rlhf_created_at ON rlhf_signals(created_at);

-- ─── Style Profiles ───────────────────────────────────────────────────────────
-- Host-level style fingerprint, built from session history.
-- Anonymized by host_fingerprint (hashed).

CREATE TABLE style_profiles (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  host_fingerprint      VARCHAR(64) NOT NULL UNIQUE,
  -- Aggregated style preferences
  avg_bpm               DECIMAL(6, 2),
  bpm_variance          DECIMAL(6, 2),
  preferred_keys        JSONB,            -- Array of {key, type, weight}
  energy_curve          JSONB,            -- Energy over time-of-night (normalized)
  genre_weights         JSONB,            -- {genre: weight}
  preferred_transitions JSONB,            -- {transition_type: frequency}
  -- Named profiles (e.g. "Friday Night", "Sunday BBQ")
  named_profiles        JSONB,            -- Array of {name, sessionIds, ...}
  session_count         INTEGER DEFAULT 0,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Licensing Audit ─────────────────────────────────────────────────────────
-- Per-session track play log for royalty reporting.
-- Required before any public commercial launch.
-- ISRC + session + timestamp is the minimum for royalty reporting.

CREATE TABLE licensing_audit (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id            UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  isrc                  VARCHAR(12) NOT NULL,
  played_at             TIMESTAMPTZ NOT NULL,
  duration_played_ms    INTEGER,
  -- Whether stems were applied (relevant for no-derivative compliance)
  stems_applied         BOOLEAN NOT NULL DEFAULT FALSE,
  -- Stem types applied: ['vocals', 'drums', 'bass', 'other']
  stems_types           TEXT[],
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_licensing_session ON licensing_audit(session_id);
CREATE INDEX idx_licensing_isrc ON licensing_audit(isrc);
CREATE INDEX idx_licensing_played_at ON licensing_audit(played_at);

-- ─── Model Versions ───────────────────────────────────────────────────────────
-- Track ML model versions for A/B testing and rollback safety.
-- Before retraining crowd_state_machine or compatibility_scorer,
-- insert a new version record and set active = false until validated.

CREATE TABLE model_versions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  model_name            VARCHAR(50) NOT NULL,  -- e.g. 'crowd_state_machine_v2'
  version               VARCHAR(20) NOT NULL,
  model_type            VARCHAR(50) NOT NULL,
  artifact_path         TEXT,                  -- S3 path or local path
  training_signal_count INTEGER,
  is_active             BOOLEAN NOT NULL DEFAULT FALSE,
  is_shadow             BOOLEAN NOT NULL DEFAULT FALSE, -- Shadow mode = run but don't act
  deployed_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes                 TEXT
);

CREATE UNIQUE INDEX idx_model_active ON model_versions(model_name) WHERE is_active = TRUE;

-- ─── Vibe Credits ────────────────────────────────────────────────────────────
-- Earn/spend ledger for vibe credits (in-app currency for wardrobe + emotes).
-- guest_fingerprint is hashed device ID — no PII stored.

CREATE TABLE vibe_credits (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  guest_fingerprint     VARCHAR(64) NOT NULL,
  -- Ledger entry
  delta                 INTEGER NOT NULL,   -- positive = earn, negative = spend
  balance_after         INTEGER NOT NULL,   -- balance after this transaction (denormalised for fast reads)
  reason                VARCHAR(50) NOT NULL
                          CHECK (reason IN (
                            'vote_cast',        -- +1
                            'track_request',    -- +2
                            'game_win',         -- +10
                            'full_session',     -- +5
                            'wardrobe_unlock',  -- -varies
                            'emote_purchase',   -- -varies
                            'admin_grant',      -- admin tooling
                            'refund'            -- refund on failed purchase
                          )),
  -- Optional reference to what was purchased
  item_id               UUID,
  item_type             VARCHAR(30),  -- 'wardrobe_item' | 'emote'
  session_id            UUID REFERENCES sessions(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vibe_credits_guest ON vibe_credits(guest_fingerprint);
CREATE INDEX idx_vibe_credits_created_at ON vibe_credits(created_at);

-- Fast balance lookup — latest entry per guest
CREATE INDEX idx_vibe_credits_balance ON vibe_credits(guest_fingerprint, created_at DESC);

-- ─── Vibe Credit Helpers ──────────────────────────────────────────────────────

-- Get current balance for a guest
CREATE OR REPLACE FUNCTION get_vibe_balance(p_fingerprint VARCHAR(64))
RETURNS INTEGER AS $$
  SELECT COALESCE(
    (SELECT balance_after FROM vibe_credits
     WHERE guest_fingerprint = p_fingerprint
     ORDER BY created_at DESC LIMIT 1),
    0
  );
$$ LANGUAGE SQL STABLE;

-- Award credits — returns new balance
CREATE OR REPLACE FUNCTION award_vibe_credits(
  p_fingerprint VARCHAR(64),
  p_delta INTEGER,
  p_reason VARCHAR(50),
  p_session_id UUID DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
  v_current INTEGER;
  v_new     INTEGER;
BEGIN
  v_current := get_vibe_balance(p_fingerprint);
  v_new     := v_current + p_delta;
  INSERT INTO vibe_credits (guest_fingerprint, delta, balance_after, reason, session_id)
  VALUES (p_fingerprint, p_delta, v_new, p_reason, p_session_id);
  RETURN v_new;
END;
$$ LANGUAGE plpgsql;

-- ─── GDPR Cleanup Function ───────────────────────────────────────────────────
-- Run nightly via cron. Deletes expired session data.
-- Schedule: SELECT cleanup_expired_data(); in a pg_cron job.

CREATE OR REPLACE FUNCTION cleanup_expired_data()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER := 0;
BEGIN
  DELETE FROM rlhf_signals WHERE retained_until < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  DELETE FROM session_tracks
    WHERE session_id IN (
      SELECT id FROM sessions WHERE retained_until < NOW()
    );
  DELETE FROM sessions WHERE retained_until < NOW();
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

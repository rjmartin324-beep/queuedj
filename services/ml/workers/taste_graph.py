"""
Taste Graph — builds and updates style profiles from RLHF signals.

A style profile captures what a crowd responds to:
  - BPM range (avg + variance of positively-rewarded tracks)
  - Camelot key preferences (weighted by reward)
  - Energy curve (energy level by hour-of-night bucket)
  - Genre weights (genre → accumulated reward)
  - Preferred transitions (transition_type → frequency)

Profile is rebuilt from scratch on each call (last 90 days of signals).
Triggered: after session ends, or manually via POST /taste-graph/rebuild.

GDPR: host_fingerprint is a hash of a device ID — never the raw ID.
      No guestId is stored anywhere in this pipeline.
"""

import hashlib
import json
from collections import defaultdict
from typing import Optional

import asyncpg
import structlog

log = structlog.get_logger()


class TasteGraphWorker:
    def __init__(self, redis_client, database_url: str):
        self.redis   = redis_client
        self.db_url  = database_url
        self._db_pool: Optional[asyncpg.Pool] = None

    async def _get_db(self) -> asyncpg.Pool:
        if not self._db_pool:
            self._db_pool = await asyncpg.create_pool(self.db_url, min_size=1, max_size=5)
        return self._db_pool

    async def process_job(self, job_data: dict) -> None:
        host_fingerprint = job_data.get("hostFingerprint")
        if host_fingerprint:
            await self.rebuild_profile(host_fingerprint)

    # ─── Public API ───────────────────────────────────────────────────────────

    @staticmethod
    def fingerprint(raw_host_id: str) -> str:
        """Hash a raw host device ID into an anonymous fingerprint."""
        return hashlib.sha256(raw_host_id.encode()).hexdigest()

    async def rebuild_profile(self, host_fingerprint: str) -> dict:
        """
        Rebuild the style profile for a host from their last 90 days of signals.
        Returns the new profile dict.
        """
        pool = await self._get_db()

        # ── Fetch all signals for this host (via sessions → rlhf_signals) ──
        rows = await pool.fetch(
            """
            SELECT
                r.signal_type,
                r.reward,
                r.isrc,
                r.crowd_state,
                r.transition_type,
                r.created_at,
                t.bpm,
                t.camelot_key,
                t.camelot_type,
                t.energy,
                t.genre,
                EXTRACT(HOUR FROM r.created_at AT TIME ZONE 'UTC') AS hour_of_day
            FROM rlhf_signals r
            JOIN sessions s ON s.id = r.session_id
            LEFT JOIN tracks t ON t.isrc = r.isrc
            WHERE s.host_fingerprint = $1
              AND r.created_at > NOW() - INTERVAL '90 days'
              AND r.isrc IS NOT NULL
            ORDER BY r.created_at
            """,
            host_fingerprint,
        )

        if not rows:
            log.info("taste_graph_no_signals", host=host_fingerprint[:8])
            return {}

        # ── BPM preferences (weight by reward, positive signals only) ───────
        bpm_values, bpm_weights = [], []
        for row in rows:
            if row["bpm"] and row["reward"] > 0:
                bpm_values.append(float(row["bpm"]))
                bpm_weights.append(float(row["reward"]))

        avg_bpm      = _weighted_avg(bpm_values, bpm_weights)
        bpm_variance = _weighted_variance(bpm_values, bpm_weights, avg_bpm)

        # ── Camelot key preferences ──────────────────────────────────────────
        key_scores: dict[str, float] = defaultdict(float)
        for row in rows:
            if row["camelot_key"] and row["camelot_type"]:
                key = f"{row['camelot_key']}{row['camelot_type']}"
                key_scores[key] += float(row["reward"])

        preferred_keys = [
            {"key": int(k[:-1]), "type": k[-1], "weight": round(w, 3)}
            for k, w in sorted(key_scores.items(), key=lambda x: -x[1])
            if w > 0
        ][:6]  # Top 6 keys

        # ── Energy curve by hour of night ────────────────────────────────────
        # Bucket into 4 periods: early (18-21), mid (21-00), peak (00-03), late (03-06)
        hour_buckets: dict[str, list[float]] = {
            "early": [], "mid": [], "peak": [], "late": [], "day": [],
        }
        for row in rows:
            if row["energy"] and row["reward"] > 0:
                h = int(row["hour_of_day"])
                bucket = (
                    "early" if 18 <= h < 21 else
                    "mid"   if 21 <= h < 24 else
                    "peak"  if 0  <= h < 3  else
                    "late"  if 3  <= h < 6  else
                    "day"
                )
                hour_buckets[bucket].append(float(row["energy"]))

        energy_curve = {
            bucket: round(sum(vals) / len(vals), 3) if vals else None
            for bucket, vals in hour_buckets.items()
        }

        # ── Genre weights ────────────────────────────────────────────────────
        genre_acc: dict[str, float] = defaultdict(float)
        for row in rows:
            if row["genre"]:
                genre_acc[row["genre"]] += float(row["reward"])

        # Normalise to [-1, 1] range
        max_abs = max((abs(v) for v in genre_acc.values()), default=1)
        genre_weights = {
            g: round(w / max_abs, 3)
            for g, w in sorted(genre_acc.items(), key=lambda x: -x[1])
        }

        # ── Preferred transitions ────────────────────────────────────────────
        transition_counts: dict[str, int] = defaultdict(int)
        for row in rows:
            if row["transition_type"] and row["reward"] > 0:
                transition_counts[row["transition_type"]] += 1

        total_transitions = sum(transition_counts.values()) or 1
        preferred_transitions = {
            t: round(c / total_transitions, 3)
            for t, c in sorted(transition_counts.items(), key=lambda x: -x[1])
        }

        session_count = len({
            row for row in rows  # proxy — count distinct days
        })

        profile = {
            "avg_bpm":               round(avg_bpm, 2) if avg_bpm else None,
            "bpm_variance":          round(bpm_variance, 2) if bpm_variance else None,
            "preferred_keys":        preferred_keys,
            "energy_curve":          energy_curve,
            "genre_weights":         genre_weights,
            "preferred_transitions": preferred_transitions,
        }

        # ── Persist to style_profiles ────────────────────────────────────────
        await pool.execute(
            """
            INSERT INTO style_profiles
                (host_fingerprint, avg_bpm, bpm_variance, preferred_keys,
                 energy_curve, genre_weights, preferred_transitions, session_count, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
            ON CONFLICT (host_fingerprint) DO UPDATE SET
                avg_bpm               = EXCLUDED.avg_bpm,
                bpm_variance          = EXCLUDED.bpm_variance,
                preferred_keys        = EXCLUDED.preferred_keys,
                energy_curve          = EXCLUDED.energy_curve,
                genre_weights         = EXCLUDED.genre_weights,
                preferred_transitions = EXCLUDED.preferred_transitions,
                session_count         = EXCLUDED.session_count,
                updated_at            = NOW()
            """,
            host_fingerprint,
            profile["avg_bpm"],
            profile["bpm_variance"],
            json.dumps(profile["preferred_keys"]),
            json.dumps(profile["energy_curve"]),
            json.dumps(profile["genre_weights"]),
            json.dumps(profile["preferred_transitions"]),
            session_count,
        )

        log.info("taste_graph_rebuilt",
                 host=host_fingerprint[:8],
                 signals=len(rows),
                 genres=len(genre_weights),
                 avg_bpm=profile["avg_bpm"])

        return profile

    async def get_profile(self, host_fingerprint: str) -> Optional[dict]:
        """Fetch cached style profile from DB."""
        pool = await self._get_db()
        row = await pool.fetchrow(
            "SELECT * FROM style_profiles WHERE host_fingerprint = $1",
            host_fingerprint,
        )
        if not row:
            return None
        return {
            "avgBpm":               row["avg_bpm"],
            "bpmVariance":          row["bpm_variance"],
            "preferredKeys":        row["preferred_keys"],
            "energyCurve":          row["energy_curve"],
            "genreWeights":         row["genre_weights"],
            "preferredTransitions": row["preferred_transitions"],
            "sessionCount":         row["session_count"],
            "updatedAt":            row["updated_at"].isoformat() if row["updated_at"] else None,
        }

    async def recommend_tracks(
        self,
        host_fingerprint: str,
        crowd_state: str = "PEAK",
        hour_of_day: int = 22,
        limit: int = 10,
        lastfm_worker=None,
        seed_isrc: str | None = None,
    ) -> list[dict]:
        """
        Return ranked track recommendations from the tracks table
        that best match the host's style profile.

        If lastfm_worker and seed_isrc are provided, also inject Last.fm
        similar-track candidates (resolved against our tracks table by title+artist).
        """
        profile = await self.get_profile(host_fingerprint)
        if not profile:
            return []

        pool = await self._get_db()

        avg_bpm      = profile["avgBpm"] or 120
        bpm_variance = profile["bpmVariance"] or 20
        genre_weights: dict = profile["genreWeights"] or {}

        # BPM window: ±1.5 standard deviations
        bpm_low  = max(60,  avg_bpm - bpm_variance * 1.5)
        bpm_high = min(200, avg_bpm + bpm_variance * 1.5)

        # Top 3 preferred genres
        top_genres = [g for g, w in sorted(genre_weights.items(), key=lambda x: -x[1]) if w > 0][:3]

        rows = await pool.fetch(
            """
            SELECT isrc, title, artist, bpm, energy, genre, camelot_key, camelot_type
            FROM tracks
            WHERE bpm BETWEEN $1 AND $2
              AND (genre = ANY($3) OR $3 = ARRAY[]::text[])
            ORDER BY RANDOM()
            LIMIT 50
            """,
            bpm_low, bpm_high, top_genres or [],
        )

        # ── Last.fm similar-track injection ───────────────────────────────────
        # Add Last.fm similar tracks as bonus candidates (resolved via our DB)
        extra_isrcs: set[str] = set()
        if lastfm_worker and seed_isrc:
            try:
                similar = await lastfm_worker.get_similar_by_isrc(seed_isrc, limit=20)
                for sim in similar:
                    # Look up by artist + title fuzzy match
                    matched = await pool.fetch(
                        """
                        SELECT isrc, title, artist, bpm, energy, genre, camelot_key, camelot_type
                        FROM tracks
                        WHERE title ILIKE $1 AND artist ILIKE $2
                        LIMIT 2
                        """,
                        f"%{sim['title']}%", f"%{sim['artist']}%",
                    )
                    for m in matched:
                        if m["isrc"] not in extra_isrcs:
                            extra_isrcs.add(m["isrc"])
                            rows = list(rows) + [m]
            except Exception as e:
                log.warning("lastfm_injection_failed", error=str(e))

        # Score each candidate
        seen: set[str] = set()
        scored = []
        for row in rows:
            if row["isrc"] in seen:
                continue
            seen.add(row["isrc"])
            score = _score_candidate(row, profile, crowd_state, hour_of_day)
            # Small bonus for Last.fm similar tracks
            if row["isrc"] in extra_isrcs:
                score += 0.05
            scored.append({
                "isrc":   row["isrc"],
                "title":  row["title"],
                "artist": row["artist"],
                "bpm":    float(row["bpm"]) if row["bpm"] else None,
                "energy": float(row["energy"]) if row["energy"] else None,
                "genre":  row["genre"],
                "score":  round(score, 3),
            })

        scored.sort(key=lambda x: -x["score"])
        return scored[:limit]


# ─── Scoring Helpers ──────────────────────────────────────────────────────────

def _score_candidate(row: dict, profile: dict, crowd_state: str, hour_of_day: int) -> float:
    score = 0.0

    # BPM proximity
    avg_bpm = profile["avgBpm"] or 120
    bpm_variance = profile["bpmVariance"] or 20
    if row["bpm"]:
        bpm_delta = abs(float(row["bpm"]) - avg_bpm)
        score += max(0, 1.0 - bpm_delta / max(bpm_variance, 1)) * 0.35

    # Genre preference
    genre_weights: dict = profile["genreWeights"] or {}
    if row["genre"] and row["genre"] in genre_weights:
        score += max(0, genre_weights[row["genre"]]) * 0.30

    # Energy fit for time of night
    energy_curve: dict = profile["energyCurve"] or {}
    bucket = (
        "early" if 18 <= hour_of_day < 21 else
        "mid"   if 21 <= hour_of_day < 24 else
        "peak"  if 0  <= hour_of_day < 3  else
        "late"  if 3  <= hour_of_day < 6  else
        "day"
    )
    target_energy = energy_curve.get(bucket)
    if target_energy and row["energy"]:
        energy_delta = abs(float(row["energy"]) - target_energy)
        score += max(0, 1.0 - energy_delta * 2) * 0.20

    # Camelot key preference
    preferred_keys: list = profile["preferredKeys"] or []
    if row["camelot_key"] and row["camelot_type"] and preferred_keys:
        for pk in preferred_keys[:3]:
            if pk["key"] == row["camelot_key"] and pk["type"] == row["camelot_type"]:
                score += pk["weight"] * 0.15
                break

    return score


def _weighted_avg(values: list[float], weights: list[float]) -> float:
    if not values:
        return 0.0
    total_weight = sum(weights)
    if total_weight == 0:
        return sum(values) / len(values)
    return sum(v * w for v, w in zip(values, weights)) / total_weight


def _weighted_variance(values: list[float], weights: list[float], mean: float) -> float:
    if len(values) < 2:
        return 0.0
    total_weight = sum(weights)
    if total_weight == 0:
        return 0.0
    return sum(w * (v - mean) ** 2 for v, w in zip(values, weights)) / total_weight

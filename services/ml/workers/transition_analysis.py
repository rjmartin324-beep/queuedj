"""
Transition Analysis Worker — Vibe Guardrail + Compatibility Scorer

Phase 0-3: Rule-based scoring (BPM delta, Camelot wheel, energy delta)
Phase 4+:  ML-assisted (LSTM crowd state model, learned compatibility weights)
Phase 5+:  Transition Sandbox (render candidate transitions, score all 5 axes)

Cold Start Fallback:
  New session with no history → use rule-based scoring only.
  This must always work. ML is an enhancement, not a dependency.
"""

import os
from typing import Optional

import asyncpg
import structlog

from .audio_analysis import CAMELOT_MAP

log = structlog.get_logger()

# ─── Camelot Compatibility ────────────────────────────────────────────────────
# Compatibility score between two Camelot positions (0–1)

def camelot_score(key_a: int, type_a: str, key_b: int, type_b: str) -> float:
    if key_a == key_b and type_a == type_b:
        return 1.0                          # Perfect match
    if type_a == type_b:
        diff = min(abs(key_a - key_b), 12 - abs(key_a - key_b))
        if diff == 1:  return 0.8           # Adjacent — clean mix
        if diff == 2:  return 0.4
        return 0.1
    else:
        if key_a == key_b:  return 0.7     # Relative major/minor
        return 0.1                          # Cross-mode clash

# ─── BPM Compatibility ────────────────────────────────────────────────────────
# Handles double-time / half-time: 128 BPM ↔ 64 BPM is the same groove

def normalize_bpm(bpm: float) -> float:
    """Collapse to 60–120 canonical tempo range."""
    b = bpm
    while b > 120: b /= 2
    while b < 60:  b *= 2
    return b

def bpm_score(bpm_a: float, bpm_b: float) -> float:
    direct_delta     = abs(bpm_a - bpm_b)
    normalized_delta = abs(normalize_bpm(bpm_a) - normalize_bpm(bpm_b))
    delta = min(direct_delta, normalized_delta)

    if delta <= 2:   return 1.0
    if delta <= 8:   return 0.85
    if delta <= 15:  return 0.6
    if delta <= 25:  return 0.35
    if delta <= 40:  return 0.15
    return 0.0

# ─── Energy Compatibility ─────────────────────────────────────────────────────

def energy_score(energy_a: float, energy_b: float) -> float:
    delta = abs(energy_a - energy_b)
    if delta <= 0.1:  return 1.0
    if delta <= 0.2:  return 0.8
    if delta <= 0.35: return 0.5
    if delta <= 0.5:  return 0.3
    return 0.1

# ─── Crowd State BPM Penalties ───────────────────────────────────────────────
# Penalize transitions that go against the crowd state trajectory

CROWD_STATE_ENERGY_TARGETS = {
    "WARMUP":   0.3,
    "RISING":   0.55,
    "PEAK":     0.85,
    "FATIGUE":  0.4,
    "RECOVERY": 0.35,
    "COOLDOWN": 0.2,
}

def crowd_state_penalty(next_energy: float, crowd_state: str) -> float:
    target = CROWD_STATE_ENERGY_TARGETS.get(crowd_state, 0.5)
    delta = abs(next_energy - target)
    return max(0.0, 1.0 - (delta * 2))  # 0.5 delta = 0 score

# ─── Transition Type Recommendation ──────────────────────────────────────────

def recommend_transition(
    bpm_delta: float,
    camelot_compat: float,
    energy_delta: float,
) -> str:
    if bpm_delta <= 2 and camelot_compat >= 0.8:
        return "harmonic_blend"
    if bpm_delta <= 10 and camelot_compat >= 0.7:
        return "crossfade"
    if energy_delta > 0.4:
        return "echo_out"    # Use echo to soften the energy drop/spike
    if bpm_delta > 20:
        return "bridge"      # Too far — insert a bridge track
    return "crossfade"

# ─── Main Worker ──────────────────────────────────────────────────────────────

class TransitionAnalysisWorker:
    def __init__(self, redis_client, database_url: str):
        self.redis = redis_client
        self.db_url = database_url
        self._db_pool: Optional[asyncpg.Pool] = None

    async def _get_db(self) -> asyncpg.Pool:
        if not self._db_pool:
            self._db_pool = await asyncpg.create_pool(self.db_url, min_size=1, max_size=3)
        return self._db_pool

    async def process_job(self, job_data: dict) -> dict:
        return await self.check_compatibility(
            isrc_a=job_data["currentTrackIsrc"],
            isrc_b=job_data["nextTrackIsrc"],
            crowd_state=job_data.get("crowdState", "PEAK"),
        )

    async def check_compatibility(
        self,
        isrc_a: str,
        isrc_b: str,
        crowd_state: str = "PEAK",
    ) -> dict:
        track_a = await self._get_track(isrc_a)
        track_b = await self._get_track(isrc_b)

        # ─── Cold Start Fallback ──────────────────────────────────────────────
        # If either track has no analysis data, return a neutral mid-score.
        # Never block the queue because we lack data.
        if not track_a or not track_b:
            log.warning("compatibility_missing_data", isrc_a=isrc_a, isrc_b=isrc_b)
            return self._neutral_result()

        bpm_a = track_a.get("bpm") or 120.0
        bpm_b = track_b.get("bpm") or 120.0
        key_a = track_a.get("camelot_key") or 1
        key_b = track_b.get("camelot_key") or 1
        type_a = track_a.get("camelot_type") or "B"
        type_b = track_b.get("camelot_type") or "B"
        energy_a = track_a.get("energy") or 0.5
        energy_b = track_b.get("energy") or 0.5
        dance_a = track_a.get("danceability")
        dance_b = track_b.get("danceability")

        bpm_delta = abs(bpm_a - bpm_b)
        energy_delta = abs(energy_a - energy_b)

        bpm_compat    = bpm_score(bpm_a, bpm_b)
        camelot_compat = camelot_score(key_a, type_a, key_b, type_b)
        energy_compat = energy_score(energy_a, energy_b)
        crowd_compat  = crowd_state_penalty(energy_b, crowd_state)

        # Danceability bonus: reward pairings that keep the dance floor engaged
        # Small bonus (max +0.08) when both tracks have similar danceability
        dance_bonus = 0.0
        if dance_a is not None and dance_b is not None:
            dance_delta = abs(dance_a - dance_b)
            dance_bonus = max(0.0, 0.08 * (1.0 - dance_delta * 2))

        # Weighted composite score
        # BPM and Camelot are most critical for perceived mix quality
        composite = (
            bpm_compat     * 0.35 +
            camelot_compat * 0.30 +
            energy_compat  * 0.20 +
            crowd_compat   * 0.15 +
            dance_bonus
        )
        composite = min(1.0, composite)

        # Vibe distance: inverse of compatibility (0 = same vibe, 1 = total mismatch)
        vibe_distance = round(1.0 - composite, 3)

        return {
            "score": round(composite, 3),
            "bpm_delta": round(bpm_delta, 2),
            "camelot_compatibility": round(camelot_compat, 3),
            "energy_delta": round(energy_delta, 3),
            "recommended_transition": recommend_transition(bpm_delta, camelot_compat, energy_delta),
            "vibe_distance_score": vibe_distance,
        }

    async def _get_track(self, isrc: str) -> Optional[dict]:
        try:
            pool = await self._get_db()
            row = await pool.fetchrow(
                "SELECT bpm, camelot_key, camelot_type, energy, danceability FROM tracks WHERE isrc = $1",
                isrc,
            )
            return dict(row) if row else None
        except Exception as e:
            log.error("get_track_failed", isrc=isrc, error=str(e))
            return None

    def _neutral_result(self) -> dict:
        """
        Returned when track data is missing.
        Score of 0.5 means: "we don't know — let it through with a warning."
        Caller shows a yellow flag (not red), and the host decides.
        """
        return {
            "score": 0.5,
            "bpm_delta": 0,
            "camelot_compatibility": 0.5,
            "energy_delta": 0,
            "recommended_transition": "crossfade",
            "vibe_distance_score": 0.5,
        }

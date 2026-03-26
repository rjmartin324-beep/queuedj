"""
ReccoBeats API Worker — fetches audio features (tempo, energy, danceability, valence)
for a track by ISRC and stores them in the tracks table.

API: GET https://api.reccobeats.com/v1/track?isrc=ISRC
Free tier: 1000 req/day — used only when our tracks table is missing features.
Falls back gracefully if unavailable (returns existing data unchanged).
"""

import os
from typing import Optional

import asyncpg
import httpx
import structlog

log = structlog.get_logger()

RECCOBEATS_API_KEY = os.getenv("RECCOBEATS_API_KEY", "")
RECCOBEATS_BASE    = "https://api.reccobeats.com/v1"


class ReccoBeatsWorker:
    def __init__(self, redis_client, database_url: str):
        self.redis   = redis_client
        self.db_url  = database_url
        self._db_pool: Optional[asyncpg.Pool] = None

    async def _get_db(self) -> asyncpg.Pool:
        if not self._db_pool:
            self._db_pool = await asyncpg.create_pool(self.db_url, min_size=1, max_size=3)
        return self._db_pool

    async def process_job(self, job_data: dict) -> dict:
        return await self.enrich(job_data["isrc"])

    async def enrich(self, isrc: str) -> dict:
        """
        Fetch audio features from ReccoBeats for the given ISRC and write
        them back to the tracks table. Returns the feature dict on success,
        empty dict on error.
        """
        if not RECCOBEATS_API_KEY:
            log.warning("reccobeats_no_api_key", isrc=isrc)
            return {}

        try:
            async with httpx.AsyncClient(timeout=8) as client:
                resp = await client.get(
                    f"{RECCOBEATS_BASE}/track",
                    params={"isrc": isrc},
                    headers={"Authorization": f"Bearer {RECCOBEATS_API_KEY}"},
                )
                if resp.status_code == 404:
                    log.info("reccobeats_not_found", isrc=isrc)
                    return {}
                resp.raise_for_status()
                data = resp.json()
        except Exception as e:
            log.error("reccobeats_request_failed", isrc=isrc, error=str(e))
            return {}

        # ReccoBeats returns a 'track' object with audio features
        track = data.get("track") or data
        features = {
            "tempo":        track.get("tempo"),          # BPM (float)
            "energy":       track.get("energy"),         # 0.0–1.0
            "danceability": track.get("danceability"),   # 0.0–1.0
            "valence":      track.get("valence"),        # 0.0–1.0 (positivity)
        }

        # Filter out None values
        features = {k: v for k, v in features.items() if v is not None}
        if not features:
            return {}

        await self._write_features(isrc, features)
        log.info("reccobeats_enriched", isrc=isrc, fields=list(features.keys()))
        return features

    async def _write_features(self, isrc: str, features: dict):
        """
        Merge ReccoBeats features into the tracks row.
        Only overwrites if our existing confidence is < 0.6 (i.e. we don't have
        Librosa/Spotify data yet). ReccoBeats confidence = 0.55.
        """
        pool = await self._get_db()

        sets = []
        vals = []
        i = 2  # $1 is reserved for isrc

        if "tempo" in features:
            sets.append(f"bpm = CASE WHEN analysis_confidence < 0.6 THEN ${i} ELSE bpm END")
            vals.append(float(features["tempo"]))
            i += 1
        if "energy" in features:
            sets.append(f"energy = CASE WHEN analysis_confidence < 0.6 THEN ${i} ELSE energy END")
            vals.append(float(features["energy"]))
            i += 1
        if "danceability" in features:
            sets.append(f"danceability = ${i}")
            vals.append(float(features["danceability"]))
            i += 1
        if "valence" in features:
            sets.append(f"valence = CASE WHEN valence IS NULL THEN ${i} ELSE valence END")
            vals.append(float(features["valence"]))
            i += 1

        if not sets:
            return

        # Always update analysis metadata when ReccoBeats adds data
        sets.append(
            "analysis_source = CASE WHEN analysis_confidence < 0.55 "
            "THEN 'reccobeats' ELSE analysis_source END"
        )
        sets.append(
            "analysis_confidence = GREATEST(analysis_confidence, 0.55)"
        )
        sets.append("updated_at = NOW()")

        sql = f"UPDATE tracks SET {', '.join(sets)} WHERE isrc = $1"
        try:
            await pool.execute(sql, isrc, *vals)
        except Exception as e:
            log.error("reccobeats_write_failed", isrc=isrc, error=str(e))

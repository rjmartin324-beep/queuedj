"""
TheAudioDB Worker — fetches genre, mood, bio, and images for an artist.

API: GET https://theaudiodb.com/api/v1/json/{API_KEY}/search.php?s=ARTIST
Free tier: API_KEY = "1", 1 req/sec limit.
Results cached in Redis (TTL 7 days) — artist metadata rarely changes.
"""

import json
import os
from typing import Optional

import asyncpg
import httpx
import structlog

log = structlog.get_logger()

THEAUDIODB_API_KEY = os.getenv("THEAUDIODB_API_KEY", "1")
THEAUDIODB_BASE    = f"https://theaudiodb.com/api/v1/json/{THEAUDIODB_API_KEY}"
CACHE_TTL          = 604_800  # 7 days


class TheAudioDBWorker:
    def __init__(self, redis_client, database_url: str):
        self.redis   = redis_client
        self.db_url  = database_url
        self._db_pool: Optional[asyncpg.Pool] = None

    async def _get_db(self) -> asyncpg.Pool:
        if not self._db_pool:
            self._db_pool = await asyncpg.create_pool(self.db_url, min_size=1, max_size=3)
        return self._db_pool

    async def process_job(self, job_data: dict) -> dict:
        return await self.enrich_by_isrc(job_data["isrc"])

    # ─── Public API ───────────────────────────────────────────────────────────

    async def enrich_by_isrc(self, isrc: str) -> dict:
        """Look up the artist for this ISRC, then enrich via TheAudioDB."""
        pool = await self._get_db()
        row = await pool.fetchrow(
            "SELECT artist FROM tracks WHERE isrc = $1", isrc
        )
        if not row:
            return {}
        result = await self.fetch_artist(row["artist"])
        if result:
            await self._write_to_tracks(isrc, result)
        return result

    async def fetch_artist(self, artist: str) -> dict:
        """
        Fetch genre, mood, bio, and image for an artist.
        Returns a flat dict with the fields we store.
        """
        if not artist:
            return {}

        cache_key = f"theaudiodb:artist:{artist.lower()[:100]}"
        try:
            cached = await self.redis.get(cache_key)
            if cached:
                return json.loads(cached)
        except Exception:
            pass

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    f"{THEAUDIODB_BASE}/search.php",
                    params={"s": artist},
                )
                resp.raise_for_status()
                data = resp.json()
        except Exception as e:
            log.error("theaudiodb_request_failed", artist=artist, error=str(e))
            return {}

        artists = data.get("artists")
        if not artists:
            return {}

        a = artists[0]
        result = {
            "genre":            a.get("strGenre") or a.get("strStyle"),
            "mood":             a.get("strMood"),
            "artist_bio":       a.get("strBiographyEN"),
            "artist_image_url": a.get("strArtistThumb") or a.get("strArtistFanart"),
        }
        result = {k: v for k, v in result.items() if v}

        try:
            await self.redis.set(cache_key, json.dumps(result), ex=CACHE_TTL)
        except Exception:
            pass

        log.info("theaudiodb_fetched", artist=artist, fields=list(result.keys()))
        return result

    async def _write_to_tracks(self, isrc: str, data: dict):
        """Merge TheAudioDB data into the tracks row. Never overwrites existing values."""
        pool = await self._get_db()
        try:
            await pool.execute(
                """
                UPDATE tracks SET
                  genre           = COALESCE(genre, $2),
                  mood            = COALESCE(mood, $3),
                  artist_bio      = COALESCE(artist_bio, $4),
                  artist_image_url = COALESCE(artist_image_url, $5),
                  updated_at      = NOW()
                WHERE isrc = $1
                """,
                isrc,
                data.get("genre"),
                data.get("mood"),
                data.get("artist_bio"),
                data.get("artist_image_url"),
            )
        except Exception as e:
            log.error("theaudiodb_write_failed", isrc=isrc, error=str(e))

"""
Last.fm Worker — fetches similar tracks for a given artist+title.
Feeds into taste_graph.py recommend_tracks as an additional candidate source.

API: GET https://ws.audioscrobbler.com/2.0/
     ?method=track.getSimilar&artist=X&track=X&api_key=KEY&format=json

Results are cached in Redis (TTL 24h) to stay within the 5 req/sec free tier.
"""

import json
import os
from typing import Optional

import asyncpg
import httpx
import structlog

log = structlog.get_logger()

LASTFM_API_KEY  = os.getenv("LASTFM_API_KEY", "")
LASTFM_BASE     = "https://ws.audioscrobbler.com/2.0/"
CACHE_TTL       = 86_400   # 24 hours


class LastFmWorker:
    def __init__(self, redis_client, database_url: str):
        self.redis   = redis_client
        self.db_url  = database_url
        self._db_pool: Optional[asyncpg.Pool] = None

    async def _get_db(self) -> asyncpg.Pool:
        if not self._db_pool:
            self._db_pool = await asyncpg.create_pool(self.db_url, min_size=1, max_size=3)
        return self._db_pool

    async def process_job(self, job_data: dict) -> list[dict]:
        return await self.get_similar(
            artist=job_data.get("artist", ""),
            title=job_data.get("title", ""),
            limit=job_data.get("limit", 10),
        )

    async def get_similar(self, artist: str, title: str, limit: int = 10) -> list[dict]:
        """
        Returns a list of similar tracks as {artist, title, match (0–1)} dicts.
        Results are Redis-cached for 24 hours.
        """
        if not LASTFM_API_KEY or not artist or not title:
            return []

        cache_key = f"lastfm:similar:{artist}:{title}".lower()[:200]

        # ── Check Redis cache ─────────────────────────────────────────────────
        try:
            cached = await self.redis.get(cache_key)
            if cached:
                return json.loads(cached)[:limit]
        except Exception:
            pass

        # ── Fetch from Last.fm ────────────────────────────────────────────────
        try:
            async with httpx.AsyncClient(timeout=8) as client:
                resp = await client.get(LASTFM_BASE, params={
                    "method":  "track.getSimilar",
                    "artist":  artist,
                    "track":   title,
                    "api_key": LASTFM_API_KEY,
                    "format":  "json",
                    "limit":   50,
                })
                resp.raise_for_status()
                data = resp.json()
        except Exception as e:
            log.error("lastfm_request_failed", artist=artist, title=title, error=str(e))
            return []

        similar_raw = data.get("similartracks", {}).get("track", [])
        if isinstance(similar_raw, dict):
            similar_raw = [similar_raw]

        results = [
            {
                "artist": t.get("artist", {}).get("name", "") if isinstance(t.get("artist"), dict) else t.get("artist", ""),
                "title":  t.get("name", ""),
                "match":  float(t.get("match", 0)),
            }
            for t in similar_raw
            if t.get("name")
        ]

        # ── Cache results ─────────────────────────────────────────────────────
        try:
            await self.redis.set(cache_key, json.dumps(results), ex=CACHE_TTL)
        except Exception:
            pass

        log.info("lastfm_similar_fetched",
                 artist=artist, title=title, count=len(results))
        return results[:limit]

    async def get_similar_by_isrc(self, isrc: str, limit: int = 10) -> list[dict]:
        """
        Convenience wrapper: look up artist/title from tracks table, then call get_similar.
        """
        pool = await self._get_db()
        row = await pool.fetchrow(
            "SELECT title, artist FROM tracks WHERE isrc = $1", isrc
        )
        if not row:
            return []
        return await self.get_similar(
            artist=row["artist"],
            title=row["title"],
            limit=limit,
        )

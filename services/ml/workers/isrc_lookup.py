"""
ISRC Lookup Worker — resolves ISRC from AcoustID fingerprint + MusicBrainz enrichment.
Caches results in the tracks table.
"""

import os
import asyncio
import asyncpg
import httpx
import structlog
from typing import Optional

log = structlog.get_logger()

ACOUSTID_API = "https://api.acoustid.org/v2/lookup"
MUSICBRAINZ_API = "https://musicbrainz.org/ws/2"
ACOUSTID_KEY = os.getenv("ACOUSTID_API_KEY", "")


class ISRCLookupWorker:
    def __init__(self, redis_client, database_url: str):
        self.redis   = redis_client
        self.db_url  = database_url
        self._db_pool: Optional[asyncpg.Pool] = None

    async def _get_db(self) -> asyncpg.Pool:
        if not self._db_pool:
            self._db_pool = await asyncpg.create_pool(self.db_url, min_size=1, max_size=3)
        return self._db_pool

    async def process_job(self, job_data: dict) -> dict:
        return await self.lookup(
            fingerprint=job_data.get("fingerprint", ""),
            duration=job_data.get("duration", 0),
        )

    async def lookup(self, fingerprint: str, duration: float) -> dict:
        if not fingerprint or not ACOUSTID_KEY:
            return {"isrc": None, "error": "missing_fingerprint_or_key"}

        async with httpx.AsyncClient(timeout=10) as client:
            try:
                res = await client.get(ACOUSTID_API, params={
                    "client": ACOUSTID_KEY,
                    "fingerprint": fingerprint,
                    "duration": int(duration),
                    "meta": "recordings",
                })
                data = res.json()
            except Exception as e:
                log.error("acoustid_request_failed", error=str(e))
                return {"isrc": None, "error": str(e)}

        results = data.get("results", [])
        if not results:
            return {"isrc": None, "error": "no_match"}

        # Take highest confidence result
        best = max(results, key=lambda r: r.get("score", 0))
        if best.get("score", 0) < 0.5:
            return {"isrc": None, "error": "low_confidence"}

        recordings = best.get("recordings", [])
        if not recordings:
            return {"isrc": None, "error": "no_recordings"}

        rec = recordings[0]
        isrc_list = rec.get("isrcs", [])
        isrc = isrc_list[0] if isrc_list else None

        title  = rec.get("title", "")
        artists = rec.get("artists", [])
        artist = artists[0].get("name", "") if artists else ""

        if not isrc:
            return {"isrc": isrc, "title": title, "artist": artist, "confidence": best.get("score", 0)}

        # Enrich with full MusicBrainz metadata (genre/tags/release_date)
        mb_data = await self._fetch_musicbrainz(isrc)
        await self._cache_track(isrc, title, artist, mb_data)

        return {
            "isrc":         isrc,
            "title":        title,
            "artist":       artist,
            "confidence":   best.get("score", 0),
            "genre":        mb_data.get("genre"),
            "release_date": mb_data.get("release_date"),
        }

    async def _fetch_musicbrainz(self, isrc: str) -> dict:
        """
        Query MusicBrainz for genre tags and release date using the ISRC.
        Returns a dict with genre (str | None) and release_date (str | None).
        """
        ua = os.getenv("MUSICBRAINZ_USER_AGENT", "QueueDJ/0.1 (contact@queuedj.com)")
        headers = {"User-Agent": ua, "Accept": "application/json"}

        try:
            async with httpx.AsyncClient(timeout=10, headers=headers) as client:
                # Look up recording by ISRC — include tags and release dates
                res = await client.get(
                    f"{MUSICBRAINZ_API}/recording",
                    params={
                        "query":  f"isrc:{isrc}",
                        "fmt":    "json",
                        "inc":    "tags+releases",
                        "limit":  1,
                    },
                )
                res.raise_for_status()
                data = res.json()
        except Exception as e:
            log.warning("musicbrainz_enrich_failed", isrc=isrc, error=str(e))
            return {}

        recordings = data.get("recordings", [])
        if not recordings:
            return {}

        rec = recordings[0]

        # ── Genre from tags ───────────────────────────────────────────────────
        tags = rec.get("tags", [])
        # Tags sorted by count (popularity). Take the most popular genre-like tag.
        # Filter out non-genre meta-tags like "seen live", "favorites", etc.
        NON_GENRE = {"seen live", "favorites", "loved", "wishlist", "own it",
                     "good", "great", "awesome", "best", "classic"}
        genre_tags = [
            t["name"] for t in sorted(tags, key=lambda x: -x.get("count", 0))
            if t.get("name", "").lower() not in NON_GENRE
        ]
        genre = genre_tags[0].title() if genre_tags else None

        # ── Release date ─────────────────────────────────────────────────────
        releases = rec.get("releases", [])
        release_date = None
        if releases:
            # Take earliest release date
            dates = [r.get("date", "") for r in releases if r.get("date")]
            dates.sort()
            release_date = dates[0] if dates else None
            # Normalise to YYYY-MM-DD (MusicBrainz sometimes gives YYYY or YYYY-MM)
            if release_date and len(release_date) == 4:
                release_date = f"{release_date}-01-01"
            elif release_date and len(release_date) == 7:
                release_date = f"{release_date}-01"

        return {"genre": genre, "release_date": release_date}

    async def _cache_track(self, isrc: str, title: str, artist: str, mb_data: dict | None = None):
        try:
            pool = await self._get_db()
            mb_data = mb_data or {}
            await pool.execute(
                """INSERT INTO tracks (isrc, title, artist, genre, release_date)
                   VALUES ($1, $2, $3, $4, $5::date)
                   ON CONFLICT (isrc) DO UPDATE SET
                     genre        = COALESCE(tracks.genre, EXCLUDED.genre),
                     release_date = COALESCE(tracks.release_date, EXCLUDED.release_date)""",
                isrc, title, artist,
                mb_data.get("genre"),
                mb_data.get("release_date"),
            )
        except Exception as e:
            log.warning("cache_track_failed", isrc=isrc, error=str(e))

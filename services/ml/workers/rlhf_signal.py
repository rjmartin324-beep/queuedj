"""
RLHF Signal Worker — consumes signal jobs from BullMQ and writes to PostgreSQL.
Gated by FEATURE_RLHF_LOGGING env flag.
"""

import os
import asyncpg
import structlog
from typing import Optional

log = structlog.get_logger()

ENABLED = os.getenv("FEATURE_RLHF_LOGGING", "false").lower() == "true"

SIGNAL_TYPE_MAP = {
    "track_request":  "vote_up",
    "vote_up":        "vote_up",
    "vote_down":      "vote_down",
    "track_skip":     "skip",
    "track_complete": "play_extended",
    "crowd_drop":     "crowd_energy_down",
}

REWARD_MAP = {
    "track_request":  0.3,
    "vote_up":        0.5,
    "vote_down":      -0.3,
    "track_skip":     -0.8,
    "track_complete": 1.0,
    "crowd_drop":     -0.5,
}


class RLHFSignalWorker:
    def __init__(self, redis_client, database_url: str):
        self.redis   = redis_client
        self.db_url  = database_url
        self._db_pool: Optional[asyncpg.Pool] = None

    async def _get_db(self) -> asyncpg.Pool:
        if not self._db_pool:
            self._db_pool = await asyncpg.create_pool(self.db_url, min_size=1, max_size=3)
        return self._db_pool

    async def process_job(self, job_data: dict) -> None:
        if not ENABLED:
            return

        room_id    = job_data.get("roomId")
        isrc       = job_data.get("isrc")
        signal_raw = job_data.get("signalType", "vote_up")
        crowd_state = job_data.get("crowdState")

        signal_type = SIGNAL_TYPE_MAP.get(signal_raw, "vote_up")
        reward      = REWARD_MAP.get(signal_raw, 0.0)

        try:
            pool = await self._get_db()

            # Look up active session for this room
            session = await pool.fetchrow(
                "SELECT id FROM sessions WHERE room_code = $1 AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1",
                room_id,
            )
            if not session:
                return

            await pool.execute(
                """INSERT INTO rlhf_signals
                     (session_id, signal_type, reward, isrc, crowd_state)
                   VALUES ($1, $2, $3, $4, $5)""",
                session["id"], signal_type, reward, isrc, crowd_state,
            )
            log.debug("rlhf_signal_logged", signal_type=signal_type, reward=reward, isrc=isrc)

        except Exception as e:
            log.error("rlhf_signal_failed", error=str(e))

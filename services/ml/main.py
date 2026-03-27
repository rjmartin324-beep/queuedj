"""
QueueDJ — ML Service (Python + FastAPI)

Handles:
  - BPM / Key / Energy analysis (Librosa + AudioFlux)
  - ISRC fingerprint lookup (AcoustID + MusicBrainz)
  - Transition analysis (Vibe Guardrail + Compatibility Scorer)
  - BullMQ job consumption from Redis

Workers are background tasks that consume from Redis/BullMQ queues.
REST endpoints are for direct calls (health, manual analysis).
"""

import asyncio
import os
import json
import logging
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import redis.asyncio as aioredis

from workers.audio_analysis import AudioAnalysisWorker
from workers.isrc_lookup import ISRCLookupWorker
from workers.transition_analysis import TransitionAnalysisWorker
from workers.rlhf_signal import RLHFSignalWorker
from workers.taste_graph import TasteGraphWorker
from workers.reccobeats import ReccoBeatsWorker
from workers.lastfm import LastFmWorker
from workers.theaudiodb import TheAudioDBWorker
from workers.stem_separation import StemSeparationWorker
from workers.bullmq_consumer import BullMQConsumer

# ─── Logging ──────────────────────────────────────────────────────────────────

structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ]
)
log = structlog.get_logger()

# ─── Config ───────────────────────────────────────────────────────────────────

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
DATABASE_URL = os.getenv("DATABASE_URL", "")
PORT = int(os.getenv("PORT", "8000"))

FEATURE_RLHF_LOGGING = os.getenv("FEATURE_RLHF_LOGGING", "false").lower() == "true"
FEATURE_STEM_SEPARATION = os.getenv("FEATURE_STEM_SEPARATION", "false").lower() == "true"

# ─── Startup / Shutdown ───────────────────────────────────────────────────────

consumer: BullMQConsumer | None = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start BullMQ consumers on startup, shut down cleanly on exit."""
    global consumer

    redis_client = await aioredis.from_url(REDIS_URL, decode_responses=True)

    workers = {
        "audio_analysis":      AudioAnalysisWorker(redis_client, DATABASE_URL),
        "isrc_lookup":         ISRCLookupWorker(redis_client, DATABASE_URL),
        "transition_analysis": TransitionAnalysisWorker(redis_client, DATABASE_URL),
        "taste_graph":         TasteGraphWorker(redis_client, DATABASE_URL),
        "reccobeats":          ReccoBeatsWorker(redis_client, DATABASE_URL),
        "lastfm":              LastFmWorker(redis_client, DATABASE_URL),
        "theaudiodb":          TheAudioDBWorker(redis_client, DATABASE_URL),
    }

    # GDPR gate: only start RLHF worker if feature flag is enabled
    if FEATURE_RLHF_LOGGING:
        workers["rlhf_signal"] = RLHFSignalWorker(redis_client, DATABASE_URL)
        log.info("rlhf_worker_started")

    # Stem separation: only start if feature flag is enabled
    # Requires demucs, torch, torchaudio in requirements.txt (uncomment to activate)
    if FEATURE_STEM_SEPARATION:
        workers["stem_separation"] = StemSeparationWorker(redis_client, DATABASE_URL)
        log.info("stem_separation_worker_started")

    consumer = BullMQConsumer(redis_client, workers)
    asyncio.create_task(consumer.start())
    log.info("ml_service_started", redis=REDIS_URL)

    yield

    # Graceful shutdown: finish active jobs, don't drop in-flight work
    if consumer:
        await consumer.stop()
    await redis_client.aclose()
    log.info("ml_service_stopped")

# ─── App ──────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="QueueDJ ML Service",
    version="0.1.0",
    lifespan=lifespan,
)

_cors_origins_raw = os.getenv("ALLOWED_ORIGINS", "http://localhost:3001,http://localhost:3002")
_cors_origins = [o.strip() for o in _cors_origins_raw.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# ─── Models ───────────────────────────────────────────────────────────────────

class AnalyzeTrackRequest(BaseModel):
    isrc: str
    local_file_path: str | None = None
    acoustid_fingerprint: str | None = None
    priority: str = "bpm_key_only"  # or "full"

class AnalyzeTrackResponse(BaseModel):
    isrc: str
    bpm: float | None
    camelot_key: int | None
    camelot_type: str | None       # 'A' or 'B'
    energy: float | None
    analysis_confidence: float
    analysis_source: str
    downbeat_offset_ms: int | None = None

class CompatibilityRequest(BaseModel):
    isrc_a: str
    isrc_b: str
    crowd_state: str

class CompatibilityResponse(BaseModel):
    score: float                   # 0–1 (1 = perfect match)
    bpm_delta: float
    camelot_compatibility: float
    energy_delta: float
    recommended_transition: str
    vibe_distance_score: float     # 0–1 (0 = same vibe, 1 = total mismatch)

class BatchCompatibilityRequest(BaseModel):
    current_isrc: str              # Now-playing track
    queue_isrcs: list[str]         # All tracks in queue
    crowd_state: str = "PEAK"

class BatchCompatibilityItem(BaseModel):
    isrc: str
    score: float
    vibe_distance_score: float
    recommended_transition: str

class BatchCompatibilityResponse(BaseModel):
    results: list[BatchCompatibilityItem]

# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    queue_health = await consumer.get_health() if consumer else {}
    return {
        "status": "ok",
        "features": {
            "rlhf_logging":     FEATURE_RLHF_LOGGING,
            "stem_separation":  FEATURE_STEM_SEPARATION,
        },
        "queues": queue_health,
    }

@app.post("/analyze", response_model=AnalyzeTrackResponse)
async def analyze_track(req: AnalyzeTrackRequest):
    """
    Direct analysis endpoint — use for urgent track analysis.
    For background analysis, prefer the BullMQ queue (ml:high).
    """
    worker = AudioAnalysisWorker.__new__(AudioAnalysisWorker)
    try:
        result = await worker.analyze(
            isrc=req.isrc,
            local_file_path=req.local_file_path,
            acoustid_fingerprint=req.acoustid_fingerprint,
            priority=req.priority,
        )
        return result
    except Exception as e:
        log.error("analyze_track_failed", isrc=req.isrc, error=str(e))
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

@app.post("/compatibility/batch", response_model=BatchCompatibilityResponse)
async def check_compatibility_batch(req: BatchCompatibilityRequest):
    """
    Score all queue tracks against the now-playing track in one call.
    Called when now-playing changes so all badges refresh at once.
    """
    import asyncio
    worker = TransitionAnalysisWorker.__new__(TransitionAnalysisWorker)
    worker._db_pool = None
    worker.db_url = DATABASE_URL
    worker.redis = None

    async def score_one(isrc_b: str) -> BatchCompatibilityItem:
        try:
            result = await worker.check_compatibility(
                isrc_a=req.current_isrc,
                isrc_b=isrc_b,
                crowd_state=req.crowd_state,
            )
            return BatchCompatibilityItem(
                isrc=isrc_b,
                score=result["score"],
                vibe_distance_score=result["vibe_distance_score"],
                recommended_transition=result["recommended_transition"],
            )
        except Exception:
            return BatchCompatibilityItem(
                isrc=isrc_b, score=0.5, vibe_distance_score=0.5,
                recommended_transition="crossfade",
            )

    results = await asyncio.gather(*[score_one(isrc) for isrc in req.queue_isrcs])
    return BatchCompatibilityResponse(results=list(results))


@app.post("/compatibility", response_model=CompatibilityResponse)
async def check_compatibility(req: CompatibilityRequest):
    """
    Check if two tracks are compatible for mixing.
    Used by Vibe Guardrail to score queue requests.
    Falls back to rule-based if track data is missing.
    """
    worker = TransitionAnalysisWorker.__new__(TransitionAnalysisWorker)
    try:
        result = await worker.check_compatibility(
            isrc_a=req.isrc_a,
            isrc_b=req.isrc_b,
            crowd_state=req.crowd_state,
        )
        return result
    except Exception as e:
        log.error("compatibility_check_failed", error=str(e))
        # Rule-based fallback — never return 500 to the realtime service
        return CompatibilityResponse(
            score=0.5,
            bpm_delta=0,
            camelot_compatibility=0.5,
            energy_delta=0,
            recommended_transition="crossfade",
            vibe_distance_score=0.5,
        )


# ─── Taste Graph Models ───────────────────────────────────────────────────────

class RebuildProfileRequest(BaseModel):
    host_fingerprint: str

class RecommendRequest(BaseModel):
    host_fingerprint: str
    crowd_state: str = "PEAK"
    hour_of_day: int = 22
    limit: int = 10

class TrackRecommendation(BaseModel):
    isrc: str
    title: str | None
    artist: str | None
    bpm: float | None
    energy: float | None
    genre: str | None
    score: float

class RecommendResponse(BaseModel):
    recommendations: list[TrackRecommendation]
    profile_updated_at: str | None


# ─── Taste Graph Endpoints ────────────────────────────────────────────────────

@app.post("/taste-graph/rebuild")
async def rebuild_taste_graph(req: RebuildProfileRequest):
    """
    Rebuild the style profile for a host from their RLHF signal history.
    Called when a session ends or manually triggered.
    """
    worker = TasteGraphWorker.__new__(TasteGraphWorker)
    worker._db_pool = None
    worker.db_url = DATABASE_URL
    worker.redis = None
    try:
        profile = await worker.rebuild_profile(req.host_fingerprint)
        return { "success": True, "profile": profile }
    except Exception as e:
        log.error("taste_graph_rebuild_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/taste-graph/{host_fingerprint}")
async def get_taste_graph(host_fingerprint: str):
    """Fetch the cached style profile for a host."""
    worker = TasteGraphWorker.__new__(TasteGraphWorker)
    worker._db_pool = None
    worker.db_url = DATABASE_URL
    worker.redis = None
    profile = await worker.get_profile(host_fingerprint)
    if not profile:
        raise HTTPException(status_code=404, detail="No profile found")
    return profile


@app.post("/recommendations", response_model=RecommendResponse)
async def get_recommendations(req: RecommendRequest):
    """
    Return ranked track recommendations matching the host's taste profile.
    Used to suggest next tracks to the DJ.
    """
    worker = TasteGraphWorker.__new__(TasteGraphWorker)
    worker._db_pool = None
    worker.db_url = DATABASE_URL
    worker.redis = None
    try:
        tracks = await worker.recommend_tracks(
            host_fingerprint=req.host_fingerprint,
            crowd_state=req.crowd_state,
            hour_of_day=req.hour_of_day,
            limit=req.limit,
        )
        profile = await worker.get_profile(req.host_fingerprint)
        return RecommendResponse(
            recommendations=[TrackRecommendation(**t) for t in tracks],
            profile_updated_at=profile.get("updatedAt") if profile else None,
        )
    except Exception as e:
        log.error("recommendations_failed", error=str(e))
        return RecommendResponse(recommendations=[], profile_updated_at=None)

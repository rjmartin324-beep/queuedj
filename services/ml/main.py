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
        "audio_analysis":   AudioAnalysisWorker(redis_client, DATABASE_URL),
        "isrc_lookup":       ISRCLookupWorker(redis_client, DATABASE_URL),
        "transition_analysis": TransitionAnalysisWorker(redis_client, DATABASE_URL),
    }

    # GDPR gate: only start RLHF worker if feature flag is enabled
    if FEATURE_RLHF_LOGGING:
        workers["rlhf_signal"] = RLHFSignalWorker(redis_client, DATABASE_URL)
        log.info("rlhf_worker_started")

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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001", "http://localhost:3002"],
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

# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    queue_health = await consumer.get_health() if consumer else {}
    return {
        "status": "ok",
        "features": {
            "rlhf_logging": FEATURE_RLHF_LOGGING,
            "stem_separation": FEATURE_STEM_SEPARATION,
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

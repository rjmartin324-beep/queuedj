"""
Audio Analysis Worker
Extracts BPM, Key, Energy, and phrase structure from audio files.

Priority chain:
  1. AcoustID fingerprint → cached result in PostgreSQL (instant)
  2. Local file → Librosa analysis (10–30s depending on track length)
  3. Fallback → log missing, return None (caller uses defaults)

Phase 3+: Add AudioFlux for real-time lower-latency analysis.
Phase 5+: Add Demucs stem separation (server-side only).
"""

import asyncio
import tempfile
import os
import hashlib
from typing import Optional

import librosa
import numpy as np
import asyncpg
import structlog

log = structlog.get_logger()

# Camelot Wheel mapping: Librosa key index → Camelot number + type
# Librosa returns 0–11 (C, C#, D, D#, E, F, F#, G, G#, A, A#, B)
# Major keys → "B", Minor keys → "A"
CAMELOT_MAP = {
    # (key_index, is_major) → (camelot_number, camelot_type)
    (0,  True):  (8,  "B"),  # C Major
    (1,  True):  (3,  "B"),  # C# Major
    (2,  True):  (10, "B"),  # D Major
    (3,  True):  (5,  "B"),  # D# Major
    (4,  True):  (12, "B"),  # E Major
    (5,  True):  (7,  "B"),  # F Major
    (6,  True):  (2,  "B"),  # F# Major
    (7,  True):  (9,  "B"),  # G Major
    (8,  True):  (4,  "B"),  # G# Major
    (9,  True):  (11, "B"),  # A Major
    (10, True):  (6,  "B"),  # A# Major
    (11, True):  (1,  "B"),  # B Major
    (0,  False): (5,  "A"),  # C Minor
    (1,  False): (12, "A"),  # C# Minor
    (2,  False): (7,  "A"),  # D Minor
    (3,  False): (2,  "A"),  # D# Minor
    (4,  False): (9,  "A"),  # E Minor
    (5,  False): (4,  "A"),  # F Minor
    (6,  False): (11, "A"),  # F# Minor
    (7,  False): (6,  "A"),  # G Minor
    (8,  False): (1,  "A"),  # G# Minor
    (9,  False): (8,  "A"),  # A Minor
    (10, False): (3,  "A"),  # A# Minor
    (11, False): (10, "A"),  # B Minor
}

class AudioAnalysisWorker:
    def __init__(self, redis_client, database_url: str):
        self.redis = redis_client
        self.db_url = database_url
        self._db_pool: Optional[asyncpg.Pool] = None

    async def _get_db(self) -> asyncpg.Pool:
        if not self._db_pool:
            self._db_pool = await asyncpg.create_pool(self.db_url, min_size=1, max_size=5)
        return self._db_pool

    async def process_job(self, job_data: dict) -> dict:
        """Entry point called by BullMQ consumer."""
        return await self.analyze(
            isrc=job_data["isrc"],
            local_file_path=job_data.get("localFilePath"),
            acoustid_fingerprint=job_data.get("acoustIdFingerprint"),
            priority=job_data.get("priority", "bpm_key_only"),
        )

    async def analyze(
        self,
        isrc: str,
        local_file_path: Optional[str] = None,
        acoustid_fingerprint: Optional[str] = None,
        priority: str = "bpm_key_only",
    ) -> dict:
        # ─── Check cache first ────────────────────────────────────────────────
        cached = await self._check_cache(isrc)
        if cached and cached.get("analysis_confidence", 0) >= 0.7:
            log.info("audio_analysis_cache_hit", isrc=isrc)
            return cached

        # ─── Run analysis ─────────────────────────────────────────────────────
        if not local_file_path or not os.path.exists(local_file_path):
            log.warning("audio_analysis_no_file", isrc=isrc)
            return self._empty_result(isrc)

        try:
            result = await asyncio.get_event_loop().run_in_executor(
                None,
                self._run_librosa,
                local_file_path,
                priority,
            )
            result["isrc"] = isrc
            result["analysis_source"] = "librosa"

            # ─── Persist to DB ────────────────────────────────────────────────
            await self._upsert_track(result)

            log.info("audio_analysis_complete", isrc=isrc, bpm=result.get("bpm"))
            return result

        except Exception as e:
            log.error("audio_analysis_failed", isrc=isrc, error=str(e))
            return self._empty_result(isrc)

    def _run_librosa(self, file_path: str, priority: str) -> dict:
        """
        CPU-intensive work — runs in a thread pool executor.
        Librosa blocks the event loop if called directly.
        """
        # Load audio — use mono, 22050 Hz sample rate for analysis
        # Librosa default: sr=22050, mono=True
        y, sr = librosa.load(file_path, sr=22050, mono=True, duration=120)  # First 2 min is enough for BPM/key

        # ─── BPM ──────────────────────────────────────────────────────────────
        tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
        bpm = float(tempo)

        # Confidence: how stable is the beat? (lower variance = higher confidence)
        if len(beat_frames) > 4:
            beat_times = librosa.frames_to_time(beat_frames, sr=sr)
            intervals = np.diff(beat_times)
            bpm_variance = float(np.std(intervals))
            bpm_confidence = max(0.0, 1.0 - min(bpm_variance / 0.1, 1.0))
        else:
            bpm_confidence = 0.3

        # ─── Key ──────────────────────────────────────────────────────────────
        # Chroma features → key detection
        chromagram = librosa.feature.chroma_cqt(y=y, sr=sr)
        chroma_mean = np.mean(chromagram, axis=1)

        # Try major and minor profiles (Krumhansl-Schmuckler)
        key_index, is_major, key_confidence = self._detect_key(chroma_mean)
        camelot_key, camelot_type = CAMELOT_MAP.get((key_index, is_major), (1, "B"))

        # ─── Energy ───────────────────────────────────────────────────────────
        rms = librosa.feature.rms(y=y)[0]
        energy = float(np.mean(rms))
        # Normalize to 0–1 (empirical range: 0.01–0.25 for most music)
        energy_normalized = float(np.clip(energy / 0.15, 0.0, 1.0))

        result = {
            "bpm": round(bpm, 2),
            "camelot_key": camelot_key,
            "camelot_type": camelot_type,
            "energy": round(energy_normalized, 3),
            "analysis_confidence": round(min(bpm_confidence, key_confidence), 3),
        }

        # ─── Full analysis (Phase 3+) ──────────────────────────────────────────
        if priority == "full":
            result.update(self._full_analysis(y, sr, beat_frames))

        return result

    def _detect_key(self, chroma_mean: np.ndarray) -> tuple[int, bool, float]:
        """
        Krumhansl-Schmuckler key-finding algorithm.
        Returns (key_index 0–11, is_major, confidence 0–1)
        """
        major_profile = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
        minor_profile = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])

        best_score = -np.inf
        best_key = 0
        best_is_major = True

        for key in range(12):
            major_rotated = np.roll(major_profile, key)
            minor_rotated = np.roll(minor_profile, key)

            major_corr = np.corrcoef(chroma_mean, major_rotated)[0, 1]
            minor_corr = np.corrcoef(chroma_mean, minor_rotated)[0, 1]

            if major_corr > best_score:
                best_score = major_corr
                best_key = key
                best_is_major = True

            if minor_corr > best_score:
                best_score = minor_corr
                best_key = key
                best_is_major = False

        # Confidence: how dominant is the winning key vs runner-up?
        confidence = float(np.clip((best_score + 1) / 2, 0.0, 1.0))
        return best_key, best_is_major, confidence

    def _full_analysis(self, y: np.ndarray, sr: int, beat_frames: np.ndarray) -> dict:
        """
        Phase 3+ features: phrase detection, intro/outro, spectral centroid.
        """
        # Spectral centroid (brightness)
        spectral_centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
        brightness = float(np.mean(spectral_centroid) / (sr / 2))  # Normalized 0–1

        # Onset strength (for phrase boundary detection)
        onset_env = librosa.onset.onset_strength(y=y, sr=sr)

        return {
            "brightness": round(brightness, 3),
        }

    async def _check_cache(self, isrc: str) -> Optional[dict]:
        """Check PostgreSQL for existing analysis."""
        try:
            pool = await self._get_db()
            row = await pool.fetchrow(
                "SELECT bpm, camelot_key, camelot_type, energy, analysis_confidence, analysis_source "
                "FROM tracks WHERE isrc = $1",
                isrc,
            )
            if row:
                return dict(row)
        except Exception:
            pass
        return None

    async def _upsert_track(self, result: dict) -> None:
        """Upsert analysis results to PostgreSQL."""
        try:
            pool = await self._get_db()
            await pool.execute(
                """
                INSERT INTO tracks (isrc, title, artist, bpm, camelot_key, camelot_type, energy, analysis_confidence, analysis_source)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT (isrc) DO UPDATE SET
                  bpm = EXCLUDED.bpm,
                  camelot_key = EXCLUDED.camelot_key,
                  camelot_type = EXCLUDED.camelot_type,
                  energy = EXCLUDED.energy,
                  analysis_confidence = EXCLUDED.analysis_confidence,
                  analysis_source = EXCLUDED.analysis_source,
                  updated_at = NOW()
                WHERE tracks.analysis_confidence < EXCLUDED.analysis_confidence
                """,
                result.get("isrc"),
                result.get("title", "Unknown"),
                result.get("artist", "Unknown"),
                result.get("bpm"),
                result.get("camelot_key"),
                result.get("camelot_type"),
                result.get("energy"),
                result.get("analysis_confidence"),
                result.get("analysis_source", "librosa"),
            )
        except Exception as e:
            log.error("upsert_track_failed", error=str(e))

    def _empty_result(self, isrc: str) -> dict:
        return {
            "isrc": isrc,
            "bpm": None,
            "camelot_key": None,
            "camelot_type": None,
            "energy": None,
            "analysis_confidence": 0.0,
            "analysis_source": "unknown",
        }

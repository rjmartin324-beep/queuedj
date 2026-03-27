"""
Stem Separation Worker — Demucs 4-stem separation + R2 upload.

Job data:
  isrc            — track ISRC (required)
  audio_url       — presigned or public URL to download the audio (required if no local_file_path)
  local_file_path — path to an already-downloaded file (optional, skips download)

Pipeline:
  1. Skip if no_derivative flag is set in DB
  2. Skip if stems already in R2 (idempotent — safe to re-enqueue)
  3. Download audio to /tmp if needed
  4. Run: python -m demucs --mp3 -o {tmp_dir} {audio_file}
  5. Upload vocals/drums/bass/other.mp3 to R2 via r2_storage
  6. Clean up temp files

Output layout in R2:
  stems/{isrc}/vocals.mp3
  stems/{isrc}/drums.mp3
  stems/{isrc}/bass.mp3
  stems/{isrc}/other.mp3

Feature flag: FEATURE_STEM_SEPARATION=true must be set or worker skips all jobs.
"""

import asyncio
import os
import shutil
import tempfile
from pathlib import Path
from typing import Optional

import asyncpg
import httpx
import structlog

from .r2_storage import stems_exist, upload_stems_async

log = structlog.get_logger()

# Demucs default model — 4-stem HTDemucs
DEMUCS_MODEL = "htdemucs"


class StemSeparationWorker:
    def __init__(self, redis_client, database_url: str):
        self.redis   = redis_client
        self.db_url  = database_url
        self._db_pool: Optional[asyncpg.Pool] = None

    async def _get_db(self) -> asyncpg.Pool:
        if not self._db_pool:
            self._db_pool = await asyncpg.create_pool(self.db_url, min_size=1, max_size=3)
        return self._db_pool

    async def process_job(self, job_data: dict) -> dict:
        isrc            = job_data.get("isrc", "")
        audio_url       = job_data.get("audio_url") or job_data.get("audioUrl")
        local_file_path = job_data.get("local_file_path") or job_data.get("localFilePath")

        if not isrc:
            log.error("stem_separation_missing_isrc")
            return {"success": False, "error": "missing_isrc"}

        # ── Feature flag guard ────────────────────────────────────────────────
        if os.getenv("FEATURE_STEM_SEPARATION", "false").lower() != "true":
            log.info("stem_separation_disabled", isrc=isrc)
            return {"success": False, "error": "feature_disabled"}

        # ── no_derivative check ───────────────────────────────────────────────
        pool = await self._get_db()
        row  = await pool.fetchrow(
            "SELECT no_derivative FROM tracks WHERE isrc = $1", isrc
        )
        if row and row["no_derivative"]:
            log.info("stem_separation_blocked_no_derivative", isrc=isrc)
            return {"success": False, "error": "no_derivative"}

        # ── Idempotency: skip if stems already in R2 ──────────────────────────
        if stems_exist(isrc):
            log.info("stem_separation_already_done", isrc=isrc)
            return {"success": True, "cached": True}

        # ── Get audio file ────────────────────────────────────────────────────
        tmp_dir   = Path(tempfile.mkdtemp(prefix=f"stems_{isrc}_"))
        audio_path: Optional[Path] = None

        try:
            if local_file_path and os.path.exists(local_file_path):
                audio_path = Path(local_file_path)
                owned_audio = False
            elif audio_url:
                audio_path  = tmp_dir / f"audio_{isrc}.mp3"
                owned_audio = True
                await _download(audio_url, audio_path)
            else:
                log.error("stem_separation_no_audio", isrc=isrc)
                return {"success": False, "error": "no_audio_source"}

            # ── Run Demucs ────────────────────────────────────────────────────
            demucs_out = tmp_dir / "demucs_out"
            demucs_out.mkdir()

            log.info("stem_separation_starting", isrc=isrc, model=DEMUCS_MODEL)
            await _run_demucs(audio_path, demucs_out)

            # ── Locate output ─────────────────────────────────────────────────
            # Demucs outputs to: {out_dir}/{model}/{audio_stem}/vocals.mp3 etc.
            stem_dir = _find_stem_dir(demucs_out, audio_path.stem)

            # ── Upload to R2 ──────────────────────────────────────────────────
            uploaded = await upload_stems_async(isrc, stem_dir)
            log.info("stem_separation_complete", isrc=isrc, files=list(uploaded.keys()))
            return {"success": True, "stems": list(uploaded.keys())}

        except Exception as e:
            log.error("stem_separation_failed", isrc=isrc, error=str(e))
            return {"success": False, "error": str(e)}

        finally:
            # Always clean up temp dir, even on error
            shutil.rmtree(tmp_dir, ignore_errors=True)


async def _download(url: str, dest: Path) -> None:
    """Stream-download audio URL to dest path."""
    async with httpx.AsyncClient(timeout=120) as client:
        async with client.stream("GET", url) as resp:
            resp.raise_for_status()
            with open(dest, "wb") as f:
                async for chunk in resp.aiter_bytes(chunk_size=65536):
                    f.write(chunk)


async def _run_demucs(audio_path: Path, out_dir: Path) -> None:
    """
    Run Demucs as a subprocess.
    Args: python -m demucs --mp3 -o {out_dir} {audio_path}

    Demucs is CPU-heavy and can take 1-3 minutes per track on CPU.
    On Railway, ensure the ML service has at least 2 vCPU / 4GB RAM.
    For GPU acceleration, add CUDA env + torch+cuda in requirements.
    """
    proc = await asyncio.create_subprocess_exec(
        "python", "-m", "demucs",
        "--mp3",                  # output as MP3 (smaller, streamable)
        "-o", str(out_dir),       # output directory
        str(audio_path),          # input file
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await proc.communicate()

    if proc.returncode != 0:
        raise RuntimeError(f"Demucs exited {proc.returncode}: {stderr.decode()[:500]}")


def _find_stem_dir(demucs_out: Path, audio_stem: str) -> Path:
    """
    Locate the directory Demucs wrote stems to.

    Demucs layout: {out_dir}/{model_name}/{audio_filename_without_ext}/
    e.g. demucs_out/htdemucs/audio_USUM123/vocals.mp3

    Searches all subdirs in case the model name differs from DEMUCS_MODEL.
    """
    # Walk two levels deep: model_dir / track_dir
    for model_dir in demucs_out.iterdir():
        if not model_dir.is_dir():
            continue
        for track_dir in model_dir.iterdir():
            if track_dir.is_dir() and (track_dir / "vocals.mp3").exists():
                return track_dir

    raise FileNotFoundError(
        f"Demucs output not found in {demucs_out}. "
        f"Expected: {demucs_out}/{DEMUCS_MODEL}/{audio_stem}/vocals.mp3"
    )

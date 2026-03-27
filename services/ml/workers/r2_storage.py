"""
Cloudflare R2 — stem upload helper for ML service.

Uses boto3 with the S3-compatible R2 endpoint.

Required env vars (same as API service):
  R2_ACCOUNT_ID          — Cloudflare account ID
  R2_ACCESS_KEY_ID       — R2 API token access key
  R2_SECRET_ACCESS_KEY   — R2 API token secret
  R2_BUCKET_NAME         — bucket name, e.g. "partyglue-stems"

Stem file layout:
  stems/{isrc}/vocals.mp3
  stems/{isrc}/drums.mp3
  stems/{isrc}/bass.mp3
  stems/{isrc}/other.mp3
"""

import os
import asyncio
from pathlib import Path
from typing import Optional

import boto3
import structlog

log = structlog.get_logger()

STEM_NAMES = ["vocals", "drums", "bass", "other"]


def _make_client() -> Optional[object]:
    account_id = os.getenv("R2_ACCOUNT_ID")
    access_key = os.getenv("R2_ACCESS_KEY_ID")
    secret_key = os.getenv("R2_SECRET_ACCESS_KEY")

    if not all([account_id, access_key, secret_key]):
        return None

    return boto3.client(
        "s3",
        endpoint_url=f"https://{account_id}.r2.cloudflarestorage.com",
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name="auto",
    )


# Module-level lazy singleton
_client = None


def get_client():
    global _client
    if _client is None:
        _client = _make_client()
    return _client


def get_bucket() -> str:
    return os.getenv("R2_BUCKET_NAME", "partyglue-stems")


def stem_key(isrc: str, stem: str) -> str:
    return f"stems/{isrc}/{stem}.mp3"


def stems_exist(isrc: str) -> bool:
    """Check if vocals stem exists (sentinel for all four stems)."""
    client = get_client()
    if client is None:
        return False
    try:
        client.head_object(Bucket=get_bucket(), Key=stem_key(isrc, "vocals"))
        return True
    except Exception:
        return False


def upload_stems(isrc: str, stem_dir: Path) -> dict[str, str]:
    """
    Upload all four stem files from stem_dir to R2.

    stem_dir must contain: vocals.mp3, drums.mp3, bass.mp3, other.mp3
    (Demucs outputs these file names by default when run with --mp3 flag)

    Returns dict of {stem_name: r2_key} for the uploaded files.
    Raises RuntimeError if R2 is not configured or any upload fails.
    """
    client = get_client()
    if client is None:
        raise RuntimeError("R2 not configured — set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY")

    bucket  = get_bucket()
    uploaded = {}

    for stem in STEM_NAMES:
        local_path = stem_dir / f"{stem}.mp3"
        if not local_path.exists():
            raise FileNotFoundError(f"Stem file missing: {local_path}")

        key = stem_key(isrc, stem)
        client.upload_file(
            Filename=str(local_path),
            Bucket=bucket,
            Key=key,
            ExtraArgs={"ContentType": "audio/mpeg"},
        )
        uploaded[stem] = key
        log.info("stem_uploaded", isrc=isrc, stem=stem, key=key)

    return uploaded


async def upload_stems_async(isrc: str, stem_dir: Path) -> dict[str, str]:
    """
    Async wrapper — runs the blocking S3 uploads in a thread pool
    so they don't block the event loop.
    """
    return await asyncio.get_event_loop().run_in_executor(
        None,
        upload_stems,
        isrc,
        stem_dir,
    )

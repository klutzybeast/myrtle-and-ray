"""Emergent Object Storage helper.

Provides persistent, redeploy-safe file storage for admin uploads (MP3s,
images, PDFs, etc.). Falls back to local disk when EMERGENT_LLM_KEY is
not configured so dev environments keep working.
"""
from __future__ import annotations

import logging
import os
import threading
from typing import Optional, Tuple

import requests

logger = logging.getLogger("storage")

STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
APP_NAME = "myrtle-and-ray"

_storage_key: Optional[str] = None
_init_lock = threading.Lock()


def _emergent_key() -> str:
    return (os.environ.get("EMERGENT_LLM_KEY") or "").strip()


def is_enabled() -> bool:
    """Whether persistent object storage is available in this environment."""
    return bool(_emergent_key())


def _init_storage(force: bool = False) -> Optional[str]:
    """Initialize once, cache the session storage_key. Returns None on failure."""
    global _storage_key
    if _storage_key and not force:
        return _storage_key
    key = _emergent_key()
    if not key:
        return None
    with _init_lock:
        if _storage_key and not force:
            return _storage_key
        try:
            resp = requests.post(
                f"{STORAGE_URL}/init",
                json={"emergent_key": key},
                timeout=30,
            )
            resp.raise_for_status()
            _storage_key = resp.json().get("storage_key")
            logger.info("Emergent object storage initialized")
            return _storage_key
        except Exception as exc:  # noqa: BLE001
            logger.warning("Emergent storage init failed: %s", exc)
            return None


def _storage_path(filename: str) -> str:
    """Namespace every object under the app name to avoid collisions."""
    return f"{APP_NAME}/uploads/{filename}"


def put_object(filename: str, data: bytes, content_type: str) -> bool:
    """Upload bytes to persistent storage. Returns True on success."""
    key = _init_storage()
    if not key:
        return False
    path = _storage_path(filename)
    try:
        resp = requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type or "application/octet-stream"},
            data=data,
            timeout=120,
        )
        if resp.status_code == 403:
            # Session expired — re-init and retry once.
            key = _init_storage(force=True)
            if not key:
                return False
            resp = requests.put(
                f"{STORAGE_URL}/objects/{path}",
                headers={"X-Storage-Key": key, "Content-Type": content_type or "application/octet-stream"},
                data=data,
                timeout=120,
            )
        resp.raise_for_status()
        return True
    except Exception as exc:  # noqa: BLE001
        logger.exception("Emergent storage put failed for %s: %s", filename, exc)
        return False


def get_object(filename: str) -> Optional[Tuple[bytes, str]]:
    """Fetch object bytes. Returns (data, content_type) or None if missing."""
    key = _init_storage()
    if not key:
        return None
    path = _storage_path(filename)
    try:
        resp = requests.get(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key},
            timeout=60,
        )
        if resp.status_code == 403:
            key = _init_storage(force=True)
            if not key:
                return None
            resp = requests.get(
                f"{STORAGE_URL}/objects/{path}",
                headers={"X-Storage-Key": key},
                timeout=60,
            )
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
        return resp.content, resp.headers.get("Content-Type", "application/octet-stream")
    except Exception as exc:  # noqa: BLE001
        logger.exception("Emergent storage get failed for %s: %s", filename, exc)
        return None

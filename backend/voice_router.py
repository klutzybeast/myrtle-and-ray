"""ElevenLabs TTS — one voice per character + interactive "make them say..." with caching."""
from __future__ import annotations
import hashlib
import logging
import os
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field

import storage as _storage

logger = logging.getLogger("voice")

API_KEY = (os.environ.get("ELEVENLABS_API_KEY") or "").strip()
MODEL_ID = os.environ.get("ELEVENLABS_MODEL_ID", "eleven_turbo_v2_5")
DAILY_BUDGET = int(os.environ.get("ELEVENLABS_DAILY_CHAR_BUDGET", "50000") or 50000)
MAX_CHARS = int(os.environ.get("ELEVENLABS_MAX_CHARS_PER_REQUEST", "300") or 300)
MAX_PER_VISITOR = int(os.environ.get("ELEVENLABS_MAX_REQUESTS_PER_VISITOR_PER_DAY", "5") or 5)

# Voice settings tuned for warm, kid-friendly storytelling.
# Lower stability = more expressive/emotional, higher = more consistent/calm.
DEFAULT_STABILITY = 0.45
DEFAULT_SIMILARITY = 0.85
DEFAULT_STYLE = 0.35


class TTSRequest(BaseModel):
    text: str = Field(min_length=1, max_length=600)


def _today_key() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _cache_key(voice_id: str, text: str) -> str:
    raw = f"{MODEL_ID}|{voice_id}|{text.strip()}|{DEFAULT_STABILITY}|{DEFAULT_SIMILARITY}|{DEFAULT_STYLE}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _client():
    if not API_KEY:
        raise HTTPException(status_code=503, detail="Voice service not configured.")
    try:
        from elevenlabs.client import ElevenLabs
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=503, detail="Voice SDK not available.") from exc
    return ElevenLabs(api_key=API_KEY)


def _visitor_id(request: Request) -> str:
    return (
        request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        or (request.client.host if request.client else "anon")
    )


async def _check_quota(db, visitor: str, chars: int) -> None:
    today = _today_key()
    daily = await db.voice_quota.find_one({"day": today}, {"_id": 0}) or {"day": today, "chars": 0}
    if daily["chars"] + chars > DAILY_BUDGET:
        raise HTTPException(status_code=429, detail="Voice budget for today reached. Try again tomorrow.")
    per_visitor = await db.voice_quota_visitor.find_one({"day": today, "visitor": visitor}, {"_id": 0})
    used = (per_visitor or {}).get("count", 0)
    if used >= MAX_PER_VISITOR:
        raise HTTPException(status_code=429, detail=f"You've used your {MAX_PER_VISITOR} voice messages for today. Come back tomorrow!")


async def _record_use(db, visitor: str, chars: int) -> None:
    today = _today_key()
    await db.voice_quota.update_one(
        {"day": today}, {"$inc": {"chars": chars}, "$setOnInsert": {"day": today}}, upsert=True
    )
    await db.voice_quota_visitor.update_one(
        {"day": today, "visitor": visitor},
        {"$inc": {"count": 1, "chars": chars}, "$setOnInsert": {"day": today, "visitor": visitor}},
        upsert=True,
    )


def _synthesize(voice_id: str, text: str) -> bytes:
    client = _client()
    from elevenlabs import VoiceSettings
    settings = VoiceSettings(
        stability=DEFAULT_STABILITY,
        similarity_boost=DEFAULT_SIMILARITY,
        style=DEFAULT_STYLE,
        use_speaker_boost=True,
    )
    audio_iter = client.text_to_speech.convert(
        text=text,
        voice_id=voice_id,
        model_id=MODEL_ID,
        voice_settings=settings,
        output_format="mp3_44100_128",
    )
    data = b""
    for chunk in audio_iter:
        if chunk:
            data += chunk
    return data


def _audio_response(audio: bytes, filename: str, attachment: bool = False) -> Response:
    disp = "attachment" if attachment else "inline"
    return Response(
        content=audio,
        media_type="audio/mpeg",
        headers={
            "Content-Disposition": f'{disp}; filename="{filename}"',
            "Cache-Control": "public, max-age=31536000, immutable",
        },
    )


def make_voice_router(db):
    router = APIRouter(tags=["voice"])

    @router.get("/voice/voices")
    async def list_voices():
        """Helper for admin: list available voices on this account."""
        client = _client()
        try:
            voices_resp = client.voices.get_all()
            voices = getattr(voices_resp, "voices", None) or []
            return [
                {
                    "voice_id": getattr(v, "voice_id", None),
                    "name": getattr(v, "name", ""),
                    "category": getattr(v, "category", ""),
                    "labels": getattr(v, "labels", {}) or {},
                    "preview_url": getattr(v, "preview_url", None),
                }
                for v in voices
            ]
        except Exception as exc:  # noqa: BLE001
            logger.exception("List voices failed")
            raise HTTPException(status_code=502, detail=str(exc)) from exc

    @router.get("/voice/character/{slug}/greeting")
    async def character_greeting(slug: str):
        """Pre-set greeting in the character's voice — cached, free playback."""
        char = await db.characters.find_one({"slug": slug}, {"_id": 0})
        if not char or not char.get("voice_id"):
            raise HTTPException(status_code=404, detail="No voice for this character.")
        greeting = (char.get("voice_greeting") or f"Hi! I'm {char.get('name','your friend')}, and I'm so glad you're here!").strip()
        return await _resolve(db, char["voice_id"], greeting, f"{slug}-greeting.mp3", record_quota=False, visitor=None)

    @router.post("/voice/character/{slug}/say")
    async def character_say(slug: str, body: TTSRequest, request: Request):
        """Make the character say arbitrary text. Rate-limited."""
        char = await db.characters.find_one({"slug": slug}, {"_id": 0})
        if not char or not char.get("voice_id"):
            raise HTTPException(status_code=404, detail="No voice for this character.")
        text = body.text.strip()
        if len(text) > MAX_CHARS:
            raise HTTPException(status_code=400, detail=f"Keep it to {MAX_CHARS} characters or fewer.")
        visitor = _visitor_id(request)
        await _check_quota(db, visitor, len(text))
        return await _resolve(db, char["voice_id"], text, f"{slug}-message.mp3", record_quota=True, visitor=visitor)

    async def _resolve(db, voice_id: str, text: str, filename: str, record_quota: bool, visitor: Optional[str]):
        key = _cache_key(voice_id, text)
        cached = await db.voice_cache.find_one({"key": key}, {"_id": 0})
        if cached and cached.get("storage_filename"):
            # Try local fast path then persistent storage
            upload_dir = os.environ.get("UPLOAD_DIR", "/app/backend/uploads")
            local_path = os.path.join(upload_dir, cached["storage_filename"])
            if os.path.exists(local_path):
                with open(local_path, "rb") as fh:
                    return _audio_response(fh.read(), filename)
            fetched = _storage.get_object(cached["storage_filename"])
            if fetched is not None:
                data, _ = fetched
                # Restore local copy for next time
                try:
                    with open(local_path, "wb") as fh:
                        fh.write(data)
                except Exception:  # noqa: BLE001
                    pass
                return _audio_response(data, filename)

        # Cache miss — synthesize
        try:
            audio = _synthesize(voice_id, text)
        except HTTPException:
            raise
        except Exception as exc:  # noqa: BLE001
            logger.exception("Synthesis failed")
            raise HTTPException(status_code=502, detail="Voice service is busy. Try again in a moment.") from exc
        if not audio:
            raise HTTPException(status_code=502, detail="Empty audio from voice service.")

        # Persist to both local + Emergent storage (so it survives redeploys)
        storage_name = f"voice/{key}.mp3"
        upload_dir = os.environ.get("UPLOAD_DIR", "/app/backend/uploads")
        local_path = os.path.join(upload_dir, storage_name)
        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        with open(local_path, "wb") as fh:
            fh.write(audio)
        _storage.put_object(storage_name, audio, "audio/mpeg")

        await db.voice_cache.insert_one({
            "key": key,
            "voice_id": voice_id,
            "text": text,
            "model_id": MODEL_ID,
            "chars": len(text),
            "storage_filename": storage_name,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        if record_quota and visitor:
            await _record_use(db, visitor, len(text))
        return _audio_response(audio, filename)

    return router

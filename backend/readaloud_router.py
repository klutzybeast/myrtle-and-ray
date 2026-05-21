"""Read-Aloud — per-page narration generator.

Stores the book as a list of pages, each with text + assigned character.
Admin can bulk-generate audio for every page via ElevenLabs. Each
generation is content-hash cached the same way as the character voices.
"""
from __future__ import annotations
import hashlib
import logging
import os
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

import storage as _storage

logger = logging.getLogger("readaloud")

API_KEY = (os.environ.get("ELEVENLABS_API_KEY") or "").strip()
MODEL_ID = os.environ.get("ELEVENLABS_MODEL_ID", "eleven_v3")

# Slightly more stable settings for storytelling — less emotional swing
NARRATION_STABILITY = 0.5
NARRATION_SIMILARITY = 0.85
NARRATION_STYLE = 0.3


class BookPage(BaseModel):
    page: int = Field(ge=1)
    character_slug: str = ""   # empty = use narrator
    text: str = Field(min_length=1, max_length=2000)
    image_url: Optional[str] = ""


class PagePatch(BaseModel):
    text: Optional[str] = None
    character_slug: Optional[str] = None
    image_url: Optional[str] = None


class SaveBookRequest(BaseModel):
    title: str = "Myrtle and Ray and the First Day of Camp"
    narrator_voice_id: str = ""
    pages: List[BookPage]


def _cache_key(voice_id: str, text: str) -> str:
    raw = f"{MODEL_ID}|{voice_id}|{text.strip()}|{NARRATION_STABILITY}|{NARRATION_SIMILARITY}|{NARRATION_STYLE}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _client():
    if not API_KEY:
        raise HTTPException(status_code=503, detail="Voice service not configured.")
    from elevenlabs.client import ElevenLabs
    return ElevenLabs(api_key=API_KEY)


def _synth(voice_id: str, text: str) -> bytes:
    from elevenlabs import VoiceSettings
    settings = VoiceSettings(
        stability=NARRATION_STABILITY,
        similarity_boost=NARRATION_SIMILARITY,
        style=NARRATION_STYLE,
        use_speaker_boost=True,
    )
    client = _client()
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


def make_readaloud_router(db, require_admin):
    router = APIRouter(tags=["read-aloud"])

    @router.get("/read-aloud/book")
    async def get_book():
        book = await db.read_aloud_book.find_one({"id": "main"}, {"_id": 0})
        if not book:
            return {"title": "", "narrator_voice_id": "", "pages": [], "characters": {}}
        # Strip voice_id from the public payload — it's an internal identifier.
        public_pages = [
            {k: v for k, v in p.items() if k not in ("voice_id", "cache_key")}
            for p in book.get("pages", [])
        ]
        slugs = sorted({p.get("character_slug", "") for p in public_pages if p.get("character_slug")})
        chars = {}
        async for ch in db.characters.find(
            {"slug": {"$in": slugs}},
            {"_id": 0, "slug": 1, "name": 1, "image_url": 1, "color": 1},
        ):
            chars[ch["slug"]] = ch
        return {
            "title": book.get("title", ""),
            "pages": public_pages,
            "characters": chars,
        }

    @router.get("/admin/read-aloud/book", dependencies=[Depends(require_admin)])
    async def get_book_admin():
        book = await db.read_aloud_book.find_one({"id": "main"}, {"_id": 0})
        if not book:
            return {"title": "", "narrator_voice_id": "", "pages": [], "characters": []}
        chars = []
        async for ch in db.characters.find(
            {"voice_id": {"$exists": True, "$ne": ""}},
            {"_id": 0, "slug": 1, "name": 1, "image_url": 1, "voice_id": 1},
        ):
            chars.append(ch)
        return {**book, "characters": chars}


    @router.put("/admin/read-aloud/book", dependencies=[Depends(require_admin)])
    async def save_book(body: SaveBookRequest):
        # Resolve voice per page from character slug
        pages_out = []
        for p in body.pages:
            voice_id = body.narrator_voice_id
            if p.character_slug:
                char = await db.characters.find_one({"slug": p.character_slug}, {"_id": 0, "voice_id": 1})
                if char and char.get("voice_id"):
                    voice_id = char["voice_id"]
            pages_out.append({
                "page": p.page,
                "character_slug": p.character_slug or "",
                "text": p.text,
                "image_url": p.image_url or "",
                "voice_id": voice_id or "",
                "audio_url": "",   # filled after generation
                "cache_key": _cache_key(voice_id, p.text) if voice_id else "",
            })
        doc = {
            "id": "main",
            "title": body.title,
            "narrator_voice_id": body.narrator_voice_id,
            "pages": pages_out,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.read_aloud_book.update_one({"id": "main"}, {"$set": doc}, upsert=True)
        return doc

    @router.post("/admin/read-aloud/generate/{page_num}", dependencies=[Depends(require_admin)])
    async def generate_page(page_num: int):
        book = await db.read_aloud_book.find_one({"id": "main"}, {"_id": 0})
        if not book:
            raise HTTPException(status_code=404, detail="No book uploaded yet.")
        page = next((p for p in book.get("pages", []) if p.get("page") == page_num), None)
        if not page:
            raise HTTPException(status_code=404, detail=f"Page {page_num} not found.")
        voice_id = page.get("voice_id") or book.get("narrator_voice_id")
        if not voice_id:
            raise HTTPException(status_code=400, detail="No voice assigned to this page (set a narrator or character).")
        text = page.get("text", "").strip()
        if not text:
            raise HTTPException(status_code=400, detail="Page has no text.")

        key = _cache_key(voice_id, text)
        cached = await db.voice_cache.find_one({"key": key}, {"_id": 0})
        if cached and cached.get("storage_filename"):
            audio_url = f"/api/uploads/{cached['storage_filename']}"
        else:
            try:
                audio = _synth(voice_id, text)
            except Exception as exc:  # noqa: BLE001
                logger.exception("Synth failed for page %s", page_num)
                raise HTTPException(status_code=502, detail=str(exc)) from exc
            if not audio:
                raise HTTPException(status_code=502, detail="Empty audio from voice service.")
            storage_name = f"voice/{key}.mp3"
            upload_dir = os.environ.get("UPLOAD_DIR", "/app/backend/uploads")
            local_path = os.path.join(upload_dir, storage_name)
            os.makedirs(os.path.dirname(local_path), exist_ok=True)
            with open(local_path, "wb") as fh:
                fh.write(audio)
            _storage.put_object(storage_name, audio, "audio/mpeg")
            await db.voice_cache.insert_one({
                "key": key, "voice_id": voice_id, "text": text, "model_id": MODEL_ID,
                "chars": len(text), "storage_filename": storage_name,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
            audio_url = f"/api/uploads/{storage_name}"

        await db.read_aloud_book.update_one(
            {"id": "main", "pages.page": page_num},
            {"$set": {"pages.$.audio_url": audio_url, "pages.$.cache_key": key, "pages.$.voice_id": voice_id}},
        )
        return {"ok": True, "page": page_num, "audio_url": audio_url, "voice_id": voice_id, "chars": len(text)}

    @router.post("/admin/read-aloud/generate-all", dependencies=[Depends(require_admin)])
    async def generate_all():
        book = await db.read_aloud_book.find_one({"id": "main"}, {"_id": 0})
        if not book:
            raise HTTPException(status_code=404, detail="No book uploaded yet.")
        results = []
        for p in book.get("pages", []):
            try:
                r = await generate_page(p["page"])
                results.append({"page": p["page"], "ok": True, "chars": r["chars"]})
            except HTTPException as exc:
                results.append({"page": p["page"], "ok": False, "error": exc.detail})
        return {"results": results, "total": len(results)}

    @router.patch("/admin/read-aloud/page/{page_num}", dependencies=[Depends(require_admin)])
    async def patch_page(page_num: int, body: PagePatch):
        book = await db.read_aloud_book.find_one({"id": "main"}, {"_id": 0})
        if not book:
            raise HTTPException(status_code=404, detail="No book uploaded yet.")
        page = next((p for p in book.get("pages", []) if p.get("page") == page_num), None)
        if not page:
            raise HTTPException(status_code=404, detail=f"Page {page_num} not found.")
        updates: dict = {}
        text_changed = False
        voice_changed = False
        if body.text is not None and body.text.strip() != page.get("text", ""):
            updates["pages.$.text"] = body.text.strip()
            page["text"] = body.text.strip()
            text_changed = True
        if body.image_url is not None:
            updates["pages.$.image_url"] = body.image_url.strip()
        if body.character_slug is not None and body.character_slug != page.get("character_slug", ""):
            slug = body.character_slug.strip()
            new_voice = book.get("narrator_voice_id", "")
            if slug:
                char = await db.characters.find_one({"slug": slug}, {"_id": 0, "voice_id": 1})
                if char and char.get("voice_id"):
                    new_voice = char["voice_id"]
            updates["pages.$.character_slug"] = slug
            updates["pages.$.voice_id"] = new_voice or ""
            page["voice_id"] = new_voice or ""
            voice_changed = True
        if text_changed or voice_changed:
            # Invalidate cached audio — new key, no url yet
            voice_id = page.get("voice_id") or book.get("narrator_voice_id", "")
            updates["pages.$.audio_url"] = ""
            updates["pages.$.cache_key"] = _cache_key(voice_id, page.get("text", "")) if voice_id else ""
        if updates:
            await db.read_aloud_book.update_one(
                {"id": "main", "pages.page": page_num},
                {"$set": updates},
            )
        return {"ok": True, "page": page_num}

    @router.delete("/admin/read-aloud/book", dependencies=[Depends(require_admin)])
    async def delete_book():
        await db.read_aloud_book.delete_many({"id": "main"})
        return {"ok": True}

    return router

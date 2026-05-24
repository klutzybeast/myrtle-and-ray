"""Sing-Along feature — short kid-friendly songs to sing along to.

Public:
  GET  /sing-along/songs               — gallery (active=True, sorted)
  GET  /sing-along/songs/{slug}        — single song detail

Admin (require_admin):
  GET    /admin/sing-along/songs       — all songs incl. inactive
  POST   /admin/sing-along/songs       — create
  PATCH  /admin/sing-along/songs/{id}  — update
  DELETE /admin/sing-along/songs/{id}  — remove
  POST   /admin/sing-along/reorder     — reposition
"""
from __future__ import annotations

import logging
import os
import re
import uuid
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

log = logging.getLogger(__name__)

UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", "/app/backend/uploads")) / "sing_along"
ASSET_DIR = Path("/app/backend/seed_assets/sing_along")


def _slugify(value: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", (value or "").lower()).strip("-")
    return s or f"song-{uuid.uuid4().hex[:8]}"


def _format_lrc(seconds: float) -> str:
    if seconds < 0:
        seconds = 0
    m = int(seconds // 60)
    s = seconds - m * 60
    return f"[{m:02d}:{s:05.2f}]"


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def _align_lrc(lyrics: str, word_list: list) -> str:
    """Walk through lyric lines and pull timestamps from word_list. Returns LRC string."""
    lyric_lines = [ln for ln in lyrics.split("\n") if ln.strip()]
    norm_align = [_norm(w["text"]) for w in word_list]
    out = []
    word_idx = 0
    used_idx = -1
    for line in lyric_lines:
        words = [w for w in re.split(r"\s+", line.strip()) if w]
        if not words:
            continue
        target = _norm(words[0])
        found = -1
        if target:
            for j in range(word_idx, min(word_idx + 200, len(norm_align))):
                if norm_align[j] == target and j > used_idx:
                    found = j
                    break
            if found < 0:
                for j in range(word_idx, min(word_idx + 200, len(norm_align))):
                    if norm_align[j].startswith(target[:3]) and j > used_idx:
                        found = j
                        break
        if found < 0:
            last = out[-1]["start"] if out else 0
            out.append({"text": line, "start": last + 1.5})
            continue
        out.append({"text": line, "start": float(word_list[found]["start"])})
        used_idx = found
        word_idx = found + len(words)
    return "\n".join(f"{_format_lrc(item['start'])}{item['text']}" for item in out)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class SongBody(BaseModel):
    slug: Optional[str] = ""
    title: Optional[str] = ""
    theme: Optional[str] = ""
    cover_image_url: Optional[str] = ""
    audio_url: Optional[str] = ""
    lyrics: Optional[str] = ""   # plain text, line per line
    lyrics_lrc: Optional[str] = ""  # optional [mm:ss.xx] synced format
    duration_seconds: Optional[int] = 0
    character_focus: Optional[str] = ""
    music_prompt: Optional[str] = ""  # what we sent to ElevenLabs Music
    active: Optional[bool] = True
    position: Optional[int] = 99


class GenerateSongBody(BaseModel):
    title: str
    music_prompt: str
    lyrics: str
    theme: Optional[str] = ""
    character_focus: Optional[str] = ""
    cover_image_url: Optional[str] = ""
    duration_seconds: Optional[int] = 35
    slug: Optional[str] = ""


class ReorderBody(BaseModel):
    song_ids: List[str]


def make_sing_along_router(db, require_admin):
    router = APIRouter(tags=["sing-along"])

    # -------- Public --------
    @router.get("/sing-along/songs")
    async def public_songs():
        cur = db.sing_along_songs.find({"active": True}, {"_id": 0}).sort([
            ("position", 1), ("created_at", 1),
        ])
        return await cur.to_list(50)

    @router.get("/sing-along/songs/{slug}")
    async def public_song(slug: str):
        doc = await db.sing_along_songs.find_one({"slug": slug, "active": True}, {"_id": 0})
        if not doc:
            raise HTTPException(status_code=404, detail="Song not found.")
        return doc

    # -------- Admin --------
    admin = APIRouter(
        prefix="/admin/sing-along",
        tags=["admin-sing-along"],
        dependencies=[Depends(require_admin)],
    )

    @admin.get("/songs")
    async def admin_list():
        cur = db.sing_along_songs.find({}, {"_id": 0}).sort([("position", 1), ("created_at", 1)])
        return await cur.to_list(200)

    @admin.post("/songs")
    async def admin_create(body: SongBody):
        slug = (body.slug or body.title or "").strip().lower().replace(" ", "-")
        if not slug:
            raise HTTPException(status_code=400, detail="Title or slug is required.")
        if await db.sing_along_songs.find_one({"slug": slug}, {"_id": 0, "id": 1}):
            raise HTTPException(status_code=409, detail="A song with that slug already exists.")
        next_pos = (await db.sing_along_songs.count_documents({})) + 1
        doc = {
            "id": str(uuid.uuid4()),
            "slug": slug,
            "title": body.title or "Untitled song",
            "theme": body.theme or "",
            "cover_image_url": body.cover_image_url or "",
            "audio_url": body.audio_url or "",
            "lyrics": body.lyrics or "",
            "lyrics_lrc": body.lyrics_lrc or "",
            "duration_seconds": int(body.duration_seconds or 0),
            "character_focus": body.character_focus or "",
            "music_prompt": body.music_prompt or "",
            "active": True if body.active is None else bool(body.active),
            "position": int(body.position) if body.position not in (None, 0) else next_pos,
            "created_at": _now_iso(),
            "updated_at": _now_iso(),
        }
        await db.sing_along_songs.insert_one(doc)
        doc.pop("_id", None)
        return doc

    @admin.patch("/songs/{song_id}")
    async def admin_patch(song_id: str, body: SongBody):
        patch = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
        if not patch:
            raise HTTPException(status_code=400, detail="No fields to update.")
        patch["updated_at"] = _now_iso()
        r = await db.sing_along_songs.update_one({"id": song_id}, {"$set": patch})
        if not r.matched_count:
            raise HTTPException(status_code=404, detail="Song not found.")
        return {"success": True}

    @admin.delete("/songs/{song_id}")
    async def admin_delete(song_id: str):
        r = await db.sing_along_songs.delete_one({"id": song_id})
        if not r.deleted_count:
            raise HTTPException(status_code=404, detail="Song not found.")
        return {"success": True}

    @admin.post("/reorder")
    async def admin_reorder(body: ReorderBody):
        for i, sid in enumerate(body.song_ids, start=1):
            await db.sing_along_songs.update_one(
                {"id": sid}, {"$set": {"position": i, "updated_at": _now_iso()}}
            )
        return {"success": True}

    @admin.post("/generate")
    async def admin_generate(body: GenerateSongBody):
        """Generate a brand-new song from a prompt+lyrics using ElevenLabs Music,
        then run forced alignment to build the LRC karaoke track."""
        api_key = (os.environ.get("ELEVENLABS_API_KEY") or "").strip()
        if not api_key:
            raise HTTPException(status_code=500, detail="ELEVENLABS_API_KEY missing")

        title = (body.title or "").strip()
        lyrics = (body.lyrics or "").strip()
        prompt = (body.music_prompt or "").strip()
        if not title or not lyrics or not prompt:
            raise HTTPException(status_code=400, detail="Title, music_prompt and lyrics are required.")

        slug = _slugify(body.slug or title)
        existing = await db.sing_along_songs.find_one({"slug": slug}, {"_id": 0, "id": 1})
        if existing:
            raise HTTPException(status_code=409, detail=f"A song with slug '{slug}' already exists.")

        duration = int(body.duration_seconds or 35)
        duration = max(15, min(duration, 90))
        length_ms = duration * 1000
        full_prompt = (
            f"{prompt}\n\n"
            f"Length: ~{duration} seconds.\n"
            f"Children's vocals, clearly enunciated for sing-along.\n\n"
            f"[LYRICS]\n{lyrics}\n[/LYRICS]"
        )

        try:
            from elevenlabs import ElevenLabs
            client = ElevenLabs(api_key=api_key)
            log.info("[sing-along/generate] composing %s (%ss)", slug, duration)
            audio_iter = client.music.compose(prompt=full_prompt, music_length_ms=length_ms)
            audio_bytes = b"".join(chunk for chunk in audio_iter if chunk)
        except Exception as exc:
            log.exception("ElevenLabs music compose failed for %s", slug)
            raise HTTPException(status_code=502, detail=f"Music generation failed: {exc}")

        if not audio_bytes or len(audio_bytes) < 5000:
            raise HTTPException(status_code=502, detail="Empty audio returned from ElevenLabs.")

        UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        ASSET_DIR.mkdir(parents=True, exist_ok=True)
        upload_path = UPLOAD_DIR / f"{slug}.mp3"
        asset_path = ASSET_DIR / f"{slug}.mp3"
        upload_path.write_bytes(audio_bytes)
        asset_path.write_bytes(audio_bytes)

        # Persist to object storage so the MP3 survives redeploys.
        try:
            import storage as _storage
            _storage.put_object(f"sing_along/{slug}.mp3", audio_bytes, "audio/mpeg")
        except Exception as exc:
            log.warning("storage.put_object failed for sing_along/%s.mp3: %s", slug, exc)

        # Forced alignment for LRC karaoke timing.
        lyrics_lrc = ""
        try:
            from elevenlabs import ElevenLabs as _EL
            client2 = _EL(api_key=api_key)
            result = client2.forced_alignment.create(file=BytesIO(audio_bytes), text=lyrics)
            words = getattr(result, "words", None) or []
            word_list = []
            for w in words:
                text = getattr(w, "text", None) or (w.get("text") if isinstance(w, dict) else "")
                start = float(getattr(w, "start", None) if not isinstance(w, dict) else w.get("start", 0))
                end = float(getattr(w, "end", None) if not isinstance(w, dict) else w.get("end", 0))
                if text:
                    word_list.append({"text": text, "start": start, "end": end})
            if word_list:
                lyrics_lrc = _align_lrc(lyrics, word_list)
        except Exception as exc:
            log.warning("Forced alignment failed for %s: %s", slug, exc)

        next_pos = (await db.sing_along_songs.count_documents({})) + 1
        doc = {
            "id": str(uuid.uuid4()),
            "slug": slug,
            "title": title,
            "theme": body.theme or "",
            "cover_image_url": body.cover_image_url or "",
            "audio_url": f"/api/uploads/sing_along/{slug}.mp3",
            "lyrics": lyrics,
            "lyrics_lrc": lyrics_lrc,
            "duration_seconds": duration,
            "character_focus": body.character_focus or "",
            "music_prompt": prompt,
            "active": True,
            "position": next_pos,
            "created_at": _now_iso(),
            "updated_at": _now_iso(),
        }
        await db.sing_along_songs.insert_one(doc)
        doc.pop("_id", None)
        return doc

    @admin.post("/songs/{song_id}/regenerate-alignment")
    async def admin_regenerate_alignment(song_id: str):
        """Re-run forced alignment on an existing song's MP3 (for songs whose
        lyrics were edited, or for cleaning up imported audio)."""
        api_key = (os.environ.get("ELEVENLABS_API_KEY") or "").strip()
        if not api_key:
            raise HTTPException(status_code=500, detail="ELEVENLABS_API_KEY missing")
        song = await db.sing_along_songs.find_one({"id": song_id}, {"_id": 0})
        if not song:
            raise HTTPException(status_code=404, detail="Song not found.")
        slug = song.get("slug", "")
        mp3_path = UPLOAD_DIR / f"{slug}.mp3"
        if not mp3_path.exists():
            mp3_path = ASSET_DIR / f"{slug}.mp3"
        if not mp3_path.exists():
            raise HTTPException(status_code=400, detail="MP3 not found for this song.")
        audio_bytes = mp3_path.read_bytes()
        lyrics = song.get("lyrics", "")
        if not lyrics.strip():
            raise HTTPException(status_code=400, detail="Song has no lyrics to align.")
        try:
            from elevenlabs import ElevenLabs as _EL
            client = _EL(api_key=api_key)
            result = client.forced_alignment.create(file=BytesIO(audio_bytes), text=lyrics)
            words = getattr(result, "words", None) or []
            word_list = []
            for w in words:
                text = getattr(w, "text", None) or (w.get("text") if isinstance(w, dict) else "")
                start = float(getattr(w, "start", None) if not isinstance(w, dict) else w.get("start", 0))
                end = float(getattr(w, "end", None) if not isinstance(w, dict) else w.get("end", 0))
                if text:
                    word_list.append({"text": text, "start": start, "end": end})
            lyrics_lrc = _align_lrc(lyrics, word_list) if word_list else ""
        except Exception as exc:
            log.exception("regen alignment failed")
            raise HTTPException(status_code=502, detail=f"Alignment failed: {exc}")
        await db.sing_along_songs.update_one(
            {"id": song_id},
            {"$set": {"lyrics_lrc": lyrics_lrc, "updated_at": _now_iso()}},
        )
        return {"success": True, "lyrics_lrc": lyrics_lrc}

    @admin.post("/songs/{song_id}/generate-cover")
    async def admin_generate_cover(song_id: str):
        """Generate beach-themed cover art for this song using Nano Banana,
        keyed off the song's character_focus (uses character portraits as
        reference images so the cover ALWAYS features the actual Sea Stars)."""
        from cover_art_service import generate_cover
        song = await db.sing_along_songs.find_one({"id": song_id}, {"_id": 0})
        if not song:
            raise HTTPException(status_code=404, detail="Song not found.")
        focus = (song.get("character_focus") or "").strip()
        # Resolve character slug list. "all" or empty → key crew of 3
        if focus == "all" or not focus:
            slugs = ["ray", "myrtle", "ollie"]
        else:
            slugs = [focus]
        result = await generate_cover(
            db,
            character_slugs=slugs,
            scene_prompt=(song.get("theme") or song.get("music_prompt") or "").strip()
                or f"a fun beach summer-camp scene matching the song '{song.get('title','')}'",
            title=song.get("title") or song.get("slug") or "Sing-Along",
            kind="sing_along",
            slug=song.get("slug") or song_id,
        )
        await db.sing_along_songs.update_one(
            {"id": song_id},
            {"$set": {"cover_image_url": result["url"], "updated_at": _now_iso()}},
        )
        return result

    router.include_router(admin)
    return router

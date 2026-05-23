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

import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field


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
        patch = {k: v for k, v in body.model_dump().items() if v is not None}
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

    router.include_router(admin)
    return router

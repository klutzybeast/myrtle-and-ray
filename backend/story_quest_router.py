"""Story Quest — interactive replay of the book that teaches the W.A.V.E.
framework through choices.

Public:
  • GET  /api/story-quest/scenes               active scenes, ordered
  • GET  /api/story-quest/character-mappings   W.A.V.E. → character_slug
  • POST /api/story-quest/track-completion     anonymous analytics

Admin (require_admin):
  • GET  /api/admin/story-quest/scenes         all scenes (incl. inactive)
  • POST /api/admin/story-quest/scenes         create
  • GET  /api/admin/story-quest/scenes/{id}    single
  • PATCH /api/admin/story-quest/scenes/{id}   update
  • DELETE /api/admin/story-quest/scenes/{id}  delete
  • POST /api/admin/story-quest/reorder        body: {scene_ids: [...]}  → updates scene_number
  • GET/PUT /api/admin/story-quest/character-mappings
  • GET  /api/admin/story-quest/analytics      completion counts + distributions
"""
from __future__ import annotations

import hashlib
import logging
import os
import re
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

logger = logging.getLogger("story-quest")

WAVE_KEYS = ("welcome_curiosity", "act_with_kindness", "value_teamwork", "encourage_others")

DEFAULT_CHARACTER_MAPPINGS = {
    "welcome_curiosity": "ms-bluegill",
    "act_with_kindness": "myrtle",
    "value_teamwork": "ray",
    "encourage_others": "ollie",
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class Choice(BaseModel):
    id: str = Field(min_length=1, max_length=4)
    text: str
    wave_principle: str
    character_reaction: Optional[str] = ""


class SceneBody(BaseModel):
    scene_number: Optional[int] = None
    title: Optional[str] = ""
    narrative: Optional[str] = ""
    background_image_url: Optional[str] = ""
    audio_narration_url: Optional[str] = ""
    narrator_slug: Optional[str] = ""
    choices: Optional[List[Choice]] = None
    is_intro: Optional[bool] = False
    is_finale: Optional[bool] = False
    active: Optional[bool] = True


class CompletionBody(BaseModel):
    wave_scores: dict
    matched_character: str
    matched_characters: Optional[List[str]] = None  # for ties


class FinaleVoiceBody(BaseModel):
    matched_slug: str = Field(min_length=1, max_length=64)
    player_name: Optional[str] = ""


def _sanitize_name(raw: str) -> str:
    """Keep letters/spaces/hyphens/apostrophes, max 24 chars. Empty if name is bad."""
    if not raw:
        return ""
    cleaned = re.sub(r"[^A-Za-z\s\-']", "", raw).strip()
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned[:24]


def make_story_quest_router(db, require_admin):
    router = APIRouter(tags=["story-quest"])

    # ---------------- Public ----------------

    @router.get("/story-quest/scenes")
    async def public_scenes():
        cur = db.story_quest_scenes.find({"active": True}, {"_id": 0}).sort("scene_number", 1)
        return await cur.to_list(50)

    @router.get("/story-quest/character-mappings")
    async def public_mappings():
        doc = await db.story_quest_settings.find_one({"_id": "character_mappings"}, {"_id": 0}) or {}
        return doc.get("value") or DEFAULT_CHARACTER_MAPPINGS

    @router.post("/story-quest/track-completion")
    async def track_completion(body: CompletionBody, request: Request):
        ip = request.client.host if request.client else "unknown"
        await db.story_quest_completions.insert_one({
            "id": str(uuid.uuid4()),
            "completed_at": _now_iso(),
            "wave_scores": {k: int(body.wave_scores.get(k, 0)) for k in WAVE_KEYS},
            "matched_character": body.matched_character,
            "matched_characters": body.matched_characters or [body.matched_character],
            "ip_hash": hashlib.sha256(ip.encode()).hexdigest()[:16],
        })
        return {"success": True}

    @router.post("/story-quest/finale-voice")
    async def finale_voice(body: FinaleVoiceBody):
        """Personalized voice line from the matched Sea Star.
        Reuses the existing /voice cache so repeat plays are free."""
        import voice_router as _vr
        import storage as _storage

        slug = body.matched_slug.strip().lower()
        char = await db.characters.find_one({"slug": slug}, {"_id": 0})
        if not char or not char.get("voice_id"):
            raise HTTPException(status_code=404, detail="No voice for this character.")
        voice_id = char["voice_id"]

        name = _sanitize_name(body.player_name or "")
        if name:
            text = (
                f"Way to go, {name}! You really listened to my friends and to me today. "
                f"You're a true Sea Star — and the cay shines a little brighter because of you."
            )
        else:
            text = (
                "Wow, what a quest! You really listened to my friends and to me today. "
                "You're a true Sea Star — and the cay shines a little brighter because of you."
            )

        key = _vr._cache_key(voice_id, text)
        storage_name = f"voice/{key}.mp3"
        upload_dir = os.environ.get("UPLOAD_DIR", "/app/backend/uploads")
        local_path = os.path.join(upload_dir, storage_name)

        # 1) Local cache hit
        if os.path.exists(local_path):
            return {"audio_url": f"/api/uploads/{storage_name}", "text": text}

        # 2) Persistent storage hit
        if _storage.is_enabled():
            fetched = _storage.get_object(storage_name)
            if fetched is not None:
                data, _ = fetched
                try:
                    os.makedirs(os.path.dirname(local_path), exist_ok=True)
                    with open(local_path, "wb") as fh:
                        fh.write(data)
                except Exception:  # noqa: BLE001
                    pass
                return {"audio_url": f"/api/uploads/{storage_name}", "text": text}

        # 3) Synthesize via ElevenLabs
        try:
            audio = _vr._synthesize(voice_id, text)
        except HTTPException:
            raise
        except Exception as exc:  # noqa: BLE001
            logger.exception("Finale voice synth failed")
            raise HTTPException(status_code=502, detail="Voice service is busy. Try again.") from exc
        if not audio:
            raise HTTPException(status_code=502, detail="Empty audio from voice service.")

        try:
            os.makedirs(os.path.dirname(local_path), exist_ok=True)
            with open(local_path, "wb") as fh:
                fh.write(audio)
            if _storage.is_enabled():
                _storage.put_object(storage_name, audio, "audio/mpeg")
            await db.voice_cache.update_one(
                {"key": key},
                {"$setOnInsert": {
                    "key": key,
                    "voice_id": voice_id,
                    "text": text,
                    "model_id": _vr.MODEL_ID,
                    "chars": len(text),
                    "storage_filename": storage_name,
                    "created_at": _now_iso(),
                }},
                upsert=True,
            )
        except Exception:  # noqa: BLE001
            logger.exception("Failed to persist finale voice cache")
        return {"audio_url": f"/api/uploads/{storage_name}", "text": text}

    # ---------------- Admin ----------------
    admin = APIRouter(prefix="/admin/story-quest", tags=["admin-story-quest"], dependencies=[Depends(require_admin)])

    @admin.get("/scenes")
    async def list_scenes():
        cur = db.story_quest_scenes.find({}, {"_id": 0}).sort("scene_number", 1)
        return await cur.to_list(200)

    @admin.post("/scenes")
    async def create_scene(body: SceneBody):
        next_num = body.scene_number
        if not next_num:
            last = await db.story_quest_scenes.find_one({}, {"_id": 0, "scene_number": 1}, sort=[("scene_number", -1)])
            next_num = ((last or {}).get("scene_number") or 0) + 1
        doc = {
            "id": str(uuid.uuid4()),
            "scene_number": int(next_num),
            "title": body.title or "Untitled scene",
            "narrative": body.narrative or "",
            "background_image_url": body.background_image_url or "",
            "audio_narration_url": body.audio_narration_url or "",
            "narrator_slug": (body.narrator_slug or "").strip(),
            "choices": [c.model_dump() for c in (body.choices or [])],
            "is_intro": bool(body.is_intro),
            "is_finale": bool(body.is_finale),
            "active": True if body.active is None else bool(body.active),
            "created_at": _now_iso(),
            "updated_at": _now_iso(),
        }
        await db.story_quest_scenes.insert_one(dict(doc))
        return {k: v for k, v in doc.items() if k != "_id"}

    @admin.get("/scenes/{scene_id}")
    async def get_scene(scene_id: str):
        s = await db.story_quest_scenes.find_one({"id": scene_id}, {"_id": 0})
        if not s:
            raise HTTPException(status_code=404, detail="Scene not found.")
        return s

    @admin.patch("/scenes/{scene_id}")
    async def update_scene(scene_id: str, body: SceneBody):
        existing = await db.story_quest_scenes.find_one({"id": scene_id}, {"_id": 0})
        if not existing:
            raise HTTPException(status_code=404, detail="Scene not found.")
        patch = body.model_dump(exclude_unset=True)
        if "choices" in patch and patch["choices"] is not None:
            patch["choices"] = [c if isinstance(c, dict) else c.model_dump() for c in patch["choices"]]
        patch["updated_at"] = _now_iso()
        await db.story_quest_scenes.update_one({"id": scene_id}, {"$set": patch})
        return await db.story_quest_scenes.find_one({"id": scene_id}, {"_id": 0})

    @admin.delete("/scenes/{scene_id}")
    async def delete_scene(scene_id: str):
        res = await db.story_quest_scenes.delete_one({"id": scene_id})
        if res.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Scene not found.")
        return {"ok": True}

    @admin.post("/reorder")
    async def reorder(body: dict):
        ids = body.get("scene_ids") or []
        if not isinstance(ids, list) or not ids:
            raise HTTPException(status_code=400, detail="scene_ids must be a non-empty list.")
        for idx, sid in enumerate(ids, start=1):
            await db.story_quest_scenes.update_one(
                {"id": sid}, {"$set": {"scene_number": idx, "updated_at": _now_iso()}}
            )
        return {"ok": True, "count": len(ids)}

    @admin.get("/character-mappings")
    async def admin_get_mappings():
        doc = await db.story_quest_settings.find_one({"_id": "character_mappings"}, {"_id": 0}) or {}
        return doc.get("value") or DEFAULT_CHARACTER_MAPPINGS

    @admin.put("/character-mappings")
    async def admin_update_mappings(body: dict):
        clean = {}
        for k in WAVE_KEYS:
            v = (body or {}).get(k)
            if v:
                clean[k] = str(v).strip()
        if len(clean) != 4:
            raise HTTPException(status_code=400, detail="All four W.A.V.E. principles must be mapped.")
        await db.story_quest_settings.update_one(
            {"_id": "character_mappings"},
            {"$set": {"value": clean, "updated_at": _now_iso()}},
            upsert=True,
        )
        return clean

    @admin.get("/analytics")
    async def analytics():
        total = await db.story_quest_completions.count_documents({})
        today = await db.story_quest_completions.count_documents(
            {"completed_at": {"$gte": _now_iso()[:10]}}
        )
        # Character distribution
        pipeline = [
            {"$group": {"_id": "$matched_character", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
        ]
        char_dist_cur = db.story_quest_completions.aggregate(pipeline)
        char_dist = [{"character": d["_id"], "count": d["count"]} async for d in char_dist_cur]

        # Average W.A.V.E. scores
        wave_avg = {k: 0.0 for k in WAVE_KEYS}
        if total > 0:
            wave_pipeline = [
                {"$group": {"_id": None, **{k: {"$avg": f"$wave_scores.{k}"} for k in WAVE_KEYS}}}
            ]
            async for row in db.story_quest_completions.aggregate(wave_pipeline):
                for k in WAVE_KEYS:
                    wave_avg[k] = round(float(row.get(k) or 0), 2)

        # Last 10 completions
        recent_cur = db.story_quest_completions.find(
            {}, {"_id": 0, "id": 1, "completed_at": 1, "matched_character": 1, "wave_scores": 1}
        ).sort("completed_at", -1).limit(10)
        recent = await recent_cur.to_list(10)

        return {
            "total": total,
            "today": today,
            "character_distribution": char_dist,
            "wave_averages": wave_avg,
            "recent": recent,
        }

    router.include_router(admin)
    return router

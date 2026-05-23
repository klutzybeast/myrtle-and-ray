"""AI Coloring Page generator — kids type a prompt, optionally pick a
character, Gemini Nano Banana (gemini-3.1-flash-image-preview) returns a
black-and-white line-art image suitable for printing.

Endpoints:
  Public:
    • POST /api/coloring/generate         — generate (rate-limited per visitor)
    • GET  /api/coloring/recent           — last N publicly-shared pages
    • GET  /api/coloring/settings         — enabled flag, daily cap, etc.

  Admin (require_admin):
    • GET    /api/admin/coloring/pages         — list / moderate
    • DELETE /api/admin/coloring/pages/{id}    — soft delete
    • GET    /api/admin/coloring/settings
    • PUT    /api/admin/coloring/settings

Storage:
  • Generated PNG is written under /app/backend/uploads/coloring/<hash>.png
    (served via /api/uploads/coloring/<hash>.png) and also pushed to
    persistent Object Storage on backend startup.
  • Cache: identical (character_slug, sanitized_prompt) returns the cached
    image — second kid asking for "Myrtle at the beach" pays $0.
"""
from __future__ import annotations

import base64
import hashlib
import logging
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger("coloring")

UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "/app/backend/uploads")
COLORING_DIR = os.path.join(UPLOAD_DIR, "coloring")
os.makedirs(COLORING_DIR, exist_ok=True)

# Reuse the kindness/PII guards from penpals
from penpals_router import sanitize_letter, contains_banned, _today_key, _now_iso  # noqa: E402


# ---------------- Models ----------------

class GenerateBody(BaseModel):
    prompt: str = Field(min_length=2, max_length=240)
    character_slug: Optional[str] = ""
    visitor_id: str = Field(min_length=8, max_length=64)
    child_name: Optional[str] = ""


# ---------------- Helpers ----------------

_NEG_HINTS = "no colors, no shading, no gray, no text, no signature, no watermark, white background"

# Soft list of subjects we don't want kids generating images of.
_BLOCKED_SUBJECTS = (
    "gun", "guns", "blood", "knife", "weapon", "weapons",
    "kill", "naked", "scary", "horror", "drugs",
)


def _is_blocked(prompt: str) -> bool:
    p = prompt.lower()
    return any(re.search(rf"\b{re.escape(w)}\b", p) for w in _BLOCKED_SUBJECTS) or contains_banned(prompt)


def _system_prompt(character_name: str, character_role: str) -> str:
    return (
        "You generate single-subject CHILDREN'S COLORING-BOOK LINE-ART images.\n"
        "STRICT RULES:\n"
        "1. Pure black outlines on a fully white background. NO color. NO gray. NO shading. NO crosshatching.\n"
        "2. Thick, bold, child-friendly outlines (similar weight to Crayola coloring books).\n"
        "3. A single clean composition. Cute, friendly, kid-safe.\n"
        "4. No text, no captions, no signatures, no borders, no watermarks.\n"
        "5. The output must be ready to print on letter paper and color with crayons.\n"
        f"6. If a character is named, draw THAT exact character from the book 'Myrtle and Ray and the First Day of Camp'.\n"
        f"   Character context: {character_name or 'A friendly sea creature'} — {character_role or 'a Sea Star at Stingray Cay'}.\n"
        "7. Do not draw anything scary, violent, sad, or off-brand. Keep it warm and playful.\n"
    )


def _build_user_text(character_name: str, prompt: str) -> str:
    intro = f"Create a coloring-book line-art page of {character_name}" if character_name else "Create a coloring-book line-art page"
    return f"{intro} {prompt.strip()}. {_NEG_HINTS}."


# ---------------- Router factory ----------------

def make_coloring_router(db, require_admin):
    router = APIRouter(tags=["coloring"])

    async def _settings() -> dict:
        s = await db.coloring_settings.find_one({"_id": "settings"}, {"_id": 0}) or {}
        return {
            "enabled": s.get("enabled", True),
            "daily_cap": int(s.get("daily_cap") or 5),
            "model_name": s.get("model_name") or "gemini-3.1-flash-image-preview",
            "max_prompt_chars": int(s.get("max_prompt_chars") or 240),
            "share_publicly": bool(s.get("share_publicly", True)),
        }

    # ---- Public ----

    @router.get("/coloring/settings")
    async def public_settings():
        s = await _settings()
        return {"enabled": s["enabled"], "daily_cap": s["daily_cap"], "max_prompt_chars": s["max_prompt_chars"]}

    @router.get("/coloring/recent")
    async def recent_pages(limit: int = 12):
        s = await _settings()
        if not s["share_publicly"]:
            return []
        cur = db.coloring_pages.find(
            {"deleted": {"$ne": True}, "shared": True},
            {"_id": 0, "id": 1, "prompt": 1, "image_url": 1, "character_name": 1, "created_at": 1},
        ).sort("created_at", -1).limit(min(48, max(1, int(limit))))
        return await cur.to_list(48)

    @router.post("/coloring/generate")
    async def generate(body: GenerateBody):
        settings = await _settings()
        if not settings["enabled"]:
            raise HTTPException(status_code=503, detail="Coloring Pages is taking a nap. Come back soon!")

        clean = sanitize_letter(body.prompt)
        if not clean:
            raise HTTPException(status_code=400, detail="Tell me what to draw — try a few words!")
        if _is_blocked(clean):
            raise HTTPException(status_code=400, detail="Let's pick a friendlier idea! Try a beach, a kite, or a Sea Star.")

        # Character lookup
        character_name = ""
        character_role = ""
        ch = None
        if body.character_slug:
            ch = await db.characters.find_one({"slug": body.character_slug}, {"_id": 0, "name": 1, "role": 1})
            if ch:
                character_name = ch.get("name", "")
                character_role = ch.get("role", "")

        # Rate limit per visitor per day
        used = await db.coloring_pages.count_documents({
            "visitor_id": body.visitor_id,
            "day_key": _today_key(),
        })
        if used >= settings["daily_cap"]:
            raise HTTPException(status_code=429, detail=f"You've made {used} pages today — come back tomorrow for more!")

        # Cache key — character + sanitized prompt → SHA-256.
        cache_key = hashlib.sha256(
            f"coloring|{body.character_slug or ''}|{clean.strip().lower()}".encode("utf-8")
        ).hexdigest()
        # Filename includes a hash of the prompt content so the on-disk
        # PNG is uniquely identified by what it depicts — defense against
        # any future "stale image" class of bug.
        prompt_hash = hashlib.sha256(clean.strip().lower().encode("utf-8")).hexdigest()[:16]
        fname = f"{cache_key}_{prompt_hash}.png"
        local_path = os.path.join(COLORING_DIR, fname)
        url_path = f"/api/uploads/coloring/{fname}"

        cached = await db.coloring_cache.find_one({"key": cache_key}, {"_id": 0})
        if cached and os.path.exists(local_path):
            image_url = url_path
        elif cached and not os.path.exists(local_path):
            # Legacy cache row from before the prompt_hash filename scheme —
            # check if the old-format file exists on disk, return it, and
            # mark the row stale so future writes will use the new path.
            legacy_path = os.path.join(COLORING_DIR, f"{cache_key}.png")
            if os.path.exists(legacy_path):
                image_url = f"/api/uploads/coloring/{cache_key}.png"
            else:
                # Both new and old paths missing — regenerate fresh.
                cached = None
                image_url = ""
        else:
            image_url = ""

        if not cached:
            # Call Nano Banana
            try:
                image_bytes = await _generate_image(
                    character_name=character_name,
                    character_role=character_role,
                    prompt=clean,
                    model_name=settings["model_name"],
                    cache_key=cache_key,
                )
            except HTTPException:
                raise
            except Exception as exc:  # noqa: BLE001
                logger.exception("Coloring gen failed")
                raise HTTPException(status_code=502, detail="The art studio is busy — try again in a moment.") from exc

            with open(local_path, "wb") as fh:
                fh.write(image_bytes)
            # Push to persistent storage
            try:
                import storage as _storage
                if _storage.is_enabled():
                    _storage.put_object(f"coloring/{fname}", image_bytes, "image/png")
            except Exception:  # noqa: BLE001
                pass
            await db.coloring_cache.update_one(
                {"key": cache_key},
                {"$set": {
                    "key": cache_key,
                    "character_slug": body.character_slug or "",
                    "prompt": clean,
                    "image_url": url_path,
                    "created_at": _now_iso(),
                }},
                upsert=True,
            )
            image_url = url_path

        # Persist the generation
        doc = {
            "id": str(uuid.uuid4()),
            "visitor_id": body.visitor_id,
            "day_key": _today_key(),
            "character_slug": body.character_slug or "",
            "character_name": character_name,
            "prompt": clean,
            "child_name": (body.child_name or "")[:30],
            "image_url": image_url,
            "cache_key": cache_key,
            "shared": True,  # default — admin can soft-delete to unpublish
            "deleted": False,
            "created_at": _now_iso(),
        }
        await db.coloring_pages.insert_one(dict(doc))
        doc.pop("_id", None)

        return {
            "id": doc["id"],
            "image_url": image_url,
            "prompt": clean,
            "character_name": character_name,
            "pages_left_today": max(0, settings["daily_cap"] - used - 1),
        }

    # ---- Admin ----
    admin = APIRouter(prefix="/admin/coloring", tags=["admin-coloring"], dependencies=[Depends(require_admin)])

    @admin.get("/settings")
    async def get_settings():
        return await _settings()

    @admin.put("/settings")
    async def update_settings(body: dict):
        patch = {k: v for k, v in (body or {}).items() if k in {"enabled", "daily_cap", "model_name", "max_prompt_chars", "share_publicly"}}
        patch["updated_at"] = _now_iso()
        await db.coloring_settings.update_one({"_id": "settings"}, {"$set": patch}, upsert=True)
        return await _settings()

    @admin.get("/pages")
    async def list_pages(limit: int = 100, search: str = ""):
        q: dict = {}
        if search:
            q["prompt"] = {"$regex": search, "$options": "i"}
        cur = db.coloring_pages.find(q, {"_id": 0}).sort("created_at", -1).limit(min(500, max(1, int(limit))))
        rows = await cur.to_list(500)
        total = await db.coloring_pages.count_documents({})
        today = await db.coloring_pages.count_documents({"day_key": _today_key()})
        return {"pages": rows, "total": total, "today": today}

    @admin.delete("/pages/{page_id}")
    async def delete_page(page_id: str):
        res = await db.coloring_pages.update_one({"id": page_id}, {"$set": {"deleted": True, "shared": False, "deleted_at": _now_iso()}})
        if res.matched_count == 0:
            raise HTTPException(status_code=404, detail="Page not found.")
        return {"ok": True}

    router.include_router(admin)
    return router


# ---------------- Gemini image call ----------------

async def _generate_image(character_name: str, character_role: str, prompt: str,
                          model_name: str, cache_key: str) -> bytes:
    """Calls Gemini Nano Banana via emergentintegrations. Returns raw PNG bytes.
    Raises HTTPException(503) if the LLM is not configured."""
    api_key = (os.environ.get("EMERGENT_LLM_KEY") or "").strip()
    if not api_key:
        raise HTTPException(status_code=503, detail="Image generation is not configured.")
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=503, detail="Image generation library is not installed.") from exc

    sys_msg = _system_prompt(character_name, character_role)
    user_text = _build_user_text(character_name, prompt)

    chat = LlmChat(
        api_key=api_key,
        session_id=f"coloring-{cache_key[:12]}",
        system_message=sys_msg,
    ).with_model("gemini", model_name or "gemini-3.1-flash-image-preview").with_params(modalities=["image", "text"])

    _text, images = await chat.send_message_multimodal_response(UserMessage(text=user_text))
    if not images:
        raise HTTPException(status_code=502, detail="The art studio didn't draw anything — try a different prompt.")
    img = images[0]
    data_b64 = img.get("data") if isinstance(img, dict) else None
    if not data_b64:
        raise HTTPException(status_code=502, detail="Unexpected image response.")
    try:
        return base64.b64decode(data_b64)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail="Could not decode the image.") from exc

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


class PostcardBody(BaseModel):
    email: str = Field(min_length=3, max_length=200)
    matched_slug: str = Field(min_length=1, max_length=64)
    player_name: Optional[str] = ""
    share_card_png_base64: str = Field(min_length=200)  # data:image/png;base64,...
    join_newsletter: Optional[bool] = False


def _sanitize_name(raw: str) -> str:
    """Keep letters/spaces/hyphens/apostrophes, max 24 chars. Empty if name is bad."""
    if not raw:
        return ""
    cleaned = re.sub(r"[^A-Za-z\s\-']", "", raw).strip()
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned[:24]


_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _build_postcard_pdf(*, share_card_png: bytes, child_name: str, character_name: str, finale_text: str) -> bytes:
    """Render a one-page letter-sized PDF postcard:
       - branded header strip
       - share-card PNG (full width)
       - finale voice transcript in a script-like style
       - 'Love, <Character>' signature
    """
    from io import BytesIO
    from reportlab.lib.pagesizes import LETTER
    from reportlab.lib.units import inch
    from reportlab.pdfgen import canvas as pdf_canvas
    from reportlab.lib.utils import ImageReader

    buf = BytesIO()
    page_w, page_h = LETTER
    c = pdf_canvas.Canvas(buf, pagesize=LETTER)

    margin = 0.6 * inch

    # Header band
    c.setFillColorRGB(238/255, 249/255, 251/255)
    c.rect(0, page_h - 0.55 * inch, page_w, 0.55 * inch, fill=1, stroke=0)
    c.setFillColorRGB(0.353, 0.541, 0.435)  # #5a8a6f
    c.setFont("Helvetica-Bold", 11)
    c.drawString(margin, page_h - 0.35 * inch, "CATCH THE")
    c.setFillColorRGB(0.227, 0.290, 0.333)  # #3a4a55
    c.setFont("Helvetica-Bold", 13)
    c.drawString(margin + 70, page_h - 0.35 * inch, "W.A.V.E.")
    c.setFillColorRGB(0.639, 0.420, 0.161)  # #a36b29
    c.setFont("Helvetica-Bold", 11)
    c.drawString(margin + 130, page_h - 0.35 * inch, "OF EXCITEMENT")
    c.setFillColorRGB(0.42, 0.45, 0.48)
    c.setFont("Helvetica", 9)
    c.drawRightString(page_w - margin, page_h - 0.35 * inch, "A postcard from Stingray Cay")

    # Share card image (1200×630 aspect) — fit to width
    try:
        img = ImageReader(BytesIO(share_card_png))
        target_w = page_w - 2 * margin
        target_h = target_w * (630 / 1200)
        y_top = page_h - 0.85 * inch - target_h
        c.drawImage(img, margin, y_top, width=target_w, height=target_h, mask="auto")
    except Exception:  # noqa: BLE001
        y_top = page_h - 0.85 * inch
        c.setFillColorRGB(0.42, 0.45, 0.48)
        c.setFont("Helvetica-Oblique", 11)
        c.drawString(margin, y_top, "(share card preview unavailable)")
        y_top -= 0.3 * inch

    # Greeting
    greeting_y = y_top - 0.45 * inch
    c.setFillColorRGB(0.227, 0.290, 0.333)
    c.setFont("Helvetica-Bold", 18)
    greeting = f"Dear {child_name}," if child_name else "Dear Sea Star,"
    c.drawString(margin, greeting_y, greeting)

    # Body — wrap text manually at ~76 chars
    body_lines = _wrap_text(finale_text, 76)
    body_y = greeting_y - 0.35 * inch
    c.setFont("Helvetica", 13)
    c.setFillColorRGB(0.290, 0.333, 0.376)
    for line in body_lines:
        c.drawString(margin, body_y, line)
        body_y -= 0.26 * inch

    # Signature
    sig_y = body_y - 0.5 * inch
    c.setFont("Helvetica-Oblique", 14)
    c.setFillColorRGB(0.353, 0.541, 0.435)
    c.drawString(margin, sig_y, "Love,")
    c.setFont("Helvetica-Bold", 20)
    c.drawString(margin, sig_y - 0.35 * inch, character_name)

    # Footer
    c.setFillColorRGB(0.42, 0.45, 0.48)
    c.setFont("Helvetica", 9)
    c.drawCentredString(page_w / 2, 0.45 * inch, "Print me out and pin me on the fridge! · Find your own Sea Star at myrtleandray.com/story-quest")

    c.showPage()
    c.save()
    return buf.getvalue()


def _finale_text_for(name: str) -> str:
    if name:
        return (
            f"Way to go, {name}! You really listened to my friends and to me today. "
            f"You're a true Sea Star — and the cay shines a little brighter because of you."
        )
    return (
        "Wow, what a quest! You really listened to my friends and to me today. "
        "You're a true Sea Star — and the cay shines a little brighter because of you."
    )


def _wrap_text(text: str, max_chars: int) -> list:
    out, current = [], ""
    for word in (text or "").split():
        candidate = (current + " " + word).strip()
        if len(candidate) > max_chars and current:
            out.append(current)
            current = word
        else:
            current = candidate
    if current:
        out.append(current)
    return out


def make_story_quest_router(db, require_admin):
    router = APIRouter(tags=["story-quest"])

    # ---------------- Public ----------------

    @router.get("/story-quest/quests")
    async def public_quests():
        """Quest gallery — every active quest the kid can choose from."""
        cur = db.story_quests.find({"active": True}, {"_id": 0}).sort([("position", 1), ("created_at", 1)])
        quests = await cur.to_list(50)
        # Annotate live scene counts
        for q in quests:
            q["scene_count"] = await db.story_quest_scenes.count_documents(
                {"quest_id": q["id"], "active": True}
            )
        return quests

    @router.get("/story-quest/quests/{slug}")
    async def public_quest_by_slug(slug: str):
        q = await db.story_quests.find_one({"slug": slug, "active": True}, {"_id": 0})
        if not q:
            raise HTTPException(status_code=404, detail="Quest not found.")
        q["scene_count"] = await db.story_quest_scenes.count_documents(
            {"quest_id": q["id"], "active": True}
        )
        return q

    @router.get("/story-quest/scenes")
    async def public_scenes(quest_id: Optional[str] = None, quest_slug: Optional[str] = None):
        # Resolve quest by slug if provided
        if quest_slug and not quest_id:
            q = await db.story_quests.find_one({"slug": quest_slug, "active": True}, {"_id": 0, "id": 1})
            quest_id = q["id"] if q else None
        if not quest_id:
            # Backward compatibility: return the first active quest's scenes
            first = await db.story_quests.find_one({"active": True}, {"_id": 0, "id": 1}, sort=[("position", 1)])
            quest_id = first["id"] if first else None
        match = {"active": True}
        if quest_id:
            match["quest_id"] = quest_id
        cur = db.story_quest_scenes.find(match, {"_id": 0}).sort("scene_number", 1)
        return await cur.to_list(200)

    @router.get("/story-quest/character-mappings")
    async def public_mappings():
        # NB: For now we use a single global mapping across all quests; can
        # be promoted to per-quest later by reading `story_quests.character_mappings`.
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
        from tts_pronunciation import phoneticize_for_tts

        slug = body.matched_slug.strip().lower()
        char = await db.characters.find_one({"slug": slug}, {"_id": 0})
        if not char or not char.get("voice_id"):
            raise HTTPException(status_code=404, detail="No voice for this character.")
        voice_id = char["voice_id"]

        name = _sanitize_name(body.player_name or "")
        text = _finale_text_for(name)
        tts_text = phoneticize_for_tts(text)

        key = _vr._cache_key(voice_id, tts_text)
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
            audio = _vr._synthesize(voice_id, tts_text)
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
                    "text": tts_text,
                    "model_id": _vr.MODEL_ID,
                    "chars": len(tts_text),
                    "storage_filename": storage_name,
                    "created_at": _now_iso(),
                }},
                upsert=True,
            )
        except Exception:  # noqa: BLE001
            logger.exception("Failed to persist finale voice cache")
        return {"audio_url": f"/api/uploads/{storage_name}", "text": text}

    @router.post("/story-quest/postcard")
    async def email_postcard(body: PostcardBody, request: Request):
        """Email the matched Sea Star's postcard (PDF) to a parent.
        Optionally subscribes them to the mailing list."""
        import base64
        from email_service import queue_email

        email = (body.email or "").strip().lower()
        if not _EMAIL_RE.match(email):
            raise HTTPException(status_code=400, detail="Please enter a valid email address.")

        slug = body.matched_slug.strip().lower()
        char = await db.characters.find_one({"slug": slug}, {"_id": 0})
        if not char:
            raise HTTPException(status_code=404, detail="Matched character not found.")
        character_name = char.get("name") or "Your Sea Star"

        name = _sanitize_name(body.player_name or "")
        finale_text = _finale_text_for(name)

        # Decode the share-card PNG that the kid generated client-side.
        png_data_url = body.share_card_png_base64 or ""
        png_bytes = b""
        try:
            if "," in png_data_url:
                _, b64 = png_data_url.split(",", 1)
            else:
                b64 = png_data_url
            png_bytes = base64.b64decode(b64, validate=False)
        except Exception:  # noqa: BLE001
            png_bytes = b""
        if len(png_bytes) < 1000:
            raise HTTPException(status_code=400, detail="Share card image was empty or malformed.")

        # Build the printable PDF
        try:
            pdf_bytes = _build_postcard_pdf(
                share_card_png=png_bytes,
                child_name=name,
                character_name=character_name,
                finale_text=finale_text,
            )
        except Exception as exc:  # noqa: BLE001
            logger.exception("Postcard PDF build failed")
            raise HTTPException(status_code=500, detail="Could not build the postcard.") from exc

        # Optional newsletter subscribe
        if body.join_newsletter:
            try:
                await db.mailing_list.update_one(
                    {"email": email},
                    {
                        "$setOnInsert": {
                            "id": str(uuid.uuid4()),
                            "email": email,
                            "name": name or "",
                            "source": "story_quest_postcard",
                            "subscribed_at": _now_iso(),
                            "unsubscribed": False,
                        }
                    },
                    upsert=True,
                )
            except Exception:  # noqa: BLE001
                logger.exception("Mailing list upsert failed (non-fatal)")

        # Compose email
        subject = (
            f"A postcard from {character_name} for {name}!" if name
            else f"A postcard from {character_name}!"
        )
        greeting_name = name or "Sea Star"
        newsletter_line = (
            "Want more Sea Star fun? You're on the newsletter — we'll send the next one soon. "
            if body.join_newsletter
            else "Your child can take the quest again any time at "
        )
        html = f"""
        <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#fff5ec;color:#3a4a55;">
          <p style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#5a8a6f;margin:0 0 4px;">A postcard from Stingray Cay</p>
          <h1 style="font-size:26px;margin:0 0 16px;color:#3a4a55;">A note for {greeting_name} &#127775;</h1>
          <p style="font-size:15px;line-height:1.6;background:#fff;padding:16px 18px;border-radius:14px;border:1px solid #f4e4c6;">
            &ldquo;{finale_text}&rdquo;<br/><br/>
            <em style="color:#5a8a6f;">— Love, {character_name}</em>
          </p>
          <p style="font-size:14px;line-height:1.5;margin-top:18px;">
            We've attached a printable postcard you can pin on the fridge.
            {newsletter_line}
            <a href="https://myrtleandray.com/story-quest" style="color:#5a8a6f;">myrtleandray.com/story-quest</a>
          </p>
          <p style="font-size:11px;color:#9aa5b1;margin-top:24px;">Catch the W.A.V.E. of Excitement &middot; Myrtle and Ray and the First Day of Camp</p>
        </div>
        """

        attachment_name = f"story-quest-postcard{('-' + name.lower()) if name else ''}.pdf"
        emailed = await queue_email(
            db,
            to=email,
            subject=subject,
            html=html,
            text=f"{finale_text}\n\n— Love, {character_name}",
            purpose="story_quest_postcard",
            attachments=[{
                "filename": attachment_name,
                "content_base64": base64.b64encode(pdf_bytes).decode("ascii"),
                "content_type": "application/pdf",
            }],
        )

        # Audit row (no PII beyond email already in outbox)
        await db.story_quest_postcards.insert_one({
            "id": str(uuid.uuid4()),
            "email": email,
            "matched_slug": slug,
            "player_name": name,
            "joined_newsletter": bool(body.join_newsletter),
            "email_status": emailed.get("status", "unknown"),
            "ip_hash": hashlib.sha256((request.client.host if request.client else "anon").encode()).hexdigest()[:16],
            "created_at": _now_iso(),
        })

        return {
            "success": True,
            "status": emailed.get("status", "queued"),
            "subscribed": bool(body.join_newsletter),
        }


    # ---------------- Admin ----------------
    admin = APIRouter(prefix="/admin/story-quest", tags=["admin-story-quest"], dependencies=[Depends(require_admin)])

    @admin.get("/quests")
    async def admin_list_quests():
        cur = db.story_quests.find({}, {"_id": 0}).sort([("position", 1), ("created_at", 1)])
        quests = await cur.to_list(50)
        for q in quests:
            q["scene_count"] = await db.story_quest_scenes.count_documents(
                {"quest_id": q["id"], "active": True}
            )
        return quests

    @admin.patch("/quests/{quest_id}")
    async def admin_update_quest(quest_id: str, body: dict):
        allowed = {"title", "blurb", "hero_image_url", "theme_color", "character_focus", "position", "status", "active"}
        patch = {k: v for k, v in (body or {}).items() if k in allowed and v is not None}
        if not patch:
            raise HTTPException(status_code=400, detail="No fields to update.")
        patch["updated_at"] = _now_iso()
        res = await db.story_quests.update_one({"id": quest_id}, {"$set": patch})
        if res.matched_count == 0:
            raise HTTPException(status_code=404, detail="Quest not found.")
        return await db.story_quests.find_one({"id": quest_id}, {"_id": 0})

    @admin.post("/quests/{quest_id}/generate-cover")
    async def admin_generate_quest_cover(quest_id: str):
        """Generate hero cover art for this quest. Uses the quest's
        character_focus + blurb so the cover features the actual Sea Stars."""
        from cover_art_service import generate_cover
        quest = await db.story_quests.find_one({"id": quest_id}, {"_id": 0})
        if not quest:
            raise HTTPException(status_code=404, detail="Quest not found.")
        focus = (quest.get("character_focus") or "").strip()
        if focus == "all" or not focus:
            slugs = ["ray", "myrtle", "ms-bluegill"]
        else:
            slugs = [focus]
        result = await generate_cover(
            db,
            character_slugs=slugs,
            scene_prompt=(quest.get("blurb") or "").strip()
                or f"a beach summer-camp scene for the adventure '{quest.get('title','')}'",
            title=quest.get("title") or quest.get("slug") or "Story Quest",
            kind="story_quest",
            slug=quest.get("slug") or quest_id,
        )
        await db.story_quests.update_one(
            {"id": quest_id},
            {"$set": {"hero_image_url": result["url"], "updated_at": _now_iso()}},
        )
        return result

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

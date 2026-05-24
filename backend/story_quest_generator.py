"""Complete Story Quest Generator.

Takes a premise + character set and produces a full interactive story
quest (12–20 scenes) with dialogue, multiple-choice branches mapped to
the W.A.V.E. principles, AI background art (Nano Banana), and ElevenLabs
narration audio — all in one click.

Job lifecycle (persisted in `story_quest_jobs`):
    queued -> generating_script -> creating_quest -> creating_scenes
        -> generating_backgrounds -> generating_narration -> done | failed

The expensive bits (image + voice) run in a background task so the API
returns immediately with a job_id that the admin UI polls.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger("story-quest-generator")

WAVE_KEYS = ("welcome_curiosity", "act_with_kindness", "value_teamwork", "encourage_others")
WAVE_LABEL = {
    "welcome_curiosity": "Welcome curiosity",
    "act_with_kindness": "Act with kindness",
    "value_teamwork": "Value teamwork",
    "encourage_others": "Encourage others",
}

DEFAULT_NARRATOR_BY_WAVE = {
    "welcome_curiosity": "ms-bluegill",
    "act_with_kindness": "myrtle",
    "value_teamwork": "ray",
    "encourage_others": "ollie",
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _slugify(s: str) -> str:
    s = (s or "").strip().lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s[:60] or f"quest-{uuid.uuid4().hex[:6]}"


class GenerateBody(BaseModel):
    title: str = Field(min_length=2, max_length=120)
    premise: str = Field(min_length=10, max_length=2000)
    character_focus: str = Field(default="all", max_length=64)
    character_slugs: List[str] = Field(default_factory=list)  # available cast for choices
    scene_count: int = Field(default=14, ge=6, le=24)
    theme_color: Optional[str] = Field(default="#7fcfc7", max_length=20)
    generate_backgrounds: bool = True
    generate_narration: bool = True
    publish: bool = False  # if False, quest is created as inactive (draft)


def _system_prompt() -> str:
    return (
        "You are a master children's book author writing an interactive "
        "story-quest adventure for ages 5–9. The quest is set at Stingray "
        "Cay summer camp and stars a cast of friendly sea-animal "
        "counselors known as the Sea Stars. Every scene is gentle, "
        "joyful, age-appropriate, and reinforces the W.A.V.E. framework:\n"
        "  W = Welcome curiosity\n"
        "  A = Act with kindness\n"
        "  V = Value teamwork\n"
        "  E = Encourage others\n\n"
        "Return STRICT JSON only — no commentary, no markdown fences. "
        "Schema:\n"
        "{\n"
        '  "scenes": [\n'
        "    {\n"
        '      "scene_number": 1,\n'
        '      "title": "short scene title",\n'
        '      "narrative": "2-4 sentences of rich descriptive prose",\n'
        '      "narrator_slug": "myrtle",  // pick from provided cast\n'
        '      "background_prompt": "vivid one-paragraph art-direction for an illustrator",\n'
        '      "choices": [\n'
        '        {"id":"A","text":"...","wave_principle":"act_with_kindness","character_reaction":"..."},\n'
        '        {"id":"B","text":"...","wave_principle":"value_teamwork","character_reaction":"..."}\n'
        "      ],\n"
        '      "is_intro": false,\n'
        '      "is_finale": false\n'
        "    }\n"
        "  ]\n"
        "}\n\n"
        "Rules:\n"
        "1. The FIRST scene MUST set is_intro=true and have no choices (use []).\n"
        "2. The LAST scene MUST set is_finale=true and have no choices (use []).\n"
        "3. Every middle scene MUST have exactly 3 choices, each mapped to a DIFFERENT wave_principle.\n"
        "4. Cover all four W.A.V.E. principles at least twice across the quest.\n"
        "5. character_reaction is a one-line warm response the narrator gives to that choice.\n"
        "6. Use only the character slugs provided in the user prompt.\n"
        "7. background_prompt should be visual, no dialogue, paint the camera angle and mood.\n"
        "8. narrative should NOT include the choices — leave those for the choices array.\n"
        "9. Output MUST be valid JSON parseable by Python's json.loads."
    )


def _user_prompt(body: GenerateBody, cast: list) -> str:
    cast_summary = "\n".join(
        f"  - {c.get('slug')}: {c.get('name','')} — {c.get('role') or c.get('species') or ''}"
        for c in cast
    ) or "  (use myrtle, ray, ms-bluegill, ollie)"
    return (
        f"Title: {body.title}\n"
        f"Premise: {body.premise}\n"
        f"Number of scenes: {body.scene_count}\n"
        f"Available cast (use these slugs only):\n{cast_summary}\n\n"
        "Generate the full quest now as JSON. Aim for variety in setting, "
        "pacing, and emotional beats. Build to a heartwarming finale that "
        "celebrates whatever the player chose along the way."
    )


def _clean_json(text: str) -> dict:
    """LLMs sometimes wrap JSON in ```json fences or add prose. Strip those."""
    t = (text or "").strip()
    if t.startswith("```"):
        t = re.sub(r"^```(?:json)?\s*", "", t)
        t = re.sub(r"\s*```$", "", t)
    # Find the first { and last } to be safe.
    start = t.find("{")
    end = t.rfind("}")
    if start >= 0 and end > start:
        t = t[start:end + 1]
    return json.loads(t)


async def _call_llm(body: GenerateBody, cast: list) -> dict:
    api_key = (os.environ.get("EMERGENT_LLM_KEY") or "").strip()
    if not api_key:
        raise HTTPException(status_code=503, detail="EMERGENT_LLM_KEY missing — admin must top up the Universal Key.")
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
    except Exception as exc:
        raise HTTPException(status_code=503, detail="LLM library missing.") from exc

    chat = LlmChat(
        api_key=api_key,
        session_id=f"quest-gen-{uuid.uuid4().hex[:8]}",
        system_message=_system_prompt(),
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")

    raw = await chat.send_message(UserMessage(text=_user_prompt(body, cast)))
    raw = (raw or "").strip()
    if not raw:
        raise HTTPException(status_code=502, detail="LLM returned empty response.")
    try:
        data = _clean_json(raw)
    except Exception as exc:
        logger.exception("Quest LLM JSON parse failed. Raw response:\n%s", raw[:2000])
        raise HTTPException(status_code=502, detail=f"LLM returned invalid JSON: {exc}") from exc
    scenes = data.get("scenes")
    if not isinstance(scenes, list) or not scenes:
        raise HTTPException(status_code=502, detail="LLM response missing 'scenes' array.")
    return data


def _normalize_scenes(raw_scenes: list, valid_slugs: set) -> list:
    """Defensive shape-fixer so a slightly off LLM response still works."""
    out = []
    for idx, s in enumerate(raw_scenes, start=1):
        scene_number = int(s.get("scene_number") or idx)
        is_intro = idx == 1 or bool(s.get("is_intro"))
        is_finale = idx == len(raw_scenes) or bool(s.get("is_finale"))
        choices_raw = s.get("choices") if (not is_intro and not is_finale) else []
        choices = []
        for ci, c in enumerate(choices_raw or []):
            if not isinstance(c, dict):
                continue
            wave = (c.get("wave_principle") or "").strip()
            if wave not in WAVE_KEYS:
                # Fallback: rotate through principles to keep distribution
                wave = WAVE_KEYS[ci % 4]
            choices.append({
                "id": (c.get("id") or chr(65 + ci))[:4],
                "text": (c.get("text") or "").strip()[:240] or f"Option {ci+1}",
                "wave_principle": wave,
                "character_reaction": (c.get("character_reaction") or "").strip()[:240],
            })
        narrator = (s.get("narrator_slug") or "").strip().lower()
        if narrator not in valid_slugs and valid_slugs:
            narrator = next(iter(valid_slugs))
        out.append({
            "scene_number": scene_number,
            "title": (s.get("title") or f"Scene {scene_number}").strip()[:160],
            "narrative": (s.get("narrative") or "").strip()[:1200],
            "background_prompt": (s.get("background_prompt") or "").strip()[:600],
            "narrator_slug": narrator,
            "choices": choices,
            "is_intro": is_intro,
            "is_finale": is_finale,
        })
    return out


# --- Async asset generation worker ----------------------------------------

async def _generate_scene_background(db, scene_id: str, quest_slug: str,
                                     scene_number: int, prompt: str,
                                     narrator_slug: str) -> Optional[str]:
    try:
        from cover_art_service import generate_cover
        # Pull the narrator portrait as the visual anchor for the scene.
        slugs = [narrator_slug] if narrator_slug else ["myrtle"]
        result = await generate_cover(
            db,
            character_slugs=slugs,
            scene_prompt=prompt,
            title=f"{quest_slug}-scene-{scene_number}",
            kind="story_quest",
            slug=f"{quest_slug}-scene-{scene_number}",
        )
        url = result.get("url", "")
        # Mirror to thumbnails library so it shows up in the unified gallery.
        if url:
            try:
                await db.thumbnails.update_one(
                    {"url": url},
                    {"$setOnInsert": {
                        "id": uuid.uuid4().hex,
                        "url": url,
                        "filename": result.get("filename", ""),
                        "kind": "general",
                        "title": f"Scene {scene_number}",
                        "scene_prompt": prompt,
                        "aspect": "wide",
                        "character_slugs": slugs,
                        "size_bytes": 0,
                        "source": "story_quest_scene",
                        "created_at": _now_iso(),
                    }},
                    upsert=True,
                )
            except Exception:  # noqa: BLE001
                pass
        return url
    except Exception as exc:  # noqa: BLE001
        logger.warning("Scene %s background gen failed: %s", scene_number, exc)
        return None


async def _generate_scene_narration(db, narrator_slug: str, text: str) -> Optional[str]:
    """Reuse the existing voice cache — same path used by /voice/play."""
    try:
        import voice_router as _vr
        import storage as _storage
        from tts_pronunciation import phoneticize_for_tts

        if not text.strip() or not narrator_slug:
            return None
        char = await db.characters.find_one({"slug": narrator_slug}, {"_id": 0, "voice_id": 1})
        if not char or not char.get("voice_id"):
            return None
        voice_id = char["voice_id"]
        tts_text = phoneticize_for_tts(text)
        key = _vr._cache_key(voice_id, tts_text)
        storage_name = f"voice/{key}.mp3"
        upload_dir = os.environ.get("UPLOAD_DIR", "/app/backend/uploads")
        local_path = os.path.join(upload_dir, storage_name)
        url = f"/api/uploads/{storage_name}"

        if os.path.exists(local_path):
            return url
        if _storage.is_enabled():
            fetched = _storage.get_object(storage_name)
            if fetched is not None:
                data, _ct = fetched
                os.makedirs(os.path.dirname(local_path), exist_ok=True)
                with open(local_path, "wb") as fh:
                    fh.write(data)
                return url

        # Run blocking ElevenLabs call off the event loop.
        loop = asyncio.get_running_loop()
        audio = await loop.run_in_executor(None, _vr._synthesize, voice_id, tts_text)
        if not audio:
            return None
        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        with open(local_path, "wb") as fh:
            fh.write(audio)
        if _storage.is_enabled():
            try:
                _storage.put_object(storage_name, audio, "audio/mpeg")
            except Exception:  # noqa: BLE001
                pass
        try:
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
            pass
        return url
    except Exception as exc:  # noqa: BLE001
        logger.warning("Narration gen failed for narrator=%s: %s", narrator_slug, exc)
        return None


async def _run_job(db, job_id: str, body: GenerateBody) -> None:
    async def _set(**patch):
        patch["updated_at"] = _now_iso()
        await db.story_quest_jobs.update_one({"id": job_id}, {"$set": patch})

    try:
        await _set(status="generating_script", step="Writing the story…", progress=5)

        # Resolve cast (DB lookup)
        slugs_filter = body.character_slugs
        if slugs_filter:
            cast_cur = db.characters.find({"slug": {"$in": slugs_filter}}, {"_id": 0})
        else:
            cast_cur = db.characters.find({}, {"_id": 0})
        cast = await cast_cur.to_list(40)
        valid_slugs = {c["slug"] for c in cast}

        data = await _call_llm(body, cast)
        scenes = _normalize_scenes(data.get("scenes") or [], valid_slugs)
        if not scenes:
            raise HTTPException(status_code=502, detail="No scenes returned by LLM.")

        await _set(status="creating_quest", step="Building the quest…", progress=15,
                   total_scenes=len(scenes), scenes_done=0)

        # Build a unique slug
        base_slug = _slugify(body.title)
        slug = base_slug
        n = 2
        while await db.story_quests.find_one({"slug": slug}):
            slug = f"{base_slug}-{n}"
            n += 1

        quest_id = str(uuid.uuid4())
        last_pos = await db.story_quests.find_one({}, sort=[("position", -1)]) or {}
        quest_doc = {
            "id": quest_id,
            "slug": slug,
            "title": body.title.strip(),
            "blurb": body.premise.strip()[:280],
            "hero_image_url": "",
            "theme_color": body.theme_color or "#7fcfc7",
            "character_focus": body.character_focus or "all",
            "position": int((last_pos.get("position") or 0)) + 1,
            "status": "draft" if not body.publish else "published",
            "active": bool(body.publish),
            "created_at": _now_iso(),
            "updated_at": _now_iso(),
            "generated_by_job": job_id,
        }
        await db.story_quests.insert_one(dict(quest_doc))

        # Create scenes (text first, so the admin can preview while images render)
        await _set(status="creating_scenes", step="Saving scenes…", progress=25)
        scene_ids: List[str] = []
        for s in scenes:
            sid = str(uuid.uuid4())
            scene_ids.append(sid)
            await db.story_quest_scenes.insert_one({
                "id": sid,
                "quest_id": quest_id,
                "scene_number": int(s["scene_number"]),
                "title": s["title"],
                "narrative": s["narrative"],
                "background_image_url": "",
                "background_prompt": s["background_prompt"],
                "audio_narration_url": "",
                "narrator_slug": s["narrator_slug"],
                "choices": s["choices"],
                "is_intro": s["is_intro"],
                "is_finale": s["is_finale"],
                "active": True,
                "created_at": _now_iso(),
                "updated_at": _now_iso(),
            })
        await _set(quest_id=quest_id, quest_slug=slug, progress=35)

        done = 0
        total_assets = len(scenes) * (
            (1 if body.generate_backgrounds else 0) + (1 if body.generate_narration else 0)
        ) or 1

        # Backgrounds — sequential to be gentle on the LLM quota.
        if body.generate_backgrounds:
            await _set(status="generating_backgrounds", step="Painting scene art…")
            for s, sid in zip(scenes, scene_ids):
                url = await _generate_scene_background(
                    db, sid, slug, int(s["scene_number"]), s["background_prompt"], s["narrator_slug"]
                )
                if url:
                    await db.story_quest_scenes.update_one(
                        {"id": sid},
                        {"$set": {"background_image_url": url, "updated_at": _now_iso()}},
                    )
                    if s["is_intro"]:
                        await db.story_quests.update_one(
                            {"id": quest_id},
                            {"$set": {"hero_image_url": url, "updated_at": _now_iso()}},
                        )
                done += 1
                await _set(
                    progress=35 + int(50 * done / total_assets),
                    scenes_done=done,
                    step=f"Painted scene {s['scene_number']}",
                )

        # Narration
        if body.generate_narration:
            await _set(status="generating_narration", step="Recording narration…")
            for s, sid in zip(scenes, scene_ids):
                audio_url = await _generate_scene_narration(
                    db, s["narrator_slug"], s["narrative"]
                )
                if audio_url:
                    await db.story_quest_scenes.update_one(
                        {"id": sid},
                        {"$set": {"audio_narration_url": audio_url, "updated_at": _now_iso()}},
                    )
                done += 1
                await _set(
                    progress=35 + int(60 * done / total_assets),
                    scenes_done=done,
                    step=f"Narrated scene {s['scene_number']}",
                )

        await _set(status="done", step="Quest ready!", progress=100,
                   completed_at=_now_iso())
    except HTTPException as exc:
        logger.warning("Quest job %s failed: %s", job_id, exc.detail)
        await db.story_quest_jobs.update_one(
            {"id": job_id},
            {"$set": {"status": "failed", "error": str(exc.detail), "updated_at": _now_iso()}},
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("Quest job %s crashed", job_id)
        await db.story_quest_jobs.update_one(
            {"id": job_id},
            {"$set": {"status": "failed", "error": str(exc), "updated_at": _now_iso()}},
        )


def make_story_quest_generator_router(db, require_admin):
    router = APIRouter(prefix="/admin/story-quest", tags=["admin-story-quest-generator"],
                       dependencies=[Depends(require_admin)])

    @router.post("/generate-full")
    async def start_generation(body: GenerateBody):
        # Cheap pre-flight checks so the UI can show "configure key" instantly.
        if not (os.environ.get("EMERGENT_LLM_KEY") or "").strip():
            raise HTTPException(status_code=503, detail="EMERGENT_LLM_KEY missing — add credits in Profile → Universal Key.")
        job_id = uuid.uuid4().hex
        await db.story_quest_jobs.insert_one({
            "id": job_id,
            "status": "queued",
            "step": "Queued",
            "progress": 0,
            "title": body.title,
            "premise": body.premise[:280],
            "scene_count": body.scene_count,
            "generate_backgrounds": bool(body.generate_backgrounds),
            "generate_narration": bool(body.generate_narration),
            "created_at": _now_iso(),
            "updated_at": _now_iso(),
        })
        asyncio.create_task(_run_job(db, job_id, body))
        return {"job_id": job_id}

    @router.get("/generate-status/{job_id}")
    async def status(job_id: str):
        row = await db.story_quest_jobs.find_one({"id": job_id}, {"_id": 0})
        if not row:
            raise HTTPException(status_code=404, detail="Job not found")
        return row

    @router.get("/generate-jobs")
    async def list_jobs():
        cur = db.story_quest_jobs.find({}, {"_id": 0}).sort("created_at", -1).limit(25)
        return await cur.to_list(25)

    return router

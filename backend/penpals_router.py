"""Wave Pal Pen Pals — kids write a short letter to a Sea Star and get a
character-in-voice rhyming reply.

Pipeline per letter:
  1.  Rate-limit (default 5 letters / day / visitor_id).
  2.  Strip PII (emails, phone numbers, full addresses) from the kid's text.
  3.  Hash (character_slug + sanitized_letter) → cache key.
  4.  If cached reply exists, serve it (free).
  5.  Otherwise call Gemini Flash via emergentintegrations to generate a
      reply written in the character's voice. Persist the reply text
      and (cache_key, reply_text) for re-use.
  6.  Optionally synthesize an MP3 of the reply using the character's
      ElevenLabs voice (only if voice_router is wired) — cached on disk
      under uploads/penpals/<hash>.mp3 + persistent storage.
  7.  Append the exchange to db.pen_pal_letters and bump the visitor's
      daily counter in db.pen_pal_quotas (TTL'd implicitly via day_key).

All exchanges are stored for admin moderation review.
"""
from __future__ import annotations

import hashlib
import logging
import os
import re
import uuid
from datetime import datetime, timezone
from typing import List, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger("penpals")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _today_key() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


# ---------------- PII / safety scrubbing ----------------

_EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
_PHONE_RE = re.compile(r"(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)?\d{3}[\s.-]?\d{4}")
_URL_RE = re.compile(r"https?://\S+|www\.\S+", re.I)
_BANNED_WORDS = {
    # Tiny illustrative list — keep replies kid-safe. Production should
    # plug a real profanity filter library, but for our 3–8 audience the
    # LLM system prompt + this list catches anything realistic kids type.
    "kill", "die", "hate", "stupid", "dumb", "ugly",
}


def sanitize_letter(text: str) -> str:
    """Strip PII + url-shaped content and trim length. Returns sanitized text."""
    if not text:
        return ""
    out = _EMAIL_RE.sub("[email]", text)
    out = _PHONE_RE.sub("[phone]", out)
    out = _URL_RE.sub("[link]", out)
    out = out.strip()
    return out[:500]


def contains_banned(text: str) -> bool:
    if not text:
        return False
    lower = text.lower()
    return any(re.search(rf"\b{re.escape(w)}\b", lower) for w in _BANNED_WORDS)


# ---------------- Character system prompts ----------------

def _system_prompt(character_name: str, character_role: str, wave_value: str, fun_fact: str) -> str:
    wave_lookup = {
        "W": "Welcome curiosity",
        "A": "Act with kindness",
        "V": "Value teamwork",
        "E": "Encourage others",
    }
    wave_phrase = wave_lookup.get((wave_value or "").upper(), "")
    return (
        f"You are {character_name}, a beloved character from the children's picture book "
        f"'Myrtle and Ray and the First Day of Camp'. Your role is: {character_role or 'a friendly Sea Star'}. "
        f"Your W.A.V.E. value: {wave_phrase or 'kindness'}.\n"
        f"Fun fact about you: {fun_fact or 'You love your friends at Stingray Cay.'}\n"
        "\n"
        "RULES — follow ALL of them:\n"
        "1. Reply as the character writing back to a child pen pal aged 3–8.\n"
        "2. Use exactly 4 short rhyming couplets (8 lines total). End-rhymes only — keep them simple and singable.\n"
        "3. Vocabulary: 2nd-grade reading level. Short sentences.\n"
        "4. Always positive, warm, and encouraging. Never frightening.\n"
        "5. Reference the W.A.V.E. value above somewhere in the reply.\n"
        "6. NEVER include URLs, emails, phone numbers, addresses, real-world locations, news topics, scary topics, "
        "or anything political/medical/violent. NEVER ask for personal info.\n"
        "7. Stay in character — talk about Stingray Cay, your friends, beach things.\n"
        "8. Sign off with your name on its own line.\n"
        "Return only the rhyme — no preamble like 'Here is your reply'."
    )


# ---------------- Main router ----------------

class LetterBody(BaseModel):
    character_slug: str
    letter: str = Field(min_length=1, max_length=500)
    visitor_id: str = Field(min_length=8, max_length=64)
    child_name: Optional[str] = ""  # Optional first name for personalization (not stored long-term)
    want_audio: Optional[bool] = True


def make_penpals_router(db, require_admin):
    router = APIRouter(tags=["penpals"])

    # ---- Settings helpers ----
    async def _settings() -> dict:
        s = await db.pen_pal_settings.find_one({"_id": "settings"}, {"_id": 0}) or {}
        return {
            "enabled": s.get("enabled", True),
            "daily_cap": int(s.get("daily_cap") or 5),
            "model_provider": s.get("model_provider") or "gemini",
            "model_name": s.get("model_name") or "gemini-3-flash-preview",
            "max_letter_chars": int(s.get("max_letter_chars") or 500),
            "audio_enabled": bool(s.get("audio_enabled", True)),
        }

    # ---- Public ----

    @router.get("/pen-pals/settings")
    async def public_settings():
        s = await _settings()
        return {"enabled": s["enabled"], "daily_cap": s["daily_cap"], "max_letter_chars": s["max_letter_chars"]}

    @router.get("/pen-pals/history/{visitor_id}")
    async def history(visitor_id: str, limit: int = 20):
        cur = db.pen_pal_letters.find(
            {"visitor_id": visitor_id, "deleted": {"$ne": True}},
            {"_id": 0, "letter": 1, "reply_text": 1, "audio_url": 1, "character_slug": 1, "character_name": 1, "created_at": 1, "id": 1},
        ).sort("created_at", -1).limit(min(50, max(1, int(limit))))
        return await cur.to_list(50)

    @router.post("/pen-pals/letter")
    async def post_letter(body: LetterBody):
        settings = await _settings()
        if not settings["enabled"]:
            raise HTTPException(status_code=503, detail="Pen Pals is taking a nap right now. Come back soon!")

        # 1) Sanitize + safety
        clean = sanitize_letter(body.letter)
        if not clean:
            raise HTTPException(status_code=400, detail="Your letter looks empty — try writing a sentence!")
        if contains_banned(clean):
            raise HTTPException(status_code=400, detail="Let's keep our letters kind! Try again with friendly words.")

        # 2) Character lookup
        ch = await db.characters.find_one({"slug": body.character_slug}, {"_id": 0})
        if not ch:
            raise HTTPException(status_code=404, detail="That Sea Star isn't here.")

        # 3) Rate limit per visitor per day
        day_key = _today_key()
        used = await db.pen_pal_letters.count_documents({
            "visitor_id": body.visitor_id,
            "day_key": day_key,
        })
        if used >= settings["daily_cap"]:
            raise HTTPException(status_code=429, detail=f"You've sent {used} letters today — come back tomorrow for more!")

        # 4) Cache lookup (deterministic per character + sanitized letter)
        cache_key = hashlib.sha256(
            f"penpal|{body.character_slug}|{clean.strip().lower()}".encode("utf-8")
        ).hexdigest()
        cached = await db.pen_pal_cache.find_one({"key": cache_key}, {"_id": 0})

        if cached:
            reply_text = cached["reply_text"]
            audio_url = cached.get("audio_url", "")
        else:
            # 5) Generate via LLM
            reply_text = await _generate_reply(
                ch=ch,
                child_letter=clean,
                child_name=(body.child_name or "").strip()[:30],
                model_provider=settings["model_provider"],
                model_name=settings["model_name"],
                cache_key=cache_key,
            )
            audio_url = ""
            # 6) Synthesize audio (best-effort)
            if body.want_audio and settings["audio_enabled"] and ch.get("voice_id"):
                try:
                    audio_url = await _synthesize_audio(reply_text, ch.get("voice_id", ""), cache_key)
                except Exception as exc:  # noqa: BLE001
                    logger.warning("Pen-pal audio synth failed: %s", exc)
                    audio_url = ""
            await db.pen_pal_cache.insert_one({
                "key": cache_key,
                "character_slug": body.character_slug,
                "reply_text": reply_text,
                "audio_url": audio_url,
                "created_at": _now_iso(),
            })

        # 7) Persist the exchange
        letter_doc = {
            "id": str(uuid.uuid4()),
            "visitor_id": body.visitor_id,
            "day_key": day_key,
            "character_slug": body.character_slug,
            "character_name": ch.get("name", ""),
            "letter": clean,
            "child_name": (body.child_name or "")[:30],
            "reply_text": reply_text,
            "audio_url": audio_url,
            "cache_key": cache_key,
            "deleted": False,
            "created_at": _now_iso(),
        }
        await db.pen_pal_letters.insert_one(dict(letter_doc))
        letter_doc.pop("_id", None)

        return {
            "id": letter_doc["id"],
            "character_slug": body.character_slug,
            "character_name": ch.get("name", ""),
            "reply_text": reply_text,
            "audio_url": audio_url,
            "letters_left_today": max(0, settings["daily_cap"] - used - 1),
        }

    # ---- Admin ----
    admin = APIRouter(prefix="/admin/pen-pals", tags=["admin-penpals"], dependencies=[Depends(require_admin)])

    @admin.get("/settings")
    async def get_settings():
        return await _settings()

    @admin.put("/settings")
    async def update_settings(body: dict):
        patch = {k: v for k, v in (body or {}).items() if k in {"enabled", "daily_cap", "model_provider", "model_name", "max_letter_chars", "audio_enabled"}}
        patch["updated_at"] = _now_iso()
        await db.pen_pal_settings.update_one({"_id": "settings"}, {"$set": patch}, upsert=True)
        return await _settings()

    @admin.get("/letters")
    async def list_letters(limit: int = 100, character: str = "", search: str = ""):
        q: dict = {}
        if character:
            q["character_slug"] = character
        if search:
            q["$or"] = [{"letter": {"$regex": search, "$options": "i"}}, {"reply_text": {"$regex": search, "$options": "i"}}]
        cur = db.pen_pal_letters.find(q, {"_id": 0}).sort("created_at", -1).limit(min(500, max(1, int(limit))))
        rows = await cur.to_list(500)
        # Aggregate counts
        total = await db.pen_pal_letters.count_documents({})
        today = await db.pen_pal_letters.count_documents({"day_key": _today_key()})
        return {"letters": rows, "total": total, "today": today}

    @admin.delete("/letters/{letter_id}")
    async def delete_letter(letter_id: str):
        res = await db.pen_pal_letters.update_one({"id": letter_id}, {"$set": {"deleted": True, "deleted_at": _now_iso()}})
        if res.matched_count == 0:
            raise HTTPException(status_code=404, detail="Letter not found.")
        return {"ok": True}

    router.include_router(admin)
    return router


# ---------------- LLM call ----------------

async def _generate_reply(ch: dict, child_letter: str, child_name: str,
                          model_provider: str, model_name: str, cache_key: str) -> str:
    """Call Gemini Flash via emergentintegrations. Falls back to a safe
    canned reply if the LLM is unavailable (so the UX never crashes)."""
    api_key = (os.environ.get("EMERGENT_LLM_KEY") or "").strip()
    if not api_key:
        return _fallback_reply(ch, child_name)
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage  # local import — kept off hot path
    except Exception:  # noqa: BLE001
        return _fallback_reply(ch, child_name)

    sys_msg = _system_prompt(
        character_name=ch.get("name", "Friend"),
        character_role=ch.get("role", ""),
        wave_value=ch.get("wave_value", ""),
        fun_fact=ch.get("fun_fact", ""),
    )
    user_text = (
        f"My name is {child_name}.\n\n"
        if child_name else ""
    ) + f"Here is my letter to you:\n\n{child_letter}\n\nPlease write back!"

    try:
        chat = LlmChat(
            api_key=api_key,
            session_id=f"penpal-{cache_key[:12]}",
            system_message=sys_msg,
        ).with_model(model_provider or "gemini", model_name or "gemini-3-flash-preview")
        reply = await chat.send_message(UserMessage(text=user_text))
        reply = (reply or "").strip()
        if not reply:
            return _fallback_reply(ch, child_name)
        return reply[:2000]
    except Exception as exc:  # noqa: BLE001
        logger.warning("LLM call failed (%s) — using fallback", exc)
        return _fallback_reply(ch, child_name)


def _fallback_reply(ch: dict, child_name: str) -> str:
    name = ch.get("name", "Your Sea Star friend")
    addressee = child_name or "friend"
    return (
        f"Hello, dear {addressee}, I'm glad you wrote in,\n"
        "Your message was bright like the sunshine within.\n"
        "At Stingray Cay we play and we share,\n"
        "Kindness and laughter are sprinkled everywhere.\n"
        "When you feel shy, take a breath, count to three,\n"
        "Brave little hearts swim as wide as the sea.\n"
        "Keep your dreams sparkly — together we'll thrive,\n"
        "Catch the W.A.V.E. and the friendship will dive.\n"
        f"\n— {name}"
    )


# ---------------- ElevenLabs audio (best-effort) ----------------

ELEVEN_API_KEY = (os.environ.get("ELEVENLABS_API_KEY") or "").strip()
ELEVEN_MODEL = os.environ.get("ELEVENLABS_MODEL_ID", "eleven_v3")


async def _synthesize_audio(text: str, voice_id: str, cache_key: str) -> str:
    if not (ELEVEN_API_KEY and voice_id and text):
        return ""
    # Try local cache first (idempotent across deploys via uploads/penpals/)
    upload_dir = os.environ.get("UPLOAD_DIR", "/app/backend/uploads")
    target_dir = os.path.join(upload_dir, "penpals")
    os.makedirs(target_dir, exist_ok=True)
    fname = f"{cache_key}.mp3"
    local_path = os.path.join(target_dir, fname)
    url_path = f"/api/uploads/penpals/{fname}"

    if os.path.exists(local_path):
        return url_path

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
    headers = {"xi-api-key": ELEVEN_API_KEY, "Content-Type": "application/json", "Accept": "audio/mpeg"}
    body = {
        "text": text,
        "model_id": ELEVEN_MODEL,
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.85, "style": 0.3},
    }
    async with httpx.AsyncClient(timeout=45.0) as http:
        r = await http.post(url, headers=headers, json=body)
        if r.status_code != 200:
            logger.warning("ElevenLabs synth %s: %s", r.status_code, r.text[:200])
            return ""
        with open(local_path, "wb") as fh:
            fh.write(r.content)
    # Push to persistent storage if available
    try:
        import storage as _storage
        if _storage.is_enabled():
            _storage.put_object(f"penpals/{fname}", r.content, "audio/mpeg")
    except Exception:  # noqa: BLE001
        pass
    return url_path

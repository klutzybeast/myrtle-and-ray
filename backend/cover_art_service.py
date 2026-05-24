"""Generate beach-themed cover art that ALWAYS includes the actual Sea Star
characters (using character portraits as reference inputs to Nano Banana).

Public function:
    await generate_cover(db, *, character_slugs, scene_prompt, title, kind, slug)

Where:
    kind  -> "sing_along" | "story_quest"
    slug  -> the song slug or quest slug (used as filename)

Returns: dict { "url": "/api/uploads/covers/<kind>/<slug>.png", "filename": ... }

Raises HTTPException on failure.
"""
from __future__ import annotations

import base64
import logging
import os
import uuid
from pathlib import Path
from typing import List, Optional

from fastapi import HTTPException

log = logging.getLogger(__name__)

UPLOAD_ROOT = Path(os.environ.get("UPLOAD_DIR", "/app/backend/uploads"))
COVERS_DIR = UPLOAD_ROOT / "covers"
CHAR_DIR = UPLOAD_ROOT / "characters"

# Lightweight character identity hints. The VISUAL look (color, outfit, props)
# is determined ENTIRELY by the reference portrait image we pass to Nano Banana —
# do NOT describe colors or outfits in text here, because text descriptions will
# override the reference image and produce wrong colors (e.g. yellow Sally
# instead of pink). Only mention the species + role so the model knows the
# character's vibe and what they typically do.
CHARACTER_VISUALS = {
    "ray":         "Ray the Manta Ray — friendly young manta ray, star of the Surfing Squad.",
    "myrtle":      "Myrtle the Turtle — kind sea turtle, Nature Scout.",
    "ms-bluegill": "Ms Bluegill — adult bluegill fish, Camp Director, warm and welcoming.",
    "ollie":       "Ollie the Octopus — eight-armed Arts and Crafts King.",
    "sally":       "Sally the Seahorse — Master Painter, gentle and creative.",
    "jessie":      "Jessie the Jellyfish — Calm Leader, peaceful meditative pose.",
    "casey":       "Casey the Crab — Sand Castle Engineer, energetic.",
    "dani":        "Dani the Dolphin — High-Dive Captain, joyful.",
    "sami":        "Sami the Shark — friendly Goal Keeper on the sports field.",
    "izzy":        "Izzy the Iguana — adventurous Rock Climber.",
    "louie":       "Louie the Lobster — silly Camp Band Drummer.",
    "billy":       "Billy the Beluga — focused Maze Navigator.",
    "frankie":     "Frankie the Flamingo — graceful Ballet Instructor on one leg.",
}


def _portrait_path(slug: str) -> Path:
    p = CHAR_DIR / f"{slug}.jpeg"
    if not p.exists():
        p = CHAR_DIR / f"{slug}.jpg"
    if not p.exists():
        p = CHAR_DIR / f"{slug}.png"
    return p


def _safe_filename(slug: str) -> str:
    s = "".join(c for c in (slug or "") if c.isalnum() or c in "-_").lower().strip("-_")
    return s or uuid.uuid4().hex[:10]


def _system_prompt() -> str:
    return (
        "You are the official illustrator for 'Myrtle and Ray and the First Day of Camp'. "
        "You draw friendly, cheerful, beach-summer-camp illustrations in a soft picture-book "
        "watercolor style with warm sunshine, turquoise water, sandy beach, palm fronds, and "
        "playful waves. The 'Sea Stars' are anthropomorphic ocean animal characters. "
        "CRITICAL: The reference portrait images attached to this message define each "
        "character's EXACT appearance — species, body color, fin/limb colors, outfit, "
        "accessories, scarf/hat color, eye color, and all markings. You MUST match the "
        "reference portraits EXACTLY. Do not change Sally's pink color, do not change "
        "Myrtle's blue scarf, do not change Ray's blue color, do not change any character's "
        "outfit or color scheme. If a character in the portrait has a scarf, keep it. If "
        "they have no surfboard, do not add one. Treat the portraits as ground truth. "
        "Never invent new characters. "
        "ABSOLUTELY NO TEXT IN THE IMAGE: do not draw any letters, words, captions, titles, "
        "labels on objects (no book titles, no signs, no banners), watermarks, signatures, or "
        "logos. If a prop would normally have text on it (book cover, sign, flag, t-shirt), "
        "leave it completely blank or replace with abstract patterns. The illustration is "
        "pure visual art only."
    )


def _build_prompt(character_slugs: List[str], characters_by_slug: dict,
                  scene_prompt: str, title: str, kind: str) -> str:
    visuals = []
    for slug in character_slugs:
        ch = characters_by_slug.get(slug) or {}
        name = ch.get("name") or slug.replace("-", " ").title()
        recipe = CHARACTER_VISUALS.get(slug) or f"{name} — {ch.get('species','')}, {ch.get('role','')}"
        visuals.append(f"- {recipe}")
    visual_block = "\n".join(visuals) if visuals else "- The Sea Stars camp crew (Ray the Manta Ray, Myrtle the Turtle, Ms Bluegill, Ollie the Octopus and friends)."

    surface = "a square album-art cover" if kind == "sing_along" else "a tall, vertical adventure poster"
    composition = (
        "Square 1:1 aspect ratio. The character(s) front-and-center, large, smiling and in dynamic pose."
        if kind == "sing_along"
        else "Square 1:1 aspect ratio. The character(s) front-and-center, large, in a heroic adventure pose with the title scene behind them."
    )

    return (
        f"Illustrate {surface} for the work titled \"{title}\".\n\n"
        f"REQUIRED CHARACTERS — each character below has an attached reference portrait "
        f"that defines their EXACT colors, outfit, scarf/hat/accessory, and look. Match those "
        f"portraits PIXEL-FAITHFULLY (same species, same color palette, same outfit). DO NOT "
        f"recolor them or change their accessories:\n"
        f"{visual_block}\n\n"
        f"SCENE: {scene_prompt}\n\n"
        f"STYLE: Warm, friendly, picture-book watercolor with bold outlines. Stingray Cay beach summer camp setting "
        f"(turquoise water, sandy shore, palm trees, gentle waves). Soft sun, no text or words anywhere.\n\n"
        f"COMPOSITION: {composition} The characters fill at least 60% of the frame and are clearly recognizable, "
        f"with the SAME colors and outfits as the reference portraits.\n\n"
        f"DO NOT include: any text, letters, words, alphabet characters, watermarks, signatures, logos, "
        f"UI elements, or human characters. Even if a prop normally has text on it (book covers, signs, "
        f"flags, t-shirts), leave it BLANK — pure visual scene only. DO NOT recolor the characters or "
        f"change their outfits from the reference portraits."
    )


async def generate_cover(
    db,
    *,
    character_slugs: List[str],
    scene_prompt: str,
    title: str,
    kind: str,
    slug: str,
) -> dict:
    """Generate a cover image and save it. Returns {"url": "/api/uploads/covers/<kind>/<slug>.png", "filename": str}."""
    api_key = (os.environ.get("EMERGENT_LLM_KEY") or "").strip()
    if not api_key:
        raise HTTPException(status_code=503, detail="Image generation is not configured (EMERGENT_LLM_KEY missing).")

    if kind not in ("sing_along", "story_quest"):
        raise HTTPException(status_code=400, detail="kind must be 'sing_along' or 'story_quest'.")

    title = (title or "").strip() or slug
    scene_prompt = (scene_prompt or "").strip() or "Sea Stars at Stingray Cay summer camp, having fun together on the beach."
    safe = _safe_filename(slug)

    # Resolve characters → fetch full docs from DB (for species/role text fallback)
    chars_cur = db.characters.find({"slug": {"$in": character_slugs}}, {"_id": 0})
    chars = await chars_cur.to_list(20) if character_slugs else []
    chars_by_slug = {c["slug"]: c for c in chars}

    # Load reference portraits (base64). Cap at 4 to keep prompts manageable.
    file_contents = []
    used_slugs = []
    for s in character_slugs[:4]:
        p = _portrait_path(s)
        if p.exists():
            try:
                b = p.read_bytes()
                b64 = base64.b64encode(b).decode("ascii")
                file_contents.append(b64)
                used_slugs.append(s)
            except Exception as exc:
                log.warning("could not read portrait %s: %s", p, exc)
        else:
            log.info("portrait missing on disk for %s", s)

    # Build text prompt
    sys_msg = _system_prompt()
    user_text = _build_prompt(used_slugs or character_slugs, chars_by_slug, scene_prompt, title, kind)

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Image generation library is not installed.") from exc

    session_id = f"cover-{kind}-{safe[:16]}-{uuid.uuid4().hex[:6]}"
    chat = LlmChat(api_key=api_key, session_id=session_id, system_message=sys_msg) \
        .with_model("gemini", "gemini-3.1-flash-image-preview").with_params(modalities=["image", "text"])

    msg_kwargs = {"text": user_text}
    if file_contents:
        msg_kwargs["file_contents"] = [ImageContent(b64) for b64 in file_contents]

    try:
        log.info("[cover-art] generating %s/%s with %d reference portrait(s)", kind, safe, len(file_contents))
        _text, images = await chat.send_message_multimodal_response(UserMessage(**msg_kwargs))
    except Exception as exc:
        log.exception("Nano Banana call failed for %s/%s", kind, safe)
        raise HTTPException(status_code=502, detail=f"Cover art generation failed: {exc}")

    if not images:
        raise HTTPException(status_code=502, detail="The art studio didn't draw anything — try again.")

    img = images[0]
    data_b64 = img.get("data") if isinstance(img, dict) else None
    if not data_b64:
        raise HTTPException(status_code=502, detail="Unexpected image response from Nano Banana.")
    try:
        png_bytes = base64.b64decode(data_b64)
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Could not decode the generated image.") from exc

    # Save to disk + persistent storage
    out_dir = COVERS_DIR / kind
    out_dir.mkdir(parents=True, exist_ok=True)
    # Use a uniquified filename so the admin can regenerate without browser cache clinging to old img.
    filename = f"{safe}-{uuid.uuid4().hex[:8]}.png"
    out_path = out_dir / filename
    out_path.write_bytes(png_bytes)

    try:
        import storage as _storage
        if _storage.is_enabled():
            _storage.put_object(f"covers/{kind}/{filename}", png_bytes, "image/png")
    except Exception as exc:
        log.warning("storage.put_object failed for covers/%s/%s: %s", kind, filename, exc)

    return {
        "url": f"/api/uploads/covers/{kind}/{filename}",
        "filename": filename,
        "characters_used": used_slugs,
    }

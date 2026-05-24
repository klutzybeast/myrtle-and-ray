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

# Detailed visual recipes the model can lean on when the portrait image alone
# isn't enough. These mirror the brief's exact phrasing (species + role + props).
CHARACTER_VISUALS = {
    "ray": "Ray the Manta Ray — friendly young manta ray, dark navy-blue top with white belly, wide stingray wings, big bright eyes, surfboard nearby.",
    "myrtle": "Myrtle the Turtle — green sea turtle in a tan adventurer's vest, kind smile, friendly outdoor pose (no books or text props).",
    "ms-bluegill": "Ms Bluegill — adult bluegill fish in a coral-orange counselor visor or sun hat, smiling warmly (no clipboard or text props).",
    "ollie": "Ollie the Octopus — purple octopus painter with all eight arms holding craft supplies (paintbrushes, scissors, glue stick).",
    "sally": "Sally the Seahorse — yellow seahorse painter with a curly tail steadying a tiny easel, beret on her head.",
    "jessie": "Jessie the Jellyfish — translucent pink jellyfish with soft flowing tentacles, calm meditative pose, gentle glow.",
    "casey": "Casey the Crab — bright red crab engineer holding a sand bucket and shovel, building a sand castle.",
    "dani": "Dani the Dolphin — light gray bottlenose dolphin in mid-flip dive pose, wearing tiny swim goggles.",
    "sami": "Sami the Shark — friendly blue shark in a goalie jersey with a soccer ball, big toothy smile (kind, not scary).",
    "izzy": "Izzy the Iguana — green iguana rock climber on a tropical cliff, climbing harness around shoulders.",
    "louie": "Louie the Lobster — bright red lobster drummer holding drumsticks behind a small drum kit on the sand.",
    "billy": "Billy the Beluga — small white beluga whale weaving through coral, exploring (no maps or text props).",
    "frankie": "Frankie the Flamingo — pink flamingo ballet instructor balanced on one leg in tutu, graceful pose.",
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
        "playful waves. The 'Sea Stars' are anthropomorphic ocean animal characters; YOU MUST "
        "use the supplied reference portraits to keep each character's species, color palette, "
        "outfit, and personality consistent across every image. Never invent new characters. "
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
        f"REQUIRED CHARACTERS (use the attached reference portraits exactly — same species, colors, outfit):\n"
        f"{visual_block}\n\n"
        f"SCENE: {scene_prompt}\n\n"
        f"STYLE: Warm, friendly, picture-book watercolor with bold outlines. Stingray Cay beach summer camp setting "
        f"(turquoise water, sandy shore, palm trees, gentle waves). Soft sun, no text or words anywhere.\n\n"
        f"COMPOSITION: {composition} The characters fill at least 60% of the frame and are clearly recognizable.\n\n"
        f"DO NOT include: any text, letters, words, alphabet characters, watermarks, signatures, logos, "
        f"UI elements, or human characters. Even if a prop normally has text on it (book covers, signs, "
        f"flags, t-shirts), leave it BLANK — pure visual scene only."
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

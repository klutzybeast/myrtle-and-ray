"""Unified AI thumbnail generation + library for admin use.

Single source of truth for all AI-generated images shown across the app:
product heros, activity tile art, character alt portraits, downloads
preview art, custom-page hero/OG images, etc.

Every generation is persisted to `thumbnails` collection so the admin
sidebar /admin/thumbnails can browse, re-download, or bulk-export them.
"""
from __future__ import annotations

import base64
import io
import logging
import os
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

log = logging.getLogger(__name__)

UPLOAD_ROOT = Path(os.environ.get("UPLOAD_DIR", "/app/backend/uploads"))
THUMBS_DIR = UPLOAD_ROOT / "thumbnails"
CHAR_DIR = UPLOAD_ROOT / "characters"

# Allowed `kind` values. Used for tagging only — the prompt + composition
# adapts to the kind so the generated image fits the consumer.
ALLOWED_KINDS = {
    "product",
    "activity",
    "download",
    "download_category",
    "custom_page",
    "character",
    "general",
}

# Reuse the cover-art character recipe lookup.
try:
    from cover_art_service import CHARACTER_VISUALS, _portrait_path  # type: ignore
except Exception:  # pragma: no cover
    CHARACTER_VISUALS = {}
    def _portrait_path(slug: str) -> Path:  # type: ignore
        return CHAR_DIR / f"{slug}.jpeg"


class ThumbnailGenerate(BaseModel):
    character_slugs: List[str] = Field(default_factory=list)
    scene_prompt: str = Field(min_length=2, max_length=400)
    kind: str = "general"
    title: Optional[str] = None
    aspect: str = "square"  # "square" | "wide" | "tall"


def _safe(s: str) -> str:
    s = "".join(c for c in (s or "") if c.isalnum() or c in "-_").lower().strip("-_")
    return s or uuid.uuid4().hex[:10]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _system_prompt() -> str:
    return (
        "You are the official illustrator for 'Myrtle and Ray and the First Day of Camp'. "
        "You draw friendly, cheerful, beach-summer-camp illustrations in a soft picture-book "
        "watercolor style with warm sunshine, turquoise water, sandy beach, palm fronds, and "
        "playful waves. CRITICAL: any reference portraits attached define each character's "
        "EXACT appearance (body color, fins, outfit, accessories, eye color). Match them "
        "pixel-faithfully. Do not recolor or restyle them. "
        "NO TEXT in the image: no letters, words, captions, titles, signs, banners, labels, "
        "watermarks, logos. Replace any prop-text with abstract patterns."
    )


def _composition(aspect: str, kind: str) -> str:
    a = (aspect or "square").lower()
    if a == "wide":
        comp = "Wide 16:9 cinematic banner — characters fill the left third, scene extends right."
    elif a == "tall":
        comp = "Tall 9:16 portrait poster — character centered, scene above and below."
    else:
        comp = "Square 1:1 — character(s) front-and-center, large, fills at least 55% of the frame."
    role = {
        "product": "Use a clean product-photography vibe — neutral or soft-gradient background, clear silhouette.",
        "activity": "Use a fun, badge-like vibe — minimal background, character + 1-2 props.",
        "download": "Use a printable-page vibe — composition is centered and balanced.",
        "download_category": "Use a category-tile vibe — symbolic, iconic composition.",
        "custom_page": "Use a hero-banner vibe — cinematic, friendly opening shot.",
        "character": "Use a portrait vibe — half-body, friendly direct pose.",
    }.get(kind, "")
    return f"{comp} {role}".strip()


def _build_prompt(character_slugs: List[str], characters_by_slug: dict,
                  scene_prompt: str, title: str, kind: str, aspect: str) -> str:
    visuals = []
    for slug in character_slugs:
        ch = characters_by_slug.get(slug) or {}
        name = ch.get("name") or slug.replace("-", " ").title()
        recipe = CHARACTER_VISUALS.get(slug) or f"{name} — {ch.get('species','')}, {ch.get('role','')}"
        visuals.append(f"- {recipe}")
    visual_block = (
        "\n".join(visuals) if visuals
        else "- One or more of the Sea Stars camp crew (Myrtle, Ray, Ms Bluegill, Ollie, and friends)."
    )

    title_line = f"for the work titled \"{title}\"" if title else ""
    return (
        f"Illustrate a thumbnail/illustration {title_line}.\n\n"
        f"REQUIRED CHARACTERS — each has an attached reference portrait that defines their EXACT "
        f"colors, outfit, scarf/hat/accessory. Match those portraits PIXEL-FAITHFULLY:\n"
        f"{visual_block}\n\n"
        f"SCENE: {scene_prompt}\n\n"
        f"STYLE: Warm, friendly, picture-book watercolor with bold outlines. Stingray Cay beach summer camp "
        f"setting (turquoise water, sandy shore, palm trees). Soft sun, no text or words anywhere.\n\n"
        f"COMPOSITION: {_composition(aspect, kind)}\n\n"
        f"DO NOT include: any text, letters, words, watermarks, signatures, logos, UI elements, or human "
        f"characters. Even if a prop normally has text on it, leave it blank — pure visual art only."
    )


def make_thumbnails_router(db, require_admin):
    router = APIRouter(prefix="/admin/thumbnails", tags=["admin-thumbnails"], dependencies=[Depends(require_admin)])

    @router.post("/generate")
    async def generate(body: ThumbnailGenerate):
        api_key = (os.environ.get("EMERGENT_LLM_KEY") or "").strip()
        if not api_key:
            raise HTTPException(status_code=503, detail="Image generation is not configured (EMERGENT_LLM_KEY missing).")

        kind = (body.kind or "general").lower()
        if kind not in ALLOWED_KINDS:
            raise HTTPException(status_code=400, detail=f"kind must be one of {sorted(ALLOWED_KINDS)}")

        # Resolve character slugs — "all" expands to all known characters.
        slugs = [s.strip() for s in (body.character_slugs or []) if s and s.strip()]
        if any(s.lower() == "all" for s in slugs):
            all_chars = await db.characters.find({}, {"_id": 0, "slug": 1}).to_list(50)
            slugs = [c["slug"] for c in all_chars]
        # Dedup, cap at 4 (otherwise the prompt gets unfocused).
        seen = set()
        unique_slugs = []
        for s in slugs:
            if s in seen:
                continue
            seen.add(s)
            unique_slugs.append(s)
            if len(unique_slugs) >= 4:
                break

        chars_by_slug = {}
        if unique_slugs:
            cur = db.characters.find({"slug": {"$in": unique_slugs}}, {"_id": 0})
            for c in await cur.to_list(20):
                chars_by_slug[c["slug"]] = c

        # Load portraits (base64).
        file_contents = []
        used_slugs = []
        for s in unique_slugs:
            p = _portrait_path(s)
            if p.exists():
                try:
                    b64 = base64.b64encode(p.read_bytes()).decode("ascii")
                    file_contents.append(b64)
                    used_slugs.append(s)
                except Exception as exc:
                    log.warning("portrait read failed for %s: %s", s, exc)

        sys_msg = _system_prompt()
        user_text = _build_prompt(used_slugs or unique_slugs, chars_by_slug,
                                  body.scene_prompt, body.title or "", kind, body.aspect)

        try:
            from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
        except Exception as exc:
            raise HTTPException(status_code=503, detail="Image generation library is not installed.") from exc

        session_id = f"thumb-{kind}-{uuid.uuid4().hex[:8]}"
        chat = LlmChat(api_key=api_key, session_id=session_id, system_message=sys_msg) \
            .with_model("gemini", "gemini-3.1-flash-image-preview").with_params(modalities=["image", "text"])

        msg_kwargs = {"text": user_text}
        if file_contents:
            msg_kwargs["file_contents"] = [ImageContent(b64) for b64 in file_contents]

        try:
            _text, images = await chat.send_message_multimodal_response(UserMessage(**msg_kwargs))
        except Exception as exc:
            log.exception("thumbnail generation failed (%s)", kind)
            raise HTTPException(status_code=502, detail=f"Image generation failed: {exc}") from exc

        if not images:
            raise HTTPException(status_code=502, detail="The art studio didn't draw anything — try again.")

        data_b64 = images[0].get("data") if isinstance(images[0], dict) else None
        if not data_b64:
            raise HTTPException(status_code=502, detail="Unexpected image response from Nano Banana.")

        try:
            png_bytes = base64.b64decode(data_b64)
        except Exception as exc:
            raise HTTPException(status_code=502, detail="Could not decode the generated image.") from exc

        # Persist to disk + storage layer
        THUMBS_DIR.mkdir(parents=True, exist_ok=True)
        out_id = uuid.uuid4().hex
        filename = f"{_safe(kind)}-{out_id[:12]}.png"
        out_path = THUMBS_DIR / filename
        out_path.write_bytes(png_bytes)

        try:
            import storage as _storage
            if _storage.is_enabled():
                _storage.put_object(f"thumbnails/{filename}", png_bytes, "image/png")
        except Exception as exc:
            log.warning("storage put_object failed thumbnails/%s: %s", filename, exc)

        url = f"/api/uploads/thumbnails/{filename}"
        doc = {
            "id": out_id,
            "filename": filename,
            "url": url,
            "kind": kind,
            "title": (body.title or "").strip()[:160],
            "scene_prompt": body.scene_prompt.strip()[:400],
            "aspect": (body.aspect or "square").lower(),
            "character_slugs": used_slugs,
            "size_bytes": len(png_bytes),
            "created_at": _now_iso(),
        }
        await db.thumbnails.insert_one(dict(doc))
        doc.pop("_id", None)
        return doc

    @router.get("")
    async def list_thumbnails(kind: Optional[str] = None, character: Optional[str] = None,
                              limit: int = 200):
        q: dict = {}
        if kind and kind.lower() != "all":
            q["kind"] = kind.lower()
        if character and character.lower() != "all":
            q["character_slugs"] = character
        cur = db.thumbnails.find(q, {"_id": 0}).sort("created_at", -1).limit(min(500, max(1, int(limit))))
        rows = await cur.to_list(500)
        return {"thumbnails": rows, "total": await db.thumbnails.count_documents({})}

    @router.delete("/{thumb_id}")
    async def delete_thumb(thumb_id: str):
        row = await db.thumbnails.find_one({"id": thumb_id}, {"_id": 0})
        if not row:
            raise HTTPException(status_code=404, detail="Thumbnail not found")
        try:
            p = THUMBS_DIR / row.get("filename", "")
            if p.exists():
                p.unlink()
        except Exception as exc:
            log.warning("could not unlink %s: %s", row.get("filename"), exc)
        await db.thumbnails.delete_one({"id": thumb_id})
        return {"ok": True}

    @router.get("/zip")
    async def download_zip(kind: Optional[str] = None, character: Optional[str] = None):
        q: dict = {}
        if kind and kind.lower() != "all":
            q["kind"] = kind.lower()
        if character and character.lower() != "all":
            q["character_slugs"] = character
        cur = db.thumbnails.find(q, {"_id": 0}).sort("created_at", -1).limit(500)
        rows = await cur.to_list(500)
        if not rows:
            raise HTTPException(status_code=404, detail="No thumbnails match those filters.")

        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            for r in rows:
                p = THUMBS_DIR / r.get("filename", "")
                if not p.exists():
                    continue
                # Friendly path: kind/character-or-mixed/filename
                chars = "-".join(r.get("character_slugs") or []) or "no-character"
                arc = f"thumbnails/{r.get('kind','general')}/{chars}/{r['filename']}"
                zf.write(p, arcname=arc)
        buf.seek(0)
        stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
        return Response(
            content=buf.getvalue(),
            media_type="application/zip",
            headers={"Content-Disposition": f'attachment; filename="thumbnails-{stamp}.zip"'},
        )

    @router.get("/health")
    async def health_check():
        """Diagnostic — surfaces whether AI image generation will work right now.
        Frontend uses this to show a banner explaining exactly what's wrong."""
        import storage as _storage
        key_present = bool((os.environ.get("EMERGENT_LLM_KEY") or "").strip())
        storage_enabled = _storage.is_enabled()
        total = await db.thumbnails.count_documents({})
        # Try the cheapest possible storage round-trip to confirm it works.
        storage_ok = False
        if storage_enabled:
            try:
                test_key = "thumbnails/.health-check"
                _storage.put_object(test_key, b"ok", "text/plain")
                got = _storage.get_object(test_key)
                storage_ok = bool(got)
            except Exception as exc:
                log.warning("storage health check failed: %s", exc)
        return {
            "ai_key_configured": key_present,
            "storage_enabled": storage_enabled,
            "storage_working": storage_ok,
            "library_count": total,
            "upload_dir": str(UPLOAD_ROOT),
            "thumbs_dir_writable": os.access(str(UPLOAD_ROOT), os.W_OK),
        }

    @router.post("/backfill")
    async def backfill_from_other_collections():
        """Scan other collections for images that should appear in the
        thumbnails library (sing-along covers, character portraits, coloring
        gallery, product images, story-quest hero images) and insert one row
        per image so they all show up under /admin/thumbnails.

        Idempotent — keyed by the image URL.
        """
        inserted = 0
        skipped = 0

        async def _add(url: str, kind: str, title: str, scene_prompt: str,
                       character_slugs: List[str], source: str):
            nonlocal inserted, skipped
            if not url:
                return
            existing = await db.thumbnails.find_one({"url": url}, {"_id": 1})
            if existing:
                skipped += 1
                return
            doc = {
                "id": uuid.uuid4().hex,
                "filename": url.rsplit("/", 1)[-1] or url,
                "url": url,
                "kind": kind,
                "title": (title or "")[:160],
                "scene_prompt": (scene_prompt or "")[:400],
                "aspect": "square",
                "character_slugs": [s for s in (character_slugs or []) if s][:4],
                "size_bytes": 0,
                "source": source,
                "created_at": _now_iso(),
            }
            await db.thumbnails.insert_one(dict(doc))
            inserted += 1

        # Sing-along covers
        async for s in db.sing_along_songs.find({"cover_image_url": {"$ne": ""}}, {"_id": 0, "title": 1, "cover_image_url": 1, "prompt": 1}):
            await _add(s.get("cover_image_url", ""), "general",
                       title=f"Cover: {s.get('title','')}",
                       scene_prompt=s.get("prompt", ""),
                       character_slugs=[], source="sing_along")

        # Character portraits
        async for c in db.characters.find({}, {"_id": 0, "slug": 1, "name": 1, "image_url": 1, "role": 1}):
            await _add(c.get("image_url", ""), "character",
                       title=c.get("name", ""),
                       scene_prompt=c.get("role", ""),
                       character_slugs=[c.get("slug", "")], source="character")

        # Story-quest hero images
        async for q in db.story_quests.find({"hero_image_url": {"$ne": ""}}, {"_id": 0, "title": 1, "hero_image_url": 1}):
            await _add(q.get("hero_image_url", ""), "general",
                       title=f"Quest: {q.get('title','')}",
                       scene_prompt="Story Quest hero image",
                       character_slugs=[], source="story_quest")

        # Story-quest scene backgrounds
        async for sc in db.story_quest_scenes.find({"background_image_url": {"$ne": ""}}, {"_id": 0, "background_image_url": 1, "narrator_slug": 1, "quest_id": 1, "title": 1}):
            await _add(sc.get("background_image_url", ""), "general",
                       title=sc.get("title", "Quest scene"),
                       scene_prompt="Story Quest scene background",
                       character_slugs=[sc.get("narrator_slug", "")] if sc.get("narrator_slug") else [],
                       source="story_quest_scene")

        # Product images
        async for p in db.products.find({}, {"_id": 0, "name": 1, "primary_image": 1, "images": 1}):
            urls = []
            if p.get("primary_image"):
                urls.append(p["primary_image"])
            urls.extend(p.get("images") or [])
            for url in urls[:3]:
                await _add(url, "product",
                           title=p.get("name", ""),
                           scene_prompt="Product image",
                           character_slugs=[], source="product")

        # Coloring history (kept by the public coloring page)
        async for col in db.coloring.find({"deleted": {"$ne": True}, "shared": True}, {"_id": 0, "image_url": 1, "prompt": 1, "character_slugs": 1, "character_slug": 1}):
            slugs = col.get("character_slugs") or ([col["character_slug"]] if col.get("character_slug") else [])
            await _add(col.get("image_url", ""), "general",
                       title="Coloring page",
                       scene_prompt=col.get("prompt", ""),
                       character_slugs=slugs, source="coloring")

        # Media library (admin manual uploads — pre-mirror)
        async for m in db.media.find(
            {"mime": {"$regex": "^image/"}},
            {"_id": 0, "url": 1, "filename": 1, "tags": 1},
        ):
            await _add(m.get("url", ""), "general",
                       title=m.get("filename", "Upload"),
                       scene_prompt=", ".join(m.get("tags") or []),
                       character_slugs=[], source="media")

        # Custom pages — hero image + OG image
        async for cp in db.custom_pages.find({}, {"_id": 0, "title": 1, "hero_image_url": 1, "og_image_url": 1, "slug": 1}):
            for field, role in (("hero_image_url", "Hero"), ("og_image_url", "OG")):
                u = cp.get(field) or ""
                if u:
                    await _add(u, "custom_page",
                               title=f"{role}: {cp.get('title') or cp.get('slug','')}",
                               scene_prompt=f"Custom page {role.lower()} image",
                               character_slugs=[], source="custom_page")

        # Downloads (PDFs/coloring sheets thumbnails)
        async for d in db.downloads.find(
            {"thumbnail_url": {"$nin": [None, ""]}},
            {"_id": 0, "title": 1, "thumbnail_url": 1, "category_slug": 1},
        ):
            await _add(d.get("thumbnail_url", ""), "download",
                       title=d.get("title", "Download"),
                       scene_prompt=d.get("category_slug", "") or "Download thumbnail",
                       character_slugs=[], source="download")

        # Download category banners
        async for dc in db.download_categories.find(
            {"image_url": {"$nin": [None, ""]}},
            {"_id": 0, "title": 1, "image_url": 1, "slug": 1},
        ):
            await _add(dc.get("image_url", ""), "download_category",
                       title=dc.get("title") or dc.get("slug", "Category"),
                       scene_prompt="Download category banner",
                       character_slugs=[], source="download_category")

        # Activity tile art (admin-generated per-activity hero images)
        async for ac in db.activity_content.find(
            {"data.tile_image_url": {"$nin": [None, ""]}},
            {"_id": 0, "key": 1, "title": 1, "data": 1},
        ):
            url = (ac.get("data") or {}).get("tile_image_url", "")
            await _add(url, "activity",
                       title=ac.get("title") or ac.get("key", "Activity"),
                       scene_prompt="Activity tile art",
                       character_slugs=[], source="activity")

        return {"ok": True, "inserted": inserted, "already_in_library": skipped}

    return router

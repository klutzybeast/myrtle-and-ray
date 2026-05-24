"""Generate ElevenLabs narration MP3s for ALL Story Quest scenes across
every quest (not just first-day-of-camp). Reads scenes straight from
MongoDB so it covers the multi-quest catalog. Saves bundled MP3s to
/app/backend/seed_assets/story_quest/ and refreshes manifest.json with
per-quest mappings.

Usage:
    cd /app/backend && python scripts/generate_all_quest_audio.py
    # Or limit to specific quest slugs:
    cd /app/backend && python scripts/generate_all_quest_audio.py beach-cleanup-heroes lost-sea-glass-treasure
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv(ROOT / ".env")

from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402
from tts_pronunciation import phoneticize_for_tts  # noqa: E402

API_KEY = (os.environ.get("ELEVENLABS_API_KEY") or "").strip()
MODEL_ID = os.environ.get("ELEVENLABS_MODEL_ID", "eleven_turbo_v2_5")
STABILITY = 0.45
SIMILARITY = 0.85
STYLE = 0.35


def cache_key(voice_id: str, text: str) -> str:
    raw = f"{MODEL_ID}|{voice_id}|{text.strip()}|{STABILITY}|{SIMILARITY}|{STYLE}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


async def main(argv: list[str]) -> int:
    if not API_KEY:
        print("ERROR: ELEVENLABS_API_KEY missing")
        return 1

    only_slugs = set(argv) if argv else set()

    c = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = c[os.environ["DB_NAME"]]

    voice_by_slug: dict[str, str] = {}
    async for ch in db.characters.find({}, {"_id": 0, "slug": 1, "voice_id": 1}):
        if ch.get("voice_id"):
            voice_by_slug[ch["slug"]] = ch["voice_id"]
    print(f"Loaded {len(voice_by_slug)} character voices")

    quests = await db.story_quests.find({}, {"_id": 0, "id": 1, "slug": 1, "title": 1}).to_list(50)
    quests_by_id = {q["id"]: q for q in quests}

    asset_dir = ROOT / "seed_assets" / "story_quest"
    asset_dir.mkdir(parents=True, exist_ok=True)

    from elevenlabs.client import ElevenLabs
    from elevenlabs import VoiceSettings
    client = ElevenLabs(api_key=API_KEY)
    settings = VoiceSettings(
        stability=STABILITY,
        similarity_boost=SIMILARITY,
        style=STYLE,
        use_speaker_boost=True,
    )

    # Collect scenes needing audio across all quests.
    scenes: list[dict] = []
    async for s in db.story_quest_scenes.find({}, {"_id": 0}).sort("scene_number", 1):
        q = quests_by_id.get(s.get("quest_id"))
        if not q:
            continue
        if only_slugs and q["slug"] not in only_slugs:
            continue
        scenes.append({**s, "quest_slug": q["slug"]})

    print(f"Found {len(scenes)} scenes to consider")

    manifest_entries: dict[str, list[dict]] = {}  # quest_slug -> [entries]
    total_new = 0
    total_chars = 0
    skipped_existing = 0
    for s in scenes:
        narrator = s.get("narrator_slug") or "ms-bluegill"
        voice_id = voice_by_slug.get(narrator)
        narrative = (s.get("narrative") or "").strip()
        if not voice_id or not narrative:
            print(f"  [skip ] {s['quest_slug']}/{s['scene_number']} no voice or narrative")
            continue
        text = phoneticize_for_tts(narrative)
        key = cache_key(voice_id, text)
        out = asset_dir / f"{key}.mp3"
        entry = {
            "scene_number": s["scene_number"],
            "title": s.get("title", ""),
            "narrator_slug": narrator,
            "voice_id": voice_id,
            "cache_key": key,
            "audio_filename": f"{key}.mp3",
        }
        manifest_entries.setdefault(s["quest_slug"], []).append(entry)
        if out.exists() and out.stat().st_size > 1000:
            skipped_existing += 1
            continue

        print(f"  [gen  ] {s['quest_slug']:28s} #{s['scene_number']:2d} ({narrator:12s} {len(text):3d}c) -> {key[:10]}…")
        try:
            audio_iter = client.text_to_speech.convert(
                text=text,
                voice_id=voice_id,
                model_id=MODEL_ID,
                voice_settings=settings,
                output_format="mp3_44100_128",
            )
            data = b"".join(chunk for chunk in audio_iter if chunk)
        except Exception as exc:  # noqa: BLE001
            print(f"    ERROR: {exc}")
            return 2
        if not data:
            print("    ERROR: empty audio")
            return 3
        out.write_bytes(data)
        total_new += 1
        total_chars += len(text)

    # Write manifest (per-quest format).
    manifest = {
        "model_id": MODEL_ID,
        "version": 2,
        "quests": {slug: sorted(entries, key=lambda e: e["scene_number"]) for slug, entries in manifest_entries.items()},
        # Backward-compatible flat list for the existing seed code that only
        # cares about first-day-of-camp scenes.
        "scenes": sorted(manifest_entries.get("first-day-of-camp", []), key=lambda e: e["scene_number"]),
    }
    manifest_path = asset_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2))
    print(f"\nDone. New MP3s: {total_new} ({total_chars} chars). Already-cached: {skipped_existing}.")
    print(f"Manifest -> {manifest_path}  ({sum(len(v) for v in manifest_entries.values())} entries across {len(manifest_entries)} quests)")
    c.close()
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main(sys.argv[1:])))

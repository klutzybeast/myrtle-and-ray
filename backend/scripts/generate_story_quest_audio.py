"""One-time generator for Story Quest narration MP3s.

Calls ElevenLabs once per scene using each scene's narrator voice and
saves the MP3 to /app/backend/seed_assets/story_quest/<cache_key>.mp3.
The cache key matches voice_router._cache_key so the runtime cache and
the seed-time bundle share a single entry: kids playing the quest hit
the cached file with zero ongoing ElevenLabs cost.

Usage:
    cd /app/backend && python scripts/generate_story_quest_audio.py
"""
from __future__ import annotations

import hashlib
import os
import sys
from pathlib import Path

# Allow importing sibling modules when run as `python scripts/...`
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv(ROOT / ".env")

from seed import STORY_QUEST_SCENES, STORY_QUEST_NARRATORS  # noqa: E402

API_KEY = (os.environ.get("ELEVENLABS_API_KEY") or "").strip()
MODEL_ID = os.environ.get("ELEVENLABS_MODEL_ID", "eleven_turbo_v2_5")
STABILITY = 0.45
SIMILARITY = 0.85
STYLE = 0.35

# Mirror /app/backend/voice_router.py::_cache_key
def cache_key(voice_id: str, text: str) -> str:
    raw = f"{MODEL_ID}|{voice_id}|{text.strip()}|{STABILITY}|{SIMILARITY}|{STYLE}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def main() -> int:
    if not API_KEY:
        print("ERROR: ELEVENLABS_API_KEY missing from /app/backend/.env")
        return 1

    # Resolve voice_ids straight from the JSON-style seed dict in characters.py
    # We don't want to touch MongoDB here — pull voices via the public API.
    import requests
    api_url = (os.environ.get("BACKEND_BASE_URL") or "http://localhost:8001").rstrip("/")
    chars = requests.get(f"{api_url}/api/characters", timeout=10).json()
    voice_by_slug = {c["slug"]: c.get("voice_id", "") for c in chars}

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

    print(f"Generating narration for {len(STORY_QUEST_SCENES)} scenes...")
    total_chars = 0
    for sc in STORY_QUEST_SCENES:
        n = sc["scene_number"]
        narrator = STORY_QUEST_NARRATORS.get(n, "ms-bluegill")
        voice_id = voice_by_slug.get(narrator)
        if not voice_id:
            print(f"  [skip] scene {n}: no voice_id for narrator '{narrator}'")
            continue
        text = sc["narrative"]
        key = cache_key(voice_id, text)
        out = asset_dir / f"{key}.mp3"
        if out.exists() and out.stat().st_size > 1000:
            print(f"  [skip] scene {n} ({narrator}) — already generated ({out.name})")
            continue

        print(f"  [gen ] scene {n} ({narrator}, {len(text)}c) -> {out.name}")
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
            print("    ERROR: empty audio returned")
            return 3
        out.write_bytes(data)
        total_chars += len(text)
        print(f"    saved ({len(data)/1024:.1f} KB)")

    print(f"\nDone. Total characters synthesized this run: {total_chars}")
    print(f"Assets folder: {asset_dir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

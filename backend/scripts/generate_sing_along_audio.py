"""One-time generator for Sing-Along songs via ElevenLabs Music.

Usage:
    cd /app/backend && python scripts/generate_sing_along_audio.py
    # Or generate only specific songs:
    cd /app/backend && python scripts/generate_sing_along_audio.py catch-the-wave myrtles-kindness-song

Outputs MP3s to /app/backend/seed_assets/sing_along/<slug>.mp3 and
updates the matching MongoDB row with `audio_url=/api/uploads/sing_along/<slug>.mp3`.
"""
from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv(ROOT / ".env")

from seed import SING_ALONG_SONGS  # noqa: E402

API_KEY = (os.environ.get("ELEVENLABS_API_KEY") or "").strip()
ASSET_DIR = ROOT / "seed_assets" / "sing_along"
UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", "/app/backend/uploads")) / "sing_along"


def _build_prompt(song: dict) -> str:
    """Combine the song's musical prompt + lyrics into a single ElevenLabs
    Music prompt. Lyrics are embedded inside [LYRICS] markers so the model
    has clear instruction on what to sing."""
    return (
        f"{song['music_prompt']}\n\n"
        f"Length: ~{song.get('duration_seconds', 45)} seconds.\n"
        f"Children's vocals, clearly enunciated for sing-along.\n\n"
        f"[LYRICS]\n{song['lyrics'].strip()}\n[/LYRICS]"
    )


def _generate_one(client, song: dict) -> bytes:
    """Call ElevenLabs Music. Returns MP3 bytes."""
    prompt = _build_prompt(song)
    length_ms = max(15000, min(int(song.get("duration_seconds", 45)) * 1000, 90000))
    # The SDK returns a generator of MP3 chunks.
    audio_iter = client.music.compose(
        prompt=prompt,
        music_length_ms=length_ms,
    )
    return b"".join(chunk for chunk in audio_iter if chunk)


async def _update_audio_url(slug: str, audio_url: str, duration: int):
    # Lazy import so non-DB invocations (e.g. dry-run) don't need motor.
    from motor.motor_asyncio import AsyncIOMotorClient
    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME")
    if not mongo_url or not db_name:
        print(f"[skip-db] MONGO_URL/DB_NAME missing — patch sing_along_songs/{slug} by hand")
        return
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    from datetime import datetime, timezone
    res = await db.sing_along_songs.update_one(
        {"slug": slug},
        {"$set": {"audio_url": audio_url, "duration_seconds": duration, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    print(f"    db patched: {slug} (matched={res.matched_count})")
    client.close()


def main(argv: list) -> int:
    if not API_KEY:
        print("ERROR: ELEVENLABS_API_KEY missing from /app/backend/.env")
        return 1
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    only = set(argv) if argv else None

    from elevenlabs import ElevenLabs
    client = ElevenLabs(api_key=API_KEY)

    songs = [s for s in SING_ALONG_SONGS if (not only or s["slug"] in only)]
    if not songs:
        print(f"No songs matched: {only}")
        return 1

    print(f"Generating {len(songs)} song(s)...")
    for s in songs:
        out_asset = ASSET_DIR / f"{s['slug']}.mp3"
        out_upload = UPLOAD_DIR / f"{s['slug']}.mp3"
        if out_asset.exists() and out_asset.stat().st_size > 5000:
            print(f"  [skip] {s['slug']} — already generated ({out_asset.stat().st_size/1024:.1f} KB)")
            # Still patch DB in case URL drifted
            asyncio.run(_update_audio_url(s["slug"], f"/api/uploads/sing_along/{s['slug']}.mp3", s.get("duration_seconds", 0)))
            continue
        print(f"  [gen ] {s['slug']} ({s.get('duration_seconds',45)}s) — calling ElevenLabs Music…")
        try:
            data = _generate_one(client, s)
        except Exception as exc:  # noqa: BLE001
            print(f"    ERROR: {exc}")
            continue
        if not data or len(data) < 5000:
            print(f"    ERROR: empty audio returned ({len(data)} bytes)")
            continue
        out_asset.write_bytes(data)
        out_upload.write_bytes(data)
        print(f"    saved ({len(data)/1024:.1f} KB) → {out_asset.name}")
        asyncio.run(_update_audio_url(s["slug"], f"/api/uploads/sing_along/{s['slug']}.mp3", s.get("duration_seconds", 0)))
        # Run forced alignment so karaoke timing is correct out of the box.
        try:
            from scripts.align_sing_along_lyrics import main as align_main
            align_main([s["slug"]])
        except Exception as exc:  # noqa: BLE001
            print(f"    (alignment skipped: {exc})")
    print("\nDone.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

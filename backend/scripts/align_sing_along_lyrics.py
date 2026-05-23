"""Run forced alignment on every sing-along MP3 to extract real per-line
timestamps and persist them as LRC in the database.

Usage:
    cd /app/backend && python scripts/align_sing_along_lyrics.py
    cd /app/backend && python scripts/align_sing_along_lyrics.py catch-the-wave
"""
from __future__ import annotations

import asyncio
import os
import re
import sys
from io import BytesIO
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv(ROOT / ".env")

API_KEY = (os.environ.get("ELEVENLABS_API_KEY") or "").strip()
ASSET_DIR = ROOT / "seed_assets" / "sing_along"


def _norm(s: str) -> str:
    """Lowercase, alphanumeric-only normalization for comparing words."""
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def _format_lrc(seconds: float) -> str:
    if seconds < 0:
        seconds = 0
    m = int(seconds // 60)
    s = seconds - m * 60
    return f"[{m:02d}:{s:05.2f}]"


def _split_lyric_words(line: str) -> list:
    return [w for w in re.split(r"\s+", line.strip()) if w]


def _align_lines(lyric_lines: list, alignment_words: list) -> list:
    """Walk through the lyric lines and pull the timestamp for the first
    word of each line from the alignment word list.

    `alignment_words` is a list of {"text": "...", "start": float, "end": float}.
    Returns a list of {"text": original_line, "start": float}.
    """
    out = []
    word_idx = 0
    used_idx = -1
    norm_align = [_norm(w["text"]) for w in alignment_words]
    for line in lyric_lines:
        words = _split_lyric_words(line)
        if not words:
            continue
        target = _norm(words[0])
        if not target:
            out.append({"text": line, "start": (alignment_words[word_idx]["start"] if word_idx < len(alignment_words) else 0)})
            continue
        # Search forward from word_idx for the next matching token. Bound by
        # a window so identical earlier matches don't snap back.
        found = -1
        for j in range(word_idx, min(word_idx + 200, len(norm_align))):
            if norm_align[j] == target and j > used_idx:
                found = j
                break
        if found < 0:
            # Fuzzy: contains-match
            for j in range(word_idx, min(word_idx + 200, len(norm_align))):
                if norm_align[j].startswith(target[:3]) and j > used_idx:
                    found = j
                    break
        if found < 0:
            # Give up — keep last good time + small step
            last = out[-1]["start"] if out else 0
            out.append({"text": line, "start": last + 1.5})
            continue
        out.append({"text": line, "start": alignment_words[found]["start"]})
        used_idx = found
        word_idx = found + len(words)  # skip past this line's words
    return out


def _do_align(client, mp3_bytes: bytes, lyrics: str) -> list:
    """Returns list of word dicts with start/end seconds."""
    bio = BytesIO(mp3_bytes)
    result = client.forced_alignment.create(file=bio, text=lyrics)
    # The SDK returns an object with .words (list of {text/start/end})
    words = getattr(result, "words", None) or []
    out = []
    for w in words:
        text = getattr(w, "text", None) or (w.get("text") if isinstance(w, dict) else "")
        start = float(getattr(w, "start", None) if not isinstance(w, dict) else w.get("start", 0))
        end = float(getattr(w, "end", None) if not isinstance(w, dict) else w.get("end", 0))
        if text:
            out.append({"text": text, "start": start, "end": end})
    return out


async def _update(slug: str, lrc: str):
    from motor.motor_asyncio import AsyncIOMotorClient
    from datetime import datetime, timezone
    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME")
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    res = await db.sing_along_songs.update_one(
        {"slug": slug},
        {"$set": {"lyrics_lrc": lrc, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    print(f"    db patched: {slug} (matched={res.matched_count})")
    client.close()


def main(argv: list) -> int:
    if not API_KEY:
        print("ERROR: ELEVENLABS_API_KEY missing")
        return 1
    from seed import SING_ALONG_SONGS  # noqa: E402
    from elevenlabs import ElevenLabs
    client = ElevenLabs(api_key=API_KEY)

    only = set(argv) if argv else None
    songs = [s for s in SING_ALONG_SONGS if (not only or s["slug"] in only)]
    print(f"Aligning {len(songs)} song(s)...")
    for s in songs:
        mp3_path = ASSET_DIR / f"{s['slug']}.mp3"
        if not mp3_path.exists():
            print(f"  [skip] {s['slug']} — no MP3 at {mp3_path}")
            continue
        try:
            mp3_bytes = mp3_path.read_bytes()
            print(f"  [align] {s['slug']} ({mp3_path.stat().st_size//1024} KB)…")
            words = _do_align(client, mp3_bytes, s["lyrics"])
            if not words:
                print("    no words returned — skipping")
                continue
            lyric_lines = [l for l in s["lyrics"].split("\n") if l.strip()]
            lines = _align_lines(lyric_lines, words)
            lrc = "\n".join(f"{_format_lrc(l['start'])}{l['text']}" for l in lines)
            print(f"    {len(lines)} lines aligned, first line at {lines[0]['start']:.2f}s")
            asyncio.run(_update(s["slug"], lrc))
        except Exception as exc:  # noqa: BLE001
            print(f"    ERROR aligning {s['slug']}: {exc}")
            continue
    print("\nDone.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

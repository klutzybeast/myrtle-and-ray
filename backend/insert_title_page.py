"""Insert a title page (read by Myrtle) at position 1 and shift existing pages 1-20 -> 2-21."""
import asyncio, hashlib, os
from datetime import datetime, timezone
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

MODEL_ID = os.environ.get("ELEVENLABS_MODEL_ID", "eleven_v3")

def cache_key(voice_id, text):
    raw = f"{MODEL_ID}|{voice_id}|{text.strip()}|0.5|0.85|0.3"
    return hashlib.sha256(raw.encode()).hexdigest()


async def main():
    c = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = c[os.environ["DB_NAME"]]
    book = await db.read_aloud_book.find_one({"id": "main"}, {"_id": 0})
    if not book:
        print("No book found"); return
    pages = sorted(book.get("pages", []), key=lambda p: p["page"])

    # If already has 21 pages or a title page at slot 1, skip
    if pages and pages[0].get("page") == 1 and "By Marissa" in (pages[0].get("text") or ""):
        print("Title page already present — nothing to do.")
        return

    # Shift everyone +1
    for p in pages:
        p["page"] += 1

    myrtle = await db.characters.find_one({"slug": "myrtle"}, {"_id": 0, "voice_id": 1})
    voice_id = myrtle["voice_id"]
    title_text = "Myrtle and Ray and the First Day of Camp.\nBy Marissa Allaben and Alison Rothenberg."
    pages.insert(0, {
        "page": 1,
        "character_slug": "myrtle",
        "text": title_text,
        "image_url": "",
        "voice_id": voice_id,
        "audio_url": "",
        "cache_key": cache_key(voice_id, title_text),
    })
    book["pages"] = pages
    book["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.read_aloud_book.update_one({"id": "main"}, {"$set": book}, upsert=True)
    print(f"Total pages now: {len(pages)}")
    for p in pages[:3]:
        print(f"  p{p['page']} {p['character_slug']}: {p['text'][:60]}...")

asyncio.run(main())

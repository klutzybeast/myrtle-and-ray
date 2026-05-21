"""One-shot seeder for the Read-Aloud book content.

Run with:  python3 seed_book.py
Idempotent — re-running keeps the same page assignments and clears stale
audio URLs (you can regen via Admin).
"""
from __future__ import annotations
import asyncio
import hashlib
import os
from datetime import datetime, timezone

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

ROOT = os.path.dirname(__file__)
load_dotenv(os.path.join(ROOT, ".env"))

MODEL_ID = os.environ.get("ELEVENLABS_MODEL_ID", "eleven_v3")
NARRATION_STABILITY = 0.5
NARRATION_SIMILARITY = 0.85
NARRATION_STYLE = 0.3


PAGES = [
    (1,  "ms-bluegill",
     "The sun shone bright on a morning so new,\n"
     "The river sparkled a shimmering blue.\n"
     "The first day of camp waited in sight,\n"
     "A place full of wonder, excitement, and light."),
    (2,  "myrtle",
     "Myrtle the Turtle felt shaky inside,\n"
     "She peeked out from her shell, trying hard not to hide.\n"
     "Her heart fluttered fast with worried fear,\n"
     "\"What if it's hard making camp friends this year?\""),
    (3,  "ray",
     "Ray the Stingray glided close to the sand,\n"
     "Nervous thoughts bubbling, he did not understand.\n"
     "He hopped off the bus, it was now time to go,\n"
     "He thought, \"I hope someone nice will come say hello.\""),
    (4,  "ms-bluegill",
     "The Director Miss Bluegill waved with a smile,\n"
     "\"Sea Stars, come gather and stand single file!\"\n"
     "\"New days feel big, but brave hearts too,\n"
     "There's so much fun waiting at camp for you!\""),
    (5,  "ms-bluegill",
     "\"Today we Catch the W.A.V.E.,\" Miss Bluegill said,\n"
     "As curious thoughts danced in each camper's head.\n"
     "\"Excitement begins when you give it a try,\n"
     "Even when feeling a little bit shy.\""),
    (6,  "myrtle",
     "Myrtle peeked out at the campers nearby,\n"
     "Ray took a breath and looked at the sky.\n"
     "New places felt strange, new faces too,\n"
     "But courage can grow when you try something new."),
    (7,  "ms-bluegill",
     "\"It's time to be brave,\" said Miss Bluegill with care,\n"
     "\"Our first camp activity is just over there.\"\n"
     "\"Take my hand, let's give it a try,\n"
     "New adventures are waiting for you nearby.\""),
    (8,  "myrtle",
     "Arts and Crafts came first, with colors so bold,\n"
     "Markers and glitter made stories unfold.\n"
     "Myrtle mixed paints, Ray cut with care,\n"
     "Both wishing a friend would notice them there."),
    (9,  "sally",
     "Sally the Seahorse struggled to draw,\n"
     "Her picture kept slipping—oh no, what a flaw!\n"
     "Myrtle smiled kindly and said with a wave,\n"
     "\"Want to try together? We can both be brave.\""),
    (10, "ollie",
     "Ray grabbed a paintbrush when Ollie came near,\n"
     "\"I'm new here,\" Ollie said, sounding unsure and unclear.\n"
     "Ray nodded gently, \"I'm new here too,\n"
     "Let's paint together—that's something we can do.\""),
    (11, "ray",
     "Next came Dance with the music turned loud,\n"
     "The Sea Stars gathered in a wiggly crowd.\n"
     "Myrtle froze still as the beat began,\n"
     "Her flippers unsure of the moves they planned."),
    (12, "ray",
     "Ray tapped the rhythm and smiled her way,\n"
     "\"We can move however feels okay.\"\n"
     "Myrtle and Ray let their confidence show,\n"
     "A friendship was growing as they learned to let go."),
    (13, "myrtle",
     "At Nature, they searched for shells on the ground,\n"
     "Beautiful colors and shapes were found.\n"
     "They worked as a team, side by side,\n"
     "And felt their worries shrink with pride."),
    (14, "ray",
     "At lunch, Ray wondered just where to sit,\n"
     "Myrtle felt the same—she worried a bit.\n"
     "Ray took a breath and looked Myrtle's way,\n"
     "\"Do you want to sit at my lunch table today?\""),
    (15, "myrtle",
     "They offered their stories, their jitters, their day,\n"
     "And laughed as the nerves now slipped away.\n"
     "They talked and listened sitting side by side,\n"
     "And shared their interests, things they'd confide."),
    (16, "ms-bluegill",
     "\"It's now time for playground!\" Miss Bluegill cheered,\n"
     "But Ray stared at the slide, it was bigger than he feared.\n"
     "Myrtle said, \"We'll try, just one step at a time,\"\n"
     "And suddenly bravery didn't feel like a climb."),
    (17, "ray",
     "At soccer, they passed and played as a team,\n"
     "Encouraging each other, just like a dream.\n"
     "They valued teamwork, helped the group play,\n"
     "And high-fived each other along the way."),
    (18, "myrtle",
     "Music Time echoed with voices and sound,\n"
     "The Sea Stars sang, happy notes all around.\n"
     "Myrtle sang loud and Ray sang with delight,\n"
     "Camp felt so magical, happy and bright."),
    (19, "myrtle",
     "As the camp day ended, the sun dipped low,\n"
     "Myrtle and Ray felt excitement grow.\n"
     "With new friends beside them, happy and true,\n"
     "They just couldn't wait to come back for Day Two."),
    (20, "ms-bluegill",
     "So if you feel scared on your very first day,\n"
     "Remember Myrtle and Ray and their brave way.\n"
     "Catch the W.A.V.E. of excitement and dive right in—\n"
     "That's just the way new friendships begin."),
]


def cache_key(voice_id: str, text: str) -> str:
    raw = f"{MODEL_ID}|{voice_id}|{text.strip()}|{NARRATION_STABILITY}|{NARRATION_SIMILARITY}|{NARRATION_STYLE}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


async def main():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]

    # Build slug -> voice_id map
    voice_by_slug = {}
    async for ch in db.characters.find({}, {"_id": 0, "slug": 1, "voice_id": 1}):
        if ch.get("voice_id"):
            voice_by_slug[ch["slug"]] = ch["voice_id"]
    print(f"Loaded {len(voice_by_slug)} voices: {sorted(voice_by_slug.keys())}")

    # Preserve existing image_url and audio_url where text+character haven't changed
    existing = await db.read_aloud_book.find_one({"id": "main"}, {"_id": 0}) or {}
    existing_pages = {p["page"]: p for p in existing.get("pages", [])}

    pages_out = []
    for num, slug, text in PAGES:
        voice_id = voice_by_slug.get(slug, "")
        key = cache_key(voice_id, text) if voice_id else ""
        prev = existing_pages.get(num) or {}
        # Keep cached audio if voice + text are unchanged
        keep_audio = prev.get("cache_key") == key and prev.get("audio_url")
        pages_out.append({
            "page": num,
            "character_slug": slug,
            "text": text,
            "image_url": prev.get("image_url", ""),
            "voice_id": voice_id,
            "audio_url": prev.get("audio_url", "") if keep_audio else "",
            "cache_key": key,
        })

    doc = {
        "id": "main",
        "title": "Myrtle and Ray and the First Day of Camp",
        "narrator_voice_id": voice_by_slug.get("ms-bluegill", ""),
        "pages": pages_out,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.read_aloud_book.update_one({"id": "main"}, {"$set": doc}, upsert=True)
    print(f"Seeded {len(pages_out)} pages. Speakers used:")
    speakers = {}
    for p in pages_out:
        speakers[p["character_slug"]] = speakers.get(p["character_slug"], 0) + 1
    for k, v in speakers.items():
        print(f"  {k}: {v}")


if __name__ == "__main__":
    asyncio.run(main())

"""Seed data for Myrtle and Ray site."""
from __future__ import annotations
import hashlib
import logging
import os
from datetime import datetime, timezone
import bcrypt

logger = logging.getLogger(__name__)

# Per-character ElevenLabs voice IDs + greetings. These ship with the seed
# so a fresh production deploy has fully voiced characters and a working
# Read-Aloud audiobook on the very first request.
CHARACTER_VOICES = {
    "ray":         ("6OzrBCQf8cjERkYgzSg8", "Hey, I'm Ray! Ready to ride the W.A.V.E. of excitement?"),
    "myrtle":      ("Z3R5wn05IrDiVCyEkUrK", "Hi! I'm Myrtle the Turtle. I'm so glad you came to camp with me!"),
    "ms-bluegill": ("6qL48o1LBmtR94hIYAQh", "Welcome to Stingray Cay! I'm Ms. Bluegill, your camp director."),
    "ollie":       ("q0IMILNRPxOgtBTS4taI", "Hiya! I'm Ollie the Octopus. Eight arms means eight high-fives - let's go!"),
    "sally":       ("K7W7zLWeGoxU9YqWoB7A", "Hi sweetie, I'm Sally the Seahorse. Welcome, welcome, welcome!"),
    "jessie":      ("FLj50PrMa40MhGHappOt", "Hi! I'm Jessie the Jellyfish. Float with me and we'll act so brave!"),
    "casey":       ("Uq9DKccXXKZ6lc53ATJV", "I'm Casey the Crab! You're valued just the way you are."),
    "dani":        ("qBDvhofpxp92JgXJxDjB", "Hi friend! I'm Dani the Dolphin - let me encourage you today!"),
    "sami":        ("xMagNCpMgZ83QOEsHNre", "I'm Sami the Shark. Don't be scared - I'm here to encourage you!"),
    "izzy":        ("8zu9JdWzG7LvGSTz3uf7", "Welcome to camp! I'm Izzy the Iguana. So happy you're here."),
    "louie":       ("nucVFUFVgPmKHjgXNbJ7", "Hey buddy, Louie the Lobster here. Let's act with big hearts today!"),
    "billy":       ("iiidtqDt9FBdT1vfBluA", "Hello, little one. I'm Billy the Beluga. You are so valued."),
    "frankie":     ("85DL3i4Z7PIWbcOYSlQl", "Hi there, sweet pea! I'm Frankie the Flamingo. Let's act with kindness today!"),
}

# Character portrait URLs (placeholders that admin can swap)
CHARACTER_PORTRAITS = {
    "ray": "https://images.unsplash.com/photo-1599663369941-884b3e7fab34?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAxODF8MHwxfHNlYXJjaHwxfHxjdXRlJTIwbWFudGElMjByYXklMjBpbGx1c3RyYXRpb258ZW58MHx8fHwxNzc4NzA2MTE0fDA&ixlib=rb-4.1.0&q=85",
    "myrtle": "https://images.unsplash.com/photo-1743613314177-fc7193605955?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzNzl8MHwxfHNlYXJjaHwyfHxjdXRlJTIwc2VhJTIwdHVydGxlJTIwaWxsdXN0cmF0aW9ufGVufDB8fHx8MTc3ODcwNjEwNnww&ixlib=rb-4.1.0&q=85",
    "ms-bluegill": "https://images.unsplash.com/photo-1734548657572-666232fd72bc?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1Nzd8MHwxfHNlYXJjaHwxfHxjdXRlJTIwZmlzaCUyMGlsbHVzdHJhdGlvbnxlbnwwfHx8fDE3Nzg3MDYxMTR8MA&ixlib=rb-4.1.0&q=85",
    "ollie": "https://images.unsplash.com/photo-1743307478241-4b240c7f4e17?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA2MTJ8MHwxfHNlYXJjaHwyfHxjdXRlJTIwb2N0b3B1cyUyMGlsbHVzdHJhdGlvbnxlbnwwfHx8fDE3Nzg3MDYxMDZ8MA&ixlib=rb-4.1.0&q=85",
    "sally": "https://images.unsplash.com/photo-1775379995608-d1d9a811d4f2?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1OTV8MHwxfHNlYXJjaHwxfHxjdXRlJTIwc2VhaG9yc2UlMjBpbGx1c3RyYXRpb258ZW58MHx8fHwxNzc4NzA2MTE0fDA&ixlib=rb-4.1.0&q=85",
    "jessie": "https://images.unsplash.com/photo-1629103554663-6685b527aead?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1Mjh8MHwxfHNlYXJjaHwxfHxjdXRlJTIwamVsbHlmaXNoJTIwaWxsdXN0cmF0aW9ufGVufDB8fHx8MTc3ODcwNjExNHww&ixlib=rb-4.1.0&q=85",
    "casey": "https://images.unsplash.com/photo-1723056018762-61d10f93241a?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2Mzl8MHwxfHNlYXJjaHwzfHxjdXRlJTIwY3JhYiUyMGlsbHVzdHJhdGlvbnxlbnwwfHx8fDE3Nzg3MDYxMDZ8MA&ixlib=rb-4.1.0&q=85",
    "dani": "https://images.pexels.com/photos/64219/dolphin-marine-mammals-water-sea-64219.jpeg?auto=compress&cs=tinysrgb&w=600",
    "sami": "https://images.pexels.com/photos/12317254/pexels-photo-12317254.jpeg?auto=compress&cs=tinysrgb&w=600",
    "izzy": "https://images.unsplash.com/photo-1737846157670-155bd6a54a4c?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzOTB8MHwxfHNlYXJjaHwxfHxjdXRlJTIwaWd1YW5hJTIwaWxsdXN0cmF0aW9ufGVufDB8fHx8MTc3ODcwNjExNHww&ixlib=rb-4.1.0&q=85",
    "louie": "https://images.unsplash.com/photo-1723056018738-6ece7e8fb3c0?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1MDV8MHwxfHNlYXJjaHwxfHxjdXRlJTIwbG9ic3RlciUyMGlsbHVzdHJhdGlvbnxlbnwwfHx8fDE3Nzg3MDYxMTV8MA&ixlib=rb-4.1.0&q=85",
    "billy": "https://images.unsplash.com/photo-1627909477137-dfef12d46d47?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NzZ8MHwxfHNlYXJjaHwxfHxjdXRlJTIwYmVsdWdhJTIwaWxsdXN0cmF0aW9ufGVufDB8fHx8MTc3ODcwNjExNXww&ixlib=rb-4.1.0&q=85",
    "frankie": "https://images.unsplash.com/photo-1706464215720-b3c65a14a2d3?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxOTJ8MHwxfHNlYXJjaHwxfHxjdXRlJTIwZmxhbWluZ28lMjBpbGx1c3RyYXRpb258ZW58MHx8fHwxNzc4NzA2MTE0fDA&ixlib=rb-4.1.0&q=85",
}

# Original filenames preserved (with spaces) so admin reseed maps correctly to user uploads.
CHARACTERS = [
    {"slug": "ray", "name": "Ray the Manta Ray", "species": "Manta Ray", "role": "Surfing Squad Star",
     "bio": "As the star of the Surfing Squad, a brave Ray paddles out to catch the biggest curls and master his balance on the crashing waves.",
     "wave_value": "E", "original_filename": "Ray the Manta Ray.jpeg",
     "fun_fact": "Ray's favorite color is sunset peach."},
    {"slug": "myrtle", "name": "Myrtle the Turtle", "species": "Sea Turtle", "role": "Nature Scout",
     "bio": "The camp's Nature Scout enjoys searching for the prettiest seashells and teaching everyone how to identify ocean treasures.",
     "wave_value": "W", "original_filename": "Myrtle the Turtle.jpeg",
     "fun_fact": "Myrtle has a seashell collection of over 100 pieces!"},
    {"slug": "ms-bluegill", "name": "Ms Bluegill", "species": "Bluegill", "role": "Camp Director",
     "bio": "A proud Camp Director beams while organizing the daily 'W.A.V.E. of Excitement' pep rallies for all her favorite campers.",
     "wave_value": "W", "original_filename": "Ms Bluegill.jpeg",
     "fun_fact": "Ms Bluegill never forgets a camper's name."},
    {"slug": "ollie", "name": "Ollie the Octopus", "species": "Octopus", "role": "Arts and Crafts King",
     "bio": "The determined king of Arts and Crafts uses all eight arms at once to build the most complicated and impressive clay sculptures.",
     "wave_value": "V", "original_filename": "Ollie the Octopus.jpeg",
     "fun_fact": "Ollie can paint with eight brushes simultaneously."},
    {"slug": "sally", "name": "Sally the Seahorse", "species": "Seahorse", "role": "Master Painter",
     "bio": "An inspired Master Painter uses her curly tail to steady herself while she brushes colorful murals of the reef onto the canyon walls.",
     "wave_value": "W", "original_filename": "Sally the Seahorse .jpeg",
     "fun_fact": "Sally only paints with reef colors."},
    {"slug": "jessie", "name": "Jessie the Jellyfish", "species": "Jellyfish", "role": "Calm Leader",
     "bio": "A calm leader. Jessie floats in quiet poses while teaching her friends how to relax and shine brightly.",
     "wave_value": "A", "original_filename": "Jessie the Jellyfish.jpeg",
     "fun_fact": "Jessie glows softly when she's happy."},
    {"slug": "casey", "name": "Casey the Crab", "species": "Crab", "role": "Sand Castle Engineer",
     "bio": "An energetic champion of Sand Castle Engineering digs deep moats and zips around building the tallest, sturdiest towers on the beach.",
     "wave_value": "V", "original_filename": "Casey the Crab.jpeg",
     "fun_fact": "Casey's tallest sand tower was three feet high."},
    {"slug": "dani", "name": "Dani the Dolphin", "species": "Dolphin", "role": "High-Dive Captain",
     "bio": "The joyful captain of the High-Dive Team performs triple-flips and splashy aerial stunts to the cheers of all her friends.",
     "wave_value": "E", "original_filename": "Dani the Dolphin.jpeg",
     "fun_fact": "Dani once nailed a quadruple flip on accident."},
    {"slug": "sami", "name": "Sami the Shark", "species": "Shark", "role": "Goal Keeper",
     "bio": "A friendly star on the sports field who guards the goal and cheers on every single player on both teams with a big, toothy grin.",
     "wave_value": "E", "original_filename": "Sami the Shark.jpeg",
     "fun_fact": "Sami cheers louder than any whistle."},
    {"slug": "izzy", "name": "Izzy the Iguana", "species": "Iguana", "role": "Rock Climber",
     "bio": "The adventurous 'best Rock Climber' at camp finds the secret paths up the tallest palm trees to see the sparkling view from the top.",
     "wave_value": "W", "original_filename": "Izzy the Iguana .jpeg",
     "fun_fact": "Izzy has climbed every palm tree at the cay."},
    {"slug": "louie", "name": "Louie the Lobster", "species": "Lobster", "role": "Camp Band Drummer",
     "bio": "The silly lead drummer in the Camp Band snaps out funky, clacking beats with his claws to get everyone up and dancing sideways.",
     "wave_value": "A", "original_filename": "Louie the Lobster.jpeg",
     "fun_fact": "Louie's clack-beat is famous at every campfire."},
    {"slug": "billy", "name": "Billy the Beluga", "species": "Beluga Whale", "role": "Maze Navigator",
     "bio": "A focused expert at Maze Navigation, he zips through the twisty coral paths to win every single game of 'Follow the Leader.'",
     "wave_value": "V", "original_filename": "Billy the Beluga.jpeg",
     "fun_fact": "Billy never gets lost. Ever."},
    {"slug": "frankie", "name": "Frankie the Flamingo", "species": "Flamingo", "role": "Ballet Instructor",
     "bio": "This graceful Ballet Instructor balances on one leg for a long time while teaching the campers how to twirl elegantly in the sand.",
     "wave_value": "A", "original_filename": "Frankie the Flamingo .jpeg",
     "fun_fact": "Frankie can balance on one leg for an hour."},
]

WAVE_CARDS = [
    {"letter": "W", "title": "Welcome Curiosity", "description": "Every wonder is a wave worth riding. Ask, explore, and notice the little things.", "color": "#40E0D0"},
    {"letter": "A", "title": "Act with Kindness", "description": "A kind word is the softest sand and the warmest sun. Lead with kindness, always.", "color": "#FF9B71"},
    {"letter": "V", "title": "Value Teamwork", "description": "Together we float higher. Cheer your friends, share the shore, share the shine.", "color": "#87CEEB"},
    {"letter": "E", "title": "Encourage Others", "description": "Brave isn't fearless — it's trying anyway. Cheer someone on today.", "color": "#3CB371"},
]

DOWNLOAD_CATEGORIES = [
    {"slug": "coloring-pages", "name": "Coloring Pages", "icon": "Palette", "description": "Print-and-color sheets of every Sea Star.", "color": "#FF9B71", "order": 1},
    {"slug": "word-searches", "name": "Word Searches", "icon": "Search", "description": "Printable word search puzzles featuring the Sea Stars.", "color": "#5EC2C9", "order": 2},
    {"slug": "activity-sheets", "name": "Activity Sheets", "icon": "PencilRuler", "description": "Puzzles, mazes, and challenges for kids.", "color": "#40E0D0", "order": 3},
    {"slug": "parent-guides", "name": "Parent Guides", "icon": "BookOpen", "description": "Conversation starters and read-along tips.", "color": "#87CEEB", "order": 4},
    {"slug": "classroom-resources", "name": "Classroom and Educator Resources", "icon": "GraduationCap", "description": "Lesson plans and classroom printables.", "color": "#3CB371", "order": 5},
    {"slug": "camp-director-resources", "name": "Camp Director Resources", "icon": "Tent", "description": "Welcome packets and orientation tools.", "color": "#FFB347", "order": 6},
    {"slug": "posters-printables", "name": "Posters and Printables", "icon": "ImageIcon", "description": "Wall posters and bulletin board art.", "color": "#FF6F91", "order": 7},
    {"slug": "wave-lessons", "name": "W.A.V.E. Lessons", "icon": "Waves", "description": "Mini-lessons on the W.A.V.E. values.", "color": "#9B72CB", "order": 8},
]

PAGES = [
    {"key": "homepage_hero", "title": "Homepage Hero", "content": {
        "headline": "Welcome to Stingray Cay",
        "subheadline": "Catch the W.A.V.E. of Excitement with Myrtle, Ray, and every Sea Star at camp.",
        "cta_primary": "Buy the Book on Amazon",
        "cta_secondary": "Meet the Sea Stars",
        "background_image": "https://customer-assets.emergentagent.com/job_wave-of-excitement/artifacts/np2lq4do_IMG_2972.jpeg",
        "book_cover": "https://customer-assets.emergentagent.com/job_wave-of-excitement/artifacts/np2lq4do_IMG_2972.jpeg",
    }},
    {"key": "about", "title": "About", "content": {
        "intro": "Myrtle and Ray and the First Day of Camp is a book about being brave even when something is new.",
        "why_we_wrote": "We wrote this book because every camper deserves a friend to wave hello on the first day. Brave does not mean fearless — it means trying anyway.",
        "authors": [
            {"name": "Marissa Allaben", "bio": "Marissa is a second-generation director at Rolling River Day Camp in East Rockaway, NY. She has spent her life welcoming campers on their very first day.", "image": ""},
            {"name": "Alison Rothenberg", "bio": "Alison is a second-generation director at Rolling River Day Camp in East Rockaway, NY. She believes every child has a wave of excitement waiting to be caught.", "image": ""},
        ],
        "publisher": "Published by KingApe Media",
        "editor": "Edited by Brian Stein",
    }},
    {"key": "for_camps", "title": "For Camps", "content": {
        "intro": "Bring Stingray Cay to your camp. Set a positive tone on opening day with a story your campers will quote all summer.",
        "benefits": [
            "Sets a positive tone for opening day.",
            "Supports nervous campers with gentle, brave language.",
            "Builds community vocabulary around the W.A.V.E. values.",
            "Gives staff shared language for kindness and teamwork.",
        ],
        "tiers": [
            {"qty": 25, "price_per": 14.95},
            {"qty": 50, "price_per": 13.95},
            {"qty": 100, "price_per": 12.95},
            {"qty": 250, "price_per": 11.95},
        ],
    }},
    {"key": "read_aloud", "title": "Read Aloud", "content": {
        "intro": "Press play and ride the wave with us. Snuggle close and turn the pages together.",
        "video_url": "",
        "parent_note": "Reading aloud builds confidence, vocabulary, and connection. There is no wrong way to share this story.",
    }},
    {"key": "sand_banner", "title": "Sand Banner Testimonial", "content": {
        "quote": "Our campers cheer 'Catch the W.A.V.E.' all summer. It became our shared language for kindness.",
        "author": "A Rolling River Camp parent",
    }},
    {"key": "contact", "title": "Contact", "content": {
        "intro": "Wave hello! We love hearing from parents, teachers, and camp directors.",
    }},
]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _hash_pw(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


async def seed_database(db) -> None:
    # --- Admin user ---
    admin_email = os.environ.get("ADMIN_EMAIL", "community@rollingriver.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "Camp1993!")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one({
            "id": "admin",
            "email": admin_email,
            "password_hash": _hash_pw(admin_password),
            "name": "Site Admin",
            "role": "admin",
            "force_password_change": False,
            "created_at": _now_iso(),
        })

    # --- Settings ---
    if not await db.settings.find_one({"_id": "settings"}):
        from models import SiteSettings
        s = SiteSettings().model_dump()
        s["_id"] = "settings"
        await db.settings.insert_one(s)

    # --- Characters ---
    for idx, ch in enumerate(CHARACTERS):
        voice_id, voice_greeting = CHARACTER_VOICES.get(ch["slug"], ("", ""))
        existing_ch = await db.characters.find_one({"slug": ch["slug"]})
        if existing_ch:
            # Retroactively populate voice_id / voice_greeting if missing —
            # this is what lets a production environment pick up voices
            # on the next deploy without manual admin work.
            patch: dict = {}
            if voice_id and not existing_ch.get("voice_id"):
                patch["voice_id"] = voice_id
            if voice_greeting and not (existing_ch.get("voice_greeting") or "").strip():
                patch["voice_greeting"] = voice_greeting
            if patch:
                patch["updated_at"] = _now_iso()
                await db.characters.update_one({"slug": ch["slug"]}, {"$set": patch})
            continue
        await db.characters.insert_one({
            "id": ch["slug"],
            "name": ch["name"],
            "slug": ch["slug"],
            "species": ch["species"],
            "role": ch["role"],
            "bio": ch["bio"],
            "image_url": CHARACTER_PORTRAITS.get(ch["slug"], ""),
            "wave_value": ch["wave_value"],
            "fun_fact": ch["fun_fact"],
            "linked_product_slug": f"{ch['slug']}-stuffie",
            "audio_url": "",
            "voice_id": voice_id,
            "voice_greeting": voice_greeting,
            "is_core": True,
            "order": idx,
            "original_filename": ch["original_filename"],
            "created_at": _now_iso(),
            "updated_at": _now_iso(),
        })

    # --- Wave cards as a page ---
    if not await db.pages.find_one({"key": "wave_values"}):
        await db.pages.insert_one({
            "id": "wave_values",
            "key": "wave_values",
            "title": "Catch the W.A.V.E.",
            "content": {"cards": WAVE_CARDS},
            "updated_at": _now_iso(),
        })

    # --- Pages ---
    for p in PAGES:
        if not await db.pages.find_one({"key": p["key"]}):
            await db.pages.insert_one({
                "id": p["key"],
                "key": p["key"],
                "title": p["title"],
                "content": p["content"],
                "updated_at": _now_iso(),
            })
        else:
            # Defense against testing-agent leaks: if any seeded page contains
            # a TEST_marker_* sentinel in its content (left over from older
            # admin-page e2e tests that didn't clean up), restore the canonical
            # content so the live site never shows test scaffolding.
            existing = await db.pages.find_one({"key": p["key"]}, {"_id": 0, "content": 1})
            content_str = str((existing or {}).get("content") or "")
            if "TEST_marker_" in content_str:
                await db.pages.update_one(
                    {"key": p["key"]},
                    {"$set": {"content": p["content"], "updated_at": _now_iso()}},
                )

    # --- Download categories ---
    for cat in DOWNLOAD_CATEGORIES:
        existing = await db.download_categories.find_one({"slug": cat["slug"]})
        if not existing:
            await db.download_categories.insert_one({
                "id": cat["slug"],
                "slug": cat["slug"],
                "name": cat["name"],
                "icon": cat["icon"],
                "description": cat["description"],
                "color": cat["color"],
                "order": cat["order"],
                "visible": True,
                "created_at": _now_iso(),
            })
        elif existing.get("order") != cat["order"]:
            # Keep ordering in sync with code so re-ordering ships via deploy.
            await db.download_categories.update_one(
                {"slug": cat["slug"]}, {"$set": {"order": cat["order"]}}
            )

    # --- Placeholder products: one stuffie per character ---
    for ch in CHARACTERS:
        slug = f"{ch['slug']}-stuffie"
        if await db.products.find_one({"slug": slug}):
            continue
        img = CHARACTER_PORTRAITS.get(ch["slug"], "")
        await db.products.insert_one({
            "id": slug,
            "name": f"{ch['name']} Plush",
            "slug": slug,
            "category": "Stuffies",
            "character_slug": ch["slug"],
            "short_description": f"A cuddly {ch['species'].lower()} stuffie inspired by {ch['name']}.",
            "long_description": f"Bring {ch['name']} home from Stingray Cay! Each plush is huggable, soft, and perfect for first-day jitters or bedtime adventures.",
            "price": 24.99,
            "compare_at_price": None,
            "images": [img] if img else [],
            "primary_image": img,
            "printify_url": "https://myrtleandray.printify.me/",
            "variants": [],
            "inventory_status": "Coming Soon",
            "featured": ch["slug"] in {"myrtle", "ray", "ollie", "dani"},
            "tags": ["stuffie", ch["slug"], "plush"],
            "seo_title": f"{ch['name']} Plush Toy",
            "meta_description": f"Plush stuffie of {ch['name']} from Myrtle and Ray and the First Day of Camp.",
            "published": True,
            "created_at": _now_iso(),
            "updated_at": _now_iso(),
        })

    # --- Placeholder downloads ---
    placeholder_files = [
        {"label": "Print-friendly PDF", "url": "/api/downloads/sample.pdf", "filename": "sample.pdf", "size_kb": 120, "page_count": 1, "mime": "application/pdf"}
    ]
    # one coloring page per character
    for ch in CHARACTERS:
        slug = f"color-{ch['slug']}"
        if await db.downloads.find_one({"slug": slug}):
            continue
        await db.downloads.insert_one({
            "id": slug,
            "title": f"Color {ch['name']}",
            "slug": slug,
            "category_slugs": ["coloring-pages"],
            "character_slug": ch["slug"],
            "cover_image": CHARACTER_PORTRAITS.get(ch["slug"], ""),
            "short_description": f"A printable coloring page of {ch['name']}.",
            "long_description": f"Grab your crayons and bring {ch['name']} to life! Great for quiet time, classroom centers, or rainy days.",
            "age_range": "Ages 3 to 8",
            "audiences": ["Parents", "Teachers", "Kids"],
            "wave_values": [ch["wave_value"]],
            "tags": ["coloring", ch["slug"]],
            "files": placeholder_files,
            "email_gate_override": None,
            "featured": ch["slug"] in {"myrtle", "ray"},
            "is_new": True,
            "new_until": None,
            "order": 0,
            "published": True,
            "seo_title": f"Free Coloring Page: {ch['name']}",
            "meta_description": f"Download a free coloring page of {ch['name']} from Myrtle and Ray.",
            "total_downloads": 0,
            "created_at": _now_iso(),
            "updated_at": _now_iso(),
        })

    # Parent guide + classroom guide + W.A.V.E. poster
    extras = [
        {"slug": "parent-first-day-guide", "title": "First Day Parent Guide",
         "category_slugs": ["parent-guides"], "short": "Gentle tips for the morning of a brand new adventure.",
         "long": "A two-page conversation guide for the night before and morning of the first day. Includes talking points and a calm-down breathing exercise.",
         "audiences": ["Parents"], "wave_values": ["W", "E"], "featured": True},
        {"slug": "classroom-wave-lesson", "title": "Classroom W.A.V.E. Lesson",
         "category_slugs": ["classroom-resources", "wave-lessons"], "short": "A 30-minute classroom lesson on the four W.A.V.E. values.",
         "long": "Lesson plan, vocabulary, discussion prompts, and a coloring extension. Designed for K-3.",
         "audiences": ["Teachers"], "wave_values": ["W", "A", "V", "E"], "featured": True},
        {"slug": "wave-classroom-poster", "title": "Catch the W.A.V.E. Poster",
         "category_slugs": ["posters-printables", "wave-lessons"], "short": "A printable poster of the four W.A.V.E. values.",
         "long": "11x17 poster perfect for the classroom or bunkhouse wall.",
         "audiences": ["Teachers", "Camp Directors"], "wave_values": ["W", "A", "V", "E"], "featured": False},
        {"slug": "camp-director-orientation", "title": "Camp Director Orientation Packet",
         "category_slugs": ["camp-director-resources"], "short": "Staff orientation packet built around W.A.V.E. values.",
         "long": "A six-page packet for opening day staff meetings — talking points, ice breakers, and W.A.V.E. cheer scripts.",
         "audiences": ["Camp Directors"], "wave_values": ["A", "V"], "featured": False},
    ]
    for d in extras:
        if await db.downloads.find_one({"slug": d["slug"]}):
            continue
        await db.downloads.insert_one({
            "id": d["slug"],
            "title": d["title"],
            "slug": d["slug"],
            "category_slugs": d["category_slugs"],
            "character_slug": "",
            "cover_image": "https://images.unsplash.com/photo-1499951360447-b19be8fe80f5?auto=format&fit=crop&w=800&q=80",
            "short_description": d["short"],
            "long_description": d["long"],
            "age_range": "Ages 3 to 8",
            "audiences": d["audiences"],
            "wave_values": d["wave_values"],
            "tags": [],
            "files": placeholder_files,
            "email_gate_override": None,
            "featured": d["featured"],
            "is_new": True,
            "new_until": None,
            "order": 0,
            "published": True,
            "seo_title": d["title"],
            "meta_description": d["short"],
            "total_downloads": 0,
            "created_at": _now_iso(),
            "updated_at": _now_iso(),
        })

    # --- Activity content with rotating levels (new schema) ---
    activity_seeds = [
        {"key": "rhyme_time", "title": "Rhyme Time", "data": {"levels": [
            {"name": "Sea Star starters", "prompts": [
                {"line": "Myrtle waved hello to the sun, and zipped down the slide just for...", "choices": ["fun", "sand"], "answer": "fun"},
                {"line": "Ray paddled out, then caught a big wave, smiling because he was being...", "choices": ["brave", "shy"], "answer": "brave"},
                {"line": "Ollie made art with each of his eight, his sculpture turned out totally...", "choices": ["great", "late"], "answer": "great"},
            ]},
            {"name": "Beach buddies", "prompts": [
                {"line": "Casey dug a castle deep in the sand, the tallest one in the whole...", "choices": ["land", "sea"], "answer": "land"},
                {"line": "Sally painted murals all bright and bold, even when her brushes felt...", "choices": ["cold", "warm"], "answer": "cold"},
                {"line": "Jessie floated, soft and still, then taught her friends a gentle...", "choices": ["skill", "song"], "answer": "skill"},
            ]},
            {"name": "Camp time", "prompts": [
                {"line": "Billy swam in loops and zooms, then said hello with happy...", "choices": ["booms", "fish"], "answer": "booms"},
                {"line": "Frankie strut in pink and tall, the kindest flamingo of them...", "choices": ["all", "few"], "answer": "all"},
                {"line": "Izzy climbed the palm so high, then waved her arms up at the...", "choices": ["sky", "tree"], "answer": "sky"},
            ]},
        ]}},
        {"key": "quiz", "title": "Which Sea Star Are You?", "data": {"levels": [
            {"name": "First Day round", "questions": [
                {"q": "Your favorite first-day activity is...", "options": [
                    {"label": "Searching for seashells", "char": "myrtle"},
                    {"label": "Surfing the biggest waves", "char": "ray"},
                    {"label": "Painting a giant mural", "char": "sally"},
                    {"label": "Climbing the tallest palm", "char": "izzy"},
                ]},
                {"q": "Pick a snack", "options": [
                    {"label": "Seaweed chips", "char": "ollie"},
                    {"label": "Fruit kabobs", "char": "frankie"},
                    {"label": "Sand-castle cookies", "char": "casey"},
                    {"label": "Triple-flip popsicles", "char": "dani"},
                ]},
                {"q": "If you needed a buddy you'd ask...", "options": [
                    {"label": "The calm one who listens", "char": "jessie"},
                    {"label": "The friend with a plan", "char": "ms-bluegill"},
                    {"label": "The one who tells jokes", "char": "louie"},
                    {"label": "The one who'll race you", "char": "ray"},
                ]},
            ]},
            {"name": "Bravery round", "questions": [
                {"q": "When something is new, you...", "options": [
                    {"label": "Breathe and try it slow", "char": "myrtle"},
                    {"label": "Jump right in", "char": "ray"},
                    {"label": "Watch first, then go", "char": "jessie"},
                    {"label": "Bring a friend", "char": "casey"},
                ]},
                {"q": "Your superpower would be...", "options": [
                    {"label": "Eight hands at once", "char": "ollie"},
                    {"label": "Tail of color", "char": "sally"},
                    {"label": "Echo-locate friends", "char": "billy"},
                    {"label": "Glow in the dark", "char": "jessie"},
                ]},
            ]},
        ]}},
        {"key": "word_search", "title": "Stingray Cay Word Search", "data": {"levels": [
            {"name": "Beach", "words": ["WAVE", "SAND", "SHELL", "SUN", "SURF", "CRAB", "REEF", "TIDE"]},
            {"name": "W.A.V.E.", "words": ["WELCOME", "ACT", "VALUE", "ENCOURAGE", "KIND", "BRAVE", "TEAM", "SHINE"]},
            {"name": "Camp crew", "words": ["MYRTLE", "RAY", "OLLIE", "SALLY", "JESSIE", "CASEY", "BILLY", "FRANKIE"]},
        ]}},
        {"key": "memory_match", "title": "Memory Match", "data": {"levels": [
            {"name": "Easy", "pairs": 6},
            {"name": "Medium", "pairs": 10},
            {"name": "Hard", "pairs": 13},
        ]}},
        {"key": "spot_difference", "title": "Spot the Difference", "data": {"levels": [
            {"name": "Beach day", "scene_key": "beach"},
            {"name": "Camp scene", "scene_key": "camp"},
        ]}},
        {"key": "coloring", "title": "Color the Cay", "data": {"palette": ["#40E0D0", "#FF9B71", "#87CEEB", "#3CB371", "#FFB347", "#9B72CB"], "levels": [
            {"name": "Big Wave", "scene_key": "wave"},
            {"name": "Stingray Cay", "scene_key": "camp"},
        ]}},
        {"key": "maze", "title": "Maze with Billy the Beluga", "data": {"levels": [
            {"name": "Easy", "width": 8, "height": 8},
            {"name": "Medium", "width": 12, "height": 12},
            {"name": "Hard", "width": 16, "height": 16},
            {"name": "Captain", "width": 20, "height": 20},
        ]}},
        {"key": "sticker_beach", "title": "Sticker Beach", "data": {"levels": [
            {"name": "Sunny beach", "scene_image": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&h=700&fit=crop"},
            {"name": "Sunset cove", "scene_image": "https://images.unsplash.com/photo-1519046904884-53103b34b206?w=1200&h=700&fit=crop"},
            {"name": "Coral reef", "scene_image": "https://images.unsplash.com/photo-1582967788606-a171c1080cb0?w=1200&h=700&fit=crop"},
        ]}},
    ]
    for a in activity_seeds:
        existing = await db.activity_content.find_one({"key": a["key"]})
        if existing:
            # Migrate: if no levels yet, add the seeded levels in-place
            if "levels" not in (existing.get("data") or {}):
                merged = {**(existing.get("data") or {}), **a["data"]}
                await db.activity_content.update_one({"key": a["key"]}, {"$set": {"data": merged, "updated_at": _now_iso()}})
            continue
        await db.activity_content.insert_one({
            "id": a["key"],
            "key": a["key"],
            "title": a["title"],
            "data": a["data"],
            "updated_at": _now_iso(),
        })

    # --- Read-Aloud book (21 pages) ---
    await _seed_readaloud_book(db)

    # --- Story Quest scenes (12 scenes + W.A.V.E. → character mapping) ---
    await _seed_story_quest(db)

    # --- Sing-Along songs (10 stubs; audio is added per song as MP3s are baked) ---
    await _seed_sing_along(db)

    # --- Stingray Cay map image (bundled asset → /api/uploads/map/...) ---
    _seed_map_image()


READALOUD_PAGES = [
    (1,  "myrtle",
     "Myrtle and Ray and the First Day of Camp.\n"
     "By Marissa Allaben and Alison Rothenberg."),
    (2,  "ms-bluegill",
     "The sun shone bright on a morning so new,\n"
     "The river sparkled a shimmering blue.\n"
     "The first day of camp waited in sight,\n"
     "A place full of wonder, excitement, and light."),
    (3,  "myrtle",
     "Myrtle the Turtle felt shaky inside,\n"
     "She peeked out from her shell, trying hard not to hide.\n"
     "Her heart fluttered fast with worried fear,\n"
     "\"What if it's hard making camp friends this year?\""),
    (4,  "ray",
     "Ray the Stingray glided close to the sand,\n"
     "Nervous thoughts bubbling, he did not understand.\n"
     "He hopped off the bus, it was now time to go,\n"
     "He thought, \"I hope someone nice will come say hello.\""),
    (5,  "ms-bluegill",
     "The Director Miss Bluegill waved with a smile,\n"
     "\"Sea Stars, come gather and stand single file!\"\n"
     "\"New days feel big, but brave hearts too,\n"
     "There's so much fun waiting at camp for you!\""),
    (6,  "ms-bluegill",
     "\"Today we Catch the W.A.V.E.,\" Miss Bluegill said,\n"
     "As curious thoughts danced in each camper's head.\n"
     "\"Excitement begins when you give it a try,\n"
     "Even when feeling a little bit shy.\""),
    (7,  "myrtle",
     "Myrtle peeked out at the campers nearby,\n"
     "Ray took a breath and looked at the sky.\n"
     "New places felt strange, new faces too,\n"
     "But courage can grow when you try something new."),
    (8,  "ms-bluegill",
     "\"It's time to be brave,\" said Miss Bluegill with care,\n"
     "\"Our first camp activity is just over there.\"\n"
     "\"Take my hand, let's give it a try,\n"
     "New adventures are waiting for you nearby.\""),
    (9,  "myrtle",
     "Arts and Crafts came first, with colors so bold,\n"
     "Markers and glitter made stories unfold.\n"
     "Myrtle mixed paints, Ray cut with care,\n"
     "Both wishing a friend would notice them there."),
    (10, "sally",
     "Sally the Seahorse struggled to draw,\n"
     "Her picture kept slipping—oh no, what a flaw!\n"
     "Myrtle smiled kindly and said with a wave,\n"
     "\"Want to try together? We can both be brave.\""),
    (11, "ollie",
     "Ray grabbed a paintbrush when Ollie came near,\n"
     "\"I'm new here,\" Ollie said, sounding unsure and unclear.\n"
     "Ray nodded gently, \"I'm new here too,\n"
     "Let's paint together—that's something we can do.\""),
    (12, "ray",
     "Next came Dance with the music turned loud,\n"
     "The Sea Stars gathered in a wiggly crowd.\n"
     "Myrtle froze still as the beat began,\n"
     "Her flippers unsure of the moves they planned."),
    (13, "ray",
     "Ray tapped the rhythm and smiled her way,\n"
     "\"We can move however feels okay.\"\n"
     "Myrtle and Ray let their confidence show,\n"
     "A friendship was growing as they learned to let go."),
    (14, "myrtle",
     "At Nature, they searched for shells on the ground,\n"
     "Beautiful colors and shapes were found.\n"
     "They worked as a team, side by side,\n"
     "And felt their worries shrink with pride."),
    (15, "ray",
     "At lunch, Ray wondered just where to sit,\n"
     "Myrtle felt the same—she worried a bit.\n"
     "Ray took a breath and looked Myrtle's way,\n"
     "\"Do you want to sit at my lunch table today?\""),
    (16, "myrtle",
     "They offered their stories, their jitters, their day,\n"
     "And laughed as the nerves now slipped away.\n"
     "They talked and listened sitting side by side,\n"
     "And shared their interests, things they'd confide."),
    (17, "ms-bluegill",
     "\"It's now time for playground!\" Miss Bluegill cheered,\n"
     "But Ray stared at the slide, it was bigger than he feared.\n"
     "Myrtle said, \"We'll try, just one step at a time,\"\n"
     "And suddenly bravery didn't feel like a climb."),
    (18, "ray",
     "At soccer, they passed and played as a team,\n"
     "Encouraging each other, just like a dream.\n"
     "They valued teamwork, helped the group play,\n"
     "And high-fived each other along the way."),
    (19, "myrtle",
     "Music Time echoed with voices and sound,\n"
     "The Sea Stars sang, happy notes all around.\n"
     "Myrtle sang loud and Ray sang with delight,\n"
     "Camp felt so magical, happy and bright."),
    (20, "myrtle",
     "As the camp day ended, the sun dipped low,\n"
     "Myrtle and Ray felt excitement grow.\n"
     "With new friends beside them, happy and true,\n"
     "They just couldn't wait to come back for Day Two."),
    (21, "ms-bluegill",
     "So if you feel scared on your very first day,\n"
     "Remember Myrtle and Ray and their brave way.\n"
     "Catch the W.A.V.E. of excitement and dive right in—\n"
     "That's just the way new friendships begin."),
]


def _readaloud_cache_key(model_id: str, voice_id: str, text: str) -> str:
    # Mirror readaloud_router._cache_key so seeded pages share cache with admin regenerations.
    raw = f"{model_id}|{voice_id}|{text.strip()}|0.5|0.85|0.3"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


async def _seed_readaloud_book(db) -> None:
    """Insert/refresh the 21-page Read-Aloud book content. Preserves any audio_url
    and image_url already present for unchanged (voice + text) pages.

    Pre-generated MP3s shipped in /app/backend/seed_assets/readaloud/ are
    imported into local uploads + persistent Object Storage on first deploy
    so production never has to call ElevenLabs for the book."""
    import storage as _storage  # local import — avoids circular deps in tests
    model_id = os.environ.get("ELEVENLABS_MODEL_ID", "eleven_v3")
    # Map slug -> voice_id from the seeded characters
    voice_by_slug: dict = {}
    async for ch in db.characters.find({}, {"_id": 0, "slug": 1, "voice_id": 1}):
        if ch.get("voice_id"):
            voice_by_slug[ch["slug"]] = ch["voice_id"]

    existing = await db.read_aloud_book.find_one({"id": "main"}, {"_id": 0}) or {}
    prev_pages = {p["page"]: p for p in existing.get("pages", [])}

    asset_dir = os.path.join(os.path.dirname(__file__), "seed_assets", "readaloud")
    upload_dir = os.environ.get("UPLOAD_DIR", "/app/backend/uploads")
    voice_dir = os.path.join(upload_dir, "voice")
    os.makedirs(voice_dir, exist_ok=True)

    pages_out = []
    for num, slug, text in READALOUD_PAGES:
        voice_id = voice_by_slug.get(slug, "")
        cache_key = _readaloud_cache_key(model_id, voice_id, text) if voice_id else ""
        prev = prev_pages.get(num) or {}

        audio_url = ""
        if cache_key:
            storage_name = f"voice/{cache_key}.mp3"
            local_path = os.path.join(voice_dir, f"{cache_key}.mp3")

            # 1) If we already cached this MP3 locally OR in persistent storage, keep it.
            if os.path.exists(local_path):
                audio_url = f"/api/uploads/{storage_name}"
            else:
                fetched = _storage.get_object(storage_name) if _storage.is_enabled() else None
                if fetched is not None:
                    audio_url = f"/api/uploads/{storage_name}"

            # 2) Otherwise, try to import the bundled MP3 that ships with the deploy.
            if not audio_url:
                bundled = os.path.join(asset_dir, f"{cache_key}.mp3")
                if os.path.exists(bundled):
                    try:
                        with open(bundled, "rb") as fh:
                            data = fh.read()
                        # Write to local cache
                        with open(local_path, "wb") as fh:
                            fh.write(data)
                        # And push to persistent storage so it survives redeploys
                        if _storage.is_enabled():
                            _storage.put_object(storage_name, data, "audio/mpeg")
                        # And ensure the voice_cache row exists so admin "regenerate"
                        # is a free no-op (cache hit) for these pages.
                        await db.voice_cache.update_one(
                            {"key": cache_key},
                            {"$setOnInsert": {
                                "key": cache_key,
                                "voice_id": voice_id,
                                "text": text,
                                "model_id": model_id,
                                "chars": len(text),
                                "storage_filename": storage_name,
                                "created_at": _now_iso(),
                            }},
                            upsert=True,
                        )
                        audio_url = f"/api/uploads/{storage_name}"
                    except Exception:  # noqa: BLE001
                        audio_url = ""

        # If we still have nothing but the previous page had something, keep the previous URL
        if not audio_url and prev.get("audio_url") and prev.get("cache_key") == cache_key:
            audio_url = prev["audio_url"]

        pages_out.append({
            "page": num,
            "character_slug": slug,
            "text": text,
            "image_url": prev.get("image_url", ""),
            "voice_id": voice_id,
            "audio_url": audio_url,
            "cache_key": cache_key,
        })

    doc = {
        "id": "main",
        "title": "Myrtle and Ray and the First Day of Camp",
        "narrator_voice_id": voice_by_slug.get("ms-bluegill", ""),
        "pages": pages_out,
        "updated_at": _now_iso(),
    }
    await db.read_aloud_book.update_one({"id": "main"}, {"$set": doc}, upsert=True)

    # --- Bundled full-book MP3 (stitched 21 pages) — import once into storage ---
    full_book_src = os.path.join(asset_dir, "myrtle-and-ray-full-book.mp3")
    full_book_local = os.path.join(upload_dir, "myrtle-and-ray-full-book.mp3")
    if os.path.exists(full_book_src) and not os.path.exists(full_book_local):
        try:
            with open(full_book_src, "rb") as fh:
                data = fh.read()
            with open(full_book_local, "wb") as fh:
                fh.write(data)
            if _storage.is_enabled():
                _storage.put_object("myrtle-and-ray-full-book.mp3", data, "audio/mpeg")
        except Exception:  # noqa: BLE001
            pass


def _seed_map_image() -> None:
    """Bundle the Stingray Cay map JPEG with the deploy so /map never has to
    rely on the preview-scoped customer-assets domain. Idempotent: copies the
    bundled asset into /api/uploads/map/ on first boot and pushes it to
    persistent Object Storage so it survives redeploys."""
    try:
        import storage as _storage  # local import — avoids circular deps in tests
        asset_path = os.path.join(os.path.dirname(__file__), "seed_assets", "map", "stingray-cay.jpeg")
        if not os.path.exists(asset_path):
            return
        upload_dir = os.environ.get("UPLOAD_DIR", "/app/backend/uploads")
        target_dir = os.path.join(upload_dir, "map")
        os.makedirs(target_dir, exist_ok=True)
        target_path = os.path.join(target_dir, "stingray-cay.jpeg")
        storage_name = "map/stingray-cay.jpeg"

        with open(asset_path, "rb") as fh:
            data = fh.read()

        if not os.path.exists(target_path):
            with open(target_path, "wb") as fh:
                fh.write(data)

        if _storage.is_enabled():
            try:
                if _storage.get_object(storage_name) is None:
                    _storage.put_object(storage_name, data, "image/jpeg")
            except Exception:  # noqa: BLE001
                pass
    except Exception:  # noqa: BLE001
        pass



# ============================================================
# Story Quest seed (12 scenes that teach W.A.V.E. through choices)
# ============================================================

# Which Sea Star narrates each scene (matched to whose voice/perspective
# fits the moment). Used to pick the ElevenLabs voice for narration.
STORY_QUEST_NARRATORS = {
    1: "ms-bluegill",   # Camp opening — Ms Bluegill welcomes the campers
    2: "ray",           # Ray introduces the crew
    3: "casey",         # Tide pool — Casey explains the rules
    4: "myrtle",        # Sami's snorkel — Myrtle's helper voice
    5: "louie",         # Lunchtime — Louie is drumming
    6: "ray",           # Big wave — Ray calls everyone in
    7: "myrtle",        # Casey is lost — Myrtle leads the search
    8: "ms-bluegill",   # Treasure hunt — Ms Bluegill announces
    9: "sally",         # Stories at sunset — Sally's quiet voice
    10: "ms-bluegill",  # Goodbye for the day — Ms Bluegill closes camp
    11: "myrtle",       # W.A.V.E. promise — Myrtle's reflective voice
    12: "ms-bluegill",  # Reveal finale — Ms Bluegill (framing narrator)
}


# Catalog of Story Quests. Each entry shows up in the public `/story-quest`
# gallery. The "First Day of Camp" quest is fully scripted (12 scenes seeded
# below). Other quests start as Coming Soon — their scenes are authored in the
# admin. The blurbs deliberately tease the W.A.V.E. principle each adventure
# spotlights, so kids can pick a quest that fits how they feel today.
STORY_QUESTS_CATALOG = [
    {
        "slug": "first-day-of-camp",
        "title": "First Day of Camp",
        "blurb": "Brand-new camp, brand-new crew. Pick choices that show Welcome, Act, Value, and Encourage — and meet the Sea Star inside you.",
        "hero_image_url": "/uploads/seed/map/stingray-cay.jpeg",
        "theme_color": "#7fcfc7",
        "character_focus": "all",
        "position": 1,
        "status": "ready",   # 'ready' shows the Start button; 'coming-soon' shows a teaser
    },
    {
        "slug": "lost-sea-glass-treasure",
        "title": "The Lost Sea Glass Treasure",
        "blurb": "Ray's special sea glass collection has gone missing! Follow clues across the sand and lean on the crew to bring it home.",
        "hero_image_url": "",
        "theme_color": "#b8a3d9",
        "character_focus": "ray",
        "position": 2,
        "status": "coming-soon",
    },
    {
        "slug": "storm-at-stingray-cay",
        "title": "Storm at Stingray Cay",
        "blurb": "Clouds are rolling in fast. Help every camper find shelter and stay calm — teamwork keeps the cay safe.",
        "hero_image_url": "",
        "theme_color": "#3a4a55",
        "character_focus": "ms-bluegill",
        "position": 3,
        "status": "coming-soon",
    },
    {
        "slug": "first-camp-talent-show",
        "title": "The First Camp Talent Show",
        "blurb": "Sally has stage fright. Louie has a new beat. Will you cheer the shy ones and dance with the loud ones?",
        "hero_image_url": "",
        "theme_color": "#f0a988",
        "character_focus": "sally",
        "position": 4,
        "status": "coming-soon",
    },
    {
        "slug": "tide-pool-mystery",
        "title": "Mystery of the Tide Pool",
        "blurb": "Something blue is hiding under the rocks. Casey needs a curious helper to investigate without scaring anyone.",
        "hero_image_url": "",
        "theme_color": "#7fcfc7",
        "character_focus": "casey",
        "position": 5,
        "status": "coming-soon",
    },
    {
        "slug": "race-to-the-lighthouse",
        "title": "Race to the Lighthouse",
        "blurb": "Ray wants to win the race — but Sami slipped on the path. Do you keep going or turn around?",
        "hero_image_url": "",
        "theme_color": "#7cbf94",
        "character_focus": "ray",
        "position": 6,
        "status": "coming-soon",
    },
    {
        "slug": "captain-for-a-day",
        "title": "Captain for a Day",
        "blurb": "Ms Bluegill is letting you steer the boat! Every choice grows the W.A.V.E. badge for the whole crew.",
        "hero_image_url": "",
        "theme_color": "#5a8a6f",
        "character_focus": "ms-bluegill",
        "position": 7,
        "status": "coming-soon",
    },
    {
        "slug": "friendship-fix-it",
        "title": "Friendship Fix-It",
        "blurb": "Frankie and Billy had a fight at lunch. Myrtle thinks you can help mend things — kindness first.",
        "hero_image_url": "",
        "theme_color": "#a36b29",
        "character_focus": "myrtle",
        "position": 8,
        "status": "coming-soon",
    },
    {
        "slug": "surprise-birthday-at-camp",
        "title": "Surprise Birthday at Camp",
        "blurb": "It's a secret — only the crew knows! Decorate, hide, and cheer to throw the best Sea Star party ever.",
        "hero_image_url": "",
        "theme_color": "#f0a988",
        "character_focus": "ollie",
        "position": 9,
        "status": "coming-soon",
    },
    {
        "slug": "beach-cleanup-heroes",
        "title": "Beach Cleanup Heroes",
        "blurb": "The tide brought in lots of stuff that shouldn't be there. Lead the crew, cheer the slow ones, and protect Stingray Cay.",
        "hero_image_url": "",
        "theme_color": "#7cbf94",
        "character_focus": "all",
        "position": 10,
        "status": "coming-soon",
    },
]


STORY_QUEST_SCENES = [
    {
        "scene_number": 1,
        "title": "Welcome to Stingray Cay",
        "narrative": (
            "It's your very first day at camp on Stingray Cay! The sun is shining, "
            "the waves are sparkling, and Ms Bluegill is waving you over to start."
        ),
        "is_intro": True,
        "choices": [
            {"id": "a", "text": "Look around and notice everything new.", "wave_principle": "welcome_curiosity",
             "character_reaction": "Ms Bluegill smiles — \"That's the spirit! Curiosity is your superpower today.\""},
            {"id": "b", "text": "Smile at the camper next to you.", "wave_principle": "act_with_kindness",
             "character_reaction": "Your new bunkmate smiles right back. The day is already brighter."},
            {"id": "c", "text": "Cheer when Ms Bluegill says hello.", "wave_principle": "encourage_others",
             "character_reaction": "The whole crew cheers with you. Energy flows through the cay!"},
        ],
    },
    {
        "scene_number": 2,
        "title": "Meeting the Crew",
        "narrative": (
            "Ray glides up and introduces the Sea Stars. There are 13 of them and "
            "they all have different talents. Some are loud, some are quiet."
        ),
        "choices": [
            {"id": "a", "text": "Ask each Sea Star what they love most.", "wave_principle": "welcome_curiosity",
             "character_reaction": "Ollie's eight arms wave with joy — he loves being asked!"},
            {"id": "b", "text": "Say hi to the quietest Sea Star first.", "wave_principle": "act_with_kindness",
             "character_reaction": "Sally the Seahorse blushes. \"You're the first to say hi to me.\""},
            {"id": "c", "text": "Suggest the crew makes a team name together.", "wave_principle": "value_teamwork",
             "character_reaction": "Ray fins the water. \"The Wave Riders! I love it!\""},
        ],
    },
    {
        "scene_number": 3,
        "title": "At the Tide Pool",
        "narrative": (
            "Your crew arrives at the tide pool. Tiny crabs scuttle, and a curious "
            "starfish waves a soft arm. Casey explains the rules: look, don't touch."
        ),
        "choices": [
            {"id": "a", "text": "Lean in close to watch a hermit crab change shells.", "wave_principle": "welcome_curiosity",
             "character_reaction": "Myrtle nods. \"That's how you learn the cay's secrets.\""},
            {"id": "b", "text": "Help a friend who's afraid of the cold water.", "wave_principle": "act_with_kindness",
             "character_reaction": "They squeeze your fin. \"Thanks for staying with me.\""},
            {"id": "c", "text": "Tell Casey their tide-pool rules are amazing.", "wave_principle": "encourage_others",
             "character_reaction": "Casey's claws snap proudly. \"Aw shucks — thank you!\""},
        ],
    },
    {
        "scene_number": 4,
        "title": "Sami's Missing Snorkel",
        "narrative": (
            "Sami is ready to swim — but their snorkel mask has gone missing! "
            "They look around the sand, suddenly very sad."
        ),
        "choices": [
            {"id": "a", "text": "\"Don't worry Sami — you can use mine!\"", "wave_principle": "act_with_kindness",
             "character_reaction": "Sami's eyes light up. \"You're the best, really.\""},
            {"id": "b", "text": "\"Let's all look together — I bet we'll find it.\"", "wave_principle": "value_teamwork",
             "character_reaction": "The whole crew fans out. Found it in two minutes!"},
            {"id": "c", "text": "\"Hey Sami — you're awesome even without a mask.\"", "wave_principle": "encourage_others",
             "character_reaction": "Sami grins through tears. \"You always know what to say.\""},
        ],
    },
    {
        "scene_number": 5,
        "title": "Lunchtime",
        "narrative": (
            "Picnic tables under the striped tent. Louie is drumming. You spot "
            "an empty spot next to a kid sitting all by themselves."
        ),
        "choices": [
            {"id": "a", "text": "Ask them what their favorite sea creature is.", "wave_principle": "welcome_curiosity",
             "character_reaction": "\"Octopuses! Did you know they have three hearts?\" Conversation: launched."},
            {"id": "b", "text": "Sit down and share your snack with them.", "wave_principle": "act_with_kindness",
             "character_reaction": "They smile and offer you half their sandwich."},
            {"id": "c", "text": "Wave the whole crew over to your table.", "wave_principle": "value_teamwork",
             "character_reaction": "Lunch turns into a sea-star sing-along with Louie on the drums."},
        ],
    },
    {
        "scene_number": 6,
        "title": "The Big Wave",
        "narrative": (
            "Suddenly a bigger-than-expected wave rolls in! A few campers gasp. "
            "Ray calls everyone toward shore. What do you do?"
        ),
        "choices": [
            {"id": "a", "text": "Hold a younger camper's hand and walk in calmly.", "wave_principle": "act_with_kindness",
             "character_reaction": "Their little fingers squeeze yours. \"You're so brave for me.\""},
            {"id": "b", "text": "Count heads to make sure no one is left behind.", "wave_principle": "value_teamwork",
             "character_reaction": "Ray winks. \"Real Sea Stars look out for the whole crew.\""},
            {"id": "c", "text": "Shout \"We've got this!\" so everyone hears.", "wave_principle": "encourage_others",
             "character_reaction": "Twelve voices shout it back. The wave doesn't feel so big now."},
        ],
    },
    {
        "scene_number": 7,
        "title": "Lost on the Beach",
        "narrative": (
            "Casey the Crab has wandered off chasing a sand dollar. The crew is "
            "worried. The beach is big and the dunes are tall."
        ),
        "choices": [
            {"id": "a", "text": "Look for clues — claw tracks in the sand.", "wave_principle": "welcome_curiosity",
             "character_reaction": "You spot a tiny trail leading toward the dunes!"},
            {"id": "b", "text": "Split into pairs so no one searches alone.", "wave_principle": "value_teamwork",
             "character_reaction": "Three pairs cover three sections of beach. Smart move."},
            {"id": "c", "text": "Call out, \"Casey, you're not in trouble — we miss you!\"", "wave_principle": "encourage_others",
             "character_reaction": "From behind a dune: \"I'm here! I just got distracted!\""},
        ],
    },
    {
        "scene_number": 8,
        "title": "The Treasure Hunt",
        "narrative": (
            "Ms Bluegill announces a treasure hunt. Each team must find five "
            "shells with letters on them that spell a word."
        ),
        "choices": [
            {"id": "a", "text": "Ask the crew, \"What word do you think it spells?\"", "wave_principle": "welcome_curiosity",
             "character_reaction": "Sami guesses \"WAVES\" — and they're right!"},
            {"id": "b", "text": "Hand the prettiest shell to the youngest camper.", "wave_principle": "act_with_kindness",
             "character_reaction": "Their face lights up like the sun on the water."},
            {"id": "c", "text": "Divide the beach into zones so no one steps on toes.", "wave_principle": "value_teamwork",
             "character_reaction": "Five shells in five minutes. Team Wave Riders FTW!"},
        ],
    },
    {
        "scene_number": 9,
        "title": "Stories at Sunset",
        "narrative": (
            "The sun is setting. The Sea Stars gather around a driftwood circle. "
            "Sally the Seahorse looks like she has a story but is too shy to share."
        ),
        "choices": [
            {"id": "a", "text": "Sit next to Sally and say, \"I'd love to hear your story.\"", "wave_principle": "encourage_others",
             "character_reaction": "Sally takes a deep breath — and starts to share."},
            {"id": "b", "text": "Tell your own short story first to break the ice.", "wave_principle": "act_with_kindness",
             "character_reaction": "Sally smiles. \"That gives me an idea for mine!\""},
            {"id": "c", "text": "Ask Sally a curious question about her painting.", "wave_principle": "welcome_curiosity",
             "character_reaction": "Sally lights up. \"You really want to know?\""},
        ],
    },
    {
        "scene_number": 10,
        "title": "Saying Goodbye for the Day",
        "narrative": (
            "Camp is almost over. Ms Bluegill asks the crew to share one word "
            "about how they feel right now."
        ),
        "choices": [
            {"id": "a", "text": "Say \"curious\" — there's so much more to learn!", "wave_principle": "welcome_curiosity",
             "character_reaction": "Ms Bluegill beams. \"Curiosity keeps the cay alive.\""},
            {"id": "b", "text": "Say \"thankful\" — for new friends made today.", "wave_principle": "act_with_kindness",
             "character_reaction": "Myrtle's eyes go shiny. \"Kindness is the best souvenir.\""},
            {"id": "c", "text": "Say \"proud\" — of the whole crew for sticking together.", "wave_principle": "value_teamwork",
             "character_reaction": "The crew fin-bumps in a giant circle. Goosebumps."},
        ],
    },
    {
        "scene_number": 11,
        "title": "The W.A.V.E. Promise",
        "narrative": (
            "Tomorrow is a new day. Each Sea Star whispers a promise to the wind "
            "about how they'll be when they return."
        ),
        "choices": [
            {"id": "a", "text": "\"Tomorrow I'll ask the questions I'm too shy to ask today.\"", "wave_principle": "welcome_curiosity",
             "character_reaction": "The wind carries your promise out across the bay."},
            {"id": "b", "text": "\"Tomorrow I'll be the friend someone needs.\"", "wave_principle": "act_with_kindness",
             "character_reaction": "Myrtle nods slowly. \"That's the promise that changes everything.\""},
            {"id": "c", "text": "\"Tomorrow I'll cheer for someone before they cheer themselves.\"", "wave_principle": "encourage_others",
             "character_reaction": "Ray glides past. \"That's how big waves start — one cheer at a time.\""},
        ],
    },
    {
        "scene_number": 12,
        "title": "Your Sea Star Reveal",
        "narrative": (
            "The stars come out. Looking back on your day, you can see your own "
            "W.A.V.E. pattern — the way YOU helped make Stingray Cay shine."
        ),
        "is_finale": True,
        "choices": [
            {"id": "a", "text": "Reveal my Sea Star!", "wave_principle": "welcome_curiosity",
             "character_reaction": "The cay falls silent — your reveal is next..."},
        ],
    },
]


# ============================================================
# Additional Story Quests — 8 scenes each, narrators rotate
# ============================================================
# Each quest reuses the same intro/finale rhythm: scene 1 is the hook
# (3 choices, all valid), scenes 2-7 are the W.A.V.E. choice points,
# scene 8 is the finale reveal. Narrators are picked to match the
# story beat. Audio is generated lazily by the existing scene-audio
# script once admin flips status to ready (or via the runtime
# voice_router cache on first play).

_FINALE_CHOICE = [
    {"id": "a", "text": "Reveal my Sea Star!", "wave_principle": "welcome_curiosity",
     "character_reaction": "The cay falls silent — your reveal is next..."},
]


def _q_finale_scene(scene_number: int, title: str, narrative: str) -> dict:
    return {
        "scene_number": scene_number,
        "title": title,
        "narrative": narrative,
        "is_finale": True,
        "choices": list(_FINALE_CHOICE),
    }


# Narrator rotation per quest — one Sea Star whose voice fits the
# beat anchors each scene. Falls back to ms-bluegill if the slot is
# unset.
QUEST_NARRATORS_BY_SLUG: dict = {
    "lost-sea-glass-treasure":  {1: "ray", 2: "myrtle", 3: "casey", 4: "ms-bluegill", 5: "ray", 6: "louie", 7: "myrtle", 8: "ray"},
    "storm-at-stingray-cay":    {1: "ms-bluegill", 2: "ray", 3: "myrtle", 4: "casey", 5: "ms-bluegill", 6: "sally", 7: "myrtle", 8: "ms-bluegill"},
    "first-camp-talent-show":   {1: "louie", 2: "sally", 3: "ms-bluegill", 4: "louie", 5: "myrtle", 6: "ollie", 7: "sally", 8: "ms-bluegill"},
    "tide-pool-mystery":        {1: "casey", 2: "myrtle", 3: "casey", 4: "ms-bluegill", 5: "casey", 6: "ray", 7: "sally", 8: "casey"},
    "race-to-the-lighthouse":   {1: "ray", 2: "myrtle", 3: "ray", 4: "casey", 5: "ollie", 6: "myrtle", 7: "ray", 8: "ms-bluegill"},
    "captain-for-a-day":        {1: "ms-bluegill", 2: "ray", 3: "ms-bluegill", 4: "myrtle", 5: "casey", 6: "louie", 7: "sally", 8: "ms-bluegill"},
    "friendship-fix-it":        {1: "myrtle", 2: "frankie", 3: "billy", 4: "ms-bluegill", 5: "myrtle", 6: "ollie", 7: "myrtle", 8: "myrtle"},
    "surprise-birthday-at-camp":{1: "ollie", 2: "myrtle", 3: "louie", 4: "casey", 5: "ms-bluegill", 6: "sally", 7: "ollie", 8: "ollie"},
    "beach-cleanup-heroes":     {1: "ms-bluegill", 2: "casey", 3: "ray", 4: "myrtle", 5: "ollie", 6: "louie", 7: "sally", 8: "ms-bluegill"},
}


def _wave_choices(triplet):
    """Shorthand to build the 3-choice WAVE block used in every middle scene."""
    return [
        {"id": "a", "text": triplet[0][0], "wave_principle": "welcome_curiosity",     "character_reaction": triplet[0][1]},
        {"id": "b", "text": triplet[1][0], "wave_principle": "act_with_kindness",     "character_reaction": triplet[1][1]},
        {"id": "c", "text": triplet[2][0], "wave_principle": triplet[2][2] if len(triplet[2]) > 2 else "value_teamwork", "character_reaction": triplet[2][1]},
    ]


# Each value is a list of 8 scenes (1=intro with 3 wave-tagged choices, 2-7=choice scenes, 8=finale).
ADDITIONAL_STORY_QUESTS_SCENES: dict = {
    # ----- 2) The Lost Sea Glass Treasure -----
    "lost-sea-glass-treasure": [
        {"scene_number": 1, "title": "Ray's Empty Pocket", "is_intro": True,
         "narrative": "Ray patted his swim pocket and his face fell. \"My sea glass collection is gone!\" The pieces had stories — blue from the bay, green from the reef, frosted white from the lighthouse. The crew gathered close. Where do you start looking?",
         "choices": [
            {"id": "a", "text": "\"Tell us where each piece came from — maybe we can retrace.\"", "wave_principle": "welcome_curiosity",
             "character_reaction": "Ray's eyes light up. \"You really want to hear all of it?\" That kind of asking is the kind that finds lost things."},
            {"id": "b", "text": "Give Ray a quick hug first — he looks sad.", "wave_principle": "act_with_kindness",
             "character_reaction": "Ray squeezes back. \"I needed that. Thanks.\""},
            {"id": "c", "text": "Round up the crew so we search together.", "wave_principle": "value_teamwork",
             "character_reaction": "The crew falls in line, ready to comb the sand."},
        ]},
        {"scene_number": 2, "title": "Footprints in the Sand",
         "narrative": "Myrtle finds zigzag footprints leading toward the dunes. They could be Ray's. Or someone else's. The dunes are tall and the path is windy.",
         "choices": _wave_choices([
            ("\"Whose feet make zigzags? Let's investigate!\"", "Myrtle smiles. \"Curious is half the search.\"", "welcome_curiosity"),
            ("Carry Ray's bucket so he doesn't have to.", "Ray exhales. \"You're a good friend.\"", "act_with_kindness"),
            ("Spread out so we cover both sides of the dune.", "The crew pairs up like a real search team.", "value_teamwork"),
        ])},
        {"scene_number": 3, "title": "Casey's Tide Pool Clue",
         "narrative": "Casey is on her belly by a tide pool. \"Look — a piece of blue sea glass right here, but it's chipped.\" It looks like Ray's, but only one of many.",
         "choices": _wave_choices([
            ("\"Why is it chipped? What happened to the rest?\"", "Casey grins. \"Curiosity for the win.\"", "welcome_curiosity"),
            ("Help Casey hop out so we don't slip together.", "Casey beams. \"Steady hands — thanks.\"", "act_with_kindness"),
            ("\"Casey, will you be our scout from up high?\"", "Casey climbs a rock. \"I see something orange to the east!\"", "value_teamwork"),
        ])},
        {"scene_number": 4, "title": "Ms Bluegill's Map",
         "narrative": "Ms Bluegill unrolls a hand-drawn map of the cay. \"If you found a clue at the tide pool, the wind might have blown the rest toward the leeward side.\" Her finger traces a slow path.",
         "choices": _wave_choices([
            ("\"What's leeward mean? Can you teach us?\"", "Ms Bluegill chuckles. \"That's the question of a true sailor.\"", "welcome_curiosity"),
            ("Thank Ms Bluegill before we run off.", "Ms Bluegill's smile gets a little brighter.", "act_with_kindness"),
            ("Split the map into sections so everyone helps.", "\"Now that's a captain's plan!\" Ms Bluegill says.", "value_teamwork"),
        ])},
        {"scene_number": 5, "title": "Ray Wants to Give Up",
         "narrative": "Ray plops down on a log. \"Maybe it's just gone. Maybe the sea took it back.\" Big tears, quiet voice.",
         "choices": _wave_choices([
            ("\"Want me to keep looking with you?\"", "Ray nods. \"Yeah — with you, I do.\"", "welcome_curiosity"),
            ("Sit close. Don't say anything yet. Just be there.", "Ray leans his head on your shoulder. Sometimes that's the kindest thing.", "act_with_kindness"),
            ("\"You started this collection with friends — let's finish it with friends.\"", "Ray stands up. \"You're right. Team Ray, let's go!\"", "encourage_others"),
        ])},
        {"scene_number": 6, "title": "Louie's Tracking Beat",
         "narrative": "Louie taps a beat on a bucket. \"If we drum, we'll all stay in step — and we won't lose each other on the long path.\" It actually works.",
         "choices": _wave_choices([
            ("\"Show me how to drum like that!\"", "Louie hands you a stick. \"Curious drummers are the best drummers.\"", "welcome_curiosity"),
            ("Carry the bucket so Louie's arms don't get tired.", "Louie grins. \"That's a kindness move.\"", "act_with_kindness"),
            ("\"Everybody — keep our drummer in the middle!\"", "The crew curls protectively around Louie. That's a team.", "value_teamwork"),
        ])},
        {"scene_number": 7, "title": "The Last Pouch",
         "narrative": "Beyond a sea-grape tree, a small pouch lies in the sand — Ray's missing pouch! But it's split open, and a few pieces have rolled into the surf line. The waves are coming in fast.",
         "choices": _wave_choices([
            ("Sprint and grab as many as I can!", "You scoop, scoop, scoop. Six pieces saved.", "act_with_kindness"),
            ("Form a chain so we don't get pulled in.", "Hand to hand, the crew works like a tide-net.", "value_teamwork"),
            ("\"Ray — pick last, you choose the rescue order!\"", "Ray's smile is shaky and proud. \"Thanks for letting me lead.\"", "encourage_others"),
        ])},
        _q_finale_scene(8, "Treasure Found",
            "Ray spills the pouch onto the picnic table. Every piece is there — even the chipped blue one. He looks at you, surprised. \"You didn't just find my sea glass. You found why I keep it.\""),
    ],
    # ----- 3) Storm at Stingray Cay -----
    "storm-at-stingray-cay": [
        {"scene_number": 1, "title": "Clouds Rolling In", "is_intro": True,
         "narrative": "Ms Bluegill pointed at the sky. \"That's a fast one — half an hour, maybe less.\" The wind picked up. Towels flapped. The crew turned to you.",
         "choices": [
            {"id": "a", "text": "\"What kind of storm is it? How do we know?\"", "wave_principle": "welcome_curiosity",
             "character_reaction": "Ms Bluegill loves teaching. \"Pop quiz coming!\""},
            {"id": "b", "text": "Help Sally — she looks scared.", "wave_principle": "act_with_kindness",
             "character_reaction": "Sally squeezes your hand. \"You're brave.\""},
            {"id": "c", "text": "\"Crew — let's pack up FAST and together!\"", "wave_principle": "value_teamwork",
             "character_reaction": "Hands fly. Buckets close. The cay readies in record time."},
        ]},
        {"scene_number": 2, "title": "Ray's Surfboard", "narrative": "Ray's board is still tied to the lifeguard rail. The wind is pulling at the knot.",
         "choices": _wave_choices([("\"Show me how you tied that knot, Ray!\"", "Ray demos a quick bowline. \"Learn-as-we-go!\"", "welcome_curiosity"), ("Hold the board steady while Ray unties.", "Ray flashes a thumbs up. \"Hero move.\"", "act_with_kindness"), ("Call two more friends to help carry it inside.", "Three of you carry it like a long surfy sleigh.", "value_teamwork")])},
        {"scene_number": 3, "title": "Myrtle's Slow Pace", "narrative": "Myrtle moves at Myrtle speed. The storm doesn't care.",
         "choices": _wave_choices([("\"Myrtle, what's your strategy when you can't go fast?\"", "Myrtle smiles. \"I walk steady. Steady wins, too.\"", "welcome_curiosity"), ("Walk beside her so she's not alone.", "Myrtle's eyes get warm. \"I love a walking buddy.\"", "act_with_kindness"), ("\"Crew — slow down so we arrive together!\"", "The whole crew syncs to Myrtle's pace. Nobody left behind.", "value_teamwork")])},
        {"scene_number": 4, "title": "Casey Spots Something", "narrative": "Casey points at a small crab who's stuck in the path of a tumbling sand bucket.",
         "choices": _wave_choices([("\"Hi crab — let's see what you're up to.\"", "Casey giggles. \"Crab interview!\"", "welcome_curiosity"), ("Carefully move the crab to a safer spot.", "The crab scuttles off. Casey claps once.", "act_with_kindness"), ("\"Two hands — one on the bucket, one near the crab.\"", "You and Casey work like one careful machine.", "value_teamwork")])},
        {"scene_number": 5, "title": "Inside the Lodge", "narrative": "The first big raindrops hit the porch. Everyone is in except… is everyone in?",
         "choices": _wave_choices([("\"Let's count heads — who's our caboose?\"", "Heads count out: 1, 2… 7. We need 8.", "welcome_curiosity"), ("Stand at the door and call names so no one feels lost.", "Voices answer back from the rain. Found!", "act_with_kindness"), ("Send a buddy pair to the path to find the missing one.", "Two friends head out together, holding hands.", "value_teamwork")])},
        {"scene_number": 6, "title": "Sally Cries", "narrative": "Thunder cracks and Sally's shoulders shake.",
         "choices": _wave_choices([("\"Sally, want to tell me your storm story?\"", "Sally tells a tiny brave one. The thunder gets quieter.", "welcome_curiosity"), ("Wrap Sally in a beach blanket and sit close.", "Sally's breath slows. \"Better.\"", "act_with_kindness"), ("\"Sally — you're SO brave being here right now!\"", "Sally smiles a watery smile. \"Really?\" \"Really.\"", "encourage_others")])},
        {"scene_number": 7, "title": "The Rain Lets Up", "narrative": "Sun pokes through. Puddles everywhere. The crew sighs in relief.",
         "choices": _wave_choices([("\"Look at the rainbow! How does that even WORK?!\"", "Myrtle says, \"Curiosity after a storm is the best kind.\"", "welcome_curiosity"), ("Hand Sally the first towel.", "Sally hugs it. \"You always think of me.\"", "act_with_kindness"), ("\"Group hug — we made it together!\"", "The crew piles in. Even Ms Bluegill joins.", "value_teamwork")])},
        _q_finale_scene(8, "After the Storm",
            "Ms Bluegill sets out hot cocoa. \"Storms test the cay, but you kept the crew calm.\" She winks. \"You'd make a fine captain.\""),
    ],
    # ----- 4) First Camp Talent Show -----
    "first-camp-talent-show": [
        {"scene_number": 1, "title": "The Stage is Set", "is_intro": True,
         "narrative": "A tiny driftwood stage. Streamers. Twenty butterflies in twenty bellies. Louie was warming up his drumsticks. Sally was hiding behind the curtain. \"What kind of talent show should it be?\" Ms Bluegill asked.",
         "choices": [
            {"id": "a", "text": "\"Can we INVENT a brand-new act together?\"", "wave_principle": "welcome_curiosity", "character_reaction": "Louie's eyes light up. \"YES.\""},
            {"id": "b", "text": "Sneak backstage and tell Sally she'll be great.", "wave_principle": "act_with_kindness", "character_reaction": "Sally peeks out. \"You think so?\""},
            {"id": "c", "text": "\"Let's make a group number so nobody's alone up there.\"", "wave_principle": "value_teamwork", "character_reaction": "The crew huddles up. \"Now THAT'S a plan!\""},
        ]},
        {"scene_number": 2, "title": "Sally Wants to Hide", "narrative": "Sally is curled up small. \"I want to disappear.\"",
         "choices": _wave_choices([("\"What's the part you're most scared of?\"", "Sally whispers, \"forgetting the words.\" \"Then I'll be your reminder.\"", "welcome_curiosity"), ("Hold Sally's hand. No words needed.", "Sally squeezes back twice. Friend code.", "act_with_kindness"), ("\"What if I'm right next to you the whole song?\"", "Sally exhales. \"You'd do that?\"", "encourage_others")])},
        {"scene_number": 3, "title": "Louie's New Beat", "narrative": "Louie taught everyone a clap-stomp pattern. Some got it. Some flipped it backwards.",
         "choices": _wave_choices([("\"Wait — what if we LIKE the backwards version?\"", "Louie grins. \"Backwards is forwards if everyone's smiling.\"", "welcome_curiosity"), ("Practice extra with whoever's struggling.", "Frankie picks it up. Hi-five.", "act_with_kindness"), ("\"Front row: clap. Back row: stomp. Together we make the beat.\"", "Louie nods. \"Now THAT'S an arrangement.\"", "value_teamwork")])},
        {"scene_number": 4, "title": "Ms Bluegill's Surprise", "narrative": "Ms Bluegill held up a kazoo. \"I'd like to be in the act too — but only if everyone's okay with it.\"",
         "choices": _wave_choices([("\"YES — what part can you take?\"", "Ms Bluegill kazoos a triumphant trill.", "welcome_curiosity"), ("Hand Ms Bluegill the front mic spot.", "Ms Bluegill bows. \"That kindness will go in my journal tonight.\"", "act_with_kindness"), ("\"Counselors AND campers — equal time!\"", "Ms Bluegill clinks her kazoo to your sand-pail drum.", "value_teamwork")])},
        {"scene_number": 5, "title": "The First Mistake", "narrative": "Mid-rehearsal, Sally went the wrong way. The whole formation snarled.",
         "choices": _wave_choices([("\"Wait — that looked kinda cool actually!\"", "Louie shouts, \"KEEP THE SNARL — it's our signature move!\"", "welcome_curiosity"), ("Touch Sally's arm. \"Easy fix.\" Smile.", "Sally's shoulders drop. \"Phew.\"", "act_with_kindness"), ("Restart from the top. Everyone laughing.", "The do-over is better. Mistakes can do that.", "value_teamwork")])},
        {"scene_number": 6, "title": "Ollie's Big Cheer", "narrative": "Ollie burst into the rehearsal: \"Y'ALL ARE GONNA NAIL IT.\" Sally froze again.",
         "choices": _wave_choices([("\"Ollie — quieter cheers near Sally?\"", "Ollie cups his hands. \"Like this?\" Whisper-cheer.", "welcome_curiosity"), ("Stand between Ollie and Sally. Body-shield of love.", "Sally peeks out from behind you. Smiles a little.", "act_with_kindness"), ("\"Ollie, you've got the loudest cheer at intermission — promise?\"", "Ollie pinky-promises. He'll hold it in until the right moment.", "encourage_others")])},
        {"scene_number": 7, "title": "Showtime!", "narrative": "Lights. Audience. The opening note — a kazoo trill, exactly as planned. Then the clap-stomp.",
         "choices": _wave_choices([("Lean into the FUN — try a tiny improv move!", "The crowd HOWLS. Louie wails on the drum.", "welcome_curiosity"), ("Pass the mic line by line — everyone shines.", "Each Sea Star gets their moment.", "act_with_kindness"), ("Whisper Sally's first lyric to her — just in case.", "Sally smiles, finds her voice, and sings the rest unaided.", "encourage_others")])},
        _q_finale_scene(8, "Bow Together",
            "The curtain falls. The cay claps. Ms Bluegill wipes a kazoo-tear. \"That was the warmest stage I've ever seen — because you held it up together.\""),
    ],
    # ----- 5) Mystery of the Tide Pool -----
    "tide-pool-mystery": [
        {"scene_number": 1, "title": "Something Blue", "is_intro": True,
         "narrative": "Casey lay belly-flat at the edge of a tide pool. \"There's something blue under the kelp,\" she whispered. \"It moved.\" The crew tip-toed up.",
         "choices": [
            {"id": "a", "text": "\"Let's watch quietly for one minute — see what it does.\"", "wave_principle": "welcome_curiosity", "character_reaction": "Casey beams. \"Investigator brain — yes.\""},
            {"id": "b", "text": "Make sure nobody splashes — gentle vibes only.", "wave_principle": "act_with_kindness", "character_reaction": "The pool stays still. Whatever it is, it can feel us being kind."},
            {"id": "c", "text": "\"Casey — you lead. We'll be your back-up scientists.\"", "wave_principle": "value_teamwork", "character_reaction": "Casey blossoms. \"REALLY?\""},
        ]},
        {"scene_number": 2, "title": "It's a... Hat?", "narrative": "A little blue rim peeks above the kelp. It's a child-sized snorkel hat.",
         "choices": _wave_choices([("\"How did a HAT get all the way in there?!\"", "Casey laughs. \"That's the right question.\"", "welcome_curiosity"), ("Reach in slowly so we don't scare the tide-pool creatures.", "A tiny hermit crab waves a claw at you.", "act_with_kindness"), ("Hand it to Casey first — her discovery.", "Casey's grin is the brightest in the cay.", "value_teamwork")])},
        {"scene_number": 3, "title": "Who Lost the Hat?", "narrative": "Casey holds the hat up. \"This belongs to somebody. We should find them.\"",
         "choices": _wave_choices([("\"Where do new campers go first? Let's start there.\"", "Casey nods. \"Detective brain UNLOCKED.\"", "welcome_curiosity"), ("Carry the hat carefully — water can ruin the fabric.", "Casey approves. \"You're already a steward.\"", "act_with_kindness"), ("\"Crew, fan out and ask three campers each.\"", "The crew scatters like a friendly search team.", "value_teamwork")])},
        {"scene_number": 4, "title": "Ms Bluegill Has Records", "narrative": "Ms Bluegill flipped her camper journal. \"Three blue hats issued this week. Let me check who hasn't checked theirs in.\"",
         "choices": _wave_choices([("\"What do you write in that journal?\"", "Ms Bluegill winks. \"Wonders like yours.\"", "welcome_curiosity"), ("Wait patiently while she checks. Hand her a pencil.", "Ms Bluegill smiles. \"You'd be a great librarian.\"", "act_with_kindness"), ("\"Crew, while we wait, we'll ask the lunch line!\"", "Off you go in pairs. Efficient.", "value_teamwork")])},
        {"scene_number": 5, "title": "A Sad Camper", "narrative": "Behind the kayak shed, a small camper is crying. No hat.",
         "choices": _wave_choices([("\"Hi! Casey found something blue. Could it be yours?\"", "Their eyes go huge. \"MY HAT!!\"", "welcome_curiosity"), ("Sit down next to them first. Talk after.", "Their shoulders soften. They wipe a tear.", "act_with_kindness"), ("\"Casey — come quick! She's the owner!\"", "Casey jogs up holding the hat like a crown.", "value_teamwork")])},
        {"scene_number": 6, "title": "Ray Wants Credit", "narrative": "Ray pops over. \"I saw the hat first this morning, actually — kind of.\"",
         "choices": _wave_choices([("\"Cool! What did it look like in the morning light?\"", "Ray softens — feels heard, not corrected.", "welcome_curiosity"), ("Tell Ray: \"There's enough hat-hero credit to share.\"", "Ray's chest puffs. \"Yeah… yeah!\"", "act_with_kindness"), ("\"Casey FOUND it — let her have the cheer.\"", "Ray turns and whoops the loudest for Casey.", "encourage_others")])},
        {"scene_number": 7, "title": "Tide Pool Promise", "narrative": "Casey kneels at the tide pool again. \"I want to keep checking it every day. Want to be my partner?\"",
         "choices": _wave_choices([("\"YES. Daily wonder check!\"", "Casey makes a tiny note in her sand-journal.", "welcome_curiosity"), ("Bring snacks. Wonder is hungry work.", "Casey laughs. \"You GET me.\"", "act_with_kindness"), ("\"Let's invite a different camper every day — share the wonder.\"", "Casey's eyes shine. \"That's how a cay gets curious together.\"", "encourage_others")])},
        _q_finale_scene(8, "Curious Forever",
            "The tide pool ripples. A small fish darts. Casey holds up her sand-journal: \"Hat: returned. Wonder: forever.\" You both nod."),
    ],
    # ----- 6) Race to the Lighthouse -----
    "race-to-the-lighthouse": [
        {"scene_number": 1, "title": "On Your Marks", "is_intro": True,
         "narrative": "Ms Bluegill drew a line in the sand. \"To the lighthouse and back!\" Ray was bouncing. Sami was double-knotting his shoe. Sally hung back. The cay sun was warm.",
         "choices": [
            {"id": "a", "text": "\"What's the strategy for the path? Sand or stairs?\"", "wave_principle": "welcome_curiosity", "character_reaction": "Ray loves a tactics question. \"Stairs! Faster grip!\""},
            {"id": "b", "text": "Tie Sally's other shoe — she missed one.", "wave_principle": "act_with_kindness", "character_reaction": "Sally smiles. \"You noticed.\""},
            {"id": "c", "text": "\"Crew, let's finish together, not separate.\"", "wave_principle": "value_teamwork", "character_reaction": "Ms Bluegill nods. \"Now that's a race.\""},
        ]},
        {"scene_number": 2, "title": "Sami Slips", "narrative": "Halfway up the path, Sami slipped and skinned a knee. Ray is already at the top of the dune.",
         "choices": _wave_choices([("\"Sami, where exactly does it hurt?\"", "Sami says, \"Just my pride. And a tiny bit my knee.\"", "welcome_curiosity"), ("Sit with Sami. Race can wait.", "Sami's eyes get watery. \"Thanks.\"", "act_with_kindness"), ("Call up to Ray: \"Come back — we've got an injury!\"", "Ray slides back down without hesitating.", "value_teamwork")])},
        {"scene_number": 3, "title": "Ray's Choice", "narrative": "Ray skidded down to you both. \"I was about to WIN.\" His face was caught between glory and friend.",
         "choices": _wave_choices([("\"Tell me your win-feeling — and then we'll decide together.\"", "Ray laughs. \"It feels like fireworks.\"", "welcome_curiosity"), ("Hand Ray a water bottle. \"Drink. Think.\"", "Ray sips. The hot rush of want cools a little.", "act_with_kindness"), ("\"What if we ALL get to the top, just slower?\"", "Ray nods slowly. \"That… is a different kind of fast.\"", "value_teamwork")])},
        {"scene_number": 4, "title": "Casey's Crab Crossing", "narrative": "A line of tiny crabs marched across the path. Sami pointed: \"Don't step!\"",
         "choices": _wave_choices([("\"How many do you think there are?\"", "Casey murmurs counts. Casey is in heaven.", "welcome_curiosity"), ("Step over them carefully — every kid.", "The crabs are unbothered. Score one for kindness.", "act_with_kindness"), ("\"Hold hands — line of legs that crabs can pass under.\"", "It's silly. It works. Crabs file through.", "value_teamwork")])},
        {"scene_number": 5, "title": "Ollie's Cheer From Below", "narrative": "From the beach, Ollie's voice rang up: \"GO GO GO!\"",
         "choices": _wave_choices([("\"OLLIE — sing it with our names!\"", "Ollie boomed each name like a parade announcer.", "welcome_curiosity"), ("Wave back so Ollie knows you heard.", "Ollie's whole body wiggles in answer.", "act_with_kindness"), ("\"Sami — that's YOUR name in the cheer!\"", "Sami stands a little taller and limps less.", "encourage_others")])},
        {"scene_number": 6, "title": "Myrtle on the Stairs", "narrative": "Myrtle was on step one. Step two looked far away. \"You go ahead.\"",
         "choices": _wave_choices([("\"What's the rhythm that works for you?\"", "Myrtle taught you a 1-2-rest count. Beautiful.", "welcome_curiosity"), ("Walk one step behind Myrtle so she's not alone.", "Myrtle hums. \"Best stair partner.\"", "act_with_kindness"), ("\"Crew — Myrtle pace, all of us!\"", "The whole line slows. Together-tempo unlocked.", "value_teamwork")])},
        {"scene_number": 7, "title": "The Top", "narrative": "The lighthouse railing was warm under your hands. Sami got there. Sally got there. Myrtle got there. Ray held the door.",
         "choices": _wave_choices([("\"Whoaaa — look at the cay from up here!\"", "The crew gasps together at the blue.", "welcome_curiosity"), ("Pass around water. Tired = thirsty.", "Hands reach. Smiles flicker.", "act_with_kindness"), ("\"FIRST PLACE GOES TO… EVERYONE.\"", "The cay below claps so loud you can hear it.", "encourage_others")])},
        _q_finale_scene(8, "Race Won, Friends Kept",
            "Ms Bluegill met you at the bottom with eight medals. \"You ran the kind of race I'll remember.\" Sami hugged you. Ray hugged Sami. The cay hummed."),
    ],
    # ----- 7) Captain for a Day -----
    "captain-for-a-day": [
        {"scene_number": 1, "title": "The Captain's Hat", "is_intro": True,
         "narrative": "Ms Bluegill plopped a captain's hat on your head. \"Today, you steer.\" The whole crew waited. The hat felt enormous and also exactly right.",
         "choices": [
            {"id": "a", "text": "\"Ms Bluegill — what's the best thing about being captain?\"", "wave_principle": "welcome_curiosity", "character_reaction": "Ms Bluegill grins. \"Hearing your crew, captain.\""},
            {"id": "b", "text": "Check in with each crew member before we set out.", "wave_principle": "act_with_kindness", "character_reaction": "Each one feels seen. That's a captain's first move."},
            {"id": "c", "text": "\"Crew — what do YOU want to do today?\"", "wave_principle": "value_teamwork", "character_reaction": "Hands shoot up everywhere. So many ideas!"},
        ]},
        {"scene_number": 2, "title": "Plotting the Course", "narrative": "Ray suggested surfing. Casey wanted tide-pool research. Louie wanted a parade. Sally wanted a quiet picnic. They all looked at you.",
         "choices": _wave_choices([("\"What if today has EVERY kind of thing — a little of each?\"", "Ms Bluegill mouths, \"Captain energy.\"", "welcome_curiosity"), ("Promise each one out loud: \"Your idea will happen today.\"", "Four small fist-pumps from four happy Sea Stars.", "act_with_kindness"), ("\"Crew, vote on the ORDER together.\"", "Hands and laughs. Order set: parade → tide → surf → picnic.", "value_teamwork")])},
        {"scene_number": 3, "title": "Myrtle Pauses", "narrative": "Mid-parade, Myrtle stopped. \"I don't think I can keep up with this pace, Captain.\"",
         "choices": _wave_choices([("\"What pace IS yours, Myrtle?\"", "Myrtle says \"steady.\" \"Then steady wins.\"", "welcome_curiosity"), ("Slow the whole parade down. \"New tempo, crew!\"", "Myrtle's eyes get warm. Captain magic.", "act_with_kindness"), ("\"Myrtle — you set the beat. We'll match.\"", "Myrtle taps a slow drum. The crew syncs.", "value_teamwork")])},
        {"scene_number": 4, "title": "Casey's Tide Pool Plan", "narrative": "At the tide pool, Casey wanted to investigate alone. The crew was getting restless.",
         "choices": _wave_choices([("\"Casey — invite us in on one cool thing.\"", "Casey teaches the whole crew about anemones. Best tide-pool moment ever.", "welcome_curiosity"), ("\"Crew — five-minute silent investigation, then we share.\"", "The cay goes still. Then explodes with sharing.", "act_with_kindness"), ("Pair up the loudest kid with Casey. Watch them quiet.", "Frankie hushes to a whisper. \"Whoa.\"", "value_teamwork")])},
        {"scene_number": 5, "title": "Sally's Picnic", "narrative": "Sally laid out the blanket and froze. \"I made the menu. What if everyone hates it?\"",
         "choices": _wave_choices([("\"Walk me through your menu — I'm curious.\"", "Sally describes each item with shy pride.", "welcome_curiosity"), ("Sit down first. Say loudly: \"This looks PERFECT.\"", "Sally's worried face softens into a smile.", "act_with_kindness"), ("\"Sally, you cooked — we serve. Tell us where to start.\"", "Sally hands you the platter like a director.", "encourage_others")])},
        {"scene_number": 6, "title": "Ray's Big Surf", "narrative": "Ray bounded toward a big wave. \"CAPTAIN, can I show the crew my move?\"",
         "choices": _wave_choices([("\"What's the move called?!\"", "Ray names it: \"The Sea Star Spin.\"", "welcome_curiosity"), ("Make sure Ms Bluegill is nearby first.", "Captain instinct. Ms Bluegill nods, \"Cleared.\"", "act_with_kindness"), ("\"Crew — let's cheer Ray from the shore!\"", "Ray nails the spin. The cay goes wild.", "encourage_others")])},
        {"scene_number": 7, "title": "Returning the Hat", "narrative": "Sundown. Ms Bluegill held out her hand. \"How does it feel to give the hat back?\"",
         "choices": _wave_choices([("\"Heavy. And awesome. How do you do it every day?\"", "Ms Bluegill laughs. \"Same as you did. Listening.\"", "welcome_curiosity"), ("Tell the crew thank you, by name.", "Eight names. Eight smiles. Captain's last act.", "act_with_kindness"), ("\"I want all of us to wear it for one minute each.\"", "The hat travels around the circle. Everyone's a captain.", "encourage_others")])},
        _q_finale_scene(8, "First Mate Forever",
            "Ms Bluegill tucked the hat back on its peg. \"You weren't captain because of the hat. You were captain because of how you led.\" She winked. \"First mate for life.\""),
    ],
    # ----- 8) Friendship Fix-It -----
    "friendship-fix-it": [
        {"scene_number": 1, "title": "Lunchtime Argument", "is_intro": True,
         "narrative": "Frankie and Billy were on opposite sides of the table, arms crossed. Myrtle was already there, ready to help, but she looked over at you. \"You're better at this than you think.\"",
         "choices": [
            {"id": "a", "text": "\"Frankie, Billy — what happened? Tell me both sides.\"", "wave_principle": "welcome_curiosity", "character_reaction": "Both start talking at once. That's a start."},
            {"id": "b", "text": "Sit down BETWEEN them. \"Both of you matter to me.\"", "wave_principle": "act_with_kindness", "character_reaction": "Frankie's arms loosen by an inch. Billy's by half.", },
            {"id": "c", "text": "\"Myrtle, will you help us all listen?\"", "wave_principle": "value_teamwork", "character_reaction": "Myrtle smiles. \"That's leadership.\""},
        ]},
        {"scene_number": 2, "title": "Frankie's Story", "narrative": "Frankie's voice shook. \"Billy said my drawing was weird.\"",
         "choices": _wave_choices([("\"Tell me about the drawing — I want to see it!\"", "Frankie's face lights up despite the tears.", "welcome_curiosity"), ("\"That hurt. I'm sorry it hurt.\"", "Frankie sniffles. \"Yeah. It really did.\"", "act_with_kindness"), ("\"Billy — Frankie's saying their feelings. Just listen first.\"", "Billy's mouth closes. He nods.", "value_teamwork")])},
        {"scene_number": 3, "title": "Billy's Side", "narrative": "Billy stared at the table. \"I meant cool-weird. I always say weird when I mean cool. I don't know other words yet.\"",
         "choices": _wave_choices([("\"What's another word you'd use? Let's brainstorm.\"", "Frankie laughs. \"Funky? Awesome? Wow?\" Billy lights up.", "welcome_curiosity"), ("\"Billy, that took courage to say.\"", "Billy looks up for the first time. \"Yeah?\"", "act_with_kindness"), ("\"Frankie — does that change how it landed?\"", "Frankie nods slowly. \"Mostly.\"", "encourage_others")])},
        {"scene_number": 4, "title": "Ms Bluegill Passes By", "narrative": "Ms Bluegill paused, started to step in, then stopped. \"You've got this. Want me to stay or go?\"",
         "choices": _wave_choices([("\"Stay — but be a wall, not a fixer.\"", "Ms Bluegill takes the wall position. Just present.", "welcome_curiosity"), ("\"We're okay. We'll find you if we get stuck.\"", "Ms Bluegill walks away smiling. \"Captain energy, kid.\"", "act_with_kindness"), ("\"Stay — we might need a witness.\"", "Ms Bluegill stays quietly. Witnesses matter.", "value_teamwork")])},
        {"scene_number": 5, "title": "The Apology", "narrative": "Billy looked at Frankie. \"I'm sorry. I'll learn cool-words.\" Frankie wasn't quite ready.",
         "choices": _wave_choices([("\"Frankie — what would help you feel better?\"", "Frankie thinks. \"Maybe… see his drawings too?\"", "welcome_curiosity"), ("Tell Billy: \"That was a good apology.\"", "Billy almost cries from relief.", "act_with_kindness"), ("\"What about a drawing-trade right now?\"", "Both pull out paper. Magic.", "value_teamwork")])},
        {"scene_number": 6, "title": "Ollie Comes Cheering", "narrative": "Ollie skidded up. \"WHAT'S HAPPENING IS IT FIXED YET?!\"",
         "choices": _wave_choices([("\"Ollie — quiet mode? They're almost there.\"", "Ollie clamps his hands over his mouth. Stays.", "welcome_curiosity"), ("\"Ollie, can you cheer when it's fully fixed, not yet?\"", "Ollie nods. \"On standby!\"", "act_with_kindness"), ("\"Ollie — your moment will be HUGE. Save it!\"", "Ollie quivers with held-back cheer.", "encourage_others")])},
        {"scene_number": 7, "title": "Drawings Traded", "narrative": "Frankie's drawing and Billy's drawing sat side by side. Frankie smiled small. Billy smiled smaller. Both real.",
         "choices": _wave_choices([("\"What if we make a CRAFT TABLE every lunch?\"", "Myrtle claps. \"Now that's a tradition!\"", "welcome_curiosity"), ("Hug both of them at once.", "Three-way squish. Tears mostly dried.", "act_with_kindness"), ("\"OLLIE — NOW.\"", "Ollie EXPLODES with cheer. The lunch tent shakes.", "encourage_others")])},
        _q_finale_scene(8, "Mended",
            "Myrtle squeezes your shoulder. \"You didn't fix THEM. You held the room so they could fix each other. That's the Sea Star way.\""),
    ],
    # ----- 9) Surprise Birthday at Camp -----
    "surprise-birthday-at-camp": [
        {"scene_number": 1, "title": "Top-Secret Mission", "is_intro": True,
         "narrative": "Ollie pulled you behind the boathouse. \"It's Casey's birthday. She doesn't know we know. We have ONE HOUR.\" His grin was bigger than the moon.",
         "choices": [
            {"id": "a", "text": "\"Ollie — what does Casey LOVE love?\"", "wave_principle": "welcome_curiosity", "character_reaction": "Ollie lists: tide pools, blue, glitter, hush surprises. Notebooks fly open."},
            {"id": "b", "text": "Keep Casey busy so she doesn't notice the prep.", "wave_principle": "act_with_kindness", "character_reaction": "You can already see Casey's face when she finds out.",},
            {"id": "c", "text": "\"Crew — assign roles. Go!\"", "wave_principle": "value_teamwork", "character_reaction": "Ollie salutes. The Sea Star army mobilizes.",},
        ]},
        {"scene_number": 2, "title": "Myrtle's Cake Plan", "narrative": "Myrtle is mixing. \"Can you write the icing letters? My hands are slow today.\"",
         "choices": _wave_choices([("\"What font do you think Casey will love?\"", "Myrtle laughs. \"Wavy.\" You make every letter a wave.", "welcome_curiosity"), ("\"I've got it — you rest.\"", "Myrtle pats your back. \"Best assistant.\"", "act_with_kindness"), ("Call two crew members to help mix.", "Three sets of hands. The bowl moves fast.", "value_teamwork")])},
        {"scene_number": 3, "title": "Louie's Drum Reveal", "narrative": "Louie wants to do a drum roll for the moment. \"Do I drum quietly first or LOUD right away?\"",
         "choices": _wave_choices([("\"Quiet — then BOOM. Build it.\"", "Louie practices. The build is goose-bumpy.", "welcome_curiosity"), ("\"Whichever feels best to YOU, Louie.\"", "Louie picks his own arc. Pride in his eyes.", "act_with_kindness"), ("\"Decide together — Sally, what do YOU think?\"", "Sally whispers her vote. Louie nods solemnly.", "value_teamwork")])},
        {"scene_number": 4, "title": "Casey's Almost Caught", "narrative": "Casey is walking right toward the boathouse. ETA: 2 minutes.",
         "choices": _wave_choices([("Block her path: \"CASEY! New tide pool to investigate — RIGHT NOW!\"", "Casey's eyes saucer. She abandons her current course.", "welcome_curiosity"), ("Walk with her in the opposite direction — gentle redirect.", "She doesn't suspect a thing.", "act_with_kindness"), ("Send a runner to the boathouse: \"3-2-1 — FINISH UP!\"", "The crew goes into overdrive.", "value_teamwork")])},
        {"scene_number": 5, "title": "Ms Bluegill's Touch", "narrative": "Ms Bluegill arrives with a wrapped book. \"This was MY favorite when I was Casey's age.\"",
         "choices": _wave_choices([("\"Tell us why YOU loved it!\"", "Ms Bluegill reads the first line. The crew's eyes shine.", "welcome_curiosity"), ("Add a handmade bookmark from the crew.", "Eight signatures. Ms Bluegill tears up.", "act_with_kindness"), ("\"Open it together as a crew when she reads it later!\"", "Ms Bluegill loves the idea. Plan locked.", "value_teamwork")])},
        {"scene_number": 6, "title": "Sally's Worry", "narrative": "Sally tugs your sleeve. \"What if she doesn't like surprises?\"",
         "choices": _wave_choices([("\"What's a quiet way to surprise her, just in case?\"", "Sally has a beautiful idea — soft music first.", "welcome_curiosity"), ("\"Sally, you stay right by her side — your job is calm.\"", "Sally's chest swells. \"I can do that.\"", "act_with_kindness"), ("\"Sally — you've got the SECRET WEAPON: the calm.\"", "Sally smiles small. \"Best gift role.\"", "encourage_others")])},
        {"scene_number": 7, "title": "Surprise!", "narrative": "Casey turned the corner. Sally took her hand. Louie drummed quiet… louder… louder. Then — \"SURPRISE!\" Casey's mouth fell open.",
         "choices": _wave_choices([("\"Casey — what's your wish?\"", "Casey closes her eyes. The cay holds its breath.", "welcome_curiosity"), ("Give Casey a moment before everyone descends.", "She breathes once. Then beams.", "act_with_kindness"), ("\"Cake-cutting team — Casey picks the order!\"", "Casey directs the room like a small wonderful queen.", "encourage_others")])},
        _q_finale_scene(8, "Quietly Loud",
            "Casey hugged the book. She hugged Sally. She hugged you. \"It was the kind of surprise that didn't scare me. That's the best kind.\""),
    ],
    # ----- 10) Beach Cleanup Heroes -----
    "beach-cleanup-heroes": [
        {"scene_number": 1, "title": "The Morning Mess", "is_intro": True,
         "narrative": "The tide pulled out and the beach was… not the beach. Plastic. Tangles. A balloon string. Ms Bluegill held up a bag. \"Who's in?\"",
         "choices": [
            {"id": "a", "text": "\"Whoa — where does all this come from?\"", "wave_principle": "welcome_curiosity", "character_reaction": "Ms Bluegill smiles. \"Big questions before big work — yes.\""},
            {"id": "b", "text": "Hand out bags to anyone without one.", "wave_principle": "act_with_kindness", "character_reaction": "Hands fill up. Smiles too."},
            {"id": "c", "text": "\"Crew — divide the beach in sections!\"", "wave_principle": "value_teamwork", "character_reaction": "Eight tiny scientists with eight bags. Off you go."},
        ]},
        {"scene_number": 2, "title": "Casey's Find", "narrative": "Casey held up a six-pack ring. \"This catches turtles.\" Her face was serious.",
         "choices": _wave_choices([("\"What else does it catch? How do we cut it safely?\"", "Casey teaches the cut-the-rings rule. Big moment.", "welcome_curiosity"), ("Help Casey cut every ring before bagging it.", "Snip snip. \"Safer ocean,\" Casey says.", "act_with_kindness"), ("\"Pass anything tricky to the cutting team.\"", "Three friends form a mini-station. Efficient.", "value_teamwork")])},
        {"scene_number": 3, "title": "Ray's Speed", "narrative": "Ray was bagging twice as fast as anyone. \"I'm winning,\" he grinned.",
         "choices": _wave_choices([("\"What's your trick? Teach us!\"", "Ray slows down to show the move. Now everyone's faster.", "welcome_curiosity"), ("\"Ray — bring some of your speed to Myrtle's section.\"", "Ray jogs over without complaint. Hero move.", "act_with_kindness"), ("\"This isn't a race today — but I love your energy.\"", "Ray pauses. \"Oh. Yeah. Sorry.\" He grins. Good correction.", "encourage_others")])},
        {"scene_number": 4, "title": "Sally Stops", "narrative": "Sally found something heavy. A tangle of fishing line wrapped around a tiny bird. The bird was breathing.",
         "choices": _wave_choices([("\"Ms Bluegill — what do we DO?\"", "Ms Bluegill kneels. \"Watch and learn — gently.\"", "welcome_curiosity"), ("Sally cradles the bird. Talk to it softly.", "The bird's eyes settle. Sally is its safe place.", "act_with_kindness"), ("\"Frankie — your steady hands. Help cut.\"", "Frankie steps up. Snip. Free.", "value_teamwork")])},
        {"scene_number": 5, "title": "Ollie's Cheer", "narrative": "From a distance, Ollie boomed: \"YOU SAVED A BIRD?! HEROOOES!\"",
         "choices": _wave_choices([("\"Ollie — come SEE the bird!\"", "Ollie tip-toes up, voice in whisper mode. He gets it.", "welcome_curiosity"), ("Sally needs quiet right now. Wave Ollie over slowly.", "Ollie reads the room. Body bouncing, mouth still.", "act_with_kindness"), ("\"Sally — Ollie's cheer is FOR YOU.\"", "Sally's tiny smile says she heard it.", "encourage_others")])},
        {"scene_number": 6, "title": "Louie's Beat", "narrative": "Louie banged out a clean-up tempo on a tin can. Suddenly bag-tying was a dance.",
         "choices": _wave_choices([("\"Make the chorus 'pick-it-up, pick-it-up!'\"", "The cay sings as it cleans. Louie's face is sunshine.", "welcome_curiosity"), ("Drum with him on a second can.", "Two-can rhythm. The beach is bopping.", "act_with_kindness"), ("\"Everyone — sing on the chorus, work on the verse!\"", "Sing-along clean-up. Brilliant.", "value_teamwork")])},
        {"scene_number": 7, "title": "The Bag Count", "narrative": "Twenty bags. Twenty. The beach looked like a beach again. The crew was tired-happy.",
         "choices": _wave_choices([("\"How LONG would this have taken alone?\"", "Ms Bluegill shrugs. \"Twenty days. Twenty alone equals twenty bags now.\"", "welcome_curiosity"), ("Make sure every kid drinks water before celebrating.", "Hands reach. Tired bodies sigh.", "act_with_kindness"), ("\"Group photo — show the empty beach behind us!\"", "Click. The smile in this photo will last a long time.", "encourage_others")])},
        _q_finale_scene(8, "Heroes of the Cay",
            "Ms Bluegill pinned a tiny shell badge on each of you. \"You didn't just clean the cay — you taught it how to be cleaned. That's a hero move.\""),
    ],
}




async def _seed_story_quest(db) -> None:
    """Seed 12 Story Quest scenes with per-scene narrator voices.

    Each scene is narrated by a Sea Star whose perspective fits the moment
    (e.g. Ms Bluegill opens camp, Ray calls the crew during the big wave,
    Sally narrates the shy storytime). Pre-generated MP3s shipped in
    /app/backend/seed_assets/story_quest/ are imported into local uploads
    + persistent Object Storage on first deploy so production never has
    to call ElevenLabs for the quest.
    """
    import storage as _storage  # local import — avoids circular deps in tests
    from tts_pronunciation import phoneticize_for_tts
    model_id = os.environ.get("ELEVENLABS_MODEL_ID", "eleven_turbo_v2_5")

    voice_by_slug: dict = {}
    async for ch in db.characters.find({}, {"_id": 0, "slug": 1, "voice_id": 1}):
        if ch.get("voice_id"):
            voice_by_slug[ch["slug"]] = ch["voice_id"]

    asset_dir = os.path.join(os.path.dirname(__file__), "seed_assets", "story_quest")
    upload_dir = os.environ.get("UPLOAD_DIR", "/app/backend/uploads")
    voice_dir = os.path.join(upload_dir, "voice")
    os.makedirs(voice_dir, exist_ok=True)

    # Load committed manifest (scene_number → {cache_key, audio_filename}) so we
    # can backfill audio even if env vars/voice_ids drift and the runtime
    # cache_key no longer matches. The manifest is regenerated by the
    # generation script after every audio bake.
    manifest_path = os.path.join(asset_dir, "manifest.json")
    manifest_by_scene: dict = {}
    if os.path.exists(manifest_path):
        try:
            import json as _json
            with open(manifest_path) as _fh:
                _manifest = _json.load(_fh)
            for entry in (_manifest.get("scenes") or []):
                manifest_by_scene[int(entry["scene_number"])] = entry
            logger.info("story_quest seed: loaded manifest with %d scenes", len(manifest_by_scene))
        except Exception as exc:  # noqa: BLE001
            logger.warning("story_quest seed: manifest load failed: %s", exc)

    def _narration_audio_url(narrator_slug: str, text: str, scene_number: int = 0) -> str:
        """Resolve an audio URL for (narrator, text). Returns '' if no
        voice is available or no cached MP3 exists yet."""
        voice_id = voice_by_slug.get(narrator_slug, "")
        if not voice_id or not text:
            # Manifest fallback even when voice mapping is missing — we
            # still have a committed MP3 for this scene_number.
            entry = manifest_by_scene.get(int(scene_number)) if scene_number else None
            if entry:
                cache_key = entry["cache_key"]
                storage_name = f"voice/{cache_key}.mp3"
                local_path = os.path.join(voice_dir, f"{cache_key}.mp3")
                bundled = os.path.join(asset_dir, entry["audio_filename"])
                if not os.path.exists(local_path) and os.path.exists(bundled):
                    try:
                        data = open(bundled, "rb").read()
                        with open(local_path, "wb") as fh:
                            fh.write(data)
                        if _storage.is_enabled():
                            _storage.put_object(storage_name, data, "audio/mpeg")
                    except Exception:  # noqa: BLE001
                        return ""
                if os.path.exists(local_path):
                    return f"/api/uploads/{storage_name}"
            return ""
        # Phoneticize so 'Cay' is read as 'Key' by ElevenLabs.
        tts_text = phoneticize_for_tts(text)
        # Cache key mirrors voice_router._cache_key so the runtime endpoint
        # and the seed share a single cache entry.
        raw = f"{model_id}|{voice_id}|{tts_text.strip()}|0.45|0.85|0.35"
        cache_key = hashlib.sha256(raw.encode("utf-8")).hexdigest()
        storage_name = f"voice/{cache_key}.mp3"
        local_path = os.path.join(voice_dir, f"{cache_key}.mp3")

        # 1) Already cached locally?
        if os.path.exists(local_path):
            return f"/api/uploads/{storage_name}"
        # 2) In persistent storage?
        if _storage.is_enabled():
            fetched = _storage.get_object(storage_name)
            if fetched is not None:
                return f"/api/uploads/{storage_name}"
        # 3) Bundled MP3 ships with the deploy?
        bundled = os.path.join(asset_dir, f"{cache_key}.mp3")
        if os.path.exists(bundled):
            try:
                with open(bundled, "rb") as fh:
                    data = fh.read()
                with open(local_path, "wb") as fh:
                    fh.write(data)
                if _storage.is_enabled():
                    _storage.put_object(storage_name, data, "audio/mpeg")
            except Exception:  # noqa: BLE001
                return ""
            # Backfill the voice_cache row so admin "regenerate" is a no-op
            try:
                # We can't await here (sync helper); the upsert below in the
                # main loop will use a separate path. So we return the URL
                # and persist the cache row in the loop where db is available.
                pass
            except Exception:  # noqa: BLE001
                pass
            return f"/api/uploads/{storage_name}"
        # 4) Manifest fallback — text/env may have drifted; use committed file by scene_number.
        entry = manifest_by_scene.get(int(scene_number)) if scene_number else None
        if entry:
            cache_key2 = entry["cache_key"]
            storage_name2 = f"voice/{cache_key2}.mp3"
            local_path2 = os.path.join(voice_dir, f"{cache_key2}.mp3")
            bundled2 = os.path.join(asset_dir, entry["audio_filename"])
            if not os.path.exists(local_path2) and os.path.exists(bundled2):
                try:
                    data = open(bundled2, "rb").read()
                    with open(local_path2, "wb") as fh:
                        fh.write(data)
                    if _storage.is_enabled():
                        _storage.put_object(storage_name2, data, "audio/mpeg")
                except Exception:  # noqa: BLE001
                    return ""
            if os.path.exists(local_path2):
                logger.info("story_quest seed: used manifest fallback for scene %s", scene_number)
                return f"/api/uploads/{storage_name2}"
        return ""

    async def _record_voice_cache(narrator_slug: str, text: str) -> None:
        voice_id = voice_by_slug.get(narrator_slug, "")
        if not voice_id or not text:
            return
        tts_text = phoneticize_for_tts(text)
        raw = f"{model_id}|{voice_id}|{tts_text.strip()}|0.45|0.85|0.35"
        cache_key = hashlib.sha256(raw.encode("utf-8")).hexdigest()
        storage_name = f"voice/{cache_key}.mp3"
        local_path = os.path.join(voice_dir, f"{cache_key}.mp3")
        if not os.path.exists(local_path):
            return
        await db.voice_cache.update_one(
            {"key": cache_key},
            {"$setOnInsert": {
                "key": cache_key,
                "voice_id": voice_id,
                "text": tts_text.strip(),
                "model_id": model_id,
                "chars": len(tts_text.strip()),
                "storage_filename": storage_name,
                "created_at": _now_iso(),
            }},
            upsert=True,
        )

    # 0) Upsert the quest catalog (idempotent — preserves admin edits to status,
    # cover image, scene structure, etc.)
    quest_id_by_slug: dict = {}
    for q in STORY_QUESTS_CATALOG:
        existing_q = await db.story_quests.find_one(
            {"slug": q["slug"]},
            {"_id": 0, "id": 1, "status": 1, "hero_image_url": 1, "title": 1, "blurb": 1, "theme_color": 1, "character_focus": 1, "position": 1},
        )
        if existing_q:
            quest_id_by_slug[q["slug"]] = existing_q["id"]
            # Only insert missing fields — NEVER clobber admin edits to title,
            # blurb, hero_image_url, etc. The seed only ensures the row exists
            # and has reasonable defaults; once admin edits a field it sticks.
            patch = {"updated_at": _now_iso()}
            if not (existing_q.get("title") or "").strip():
                patch["title"] = q["title"]
            if not (existing_q.get("blurb") or "").strip():
                patch["blurb"] = q["blurb"]
            if not (existing_q.get("hero_image_url") or "").strip():
                patch["hero_image_url"] = q.get("hero_image_url", "")
            if not (existing_q.get("theme_color") or "").strip():
                patch["theme_color"] = q.get("theme_color", "#7fcfc7")
            if not (existing_q.get("character_focus") or "").strip():
                patch["character_focus"] = q.get("character_focus", "all")
            if not existing_q.get("position"):
                patch["position"] = q.get("position", 99)
            if existing_q.get("status") not in ("ready", "coming-soon"):
                patch["status"] = q.get("status", "coming-soon")
            await db.story_quests.update_one({"slug": q["slug"]}, {"$set": patch})
        else:
            new_id = str(__import__("uuid").uuid4())
            quest_id_by_slug[q["slug"]] = new_id
            await db.story_quests.insert_one({
                "id": new_id,
                "slug": q["slug"],
                "title": q["title"],
                "blurb": q["blurb"],
                "hero_image_url": q.get("hero_image_url", ""),
                "theme_color": q.get("theme_color", "#7fcfc7"),
                "character_focus": q.get("character_focus", "all"),
                "position": q.get("position", 99),
                "status": q.get("status", "coming-soon"),
                "active": True,
                "created_at": _now_iso(),
                "updated_at": _now_iso(),
            })
    first_quest_id = quest_id_by_slug.get("first-day-of-camp")

    # Backfill quest_id on any existing scenes that pre-date multi-quest support.
    if first_quest_id:
        await db.story_quest_scenes.update_many(
            {"quest_id": {"$exists": False}},
            {"$set": {"quest_id": first_quest_id, "updated_at": _now_iso()}},
        )

    # 1) Scenes — insert any missing by (quest_id, scene_number); backfill narrator + audio on existing
    for sc in STORY_QUEST_SCENES:
        scene_num = sc["scene_number"]
        narrator_slug = STORY_QUEST_NARRATORS.get(scene_num, "ms-bluegill")
        audio_url = _narration_audio_url(narrator_slug, sc["narrative"], scene_number=scene_num)
        await _record_voice_cache(narrator_slug, sc["narrative"])

        existing = await db.story_quest_scenes.find_one(
            {"scene_number": scene_num, "quest_id": first_quest_id}, {"_id": 0}
        )
        if existing:
            # Backfill narrator_slug and audio_narration_url if missing or out-of-date.
            patch: dict = {}
            if existing.get("narrator_slug") != narrator_slug:
                patch["narrator_slug"] = narrator_slug
            current_audio = existing.get("audio_narration_url") or ""
            # Backfill empty audio URLs from disk, OR update an existing voice/
            # URL that's drifted (e.g. different cache_key on this deploy).
            if audio_url and (not current_audio or current_audio.startswith("/api/uploads/voice/")):
                if current_audio != audio_url:
                    patch["audio_narration_url"] = audio_url
            if patch:
                patch["updated_at"] = _now_iso()
                await db.story_quest_scenes.update_one({"id": existing["id"]}, {"$set": patch})
            continue

        await db.story_quest_scenes.insert_one({
            "id": str(__import__("uuid").uuid4()),
            "quest_id": first_quest_id,
            "scene_number": scene_num,
            "title": sc["title"],
            "narrative": sc["narrative"],
            "background_image_url": sc.get("background_image_url", ""),
            "audio_narration_url": audio_url,
            "narrator_slug": narrator_slug,
            "choices": sc["choices"],
            "is_intro": sc.get("is_intro", False),
            "is_finale": sc.get("is_finale", False),
            "active": True,
            "created_at": _now_iso(),
            "updated_at": _now_iso(),
        })

    # 2) W.A.V.E. → character mapping
    if not await db.story_quest_settings.find_one({"_id": "character_mappings"}):
        await db.story_quest_settings.insert_one({
            "_id": "character_mappings",
            "value": {
                "welcome_curiosity": "ms-bluegill",
                "act_with_kindness": "myrtle",
                "value_teamwork": "ray",
                "encourage_others": "ollie",
            },
            "updated_at": _now_iso(),
        })

    # 3) Seed scenes for the other 9 quests (each 8 scenes) and flip them to ready.
    for quest_slug, scene_list in ADDITIONAL_STORY_QUESTS_SCENES.items():
        qid = quest_id_by_slug.get(quest_slug)
        if not qid:
            continue
        narrator_map = QUEST_NARRATORS_BY_SLUG.get(quest_slug, {})
        for sc in scene_list:
            scene_num = sc["scene_number"]
            narrator_slug = narrator_map.get(scene_num, "ms-bluegill")
            existing = await db.story_quest_scenes.find_one(
                {"quest_id": qid, "scene_number": scene_num}, {"_id": 0, "id": 1}
            )
            if existing:
                continue
            await db.story_quest_scenes.insert_one({
                "id": str(__import__("uuid").uuid4()),
                "quest_id": qid,
                "scene_number": scene_num,
                "title": sc["title"],
                "narrative": sc["narrative"],
                "background_image_url": "",
                "audio_narration_url": "",  # narration baked lazily — quiet-mode works fine until then
                "narrator_slug": narrator_slug,
                "choices": sc["choices"],
                "is_intro": sc.get("is_intro", False),
                "is_finale": sc.get("is_finale", False),
                "active": True,
                "created_at": _now_iso(),
                "updated_at": _now_iso(),
            })
        # Flip status to ready once all 8 scenes are seeded.
        await db.story_quests.update_one(
            {"id": qid, "status": {"$ne": "ready"}},
            {"$set": {"status": "ready", "updated_at": _now_iso()}},
        )

    # 4) Multi-quest manifest backfill — bake committed MP3s into every
    # quest's scenes on every startup so production deploys ship audio for
    # ALL 10 quests, not just first-day-of-camp. Idempotent: only patches
    # scenes whose audio_narration_url is empty or a /api/uploads/voice/ URL
    # that doesn't match the committed cache_key.
    try:
        import json as _json
        import shutil as _shutil
        manifest_path = os.path.join(asset_dir, "manifest.json")
        if os.path.exists(manifest_path):
            try:
                _manifest = _json.loads(open(manifest_path).read())
            except Exception as exc:  # noqa: BLE001
                logger.warning("story_quest seed: manifest parse failed: %s", exc)
                _manifest = {}
            per_quest = _manifest.get("quests") or {}
            # Legacy flat-list maps to first-day-of-camp.
            if not per_quest and _manifest.get("scenes"):
                per_quest = {"first-day-of-camp": _manifest["scenes"]}

            logger.info("story_quest seed: applying multi-quest manifest (%d quests)", len(per_quest))
            patched_count = 0
            for quest_slug, entries in per_quest.items():
                qid = quest_id_by_slug.get(quest_slug)
                if not qid:
                    continue
                for entry in entries:
                    n = int(entry["scene_number"])
                    cache_key = entry["cache_key"]
                    mp3 = os.path.join(asset_dir, entry["audio_filename"])
                    if not os.path.exists(mp3):
                        continue
                    # Copy MP3 to local uploads/voice/ if missing.
                    target = os.path.join(voice_dir, f"{cache_key}.mp3")
                    if not os.path.exists(target):
                        try:
                            with open(mp3, "rb") as fh:
                                data = fh.read()
                            with open(target, "wb") as fh:
                                fh.write(data)
                            if _storage.is_enabled():
                                _storage.put_object(f"voice/{cache_key}.mp3", data, "audio/mpeg")
                        except Exception as exc:  # noqa: BLE001
                            logger.warning("seed manifest: copy %s/%s failed: %s", quest_slug, n, exc)
                            continue
                    audio_url = f"/api/uploads/voice/{cache_key}.mp3"
                    # Only patch scenes whose audio is empty or a stale voice/ URL.
                    r = await db.story_quest_scenes.update_one(
                        {
                            "quest_id": qid, "scene_number": n,
                            "$or": [
                                {"audio_narration_url": ""},
                                {"audio_narration_url": {"$exists": False}},
                                {"audio_narration_url": {"$regex": "^/api/uploads/voice/", "$ne": audio_url}},
                            ],
                        },
                        {"$set": {
                            "audio_narration_url": audio_url,
                            "narrator_slug": entry.get("narrator_slug", "") or None,
                            "updated_at": _now_iso(),
                        }},
                    )
                    if r.modified_count:
                        patched_count += 1
            if patched_count:
                logger.info("story_quest seed: backfilled audio on %d scenes from manifest", patched_count)

            # 5) Dedupe legacy duplicate scene rows. Two strategies:
            # (a) same (quest_id, scene_number) — happens from re-runs.
            # (b) same (quest_id, narrative text) but different scene_number —
            #     happens when an old set of scenes was re-inserted with new
            #     scene_numbers while the originals were still present.
            #     This caused scene #4 to play scene #1's audio (same narrative).
            dupe_pipeline = [
                {"$group": {"_id": {"quest_id": "$quest_id", "scene_number": "$scene_number"}, "ids": {"$push": "$id"}, "count": {"$sum": 1}}},
                {"$match": {"count": {"$gt": 1}}},
            ]
            deduped = 0
            async for group in db.story_quest_scenes.aggregate(dupe_pipeline):
                ids = group["ids"]
                docs = await db.story_quest_scenes.find(
                    {"id": {"$in": ids}}, {"_id": 0, "id": 1, "audio_narration_url": 1}
                ).to_list(20)
                keep_id = next((d["id"] for d in docs if (d.get("audio_narration_url") or "").strip()), None) or docs[0]["id"]
                delete_ids = [d["id"] for d in docs if d["id"] != keep_id]
                if delete_ids:
                    r = await db.story_quest_scenes.delete_many({"id": {"$in": delete_ids}})
                    deduped += r.deleted_count

            # (b) Same narrative under different scene_numbers — keep the lowest
            # scene_number (which is the legit one from the original 8-scene seed).
            narr_pipeline = [
                {"$match": {"narrative": {"$exists": True, "$nin": ["", None]}}},
                {"$group": {
                    "_id": {"quest_id": "$quest_id", "narrative": "$narrative"},
                    "rows": {"$push": {"id": "$id", "scene_number": "$scene_number"}},
                    "count": {"$sum": 1},
                }},
                {"$match": {"count": {"$gt": 1}}},
            ]
            async for group in db.story_quest_scenes.aggregate(narr_pipeline):
                rows = sorted(group["rows"], key=lambda r: r["scene_number"])
                keep_id = rows[0]["id"]  # lowest scene_number wins
                delete_ids = [r["id"] for r in rows[1:]]
                if delete_ids:
                    r = await db.story_quest_scenes.delete_many({"id": {"$in": delete_ids}})
                    deduped += r.deleted_count
            if deduped:
                logger.info("story_quest seed: deduped %d duplicate scene rows", deduped)
    except Exception as exc:  # noqa: BLE001
        logger.warning("story_quest seed: manifest backfill failed: %s", exc)


# ============================================================
# Sing-Along seed (10 short songs kids can sing along to)
# ============================================================

SING_ALONG_SONGS = [
    {
        "slug": "catch-the-wave",
        "title": "Catch the W.A.V.E.",
        "theme": "anthem",
        "character_focus": "all",
        "lyrics": (
            "W is for Welcome — say hi, say hi!\n"
            "A is for Acting kind — try, try, try!\n"
            "V is for Value the friends by your side!\n"
            "E is Encourage with a smile so wide!\n"
            "Catch the wave, catch the wave!\n"
            "C-A-T-C-H the wave!\n"
            "Catch the wave, catch the wave!\n"
            "That's how a Sea Star be!\n"
            "Catch the wave, catch the wave!\n"
            "C-A-T-C-H the wave!\n"
            "Catch the wave, catch the wave!\n"
            "That's how a Sea Star be!"
        ),
        "music_prompt": (
            "Bright, fast, upbeat children's anthem at 128 BPM in C major. "
            "FULLY SUNG ALL THE WAY THROUGH — no instrumental gaps. "
            "Lead vocal: cheerful kid-choir, clear enunciation. "
            "Backing: hand-claps every beat, acoustic guitar strums on the down-beat, "
            "ukulele on the up-beat, snare on 2 and 4. "
            "Every line of lyrics is sung once and the chorus repeats twice. "
            "Sunny Caribbean-camp energy. Punchy, danceable."
        ),
        "duration_seconds": 45,
        "position": 1,
    },
    {
        "slug": "stingray-key-camp-song",
        "title": "Stingray Cay Camp Song",
        "theme": "camp",
        "character_focus": "ms-bluegill",
        "lyrics": (
            "Stingray, Stingray, Stingray Cay!\n"
            "We're going to camp today, hey, hey!\n"
            "Sandy toes and salty hair,\n"
            "Sea Stars meeting everywhere!\n"
            "Stingray, Stingray, Stingray Cay!\n"
            "Hooray, hooray, hooray!\n"
            "Stingray, Stingray, Stingray Cay!\n"
            "We're going to camp today!"
        ),
        "music_prompt": (
            "Marching camp-song at 120 BPM, 4/4 time. "
            "FULLY SUNG by a kids' group — every line clearly enunciated, repeated for sing-along. "
            "Backing: marching snare drum, ukulele strums, hand-claps, tambourine. "
            "Bright, beach-day, parade-down-the-pier energy. "
            "Each line repeats once. Chorus of 'Stingray, Stingray, Stingray Cay!' returns at start and end."
        ),
        "duration_seconds": 40,
        "position": 2,
    },
    {
        "slug": "myrtles-kindness-song",
        "title": "Myrtle's Kindness Song",
        "theme": "character",
        "character_focus": "myrtle",
        "lyrics": (
            "Be kind, be kind, that's Myrtle's way!\n"
            "Be kind, be kind, every day!\n"
            "Slow and steady, never rude,\n"
            "Kindness is the attitude!\n"
            "Be kind, be kind, that's Myrtle's way!\n"
            "Be kind, be kind, every day!\n"
            "Pass it on and pass it round,\n"
            "Kindness makes the world go round!\n"
            "Be kind, be kind, that's Myrtle's way!\n"
            "Be kind, be kind, every day!"
        ),
        "music_prompt": (
            "Warm, mid-tempo singalong at 110 BPM. NOT a lullaby — bouncy and bright. "
            "FULLY SUNG with a warm female lead voice + kids' choir on the chorus. "
            "Every lyric line is clearly enunciated. The 'Be kind, be kind' refrain repeats throughout. "
            "Backing: finger-picked nylon guitar, soft glockenspiel chimes, light shaker on the off-beat. "
            "Hopeful, hand-on-shoulder energy."
        ),
        "duration_seconds": 40,
        "position": 3,
    },
    {
        "slug": "rays-big-wave",
        "title": "Ray's Big Wave",
        "theme": "character",
        "character_focus": "ray",
        "lyrics": (
            "Hey-ho, big wave! Surf's up — go go go!\n"
            "Hey-ho, big wave! Hang on, here we go!\n"
            "Ray is riding, ride along!\n"
            "Sing it loud, sing it strong!\n"
            "Hey-ho, big wave! Surf's up — go go go!\n"
            "Hey-ho, big wave! Hang on, here we go!\n"
            "Catch it, ride it, never stop!\n"
            "Sea Star surfers — top to bop!\n"
            "Hey-ho, big wave! Surf's up — go go go!\n"
            "Hey-ho, big wave! Hang on, here we go!"
        ),
        "music_prompt": (
            "Fast surf-rock for kids at 140 BPM, very upbeat. "
            "FULLY SUNG ALL THE WAY THROUGH — vocals are the main element, NOT background music. "
            "Lead: a single playful boy voice for the verses + a kids' group shouting 'hey-ho!' on the chorus. "
            "Backing: twangy electric surf guitar, kick-snare, hand-claps, '60s organ. "
            "Every lyric line is sung clearly with group shouts. "
            "Pure energy, beach-bonfire vibe."
        ),
        "duration_seconds": 35,
        "position": 4,
    },
    {
        "slug": "ms-bluegills-welcome",
        "title": "Ms Bluegill's Welcome",
        "theme": "character",
        "character_focus": "ms-bluegill",
        "lyrics": (
            "Welcome, welcome, welcome to the cay!\n"
            "Welcome, welcome, glad you came today!\n"
            "Find your spot, find your crew,\n"
            "There's a wave with your name on it too!\n"
            "Welcome, welcome, welcome to the cay!\n"
            "Welcome, welcome, glad you came today!"
        ),
        "music_prompt": (
            "Cheerful welcome song at 118 BPM. NOT mellow — upbeat and inviting. "
            "FULLY SUNG by a warm older female lead voice + kid choir backing. "
            "Every lyric line enunciated clearly. The 'Welcome, welcome' refrain repeats. "
            "Backing: bright piano, brushed snare, muted trumpet, walking upright bass. "
            "Like the opening number of a great day at camp."
        ),
        "duration_seconds": 30,
        "position": 5,
    },
    {
        "slug": "caseys-curiosity",
        "title": "Casey's Curiosity",
        "theme": "character",
        "character_focus": "casey",
        "lyrics": (
            "What's that? Look here! What's that? Look there!\n"
            "Curious eyes are everywhere!\n"
            "Tide pool, sand, the bright blue sky,\n"
            "Wonder, wonder — that's how we fly!\n"
            "What's that? Look here! What's that? Look there!\n"
            "Curious eyes are everywhere!\n"
            "Ask a question, find a clue,\n"
            "Curious kids always do!\n"
            "What's that? Look here! What's that? Look there!\n"
            "Curious eyes are everywhere!"
        ),
        "music_prompt": (
            "Bouncy, fast playful tune at 132 BPM. "
            "FULLY SUNG by a curious kid-voice lead, with a kids' group answering 'Look here! Look there!' "
            "Every lyric line clearly enunciated, call-and-response style. "
            "Backing: bright xylophone, kazoo, finger-snaps, light bongo drums. "
            "Whimsical, adventurous explorer energy. No instrumental breaks longer than 2 seconds."
        ),
        "duration_seconds": 35,
        "position": 6,
    },
    {
        "slug": "louies-lunchtime-jam",
        "title": "Louie's Lunchtime Jam",
        "theme": "character",
        "character_focus": "louie",
        "lyrics": (
            "Drum on the tray, drum on the tray!\n"
            "Louie's got the beat for the cay today!\n"
            "Boom-boom-clap, give it your best!\n"
            "Everybody join in, give it a rest!\n"
            "Drum on the tray, drum on the tray!\n"
            "Louie's got the beat for the cay today!\n"
            "Bang the drums, sing the song,\n"
            "Lunchtime jamming all day long!\n"
            "Drum on the tray, drum on the tray!\n"
            "Louie's got the beat for the cay today!"
        ),
        "music_prompt": (
            "Funky kid hip-hop / drumline crossover at 124 BPM, very groovy. "
            "FULLY SUNG by a playful boy-voice lead doing call-and-response with the group. "
            "Every lyric line spoken-sung clearly. The 'Drum on the tray' refrain repeats. "
            "Backing: dominant lunchroom-tray percussion, hand-claps, deep bass, marching snare. "
            "Cafeteria-celebration vibe. No long instrumental breaks."
        ),
        "duration_seconds": 35,
        "position": 7,
    },
    {
        "slug": "sallys-quiet-song",
        "title": "Sally's Quiet Song",
        "theme": "character",
        "character_focus": "sally",
        "lyrics": (
            "Brave can be quiet, brave can be soft,\n"
            "Brave is the heart way up aloft!\n"
            "You are enough, you are enough,\n"
            "Take your time, brave is love!\n"
            "Brave can be quiet, brave can be soft,\n"
            "Brave is the heart way up aloft!\n"
            "You are enough, you are enough,\n"
            "Take your time, brave is love!"
        ),
        "music_prompt": (
            "Gentle but PACED singalong at 100 BPM — NOT a lullaby, kids should be able to sing along easily. "
            "FULLY SUNG by a soft young female voice + a small kids' choir on the repeat. "
            "Every lyric line clearly enunciated. The verse repeats twice. "
            "Backing: warm piano chords, light brushed snare, soft strings, wind chimes. "
            "Hopeful, encouraging, never sleepy."
        ),
        "duration_seconds": 35,
        "position": 8,
    },
    {
        "slug": "ollies-cheer",
        "title": "Ollie's Cheer",
        "theme": "character",
        "character_focus": "ollie",
        "lyrics": (
            "You can do it! Yes you can!\n"
            "Ollie's your biggest fan!\n"
            "Go-go-go, hey-hey-hey!\n"
            "Cheer it loud, cheer all day!\n"
            "You can do it! Yes you can!\n"
            "Ollie's your biggest fan!\n"
            "Go-go-go, hey-hey-hey!\n"
            "Cheer it loud, cheer all day!\n"
            "You can do it! Yes you can!\n"
            "Ollie's your biggest fan!"
        ),
        "music_prompt": (
            "High-energy cheer-pop at 144 BPM, EXTREMELY upbeat. "
            "FULLY SUNG by a megaphone-style group chant with a punchy boy-voice lead. "
            "Every lyric line shouted-sung clearly. 'Go-go-go, hey-hey-hey!' repeats. "
            "Backing: marching-band snare, brass horns, stadium claps, big group 'hey!' shouts. "
            "Pure pep-rally encouragement. No quiet moments, no long instrumental breaks."
        ),
        "duration_seconds": 35,
        "position": 9,
    },
    {
        "slug": "the-wave-promise",
        "title": "The W.A.V.E. Promise",
        "theme": "anthem",
        "character_focus": "all",
        "lyrics": (
            "I promise, I promise, I'll catch the wave!\n"
            "Welcome, Act, Value, Encourage — that's the way!\n"
            "I promise, I promise, I'll catch the wave!\n"
            "Sea Star me, Sea Star you, Sea Star every day!\n"
            "Welcome — Act — Value — Encourage!\n"
            "Welcome — Act — Value — Encourage!\n"
            "I promise, I promise, I'll catch the wave!\n"
            "Sea Star me, Sea Star you, Sea Star every day!"
        ),
        "music_prompt": (
            "Inspirational anthem-finale at 96 BPM — the ONE slow song. "
            "FULLY SUNG by a single child voice for the first verse, then a full kids' choir joining in for the chorus. "
            "Every lyric line clearly enunciated. The 'Welcome — Act — Value — Encourage!' line is chanted by the choir. "
            "Backing: swelling strings, piano, gentle drums building to a big finish. "
            "Emotional graduation/promise feel. Anthem closer."
        ),
        "duration_seconds": 50,
        "position": 10,
    },
    # ----- 10 more bangers (positions 11-20) -----
    {
        "slug": "splash-splash-splash",
        "title": "Splash Splash Splash",
        "theme": "party",
        "character_focus": "ray",
        "lyrics": (
            "Splash, splash, splash — jump into the bay!\n"
            "Splash, splash, splash — Sea Stars come and play!\n"
            "Cannonball, big and tall, soak the cay all day!\n"
            "Splash, splash, splash — that's how we play!\n"
            "Splash, splash, splash — jump into the bay!\n"
            "Splash, splash, splash — Sea Stars come and play!\n"
            "1-2-3 — splash with me!\n"
            "1-2-3 — splash with me!\n"
            "Splash, splash, splash — jump into the bay!\n"
            "Splash, splash, splash — best summer day!"
        ),
        "music_prompt": (
            "Fast, hype kids' party song at 138 BPM, like a pool-party banger. "
            "FULLY SUNG ALL THE WAY THROUGH — no instrumental gaps. "
            "Lead: a kid choir shouting in unison with a single playful boy lead on the verses. "
            "Backing: kick-drum on every beat, hand-claps on 2 and 4, whistles, party-blowers, surf guitar stabs, "
            "'whoo!' shouts on the chorus. "
            "Every line clearly enunciated. 'Splash, splash, splash!' chant returns 4 times. "
            "Beach-party, sprinkler-tag, cannonball energy."
        ),
        "duration_seconds": 35,
        "position": 11,
    },
    {
        "slug": "stomp-clap-cay",
        "title": "Stomp Clap Cay",
        "theme": "party",
        "character_focus": "louie",
        "lyrics": (
            "STOMP your feet — boom boom boom!\n"
            "CLAP your hands — make some room!\n"
            "Stomp clap stomp clap, find the groove!\n"
            "Stomp clap Stingray, watch us move!\n"
            "STOMP your feet — boom boom boom!\n"
            "CLAP your hands — make some room!\n"
            "Faster, faster, don't stop now!\n"
            "Faster, faster, take a bow!\n"
            "STOMP CLAP STINGRAY CAY!\n"
            "STOMP CLAP STINGRAY CAY!"
        ),
        "music_prompt": (
            "High-energy stomp-clap kids' anthem at 136 BPM (think We Will Rock You vibe but FAST and KID-friendly). "
            "FULLY SUNG ALL THE WAY THROUGH. "
            "Lead: a kid-group shouting in unison with a strong boy-lead doing the call. "
            "Backing: dominant foot-stomps on beat, big claps, drumline snare rolls, brass stabs, 'hey!' shouts. "
            "Every lyric line shouted-sung. The 'STOMP CLAP STINGRAY CAY!' refrain returns at the end. "
            "Sports-arena pep-rally energy."
        ),
        "duration_seconds": 35,
        "position": 12,
    },
    {
        "slug": "i-am-a-sea-star",
        "title": "I Am a Sea Star",
        "theme": "anthem",
        "character_focus": "all",
        "lyrics": (
            "I am a Sea Star, shining bright!\n"
            "I am a Sea Star, day and night!\n"
            "Five big arms, one big heart,\n"
            "Sea Star me — that's a start!\n"
            "I am a Sea Star, shining bright!\n"
            "I am a Sea Star, day and night!\n"
            "Stretch them out, reach them wide,\n"
            "Sea Star pride, take it in stride!\n"
            "I am a Sea Star! Yes I am!\n"
            "I am a Sea Star! Yes I am!"
        ),
        "music_prompt": (
            "Empowerment kids' pop song at 126 BPM, very upbeat and hype. "
            "FULLY SUNG by a strong kid-choir lead with individual kid solo lines on the verses. "
            "Backing: bright piano, hand-claps, snare on 2 and 4, brass horns answering the chorus, "
            "synth-pad on the bridge. Every lyric line crystal clear, easy to sing. "
            "Self-confidence-anthem feel — like the kid is suddenly five feet taller."
        ),
        "duration_seconds": 35,
        "position": 13,
    },
    {
        "slug": "sandcastle-stomp",
        "title": "Sandcastle Stomp",
        "theme": "party",
        "character_focus": "casey",
        "lyrics": (
            "Pack the sand, build it tall!\n"
            "Sandcastle stomp — don't let it fall!\n"
            "Towers, moats, and seashell doors,\n"
            "Sandcastle stomp on the sandy shores!\n"
            "Pack the sand, build it tall!\n"
            "Sandcastle stomp — don't let it fall!\n"
            "1-2-3, build with me!\n"
            "1-2-3, build with me!\n"
            "Sandcastle, sandcastle, hooray!\n"
            "Sandcastle stomp — Stingray Cay!"
        ),
        "music_prompt": (
            "Bouncy kids' marching tune at 130 BPM with stomp-clap energy. "
            "FULLY SUNG with a fun unison kid-choir lead, group shouts of '1-2-3!' on the chant. "
            "Backing: tom-tom drums on every beat, ukulele strums, hand-claps, whistles, "
            "wood-block clops. Every line repeats so kids can join in. "
            "Big-as-a-castle build-it-up energy."
        ),
        "duration_seconds": 35,
        "position": 14,
    },
    {
        "slug": "high-five-the-sky",
        "title": "High Five the Sky",
        "theme": "party",
        "character_focus": "ollie",
        "lyrics": (
            "Up, up, UP! High five the sky!\n"
            "Up, up, UP! Reach up high!\n"
            "Crew on the count of one-two-three,\n"
            "High five the sky and high five me!\n"
            "Up, up, UP! High five the sky!\n"
            "Up, up, UP! Reach up high!\n"
            "Slap your palm — boom boom boom!\n"
            "Sea Star squad in the room!\n"
            "Up, up, UP! High five the sky!\n"
            "Up, up, UP! Reach up high!"
        ),
        "music_prompt": (
            "Crowd-pumping cheer-pop at 142 BPM. EXTREMELY hype. "
            "FULLY SUNG ALL THE WAY THROUGH. "
            "Lead: a megaphone-style group chant + booming boy-voice solo. "
            "Backing: marching-band snare, big brass horns, stadium claps, kids' group 'whoo-hoo!' shouts every 4 beats. "
            "Every lyric line shouted-sung. Pep-rally, victory-lap energy."
        ),
        "duration_seconds": 35,
        "position": 15,
    },
    {
        "slug": "shake-the-shells",
        "title": "Shake the Shells",
        "theme": "party",
        "character_focus": "louie",
        "lyrics": (
            "Shake the shells, shake the shells!\n"
            "Shaka-shaka shells — feels so swell!\n"
            "Pick 'em up, shake 'em loud,\n"
            "Shake those shells with the Sea Star crowd!\n"
            "Shake the shells, shake the shells!\n"
            "Shaka-shaka shells — feels so swell!\n"
            "Side to side, up and down,\n"
            "Shake those shells all around the town!\n"
            "Shake, shake, shake, shake — shake the shells!\n"
            "Shake, shake, shake, shake — shake the shells!"
        ),
        "music_prompt": (
            "Funky maraca-driven kids' dance song at 128 BPM. "
            "FULLY SUNG ALL THE WAY THROUGH with a kid-group lead. "
            "Backing: dominant shaker percussion (egg shakers + maracas), bongo drums, "
            "bright acoustic guitar, hand-claps on every beat. "
            "Every lyric line clearly enunciated, call-and-response feel. "
            "Caribbean-dance-party, hip-shaking energy."
        ),
        "duration_seconds": 35,
        "position": 16,
    },
    {
        "slug": "race-the-tide",
        "title": "Race the Tide",
        "theme": "party",
        "character_focus": "ray",
        "lyrics": (
            "Run, run, run — race the tide!\n"
            "Run, run, run — Sea Stars glide!\n"
            "Faster than the waves can chase,\n"
            "Race the tide — first place!\n"
            "Run, run, run — race the tide!\n"
            "Run, run, run — Sea Stars glide!\n"
            "Sand below and sky above,\n"
            "Race the tide with the crew you love!\n"
            "Run-run, race-race, GO GO GO!\n"
            "Run-run, race-race, GO GO GO!"
        ),
        "music_prompt": (
            "Sprint-tempo kids' anthem at 144 BPM. Very fast, very hype. "
            "FULLY SUNG ALL THE WAY THROUGH with a kid-choir lead. "
            "Backing: galloping snare-tom drums, hand-claps, brass stabs, kids shouting 'GO GO GO!' on the breaks. "
            "Every lyric crystal clear. The 'Run, run, run' chant returns at the start and end. "
            "Track-meet, finish-line, wind-in-your-hair energy. No instrumental breaks longer than 2 seconds."
        ),
        "duration_seconds": 30,
        "position": 17,
    },
    {
        "slug": "dance-the-cay",
        "title": "Dance the Cay",
        "theme": "party",
        "character_focus": "all",
        "lyrics": (
            "Dance the cay, dance the cay!\n"
            "Move your feet the Sea Star way!\n"
            "Spin around and clap your hands,\n"
            "Dance the cay with all your friends!\n"
            "Dance the cay, dance the cay!\n"
            "Move your feet the Sea Star way!\n"
            "Wiggle, jiggle, jump, repeat,\n"
            "Dance the cay — best beat on the street!\n"
            "Dance the cay! Yeah yeah yeah!\n"
            "Dance the cay! Hey hey hey!"
        ),
        "music_prompt": (
            "Joyful kids' dance-pop at 134 BPM, like an end-of-camp dance party. "
            "FULLY SUNG ALL THE WAY THROUGH. "
            "Lead: kid-group chorus with a single playful kid voice on the verses. "
            "Backing: four-on-the-floor kick drum, hand-claps every beat, bright piano, "
            "synth-bass, brass horns answering the chorus, group shouts of 'hey hey hey!' "
            "Every lyric crystal clear. The 'Dance the cay!' refrain returns 4 times. "
            "Camp-disco, glow-stick energy."
        ),
        "duration_seconds": 35,
        "position": 18,
    },
    {
        "slug": "sea-star-power",
        "title": "Sea Star Power",
        "theme": "anthem",
        "character_focus": "all",
        "lyrics": (
            "Sea Star power! Watch me go!\n"
            "Sea Star power! Top to toe!\n"
            "Five-point arms and a heart so big,\n"
            "Sea Star power — that's our jig!\n"
            "Sea Star power! Watch me go!\n"
            "Sea Star power! Top to toe!\n"
            "S-E-A — S-T-A-R!\n"
            "Sea Star power, here we are!\n"
            "Sea Star power! Yeah yeah yeah!\n"
            "Sea Star power! Stingray Cay!"
        ),
        "music_prompt": (
            "Superhero-style kids' anthem at 132 BPM with a triumphant rising hook. "
            "FULLY SUNG ALL THE WAY THROUGH. "
            "Lead: a strong kid-choir + individual kid hero-voice on the verses. "
            "Backing: cinematic brass, snare-roll fills, hand-claps on every beat, "
            "synth-strings on the chorus, big group 'YEAH!' shouts. "
            "Every lyric line punchy and clear. The 'S-E-A — S-T-A-R!' spelled-out chant is a highlight. "
            "Cape-flying, cay-saving, hero-anthem energy."
        ),
        "duration_seconds": 35,
        "position": 19,
    },
    {
        "slug": "campfire-clap-along",
        "title": "Campfire Clap-Along",
        "theme": "camp",
        "character_focus": "ms-bluegill",
        "lyrics": (
            "Round the fire, clap along!\n"
            "Round the fire, sing this song!\n"
            "Marshmallow, marshmallow, twist and turn,\n"
            "Round the fire while the embers burn!\n"
            "Round the fire, clap along!\n"
            "Round the fire, sing this song!\n"
            "Friends on the left, friends on the right,\n"
            "Round the fire on a Stingray night!\n"
            "Round-the-fire, clap-clap-CLAP!\n"
            "Round-the-fire, clap-clap-CLAP!"
        ),
        "music_prompt": (
            "Foot-tapping campfire singalong at 124 BPM — upbeat, NOT sleepy. "
            "FULLY SUNG ALL THE WAY THROUGH by a kid-group with a warm female lead. "
            "Backing: acoustic guitar strums, hand-claps on every beat, light shaker, "
            "ukulele, soft bongo, 'la-la-la' choir on the chorus. "
            "Every lyric line clearly enunciated. The 'clap-clap-CLAP!' tag returns at the end. "
            "Roasted-marshmallow, song-around-the-fire energy — but danceable."
        ),
        "duration_seconds": 35,
        "position": 20,
    },
]


async def _seed_sing_along(db) -> None:
    """Insert any missing sing-along song stub, then backfill audio + LRC
    from committed seed_assets so production deploys ship with working
    karaoke without re-running ElevenLabs. MP3s and metadata live at
    /app/backend/seed_assets/sing_along/<slug>.{mp3,json}."""
    import json
    import shutil
    from pathlib import Path
    # Resolve relative to this file so the path is correct on any deployment
    # layout (production may run from a different working directory).
    asset_dir = Path(os.path.dirname(__file__)) / "seed_assets" / "sing_along"
    upload_dir = Path(os.environ.get("UPLOAD_DIR", "/app/backend/uploads")) / "sing_along"
    upload_dir.mkdir(parents=True, exist_ok=True)
    logger.info("sing-along seed: asset_dir=%s (exists=%s, count=%s)",
                asset_dir, asset_dir.exists(),
                len(list(asset_dir.glob("*.mp3"))) if asset_dir.exists() else 0)

    # Lazy import storage helper.
    try:
        import storage as _storage  # type: ignore
    except Exception:  # noqa: BLE001
        _storage = None

    def _hydrate_from_assets(slug: str, push_to_storage: bool):
        """Return dict of fields to backfill from disk. Only pushes to Object
        Storage when explicitly requested (i.e. on first-time backfill)."""
        mp3 = asset_dir / f"{slug}.mp3"
        meta_path = asset_dir / f"{slug}.json"
        out = {}
        if not mp3.exists():
            return out
        # Copy MP3 to local uploads if missing.
        target_mp3 = upload_dir / f"{slug}.mp3"
        if not target_mp3.exists() or target_mp3.stat().st_size != mp3.stat().st_size:
            try:
                shutil.copyfile(mp3, target_mp3)
            except Exception as exc:  # noqa: BLE001
                logger.warning("seed sing-along: copy %s failed: %s", slug, exc)
        # Push to persistent storage on first backfill so files survive redeploys.
        if push_to_storage and _storage is not None and _storage.is_enabled():
            storage_key = f"sing_along/{slug}.mp3"
            try:
                _storage.put_object(storage_key, mp3.read_bytes(), "audio/mpeg")
                logger.info("seed sing-along: pushed %s to object storage", storage_key)
            except Exception as exc:  # noqa: BLE001
                logger.warning("seed sing-along: storage put %s failed: %s", slug, exc)
        out["audio_url"] = f"/api/uploads/sing_along/{slug}.mp3"
        if meta_path.exists():
            try:
                meta = json.loads(meta_path.read_text())
                if meta.get("lyrics_lrc"):
                    out["lyrics_lrc"] = meta["lyrics_lrc"]
                if meta.get("duration_seconds"):
                    out["duration_seconds"] = int(meta["duration_seconds"])
            except Exception as exc:  # noqa: BLE001
                logger.warning("seed sing-along: meta %s parse failed: %s", slug, exc)
        return out

    for s in SING_ALONG_SONGS:
        slug = s["slug"]
        existing = await db.sing_along_songs.find_one({"slug": slug}, {"_id": 0, "id": 1, "audio_url": 1, "lyrics_lrc": 1})
        needs_backfill = (not existing) or not (existing.get("audio_url") or "").strip() or not (existing.get("lyrics_lrc") or "").strip()
        hydrate = _hydrate_from_assets(slug, push_to_storage=needs_backfill)
        if existing:
            patch = {
                "title": s["title"],
                "theme": s["theme"],
                "character_focus": s.get("character_focus", ""),
                "lyrics": s["lyrics"],
                "music_prompt": s["music_prompt"],
                "duration_seconds": s.get("duration_seconds", 0),
                "position": s.get("position", 99),
                "updated_at": _now_iso(),
            }
            # Only backfill audio/lrc if the existing doc is missing them — never clobber
            # admin-uploaded covers or admin-edited audio.
            if not (existing.get("audio_url") or "").strip() and hydrate.get("audio_url"):
                patch["audio_url"] = hydrate["audio_url"]
            if not (existing.get("lyrics_lrc") or "").strip() and hydrate.get("lyrics_lrc"):
                patch["lyrics_lrc"] = hydrate["lyrics_lrc"]
            if hydrate.get("duration_seconds"):
                patch["duration_seconds"] = hydrate["duration_seconds"]
            await db.sing_along_songs.update_one({"slug": slug}, {"$set": patch})
            continue
        await db.sing_along_songs.insert_one({
            "id": str(__import__("uuid").uuid4()),
            "slug": slug,
            "title": s["title"],
            "theme": s["theme"],
            "cover_image_url": "",
            "audio_url": hydrate.get("audio_url", ""),
            "lyrics": s["lyrics"],
            "lyrics_lrc": hydrate.get("lyrics_lrc", ""),
            "duration_seconds": hydrate.get("duration_seconds") or s.get("duration_seconds", 0),
            "character_focus": s.get("character_focus", ""),
            "music_prompt": s["music_prompt"],
            "active": True,
            "position": s.get("position", 99),
            "created_at": _now_iso(),
            "updated_at": _now_iso(),
        })

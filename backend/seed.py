"""Seed data for Myrtle and Ray site."""
from __future__ import annotations
import hashlib
import os
from datetime import datetime, timezone
import bcrypt

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


async def _seed_story_quest(db) -> None:
    # 1) Scenes — insert any missing by scene_number
    for sc in STORY_QUEST_SCENES:
        existing = await db.story_quest_scenes.find_one(
            {"scene_number": sc["scene_number"]}, {"_id": 0, "id": 1}
        )
        if existing:
            continue
        await db.story_quest_scenes.insert_one({
            "id": str(__import__("uuid").uuid4()),
            "scene_number": sc["scene_number"],
            "title": sc["title"],
            "narrative": sc["narrative"],
            "background_image_url": sc.get("background_image_url", ""),
            "audio_narration_url": sc.get("audio_narration_url", ""),
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
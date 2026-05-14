"""Seed data for Myrtle and Ray site."""
from __future__ import annotations
import os
from datetime import datetime, timezone
import bcrypt

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
    {"slug": "activity-sheets", "name": "Activity Sheets", "icon": "PencilRuler", "description": "Puzzles, mazes, and challenges for kids.", "color": "#40E0D0", "order": 2},
    {"slug": "parent-guides", "name": "Parent Guides", "icon": "BookOpen", "description": "Conversation starters and read-along tips.", "color": "#87CEEB", "order": 3},
    {"slug": "classroom-resources", "name": "Classroom and Educator Resources", "icon": "GraduationCap", "description": "Lesson plans and classroom printables.", "color": "#3CB371", "order": 4},
    {"slug": "camp-director-resources", "name": "Camp Director Resources", "icon": "Tent", "description": "Welcome packets and orientation tools.", "color": "#FFB347", "order": 5},
    {"slug": "posters-printables", "name": "Posters and Printables", "icon": "ImageIcon", "description": "Wall posters and bulletin board art.", "color": "#FF6F91", "order": 6},
    {"slug": "wave-lessons", "name": "W.A.V.E. Lessons", "icon": "Waves", "description": "Mini-lessons on the W.A.V.E. values.", "color": "#9B72CB", "order": 7},
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
        if await db.characters.find_one({"slug": ch["slug"]}):
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

    # --- Download categories ---
    for cat in DOWNLOAD_CATEGORIES:
        if not await db.download_categories.find_one({"slug": cat["slug"]}):
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

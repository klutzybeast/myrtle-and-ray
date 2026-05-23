"""Pytest suite for Sea Star Studio (iteration 14).

Reuses the same cache-seeding pattern as test_coloring.py + test_penpals.py
to avoid burning Gemini Flash, Gemini Nano Banana, and ElevenLabs credits.
Cache key: sha256('studio|<slug>|<lowercase_sanitized_letter>').
"""
import hashlib
import os
import time
import uuid

import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
if not BASE_URL:
    with open("/app/frontend/.env") as fh:
        for line in fh:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip()
                break
BASE_URL = (BASE_URL or "").rstrip("/")

ADMIN_EMAIL = "community@rollingriver.com"
ADMIN_PASSWORD = "Camp1993!"

COLORING_DIR = "/app/backend/uploads/coloring"
PENPALS_DIR = "/app/backend/uploads/penpals"

PNG_1X1 = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xf8"
    b"\xff\xff?\x00\x05\xfe\x02\xfe\xa3\xc0\xd1\xc4\x00\x00\x00\x00IEND\xaeB`\x82"
)
MP3_STUB = b"\xff\xfb\x90\x00" + b"\x00" * 256  # minimal MP3-ish header + silence


@pytest.fixture(scope="session")
def mongo_db():
    mongo_url = None
    db_name = None
    with open("/app/backend/.env") as fh:
        for line in fh:
            if line.startswith("MONGO_URL="):
                mongo_url = line.split("=", 1)[1].strip().strip('"').strip("'")
            elif line.startswith("DB_NAME="):
                db_name = line.split("=", 1)[1].strip().strip('"').strip("'")
    assert mongo_url and db_name
    return MongoClient(mongo_url)[db_name]


@pytest.fixture(scope="session")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return s


def _cache_key(character_slug: str, letter: str) -> str:
    from penpals_router import sanitize_letter
    clean = sanitize_letter(letter).strip().lower()
    return hashlib.sha256(f"studio|{character_slug}|{clean}".encode("utf-8")).hexdigest()


def _seed_studio_cache(mongo_db, character_slug: str, letter: str,
                        reply_text: str = None, scene_prompt: str = None) -> dict:
    key = _cache_key(character_slug, letter)
    os.makedirs(COLORING_DIR, exist_ok=True)
    os.makedirs(PENPALS_DIR, exist_ok=True)
    png_path = os.path.join(COLORING_DIR, f"{key}.png")
    mp3_path = os.path.join(PENPALS_DIR, f"{key}.mp3")
    if not os.path.exists(png_path):
        with open(png_path, "wb") as fh:
            fh.write(PNG_1X1)
    if not os.path.exists(mp3_path):
        with open(mp3_path, "wb") as fh:
            fh.write(MP3_STUB)
    image_url = f"/api/uploads/coloring/{key}.png"
    audio_url = f"/api/uploads/penpals/{key}.mp3"
    reply = reply_text or (
        "Hello there, my friend so true,\nI'm so glad to hear from you.\n"
        "Welcome curiosity, that's the way,\nLearn one new thing every day.\n"
        "Out at sea or on the shore,\nKindness opens every door.\n"
        "Keep on smiling, big and bright,\nWith love, Myrtle the Turtle."
    )
    scene = scene_prompt or "Myrtle the Turtle splashing in a tide pool"
    mongo_db.studio_cache.update_one(
        {"key": key},
        {"$set": {
            "key": key, "character_slug": character_slug, "reply_text": reply,
            "scene_prompt": scene, "audio_url": audio_url, "image_url": image_url,
            "created_at": "2026-01-01T00:00:00Z",
        }},
        upsert=True,
    )
    return {"key": key, "image_url": image_url, "audio_url": audio_url,
            "reply_text": reply, "scene_prompt": scene}


@pytest.fixture(autouse=True)
def cleanup_test_visitor(mongo_db):
    yield
    mongo_db.sea_star_keepsakes.delete_many({"visitor_id": {"$regex": "^TEST_"}})


# ---------------- Public settings ----------------

class TestStudioPublicSettings:
    def test_settings_no_model_leak(self):
        r = requests.get(f"{BASE_URL}/api/sea-star-studio/settings")
        assert r.status_code == 200
        data = r.json()
        assert set(data.keys()) == {"enabled", "daily_cap"}
        for forbidden in ("text_model", "image_model", "audio_enabled", "model_name"):
            assert forbidden not in data


# ---------------- Parse helper ----------------

class TestParseStudioResponse:
    def test_fallback_when_no_scene_label(self):
        from seastar_studio_router import _parse_studio_response
        reply, scene = _parse_studio_response("Just some rhyme text", "Myrtle")
        assert reply == "Just some rhyme text"
        assert "Myrtle" in scene  # sensible fallback

    def test_parses_rhyme_and_scene(self):
        from seastar_studio_router import _parse_studio_response
        raw = (
            "RHYME:\nLine one\nLine two\nLine three\nLine four\n"
            "Line five\nLine six\nLine seven\n— Myrtle\n\n"
            "SCENE: Myrtle splashing in a tide pool"
        )
        reply, scene = _parse_studio_response(raw, "Myrtle")
        assert "Line one" in reply
        assert scene == "Myrtle splashing in a tide pool"


# ---------------- Create happy path ----------------

class TestStudioCreate:
    def test_happy_path_cache_hit(self, mongo_db):
        # Pick a real character with voice_id from db
        ch = mongo_db.characters.find_one({"voice_id": {"$exists": True, "$ne": ""}})
        if not ch:
            ch = mongo_db.characters.find_one({})
        assert ch, "No characters seeded"
        slug = ch["slug"]
        letter = f"Hi there! I had a fun day at the beach {uuid.uuid4().hex[:6]}"
        seed = _seed_studio_cache(mongo_db, slug, letter)
        vid = f"TEST_{uuid.uuid4().hex[:16]}"
        t0 = time.time()
        r = requests.post(f"{BASE_URL}/api/sea-star-studio/create", json={
            "character_slug": slug, "letter": letter, "visitor_id": vid,
            "child_name": "Sam",
        }, timeout=15)
        elapsed = time.time() - t0
        assert r.status_code == 200, r.text
        body = r.json()
        assert {"id", "character_slug", "character_name", "reply_text",
                "scene_prompt", "audio_url", "image_url",
                "keepsakes_left_today"} <= set(body.keys())
        assert body["image_url"] == seed["image_url"]
        assert body["audio_url"] == seed["audio_url"]
        assert elapsed < 5, f"Cache hit too slow: {elapsed}s"
        # HEAD image
        head = requests.head(f"{BASE_URL}{body['image_url']}", timeout=10)
        assert head.status_code == 200
        assert "image/png" in head.headers.get("content-type", "")
        # HEAD audio
        head_a = requests.head(f"{BASE_URL}{body['audio_url']}", timeout=10)
        assert head_a.status_code == 200

    def test_cache_dedup_across_visitors(self, mongo_db):
        ch = mongo_db.characters.find_one({})
        slug = ch["slug"]
        letter = f"Tell me about the sand {uuid.uuid4().hex[:6]}"
        _seed_studio_cache(mongo_db, slug, letter)
        vid1 = f"TEST_{uuid.uuid4().hex[:16]}"
        vid2 = f"TEST_{uuid.uuid4().hex[:16]}"
        r1 = requests.post(f"{BASE_URL}/api/sea-star-studio/create", json={
            "character_slug": slug, "letter": letter, "visitor_id": vid1,
        }, timeout=15)
        t0 = time.time()
        r2 = requests.post(f"{BASE_URL}/api/sea-star-studio/create", json={
            "character_slug": slug, "letter": letter, "visitor_id": vid2,
        }, timeout=15)
        elapsed = time.time() - t0
        assert r1.status_code == 200 and r2.status_code == 200
        b1, b2 = r1.json(), r2.json()
        assert b1["reply_text"] == b2["reply_text"]
        assert b1["scene_prompt"] == b2["scene_prompt"]
        assert b1["audio_url"] == b2["audio_url"]
        assert b1["image_url"] == b2["image_url"]
        assert elapsed < 3, f"Cache-hit too slow: {elapsed}s"
        key = _cache_key(slug, letter)
        assert mongo_db.studio_cache.count_documents({"key": key}) == 1

    def test_rate_limit_429(self, mongo_db):
        ch = mongo_db.characters.find_one({})
        slug = ch["slug"]
        cap = requests.get(f"{BASE_URL}/api/sea-star-studio/settings").json()["daily_cap"]
        vid = f"TEST_{uuid.uuid4().hex[:16]}"
        for i in range(cap):
            letter = f"Letter number {i} hex {uuid.uuid4().hex[:6]}"
            _seed_studio_cache(mongo_db, slug, letter)
            r = requests.post(f"{BASE_URL}/api/sea-star-studio/create", json={
                "character_slug": slug, "letter": letter, "visitor_id": vid,
            }, timeout=15)
            assert r.status_code == 200, f"call {i}: {r.text}"
        letter = f"One more please {uuid.uuid4().hex[:6]}"
        _seed_studio_cache(mongo_db, slug, letter)
        r = requests.post(f"{BASE_URL}/api/sea-star-studio/create", json={
            "character_slug": slug, "letter": letter, "visitor_id": vid,
        })
        assert r.status_code == 429, r.text
        assert "tomorrow" in r.json().get("detail", "").lower()

    def test_banned_subject_gun(self, mongo_db):
        ch = mongo_db.characters.find_one({})
        r = requests.post(f"{BASE_URL}/api/sea-star-studio/create", json={
            "character_slug": ch["slug"],
            "letter": "I want to draw a gun",
            "visitor_id": f"TEST_{uuid.uuid4().hex[:16]}",
        })
        assert r.status_code == 400, r.text

    def test_banned_word_hate(self, mongo_db):
        ch = mongo_db.characters.find_one({})
        r = requests.post(f"{BASE_URL}/api/sea-star-studio/create", json={
            "character_slug": ch["slug"],
            "letter": "I hate everyone",
            "visitor_id": f"TEST_{uuid.uuid4().hex[:16]}",
        })
        assert r.status_code == 400, r.text

    def test_unknown_character_404(self):
        r = requests.post(f"{BASE_URL}/api/sea-star-studio/create", json={
            "character_slug": "not-a-real-slug-xyz",
            "letter": "Hello friend",
            "visitor_id": f"TEST_{uuid.uuid4().hex[:16]}",
        })
        assert r.status_code == 404, r.text

    def test_empty_letter_rejected(self, mongo_db):
        ch = mongo_db.characters.find_one({})
        r = requests.post(f"{BASE_URL}/api/sea-star-studio/create", json={
            "character_slug": ch["slug"],
            "letter": "   ",
            "visitor_id": f"TEST_{uuid.uuid4().hex[:16]}",
        })
        assert r.status_code in (400, 422), r.text

    def test_pii_strip(self, mongo_db):
        ch = mongo_db.characters.find_one({})
        slug = ch["slug"]
        letter = f"email me at x@y.com and call 555-555-5555 hex {uuid.uuid4().hex[:6]}"
        _seed_studio_cache(mongo_db, slug, letter)
        vid = f"TEST_{uuid.uuid4().hex[:16]}"
        r = requests.post(f"{BASE_URL}/api/sea-star-studio/create", json={
            "character_slug": slug, "letter": letter, "visitor_id": vid,
        }, timeout=15)
        assert r.status_code == 200, r.text
        stored = mongo_db.sea_star_keepsakes.find_one({"visitor_id": vid})
        assert stored is not None
        assert "[email]" in stored["letter"]
        assert "[phone]" in stored["letter"]
        assert "x@y.com" not in stored["letter"]
        assert "555-555-5555" not in stored["letter"]


# ---------------- History endpoint ----------------

class TestStudioHistory:
    def test_history_desc_excludes_deleted(self, mongo_db):
        ch = mongo_db.characters.find_one({})
        slug = ch["slug"]
        vid = f"TEST_{uuid.uuid4().hex[:16]}"
        letters = [f"first letter {uuid.uuid4().hex[:6]}",
                   f"second letter {uuid.uuid4().hex[:6]}"]
        for ltr in letters:
            _seed_studio_cache(mongo_db, slug, ltr)
            r = requests.post(f"{BASE_URL}/api/sea-star-studio/create", json={
                "character_slug": slug, "letter": ltr, "visitor_id": vid,
            }, timeout=15)
            assert r.status_code == 200
            time.sleep(0.05)
        # Soft-delete the first
        mongo_db.sea_star_keepsakes.update_many(
            {"visitor_id": vid, "letter": {"$regex": "first letter"}},
            {"$set": {"deleted": True}},
        )
        r = requests.get(f"{BASE_URL}/api/sea-star-studio/history/{vid}")
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list)
        assert all(not r_.get("deleted") for r_ in rows)
        assert all("second letter" in r_["letter"] for r_ in rows)
        if len(rows) >= 2:
            assert rows[0]["created_at"] >= rows[1]["created_at"]


# ---------------- Admin endpoints ----------------

class TestStudioAdmin:
    def test_admin_list_keepsakes(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/sea-star-studio/keepsakes")
        assert r.status_code == 200, r.text
        body = r.json()
        assert set(body.keys()) >= {"keepsakes", "total", "today"}
        assert isinstance(body["keepsakes"], list)

    def test_admin_filters(self, admin_session, mongo_db):
        ch = mongo_db.characters.find_one({})
        slug = ch["slug"]
        marker = uuid.uuid4().hex[:8]
        letter = f"distinctive filter test {marker}"
        _seed_studio_cache(mongo_db, slug, letter)
        requests.post(f"{BASE_URL}/api/sea-star-studio/create", json={
            "character_slug": slug, "letter": letter,
            "visitor_id": f"TEST_{uuid.uuid4().hex[:16]}",
        }, timeout=15)
        # character filter
        r = admin_session.get(
            f"{BASE_URL}/api/admin/sea-star-studio/keepsakes",
            params={"character": slug, "search": marker},
        )
        assert r.status_code == 200
        rows = r.json()["keepsakes"]
        assert any(marker in (row.get("letter") or "") for row in rows)

    def test_admin_soft_delete(self, admin_session, mongo_db):
        ch = mongo_db.characters.find_one({})
        slug = ch["slug"]
        letter = f"delete me please {uuid.uuid4().hex[:6]}"
        _seed_studio_cache(mongo_db, slug, letter)
        r = requests.post(f"{BASE_URL}/api/sea-star-studio/create", json={
            "character_slug": slug, "letter": letter,
            "visitor_id": f"TEST_{uuid.uuid4().hex[:16]}",
        }, timeout=15)
        assert r.status_code == 200
        kid = r.json()["id"]
        d = admin_session.delete(f"{BASE_URL}/api/admin/sea-star-studio/keepsakes/{kid}")
        assert d.status_code == 200
        row = mongo_db.sea_star_keepsakes.find_one({"id": kid})
        assert row["deleted"] is True

    def test_admin_settings_roundtrip(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/sea-star-studio/settings")
        assert r.status_code == 200
        original = r.json()
        assert {"enabled", "daily_cap", "text_model", "image_model", "audio_enabled"} <= set(original.keys())
        try:
            new_cap = (original["daily_cap"] or 3) + 1
            r = admin_session.put(
                f"{BASE_URL}/api/admin/sea-star-studio/settings",
                json={**original, "daily_cap": new_cap},
            )
            assert r.status_code == 200
            assert r.json()["daily_cap"] == new_cap
        finally:
            admin_session.put(
                f"{BASE_URL}/api/admin/sea-star-studio/settings", json=original,
            )

    def test_admin_disable_returns_503(self, admin_session, mongo_db):
        ch = mongo_db.characters.find_one({})
        slug = ch["slug"]
        original = admin_session.get(f"{BASE_URL}/api/admin/sea-star-studio/settings").json()
        try:
            admin_session.put(
                f"{BASE_URL}/api/admin/sea-star-studio/settings",
                json={**original, "enabled": False},
            )
            time.sleep(0.4)
            r = requests.post(f"{BASE_URL}/api/sea-star-studio/create", json={
                "character_slug": slug,
                "letter": "hi there",
                "visitor_id": f"TEST_{uuid.uuid4().hex[:16]}",
            })
            assert r.status_code == 503, r.text
        finally:
            admin_session.put(
                f"{BASE_URL}/api/admin/sea-star-studio/settings", json=original,
            )
        time.sleep(0.4)
        assert requests.get(f"{BASE_URL}/api/sea-star-studio/settings").json()["enabled"] is True

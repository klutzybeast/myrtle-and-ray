"""Pytest suite for Wave Pal Pen Pals (iteration 12).

Covers public + admin endpoints, rate limit, cache, PII strip, banned-word
block, disable toggle, and DB-level assertions.
"""
import os
import time
import uuid
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else None
if not BASE_URL:
    # Read frontend .env (test environment fallback)
    with open("/app/frontend/.env") as fh:
        for line in fh:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break

ADMIN_EMAIL = "community@rollingriver.com"
ADMIN_PASSWORD = "Camp1993!"


# ---------------- Fixtures ----------------

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
    assert mongo_url and db_name, "MONGO_URL/DB_NAME missing"
    client = MongoClient(mongo_url)
    return client[db_name]


@pytest.fixture(scope="session")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="session")
def char_slugs(mongo_db):
    slugs = [c["slug"] for c in mongo_db.characters.find({}, {"slug": 1, "_id": 0})]
    # Prefer "ray" / "myrtle" but fall back to whatever exists
    for s in ("ray", "myrtle"):
        if s in slugs:
            return s, slugs
    assert slugs, "No characters seeded"
    return slugs[0], slugs


@pytest.fixture(autouse=True)
def cleanup_test_visitor(mongo_db, request):
    yield
    # Remove TEST_ visitor letters between tests
    mongo_db.pen_pal_letters.delete_many({"visitor_id": {"$regex": "^TEST_"}})


# ---------------- Public endpoints ----------------

class TestPenPalsPublic:
    def test_settings_no_model_leak(self):
        r = requests.get(f"{BASE_URL}/api/pen-pals/settings")
        assert r.status_code == 200
        data = r.json()
        assert set(data.keys()) >= {"enabled", "daily_cap", "max_letter_chars"}
        assert "model_name" not in data and "model_provider" not in data

    def test_letter_happy_path(self, char_slugs):
        slug, _ = char_slugs
        vid = f"TEST_{uuid.uuid4().hex[:16]}"
        r = requests.post(f"{BASE_URL}/api/pen-pals/letter", json={
            "character_slug": slug,
            "letter": "Hi friend, I love the beach and seashells today!",
            "visitor_id": vid,
            "child_name": "Sam",
            "want_audio": False,
        }, timeout=60)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["reply_text"], "Empty reply"
        assert isinstance(body["reply_text"], str)
        assert len(body["reply_text"]) > 20
        assert "letters_left_today" in body
        assert isinstance(body["letters_left_today"], int)

    def test_empty_letter_rejected(self, char_slugs):
        slug, _ = char_slugs
        r = requests.post(f"{BASE_URL}/api/pen-pals/letter", json={
            "character_slug": slug,
            "letter": "    ",
            "visitor_id": f"TEST_{uuid.uuid4().hex[:16]}",
        })
        # pydantic min_length=1 may return 422; or sanitize-to-empty returns 400
        assert r.status_code in (400, 422), r.text

    def test_unknown_character_404(self):
        r = requests.post(f"{BASE_URL}/api/pen-pals/letter", json={
            "character_slug": "not-a-real-star",
            "letter": "Hello!",
            "visitor_id": f"TEST_{uuid.uuid4().hex[:16]}",
        })
        assert r.status_code == 404

    def test_banned_word_blocked(self, char_slugs):
        slug, _ = char_slugs
        r = requests.post(f"{BASE_URL}/api/pen-pals/letter", json={
            "character_slug": slug,
            "letter": "I hate my brother sometimes.",
            "visitor_id": f"TEST_{uuid.uuid4().hex[:16]}",
        })
        assert r.status_code == 400
        assert "kind" in r.json().get("detail", "").lower()

    def test_pii_stripped(self, char_slugs, mongo_db):
        slug, _ = char_slugs
        vid = f"TEST_{uuid.uuid4().hex[:16]}"
        r = requests.post(f"{BASE_URL}/api/pen-pals/letter", json={
            "character_slug": slug,
            "letter": "My email is kid@example.com and call 555-123-4567 at https://x.com",
            "visitor_id": vid,
            "want_audio": False,
        }, timeout=60)
        assert r.status_code == 200, r.text
        stored = mongo_db.pen_pal_letters.find_one({"visitor_id": vid})
        assert stored is not None
        letter_stored = stored["letter"]
        assert "[email]" in letter_stored
        assert "[phone]" in letter_stored
        assert "[link]" in letter_stored
        assert "kid@example.com" not in letter_stored
        assert "555-123-4567" not in letter_stored
        assert "https://x.com" not in letter_stored

    def test_cache_dedup_across_visitors(self, char_slugs, mongo_db):
        slug, _ = char_slugs
        unique_letter = f"My favorite color is azure {uuid.uuid4().hex[:6]} and I love starfish"
        vid1 = f"TEST_{uuid.uuid4().hex[:16]}"
        vid2 = f"TEST_{uuid.uuid4().hex[:16]}"

        r1 = requests.post(f"{BASE_URL}/api/pen-pals/letter", json={
            "character_slug": slug, "letter": unique_letter, "visitor_id": vid1, "want_audio": False,
        }, timeout=60)
        assert r1.status_code == 200
        reply1 = r1.json()["reply_text"]

        r2 = requests.post(f"{BASE_URL}/api/pen-pals/letter", json={
            "character_slug": slug, "letter": unique_letter, "visitor_id": vid2, "want_audio": False,
        }, timeout=60)
        assert r2.status_code == 200
        reply2 = r2.json()["reply_text"]

        assert reply1 == reply2, "Cache should return identical reply"

        # Exactly one cache row for this (char, letter)
        import hashlib
        clean = unique_letter.strip().lower()
        key = hashlib.sha256(f"penpal|{slug}|{clean}".encode("utf-8")).hexdigest()
        count = mongo_db.pen_pal_cache.count_documents({"key": key})
        assert count == 1

    def test_history_excludes_deleted_desc(self, char_slugs, mongo_db):
        slug, _ = char_slugs
        vid = f"TEST_{uuid.uuid4().hex[:16]}"
        for i in range(2):
            requests.post(f"{BASE_URL}/api/pen-pals/letter", json={
                "character_slug": slug, "letter": f"Hello number {i} and azure {uuid.uuid4().hex[:6]}",
                "visitor_id": vid, "want_audio": False,
            }, timeout=60)

        rows = mongo_db.pen_pal_letters.find({"visitor_id": vid}).sort("created_at", 1).to_list(10) if hasattr(mongo_db.pen_pal_letters.find({}), 'to_list') else list(mongo_db.pen_pal_letters.find({"visitor_id": vid}).sort("created_at", 1))
        assert len(rows) >= 2
        first_id = rows[0]["id"]
        mongo_db.pen_pal_letters.update_one({"id": first_id}, {"$set": {"deleted": True}})

        r = requests.get(f"{BASE_URL}/api/pen-pals/history/{vid}")
        assert r.status_code == 200
        history = r.json()
        ids = [h["id"] for h in history]
        assert first_id not in ids
        # Desc order: created_at decreasing
        if len(history) >= 2:
            assert history[0]["created_at"] >= history[1]["created_at"]


class TestPenPalsRateLimit:
    def test_429_after_cap(self, char_slugs):
        slug, _ = char_slugs
        # Read current cap
        s = requests.get(f"{BASE_URL}/api/pen-pals/settings").json()
        cap = s["daily_cap"]
        vid = f"TEST_{uuid.uuid4().hex[:16]}"
        for i in range(cap):
            r = requests.post(f"{BASE_URL}/api/pen-pals/letter", json={
                "character_slug": slug,
                "letter": f"Hello sea star number {i} {uuid.uuid4().hex[:6]}",
                "visitor_id": vid, "want_audio": False,
            }, timeout=60)
            assert r.status_code == 200, f"call {i} failed: {r.text}"
        # Next one over the cap
        r = requests.post(f"{BASE_URL}/api/pen-pals/letter", json={
            "character_slug": slug, "letter": "One more please!",
            "visitor_id": vid, "want_audio": False,
        }, timeout=60)
        assert r.status_code == 429
        assert "letters today" in r.json().get("detail", "").lower() or "tomorrow" in r.json().get("detail", "").lower()


# ---------------- Admin endpoints ----------------

class TestPenPalsAdmin:
    def test_admin_letters_list(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/pen-pals/letters")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "letters" in data and "total" in data and "today" in data
        assert isinstance(data["letters"], list)

    def test_admin_letters_filters(self, admin_session, char_slugs):
        slug, _ = char_slugs
        r = admin_session.get(f"{BASE_URL}/api/admin/pen-pals/letters?character={slug}")
        assert r.status_code == 200
        for l in r.json()["letters"]:
            assert l["character_slug"] == slug
        r2 = admin_session.get(f"{BASE_URL}/api/admin/pen-pals/letters?search=hello")
        assert r2.status_code == 200

    def test_admin_settings_roundtrip_and_disable(self, admin_session, char_slugs):
        slug, _ = char_slugs
        # GET
        r = admin_session.get(f"{BASE_URL}/api/admin/pen-pals/settings")
        assert r.status_code == 200
        original = r.json()
        try:
            # Disable
            r = admin_session.put(f"{BASE_URL}/api/admin/pen-pals/settings", json={**original, "enabled": False})
            assert r.status_code == 200
            assert r.json()["enabled"] is False
            # Public POST → 503
            time.sleep(0.5)
            r = requests.post(f"{BASE_URL}/api/pen-pals/letter", json={
                "character_slug": slug, "letter": "Hi!",
                "visitor_id": f"TEST_{uuid.uuid4().hex[:16]}", "want_audio": False,
            })
            assert r.status_code == 503
        finally:
            # Restore
            admin_session.put(f"{BASE_URL}/api/admin/pen-pals/settings", json={**original, "enabled": True})
        # Restored — service back up
        time.sleep(0.5)
        r = requests.get(f"{BASE_URL}/api/pen-pals/settings")
        assert r.json()["enabled"] is True

    def test_admin_soft_delete_letter(self, admin_session, char_slugs, mongo_db):
        slug, _ = char_slugs
        vid = f"TEST_{uuid.uuid4().hex[:16]}"
        r = requests.post(f"{BASE_URL}/api/pen-pals/letter", json={
            "character_slug": slug, "letter": f"Delete me please {uuid.uuid4().hex[:6]}",
            "visitor_id": vid, "want_audio": False,
        }, timeout=60)
        assert r.status_code == 200
        lid = r.json()["id"]
        d = admin_session.delete(f"{BASE_URL}/api/admin/pen-pals/letters/{lid}")
        assert d.status_code == 200
        # DB row still exists, deleted=true
        row = mongo_db.pen_pal_letters.find_one({"id": lid})
        assert row is not None
        assert row.get("deleted") is True


# ---------------- Discount picker support endpoint ----------------

class TestAdminDiscountsForPicker:
    def test_active_discounts_endpoint(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/discounts")
        assert r.status_code == 200, r.text
        rows = r.json()
        assert isinstance(rows, list)
        # Filter to active for the picker
        active = [d for d in rows if d.get("active")]
        # Don't assert >0 since admin may have none — but log
        print(f"Active discounts available: {len(active)}")

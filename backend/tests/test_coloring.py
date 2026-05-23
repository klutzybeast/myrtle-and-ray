"""Pytest suite for AI Coloring Pages (iteration 13).

Covers public + admin endpoints, rate-limit, cache, blocked subject, banned
word, PII strip, soft delete, settings round-trip + disable→503.

Strategy: We avoid burning Nano Banana credits by always seeding a cache row
+ a real PNG on disk before hitting /coloring/generate. The route's cache
path short-circuits before calling the LLM, so no credits are spent.
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
    assert mongo_url and db_name
    return MongoClient(mongo_url)[db_name]


@pytest.fixture(scope="session")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return s


def _seed_cache(mongo_db, character_slug: str, prompt: str) -> tuple[str, str]:
    """Pre-populate cache so /generate skips LLM. Returns (cache_key, url_path)."""
    clean = prompt.strip().lower()
    key = hashlib.sha256(f"coloring|{character_slug}|{clean}".encode("utf-8")).hexdigest()
    url_path = f"/api/uploads/coloring/{key}.png"
    local = os.path.join(COLORING_DIR, f"{key}.png")
    os.makedirs(COLORING_DIR, exist_ok=True)
    if not os.path.exists(local):
        # Minimal valid PNG (1x1 white) to satisfy any HEAD checks.
        png_1x1 = (
            b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
            b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xf8"
            b"\xff\xff?\x00\x05\xfe\x02\xfe\xa3\xc0\xd1\xc4\x00\x00\x00\x00IEND\xaeB`\x82"
        )
        with open(local, "wb") as fh:
            fh.write(png_1x1)
    mongo_db.coloring_cache.update_one(
        {"key": key},
        {"$set": {"key": key, "character_slug": character_slug, "prompt": prompt,
                  "image_url": url_path, "created_at": "2026-01-01T00:00:00Z"}},
        upsert=True,
    )
    return key, url_path


@pytest.fixture(autouse=True)
def cleanup_test_visitor(mongo_db):
    yield
    mongo_db.coloring_pages.delete_many({"visitor_id": {"$regex": "^TEST_"}})


# ---------------- Regression: homepage hero ----------------

class TestHomepageHeroRegression:
    def test_hero_no_test_marker(self):
        r = requests.get(f"{BASE_URL}/api/pages/homepage_hero")
        assert r.status_code == 200
        content = r.json().get("content", {})
        headline = (content.get("headline") or "").strip()
        assert headline.startswith("Myrtle and Ray"), f"Hero leaked: {headline!r}"
        assert "TEST_marker" not in headline


# ---------------- Public coloring endpoints ----------------

class TestColoringPublic:
    def test_settings_no_model_leak(self):
        r = requests.get(f"{BASE_URL}/api/coloring/settings")
        assert r.status_code == 200
        data = r.json()
        assert set(data.keys()) == {"enabled", "daily_cap", "max_prompt_chars"}
        assert "model_name" not in data

    def test_generate_happy_path_via_cache(self, mongo_db):
        prompt = "a happy whale wearing sunglasses"
        _seed_cache(mongo_db, "myrtle", prompt)
        vid = f"TEST_{uuid.uuid4().hex[:16]}"
        t0 = time.time()
        r = requests.post(f"{BASE_URL}/api/coloring/generate", json={
            "prompt": prompt, "character_slug": "myrtle", "visitor_id": vid,
        }, timeout=30)
        elapsed = time.time() - t0
        assert r.status_code == 200, r.text
        body = r.json()
        assert {"id", "image_url", "prompt", "character_name", "pages_left_today"} <= set(body.keys())
        assert body["image_url"].endswith(".png")
        assert body["character_name"] == "Myrtle the Turtle"
        # Cache-hit so should be fast
        assert elapsed < 5, f"Cache hit took {elapsed}s"
        # HEAD the image
        head = requests.head(f"{BASE_URL}{body['image_url']}", timeout=10)
        assert head.status_code == 200
        assert "image/png" in head.headers.get("content-type", "")

    def test_real_live_generation_smoke(self, mongo_db):
        """Verify the already-cached real image (built by main agent) is a
        legit >50KB PNG. Validates the production happy path without re-paying."""
        # Pick a real cached entry that was generated live earlier
        real = mongo_db.coloring_cache.find_one(
            {"image_url": {"$regex": "^/api/uploads/coloring/"}, "character_slug": {"$ne": ""}},
            sort=[("created_at", -1)],
        )
        if not real:
            pytest.skip("No live-generated image cached yet")
        head = requests.head(f"{BASE_URL}{real['image_url']}", timeout=10)
        assert head.status_code == 200
        assert "image/png" in head.headers.get("content-type", "")
        size = int(head.headers.get("content-length", "0"))
        assert size > 50_000, f"Real PNG too small ({size}B)"

    def test_cache_dedup_across_visitors(self, mongo_db):
        prompt = f"a dolphin doing a flip {uuid.uuid4().hex[:6]}"
        key, _url = _seed_cache(mongo_db, "myrtle", prompt)
        vid1 = f"TEST_{uuid.uuid4().hex[:16]}"
        vid2 = f"TEST_{uuid.uuid4().hex[:16]}"
        r1 = requests.post(f"{BASE_URL}/api/coloring/generate", json={
            "prompt": prompt, "character_slug": "myrtle", "visitor_id": vid1,
        }, timeout=15)
        t0 = time.time()
        r2 = requests.post(f"{BASE_URL}/api/coloring/generate", json={
            "prompt": prompt, "character_slug": "myrtle", "visitor_id": vid2,
        }, timeout=15)
        elapsed = time.time() - t0
        assert r1.status_code == 200 and r2.status_code == 200
        assert r1.json()["image_url"] == r2.json()["image_url"]
        assert elapsed < 3, f"Cache-hit too slow: {elapsed}s"
        count = mongo_db.coloring_cache.count_documents({"key": key})
        assert count == 1

    def test_blocked_subject_gun(self):
        r = requests.post(f"{BASE_URL}/api/coloring/generate", json={
            "prompt": "a kid holding a gun",
            "character_slug": "",
            "visitor_id": f"TEST_{uuid.uuid4().hex[:16]}",
        })
        assert r.status_code == 400
        assert "friendlier" in r.json().get("detail", "").lower()

    def test_banned_word_hate(self):
        r = requests.post(f"{BASE_URL}/api/coloring/generate", json={
            "prompt": "I hate sandcastles",
            "character_slug": "",
            "visitor_id": f"TEST_{uuid.uuid4().hex[:16]}",
        })
        assert r.status_code == 400

    def test_empty_prompt_rejected(self):
        r = requests.post(f"{BASE_URL}/api/coloring/generate", json={
            "prompt": "  ",
            "character_slug": "",
            "visitor_id": f"TEST_{uuid.uuid4().hex[:16]}",
        })
        assert r.status_code in (400, 422)

    def test_unknown_character_accepted_with_empty_name(self, mongo_db):
        prompt = f"a starfish on a rock {uuid.uuid4().hex[:6]}"
        _seed_cache(mongo_db, "not-a-real-char", prompt)
        r = requests.post(f"{BASE_URL}/api/coloring/generate", json={
            "prompt": prompt, "character_slug": "not-a-real-char",
            "visitor_id": f"TEST_{uuid.uuid4().hex[:16]}",
        }, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["character_name"] == ""

    def test_pii_stripped(self, mongo_db):
        prompt_text = f"my email is kid@x.com drawing a kite {uuid.uuid4().hex[:6]}"
        # Sanitized version becomes the cache key — seed that one
        from penpals_router import sanitize_letter
        clean = sanitize_letter(prompt_text)
        _seed_cache(mongo_db, "myrtle", clean)
        vid = f"TEST_{uuid.uuid4().hex[:16]}"
        r = requests.post(f"{BASE_URL}/api/coloring/generate", json={
            "prompt": prompt_text, "character_slug": "myrtle", "visitor_id": vid,
        }, timeout=15)
        assert r.status_code == 200, r.text
        stored = mongo_db.coloring_pages.find_one({"visitor_id": vid})
        assert stored is not None
        assert "[email]" in stored["prompt"]
        assert "kid@x.com" not in stored["prompt"]

    def test_rate_limit_429(self, mongo_db):
        cap = requests.get(f"{BASE_URL}/api/coloring/settings").json()["daily_cap"]
        vid = f"TEST_{uuid.uuid4().hex[:16]}"
        for i in range(cap):
            p = f"thing number {i} hex {uuid.uuid4().hex[:6]}"
            _seed_cache(mongo_db, "", p)
            r = requests.post(f"{BASE_URL}/api/coloring/generate", json={
                "prompt": p, "character_slug": "", "visitor_id": vid,
            }, timeout=15)
            assert r.status_code == 200, f"call {i} failed: {r.text}"
        # Next should 429
        p = f"one more please {uuid.uuid4().hex[:6]}"
        _seed_cache(mongo_db, "", p)
        r = requests.post(f"{BASE_URL}/api/coloring/generate", json={
            "prompt": p, "character_slug": "", "visitor_id": vid,
        })
        assert r.status_code == 429, r.text
        assert "tomorrow" in r.json().get("detail", "").lower()

    def test_recent_endpoint_shape(self, mongo_db):
        # Ensure at least one shared page exists
        prompt = f"a kite at the beach {uuid.uuid4().hex[:6]}"
        _seed_cache(mongo_db, "myrtle", prompt)
        requests.post(f"{BASE_URL}/api/coloring/generate", json={
            "prompt": prompt, "character_slug": "myrtle",
            "visitor_id": f"TEST_{uuid.uuid4().hex[:16]}",
        }, timeout=15)
        r = requests.get(f"{BASE_URL}/api/coloring/recent")
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list)
        if len(rows) >= 2:
            assert rows[0]["created_at"] >= rows[1]["created_at"]


# ---------------- Admin coloring endpoints ----------------

class TestColoringAdmin:
    def test_admin_pages_list(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/coloring/pages")
        assert r.status_code == 200, r.text
        body = r.json()
        assert set(body.keys()) >= {"pages", "total", "today"}
        assert isinstance(body["pages"], list)

    def test_admin_settings_roundtrip(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/coloring/settings")
        assert r.status_code == 200
        original = r.json()
        assert "enabled" in original and "daily_cap" in original
        try:
            new_cap = (original["daily_cap"] or 5) + 1
            r = admin_session.put(f"{BASE_URL}/api/admin/coloring/settings",
                                  json={**original, "daily_cap": new_cap})
            assert r.status_code == 200
            assert r.json()["daily_cap"] == new_cap
        finally:
            admin_session.put(f"{BASE_URL}/api/admin/coloring/settings", json=original)

    def test_admin_disable_returns_503(self, admin_session, mongo_db):
        r = admin_session.get(f"{BASE_URL}/api/admin/coloring/settings")
        original = r.json()
        try:
            admin_session.put(f"{BASE_URL}/api/admin/coloring/settings",
                              json={**original, "enabled": False})
            time.sleep(0.5)
            r = requests.post(f"{BASE_URL}/api/coloring/generate", json={
                "prompt": "a star", "character_slug": "",
                "visitor_id": f"TEST_{uuid.uuid4().hex[:16]}",
            })
            assert r.status_code == 503
        finally:
            admin_session.put(f"{BASE_URL}/api/admin/coloring/settings", json=original)
        time.sleep(0.5)
        assert requests.get(f"{BASE_URL}/api/coloring/settings").json()["enabled"] is True

    def test_admin_soft_delete_page(self, admin_session, mongo_db):
        prompt = f"soft delete me {uuid.uuid4().hex[:6]}"
        _seed_cache(mongo_db, "", prompt)
        r = requests.post(f"{BASE_URL}/api/coloring/generate", json={
            "prompt": prompt, "character_slug": "",
            "visitor_id": f"TEST_{uuid.uuid4().hex[:16]}",
        }, timeout=15)
        assert r.status_code == 200
        page_id = r.json()["id"]
        d = admin_session.delete(f"{BASE_URL}/api/admin/coloring/pages/{page_id}")
        assert d.status_code == 200
        row = mongo_db.coloring_pages.find_one({"id": page_id})
        assert row["deleted"] is True
        assert row["shared"] is False

    def test_admin_share_publicly_false_hides_recent(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/coloring/settings")
        original = r.json()
        try:
            admin_session.put(f"{BASE_URL}/api/admin/coloring/settings",
                              json={**original, "share_publicly": False})
            time.sleep(0.3)
            r = requests.get(f"{BASE_URL}/api/coloring/recent")
            assert r.status_code == 200
            assert r.json() == []
        finally:
            admin_session.put(f"{BASE_URL}/api/admin/coloring/settings", json=original)

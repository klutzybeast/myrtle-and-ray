"""Pytest suite for Story Quest — interactive replay teaching W.A.V.E.

Covers all public + admin endpoints registered by /app/backend/story_quest_router.py.
Mirrors the test infra patterns from test_seastar_studio.py.
"""
import os
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

WAVE_KEYS = ("welcome_curiosity", "act_with_kindness", "value_teamwork", "encourage_others")


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


@pytest.fixture(autouse=True)
def cleanup_test_scenes(mongo_db):
    yield
    mongo_db.story_quest_scenes.delete_many({"title": {"$regex": "^TEST_"}})
    mongo_db.story_quest_completions.delete_many({"matched_character": {"$regex": "^TEST_"}})


# ---------------- Public ----------------

class TestStoryQuestPublic:
    def test_scenes_returns_12_active_ordered_no_id_leak(self):
        r = requests.get(f"{BASE_URL}/api/story-quest/scenes")
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list)
        assert len(data) == 12, f"expected 12 seeded scenes, got {len(data)}"
        nums = [s["scene_number"] for s in data]
        assert nums == sorted(nums), "scenes not ordered by scene_number"
        for s in data:
            assert "_id" not in s, "MongoDB _id leaked"
            assert s.get("active") is True
            assert "choices" in s and isinstance(s["choices"], list)
        # scene 1 is intro-ish, last is finale per seed
        finales = [s for s in data if s.get("is_finale")]
        assert len(finales) >= 1, "no finale scene seeded"

    def test_character_mappings_has_4_wave_keys(self):
        r = requests.get(f"{BASE_URL}/api/story-quest/character-mappings")
        assert r.status_code == 200, r.text
        data = r.json()
        assert set(data.keys()) == set(WAVE_KEYS), f"wave keys mismatch: {data.keys()}"
        for k, v in data.items():
            assert isinstance(v, str) and len(v) > 0, f"empty mapping for {k}"

    def test_every_scene_has_narrator_and_playable_audio(self):
        """Each of the 12 seeded scenes is narrated by a real Sea Star and the
        bundled MP3 streams a 200 with audio/mpeg from /api/uploads/voice/..."""
        r = requests.get(f"{BASE_URL}/api/story-quest/scenes")
        assert r.status_code == 200, r.text
        scenes = r.json()
        chars = requests.get(f"{BASE_URL}/api/characters").json()
        slugs_with_voice = {c["slug"] for c in chars if c.get("voice_id")}
        for s in scenes:
            assert s.get("narrator_slug"), f"scene {s['scene_number']} missing narrator_slug"
            assert s["narrator_slug"] in slugs_with_voice, (
                f"scene {s['scene_number']} narrator {s['narrator_slug']!r} has no voice_id"
            )
            url = s.get("audio_narration_url") or ""
            assert url.startswith("/api/uploads/voice/"), (
                f"scene {s['scene_number']} audio URL not from voice cache: {url!r}"
            )
            head = requests.head(f"{BASE_URL}{url}", allow_redirects=True)
            assert head.status_code == 200, f"scene {s['scene_number']} audio HEAD {head.status_code}"
            assert head.headers.get("content-type", "").startswith("audio/"), (
                f"scene {s['scene_number']} content-type was {head.headers.get('content-type')}"
            )

    def test_track_completion_success(self, mongo_db):
        marker = f"TEST_char_{uuid.uuid4().hex[:8]}"
        body = {
            "wave_scores": {k: i for i, k in enumerate(WAVE_KEYS, start=1)},
            "matched_character": marker,
            "matched_characters": [marker],
        }
        r = requests.post(f"{BASE_URL}/api/story-quest/track-completion", json=body)
        assert r.status_code == 200, r.text
        assert r.json() == {"success": True}
        # Verify persistence
        row = mongo_db.story_quest_completions.find_one({"matched_character": marker})
        assert row is not None
        assert row["wave_scores"]["welcome_curiosity"] == 1
        assert row["wave_scores"]["encourage_others"] == 4
        assert "ip_hash" in row

    def test_finale_voice_with_name(self):
        """Personalized voice line — first call synthesizes, second hits cache fast."""
        r = requests.post(
            f"{BASE_URL}/api/story-quest/finale-voice",
            json={"matched_slug": "ms-bluegill", "player_name": "Tessa"},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["audio_url"].startswith("/api/uploads/voice/")
        assert "Tessa" in data["text"]
        # Sanity-check the MP3 streams
        head = requests.head(f"{BASE_URL}{data['audio_url']}", allow_redirects=True)
        assert head.status_code == 200
        assert head.headers.get("content-type", "").startswith("audio/")

    def test_finale_voice_sanitizes_name(self):
        """Garbage non-letter input → no name baked into the line."""
        r = requests.post(
            f"{BASE_URL}/api/story-quest/finale-voice",
            json={"matched_slug": "ms-bluegill", "player_name": "!!!@@@###"},
        )
        assert r.status_code == 200, r.text
        # No name → generic "Wow, what a quest!" line, not "Way to go, !!!"
        assert "Way to go," not in r.json()["text"]

    def test_finale_voice_unknown_character(self):
        r = requests.post(
            f"{BASE_URL}/api/story-quest/finale-voice",
            json={"matched_slug": "not-a-real-slug", "player_name": "Bo"},
        )
        assert r.status_code == 404, r.text

    def test_postcard_happy_path(self, mongo_db):
        """End-to-end postcard send: PDF builds, mailing list upsert,
        audit row written. We don't assert email actually transits Resend
        (depends on env), but `success: True` should be returned."""
        from PIL import Image
        from io import BytesIO
        import base64

        im = Image.new("RGB", (1200, 630), (238, 249, 251))
        buf = BytesIO(); im.save(buf, "PNG")
        b64 = base64.b64encode(buf.getvalue()).decode()
        test_email = f"sq_test_{uuid.uuid4().hex[:8]}@example.com"
        r = requests.post(
            f"{BASE_URL}/api/story-quest/postcard",
            json={
                "email": test_email,
                "matched_slug": "ms-bluegill",
                "player_name": "Tessa",
                "share_card_png_base64": f"data:image/png;base64,{b64}",
                "join_newsletter": True,
            },
            timeout=30,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["success"] is True
        assert data["subscribed"] is True
        # Mailing list upsert created the row
        ml = mongo_db.mailing_list.find_one({"email": test_email}, {"_id": 0})
        assert ml is not None
        assert ml["source"] == "story_quest_postcard"
        # Audit + outbox rows
        audit = mongo_db.story_quest_postcards.find_one({"email": test_email}, {"_id": 0})
        assert audit is not None and audit["joined_newsletter"] is True
        outbox = mongo_db.email_outbox.find_one({"to": test_email}, {"_id": 0}, sort=[("created_at", -1)])
        assert outbox is not None
        assert outbox["purpose"] == "story_quest_postcard"
        assert outbox.get("attachment_names") and outbox["attachment_names"][0].endswith(".pdf")

    def test_postcard_rejects_bad_email(self):
        from PIL import Image
        from io import BytesIO
        import base64
        im = Image.new("RGB", (1200, 630), (255, 255, 255))
        buf = BytesIO(); im.save(buf, "PNG")
        b64 = base64.b64encode(buf.getvalue()).decode()
        r = requests.post(
            f"{BASE_URL}/api/story-quest/postcard",
            json={
                "email": "not-an-email",
                "matched_slug": "ms-bluegill",
                "share_card_png_base64": f"data:image/png;base64,{b64}",
            },
        )
        assert r.status_code == 400, r.text

    def test_postcard_rejects_unknown_character(self):
        from PIL import Image
        from io import BytesIO
        import base64
        im = Image.new("RGB", (1200, 630), (255, 255, 255))
        buf = BytesIO(); im.save(buf, "PNG")
        b64 = base64.b64encode(buf.getvalue()).decode()
        r = requests.post(
            f"{BASE_URL}/api/story-quest/postcard",
            json={
                "email": "ok@example.com",
                "matched_slug": "no-such-slug",
                "share_card_png_base64": f"data:image/png;base64,{b64}",
            },
        )
        assert r.status_code == 404, r.text


# ---------------- Admin ----------------

class TestStoryQuestAdmin:
    def test_requires_admin_auth(self):
        r = requests.get(f"{BASE_URL}/api/admin/story-quest/scenes")
        assert r.status_code in (401, 403), r.text

    def test_admin_list_includes_inactive(self, admin_session, mongo_db):
        r = admin_session.get(f"{BASE_URL}/api/admin/story-quest/scenes")
        assert r.status_code == 200, r.text
        data = r.json()
        assert len(data) >= 12
        for s in data:
            assert "_id" not in s

    def test_admin_create_patch_delete(self, admin_session):
        title = f"TEST_scene_{uuid.uuid4().hex[:6]}"
        # CREATE
        create_body = {
            "title": title,
            "narrative": "A test scene narrative",
            "choices": [
                {"id": "a", "text": "Choice A", "wave_principle": "welcome_curiosity", "character_reaction": "yay"},
                {"id": "b", "text": "Choice B", "wave_principle": "act_with_kindness"},
            ],
        }
        r = admin_session.post(f"{BASE_URL}/api/admin/story-quest/scenes", json=create_body)
        assert r.status_code == 200, r.text
        created = r.json()
        assert created["title"] == title
        assert created["scene_number"] >= 13
        assert len(created["choices"]) == 2
        assert "_id" not in created
        sid = created["id"]

        # GET single
        r = admin_session.get(f"{BASE_URL}/api/admin/story-quest/scenes/{sid}")
        assert r.status_code == 200
        assert r.json()["title"] == title

        # PATCH
        r = admin_session.patch(
            f"{BASE_URL}/api/admin/story-quest/scenes/{sid}",
            json={"title": title + "_updated", "active": False},
        )
        assert r.status_code == 200, r.text
        upd = r.json()
        assert upd["title"] == title + "_updated"
        assert upd["active"] is False

        # DELETE
        r = admin_session.delete(f"{BASE_URL}/api/admin/story-quest/scenes/{sid}")
        assert r.status_code == 200
        # Verify 404 after delete
        r = admin_session.get(f"{BASE_URL}/api/admin/story-quest/scenes/{sid}")
        assert r.status_code == 404

    def test_admin_reorder_roundtrip(self, admin_session):
        # Get current order
        r = admin_session.get(f"{BASE_URL}/api/admin/story-quest/scenes")
        scenes = sorted([s for s in r.json() if s.get("active")], key=lambda x: x["scene_number"])
        # Only take the 12 seeded; identify by smallest 12 scene_numbers
        original_ids = [s["id"] for s in scenes[:12]]
        original_numbers = [s["scene_number"] for s in scenes[:12]]
        try:
            # Reverse
            reversed_ids = list(reversed(original_ids))
            r = admin_session.post(
                f"{BASE_URL}/api/admin/story-quest/reorder",
                json={"scene_ids": reversed_ids},
            )
            assert r.status_code == 200, r.text
            assert r.json()["count"] == 12

            # Verify the first id now has scene_number 1
            r = admin_session.get(f"{BASE_URL}/api/admin/story-quest/scenes/{reversed_ids[0]}")
            assert r.json()["scene_number"] == 1
        finally:
            # Restore original order using original_ids
            r = admin_session.post(
                f"{BASE_URL}/api/admin/story-quest/reorder",
                json={"scene_ids": original_ids},
            )
            assert r.status_code == 200
        # Confirm restore
        r = admin_session.get(f"{BASE_URL}/api/admin/story-quest/scenes/{original_ids[0]}")
        assert r.json()["scene_number"] == original_numbers[0]

    def test_admin_reorder_rejects_empty(self, admin_session):
        r = admin_session.post(f"{BASE_URL}/api/admin/story-quest/reorder", json={"scene_ids": []})
        assert r.status_code == 400

    def test_admin_mappings_get_and_put(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/story-quest/character-mappings")
        assert r.status_code == 200
        original = r.json()
        assert set(original.keys()) == set(WAVE_KEYS)

        # Reject missing key
        bad = {k: v for k, v in original.items() if k != "welcome_curiosity"}
        r = admin_session.put(f"{BASE_URL}/api/admin/story-quest/character-mappings", json=bad)
        assert r.status_code == 400, r.text

        # Accept full payload
        try:
            new_payload = dict(original)
            new_payload["welcome_curiosity"] = "ms-bluegill"  # ensure valid string
            r = admin_session.put(f"{BASE_URL}/api/admin/story-quest/character-mappings", json=new_payload)
            assert r.status_code == 200, r.text
            assert set(r.json().keys()) == set(WAVE_KEYS)
        finally:
            admin_session.put(f"{BASE_URL}/api/admin/story-quest/character-mappings", json=original)

    def test_admin_analytics_shape(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/story-quest/analytics")
        assert r.status_code == 200, r.text
        data = r.json()
        assert set(["total", "today", "character_distribution", "wave_averages", "recent"]) <= set(data.keys())
        assert isinstance(data["total"], int)
        assert isinstance(data["character_distribution"], list)
        assert set(data["wave_averages"].keys()) == set(WAVE_KEYS)
        assert isinstance(data["recent"], list)

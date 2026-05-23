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

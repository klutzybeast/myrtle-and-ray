"""Tests for new features in iteration 5:
- Activity LEVELS for all 8 games (data.levels array with correct counts)
- /api/site exposes ambient_audio_url
- Admin can PUT activity content with new levels (persists)
- Admin can PUT settings.ambient_audio_url (persists & surfaces in /api/site)
"""
from __future__ import annotations
import os
import uuid
import pytest
import requests


def _load_backend_url() -> str:
    url = os.environ.get("REACT_APP_BACKEND_URL", "").strip()
    if not url:
        try:
            with open("/app/frontend/.env", "r") as f:
                for line in f:
                    if line.startswith("REACT_APP_BACKEND_URL="):
                        url = line.split("=", 1)[1].strip().strip('"').strip("'")
                        break
        except Exception:
            pass
    return url.rstrip("/")


BASE_URL = _load_backend_url()
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "community@rollingriver.com"
ADMIN_PASSWORD = "Camp1993!"


# ---------- fixtures ----------
@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_client(client):
    r = client.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text}")
    token = r.json()["access_token"]
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {token}"})
    return s


# ---------- activity levels ----------
EXPECTED_LEVELS = {
    "maze": 4,
    "word_search": 3,
    "memory_match": 3,
    "rhyme_time": 3,
    "quiz": 2,
    "coloring": 2,
    "spot_difference": 2,
    "sticker_beach": 3,
}


class TestActivityLevels:
    @pytest.mark.parametrize("key,expected_count", list(EXPECTED_LEVELS.items()))
    def test_activity_returns_levels(self, client, key, expected_count):
        r = client.get(f"{API}/activities/{key}")
        assert r.status_code == 200, f"{key}: {r.text}"
        d = r.json()
        assert "_id" not in d
        levels = (d.get("data") or {}).get("levels")
        assert isinstance(levels, list), f"{key} missing data.levels list"
        assert len(levels) == expected_count, (
            f"{key} expected {expected_count} levels, got {len(levels)}"
        )
        # each level has some identifier
        for i, lv in enumerate(levels):
            assert isinstance(lv, dict), f"{key}[{i}] not a dict"

    def test_maze_level_sizes(self, client):
        r = client.get(f"{API}/activities/maze")
        levels = r.json()["data"]["levels"]
        sizes = [lv.get("size") or lv.get("grid") or lv.get("dimension") or lv.get("width") for lv in levels]
        # Expected 8, 12, 16, 20
        assert 8 in sizes and 12 in sizes and 16 in sizes and 20 in sizes, (
            f"Maze levels should include sizes 8/12/16/20, got: {sizes}"
        )


# ---------- site config exposes ambient_audio_url ----------
class TestSiteAmbientAudio:
    def test_site_includes_ambient_audio_url(self, client):
        r = client.get(f"{API}/site")
        assert r.status_code == 200
        d = r.json()
        assert "ambient_audio_url" in d
        # default may be empty string
        assert isinstance(d["ambient_audio_url"], str)


# ---------- admin can update levels ----------
class TestAdminUpdateLevels:
    def test_put_activity_content_with_levels(self, admin_client, client):
        key = "quiz"
        # Fetch current
        cur = client.get(f"{API}/activities/{key}").json()
        original_levels = cur["data"]["levels"]

        # Build new levels payload preserving structure
        new_levels = [
            {**lv, "title": f"TEST_{lv.get('title','L')}_{uuid.uuid4().hex[:4]}"}
            for lv in original_levels
        ]
        new_data = {**cur["data"], "levels": new_levels}

        r = admin_client.put(
            f"{API}/admin/activity-content/{key}",
            json={"title": cur["title"], "data": new_data},
        )
        assert r.status_code == 200, r.text

        # Re-read public endpoint
        re = client.get(f"{API}/activities/{key}").json()
        re_levels = re["data"]["levels"]
        assert len(re_levels) == len(new_levels)
        assert [l["title"] for l in re_levels] == [l["title"] for l in new_levels]

        # Restore original (cleanup)
        admin_client.put(
            f"{API}/admin/activity-content/{key}",
            json={"title": cur["title"], "data": cur["data"]},
        )


# ---------- admin settings ambient_audio_url persists ----------
class TestAmbientAudioSettings:
    def test_put_ambient_audio_url_persists(self, admin_client, client):
        # Get current settings to restore later
        cur_site = client.get(f"{API}/site").json()
        original_url = cur_site.get("ambient_audio_url", "")

        test_url = f"https://example.com/test-ambient-{uuid.uuid4().hex[:6]}.mp3"
        r = admin_client.put(
            f"{API}/admin/settings",
            json={"ambient_audio_url": test_url},
        )
        assert r.status_code == 200, r.text

        # Surface in /api/site
        site = client.get(f"{API}/site").json()
        assert site.get("ambient_audio_url") == test_url

        # Restore
        admin_client.put(f"{API}/admin/settings", json={"ambient_audio_url": original_url})
        site2 = client.get(f"{API}/site").json()
        assert site2.get("ambient_audio_url") == original_url

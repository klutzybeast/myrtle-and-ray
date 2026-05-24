"""
Iteration 16 — Sing-Along admin features + Story Quest hero_image_url tests.
Covers:
  - Public /api/sing-along/songs returns 20 songs all with audio_url + lyrics_lrc
  - Admin auth via /api/auth/login (community@rollingriver.com / Camp1993!)
  - Admin Sing-Along CRUD: list, patch, create, delete
  - Story Quest admin: GET /api/admin/story-quest/quests (10 quests with hero_image_url) + PATCH
  - regenerate-alignment endpoint reachable (succeeds, or returns 400 for missing mp3)
  - Skipping POST /api/admin/sing-along/generate (cost + slow)
"""

import os
import uuid
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback: read frontend/.env
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                    break
    except Exception:
        pass

ADMIN_EMAIL = "community@rollingriver.com"
ADMIN_PASSWORD = "Camp1993!"


@pytest.fixture(scope="session")
def admin_session():
    s = requests.Session()
    r = s.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=20,
    )
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("access_token") or data.get("token")
    if token:
        s.headers.update({"Authorization": f"Bearer {token}"})
    return s


# ---------------- Public sing-along ----------------
def test_public_sing_along_returns_20_songs_with_audio_and_lrc():
    r = requests.get(f"{BASE_URL}/api/sing-along/songs", timeout=20)
    assert r.status_code == 200, r.text
    songs = r.json()
    assert isinstance(songs, list)
    assert len(songs) == 20, f"expected 20 public songs, got {len(songs)}"
    missing_audio = [s.get("slug") for s in songs if not s.get("audio_url")]
    missing_lrc = [s.get("slug") for s in songs if not s.get("lyrics_lrc")]
    assert not missing_audio, f"songs missing audio_url: {missing_audio}"
    assert not missing_lrc, f"songs missing lyrics_lrc: {missing_lrc}"


# ---------------- Admin auth ----------------
def test_admin_login_returns_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=20,
    )
    assert r.status_code == 200
    j = r.json()
    assert (j.get("access_token") or j.get("token")), f"no token in {j}"


# ---------------- Admin Sing-Along ----------------
def test_admin_list_sing_along_songs(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/admin/sing-along/songs", timeout=20)
    assert r.status_code == 200, r.text
    songs = r.json()
    assert isinstance(songs, list)
    assert len(songs) >= 20, f"expected at least 20 songs, got {len(songs)}"


def test_admin_patch_song_theme(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/admin/sing-along/songs", timeout=20)
    songs = r.json()
    target = songs[0]
    original_theme = target.get("theme", "")
    new_theme = f"TEST_theme_{uuid.uuid4().hex[:6]}"
    pr = admin_session.patch(
        f"{BASE_URL}/api/admin/sing-along/songs/{target['id']}",
        json={"theme": new_theme},
        timeout=20,
    )
    assert pr.status_code == 200, pr.text
    # verify persistence
    r2 = admin_session.get(f"{BASE_URL}/api/admin/sing-along/songs", timeout=20)
    after = [s for s in r2.json() if s["id"] == target["id"]][0]
    assert after["theme"] == new_theme
    # restore
    admin_session.patch(
        f"{BASE_URL}/api/admin/sing-along/songs/{target['id']}",
        json={"theme": original_theme or ""},
        timeout=20,
    )


def test_admin_create_and_delete_manual_song(admin_session):
    slug = f"test-song-{uuid.uuid4().hex[:6]}"
    payload = {
        "title": f"TEST_Song_{slug}",
        "slug": slug,
        "theme": "TEST",
        "lyrics": "la la la",
        "lyrics_lrc": "[00:00.00]la la la",
        "audio_url": "/api/uploads/test.mp3",
        "duration_seconds": 20,
    }
    cr = admin_session.post(
        f"{BASE_URL}/api/admin/sing-along/songs", json=payload, timeout=20
    )
    assert cr.status_code == 200, cr.text
    created = cr.json()
    assert created["slug"] == slug
    assert created["title"] == payload["title"]
    sid = created["id"]
    # delete
    dr = admin_session.delete(
        f"{BASE_URL}/api/admin/sing-along/songs/{sid}", timeout=20
    )
    assert dr.status_code == 200, dr.text
    # verify gone
    lst = admin_session.get(f"{BASE_URL}/api/admin/sing-along/songs", timeout=20).json()
    assert not any(s["id"] == sid for s in lst), "song still present after delete"


def test_admin_regenerate_alignment_status(admin_session):
    """Should either succeed (200) on a real seeded song, or return 400 if MP3 missing.
    Should NOT return 404/500."""
    r = admin_session.get(f"{BASE_URL}/api/admin/sing-along/songs", timeout=20)
    songs = [s for s in r.json() if s.get("audio_url") and s.get("lyrics")]
    assert songs, "need at least one seeded song with audio + lyrics"
    target = songs[0]
    rr = admin_session.post(
        f"{BASE_URL}/api/admin/sing-along/songs/{target['id']}/regenerate-alignment",
        timeout=120,
    )
    # Acceptable outcomes: 200 OK, or 400 (mp3 not found / no lyrics), or 502 (elevenlabs)
    assert rr.status_code in (200, 400, 502), f"unexpected status {rr.status_code}: {rr.text}"


# ---------------- Admin Story Quest hero_image_url ----------------
def test_admin_story_quest_quests_list(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/admin/story-quest/quests", timeout=20)
    assert r.status_code == 200, r.text
    quests = r.json()
    assert isinstance(quests, list)
    assert len(quests) >= 10, f"expected >=10 quests, got {len(quests)}"
    # all should have hero_image_url field present (may be empty string)
    for q in quests:
        assert "hero_image_url" in q, f"missing hero_image_url field on {q.get('slug')}"


def test_admin_story_quest_patch_hero_image(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/admin/story-quest/quests", timeout=20)
    quests = r.json()
    target = quests[0]
    qid = target.get("id") or target.get("slug")
    original = target.get("hero_image_url", "")
    test_url = "/api/uploads/test.png"
    pr = admin_session.patch(
        f"{BASE_URL}/api/admin/story-quest/quests/{qid}",
        json={"hero_image_url": test_url},
        timeout=20,
    )
    assert pr.status_code == 200, pr.text
    body = pr.json()
    # Endpoint should return patched quest
    if isinstance(body, dict) and "hero_image_url" in body:
        assert body["hero_image_url"] == test_url
    # Verify persistence
    r2 = admin_session.get(f"{BASE_URL}/api/admin/story-quest/quests", timeout=20)
    after = [q for q in r2.json() if (q.get("id") or q.get("slug")) == qid][0]
    assert after["hero_image_url"] == test_url
    # Restore
    admin_session.patch(
        f"{BASE_URL}/api/admin/story-quest/quests/{qid}",
        json={"hero_image_url": original},
        timeout=20,
    )

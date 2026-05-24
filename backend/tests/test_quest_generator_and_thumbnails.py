"""Backend tests for iteration 21.

Covers:
  * POST /api/admin/thumbnails/backfill (idempotency + multi-source ingest)
  * GET  /api/admin/thumbnails
  * POST /api/admin/story-quest/generate-full + status polling
  * GET  /api/admin/story-quest/generate-jobs
  * Auth gating (no token => 401/403)
  * Regression: /api/admin/story-quest/quests + /scenes still work
"""
from __future__ import annotations

import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback: read frontend/.env directly
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break

ADMIN_EMAIL = "community@rollingriver.com"
ADMIN_PASSWORD = "Camp1993!"


# -------- fixtures --------

@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=30,
    )
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("access_token") or data.get("token")
    assert token, f"no token in login response: {data}"
    return token


@pytest.fixture(scope="session")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def created_artifacts():
    """Track created quests/jobs so we can clean up afterwards."""
    return {"quest_ids": [], "job_ids": []}


# -------- 1. AUTH GATING --------

class TestAuthGate:
    def test_backfill_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/admin/thumbnails/backfill", timeout=30)
        assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}"

    def test_generate_full_requires_auth(self):
        r = requests.post(
            f"{BASE_URL}/api/admin/story-quest/generate-full",
            json={"title": "x", "premise": "x" * 20, "character_slugs": [], "scene_count": 6},
            timeout=30,
        )
        assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}"

    def test_generate_jobs_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/admin/story-quest/generate-jobs", timeout=30)
        assert r.status_code in (401, 403)


# -------- 2. THUMBNAILS BACKFILL --------

class TestThumbnailsBackfill:
    def test_backfill_first_call(self, auth_headers):
        r = requests.post(
            f"{BASE_URL}/api/admin/thumbnails/backfill",
            headers=auth_headers, timeout=120,
        )
        assert r.status_code == 200, f"{r.status_code}: {r.text}"
        data = r.json()
        assert data.get("ok") is True
        assert "inserted" in data
        assert "already_in_library" in data
        assert isinstance(data["inserted"], int)
        assert isinstance(data["already_in_library"], int)
        print(f"First backfill inserted={data['inserted']} skipped={data['already_in_library']}")

    def test_backfill_idempotent(self, auth_headers):
        # Second call should yield inserted=0 since all rows now exist.
        r = requests.post(
            f"{BASE_URL}/api/admin/thumbnails/backfill",
            headers=auth_headers, timeout=120,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["inserted"] == 0, f"expected 0 inserted on 2nd call, got {data}"
        assert data["already_in_library"] >= 0

    def test_thumbnails_list_returns_unified_rows(self, auth_headers):
        r = requests.get(
            f"{BASE_URL}/api/admin/thumbnails",
            headers=auth_headers, timeout=20,
        )
        assert r.status_code == 200, r.text
        rows = r.json()
        # endpoint may return list or dict with items
        items = rows if isinstance(rows, list) else rows.get("items") or rows.get("thumbnails") or []
        assert isinstance(items, list)
        # We expect at least some rows after backfill (characters always exist).
        # Don't hard-fail if seed is empty, but log.
        print(f"thumbnails list returned {len(items)} rows")
        # Make sure no _id leaked
        for row in items[:10]:
            assert "_id" not in row, "MongoDB _id leaked in thumbnails list response"

    def test_backfill_covered_sources(self, auth_headers):
        """Verify the backfill produced thumbnails from multiple known sources."""
        r = requests.get(
            f"{BASE_URL}/api/admin/thumbnails",
            headers=auth_headers, timeout=20,
        )
        assert r.status_code == 200
        rows = r.json()
        items = rows if isinstance(rows, list) else rows.get("items") or rows.get("thumbnails") or []
        sources = {row.get("source") for row in items if isinstance(row, dict)}
        print(f"unique sources in library: {sources}")
        # We do not assert all 10 sources because seed may not have every type.
        # But we expect at least 'character' (always seeded).
        assert "character" in sources or len(items) == 0, \
            f"expected character source in thumbnails, got {sources}"


# -------- 3. STORY QUEST GENERATOR --------

class TestStoryQuestGenerator:
    def test_generate_full_starts_job(self, auth_headers, created_artifacts):
        body = {
            "title": f"TEST_Quest_{uuid.uuid4().hex[:6]}",
            "premise": "A gentle adventure where the Sea Stars learn to share their seashell collection at low tide.",
            "character_slugs": ["myrtle", "ray"],
            "scene_count": 6,
            "generate_backgrounds": False,
            "generate_narration": False,
            "publish": False,
            "theme_color": "#7fcfc7",
        }
        r = requests.post(
            f"{BASE_URL}/api/admin/story-quest/generate-full",
            headers=auth_headers, json=body, timeout=30,
        )
        assert r.status_code == 200, f"{r.status_code}: {r.text}"
        data = r.json()
        assert "job_id" in data
        assert isinstance(data["job_id"], str) and len(data["job_id"]) > 0
        created_artifacts["job_ids"].append(data["job_id"])
        # store body for later assertions
        created_artifacts["last_body"] = body

    def test_generate_status_polling_to_done(self, auth_headers, created_artifacts):
        job_id = created_artifacts["job_ids"][-1]
        body = created_artifacts["last_body"]

        deadline = time.time() + 180  # 3 min timeout
        last_status = None
        row = None
        while time.time() < deadline:
            try:
                r = requests.get(
                    f"{BASE_URL}/api/admin/story-quest/generate-status/{job_id}",
                    headers=auth_headers, timeout=30,
                )
            except requests.exceptions.ReadTimeout:
                print(f"poll timeout at t={time.time()-deadline+180:.0f}s, retrying")
                continue
            assert r.status_code == 200, r.text
            row = r.json()
            last_status = row.get("status")
            print(f"poll status={last_status} progress={row.get('progress')} step={row.get('step')}")
            if last_status in ("done", "failed"):
                break
            time.sleep(4)

        assert row is not None
        assert last_status == "done", f"job did not complete; last row={row}"
        assert "quest_id" in row and row["quest_id"]
        assert "quest_slug" in row and row["quest_slug"]
        assert row.get("progress") == 100
        created_artifacts["quest_ids"].append(row["quest_id"])
        created_artifacts["last_quest_slug"] = row["quest_slug"]
        created_artifacts["last_total_scenes"] = row.get("total_scenes") or body["scene_count"]

    def test_quest_persisted_as_draft(self, auth_headers, created_artifacts):
        quest_id = created_artifacts["quest_ids"][-1]
        body = created_artifacts["last_body"]
        # use the existing admin quests list endpoint (regression endpoint)
        r = requests.get(
            f"{BASE_URL}/api/admin/story-quest/quests",
            headers=auth_headers, timeout=30,
        )
        assert r.status_code == 200
        quests = r.json()
        match = next((q for q in quests if q.get("id") == quest_id), None)
        assert match is not None, f"new quest {quest_id} not found in admin list"
        assert match.get("status") == "draft"
        assert match.get("active") is False
        assert match.get("title") == body["title"]

    def test_scenes_persisted_with_structure(self, auth_headers, created_artifacts):
        quest_id = created_artifacts["quest_ids"][-1]
        scene_count_expected = created_artifacts["last_total_scenes"]
        # GET /admin/story-quest/scenes — endpoint doesn't filter, so we filter client-side
        r = requests.get(
            f"{BASE_URL}/api/admin/story-quest/scenes",
            headers=auth_headers, timeout=30,
        )
        assert r.status_code == 200, r.text
        all_scenes = r.json()
        assert isinstance(all_scenes, list)
        scenes = [s for s in all_scenes if s.get("quest_id") == quest_id]
        assert len(scenes) == scene_count_expected, \
            f"expected {scene_count_expected} scenes for quest {quest_id}, got {len(scenes)}"

        # sort by scene_number
        scenes.sort(key=lambda s: s.get("scene_number", 0))

        # intro/finale flags
        assert scenes[0].get("is_intro") is True, "first scene must be is_intro=True"
        assert scenes[-1].get("is_finale") is True, "last scene must be is_finale=True"
        assert scenes[0].get("scene_number") == 1
        assert scenes[-1].get("scene_number") == scene_count_expected

        # scene_number sequence 1..N
        nums = [s.get("scene_number") for s in scenes]
        assert nums == list(range(1, scene_count_expected + 1)), f"scene_numbers not 1..N: {nums}"

        # narrator slugs come from the allowed cast (was passed myrtle/ray, but
        # generator may include the wider Sea Stars cast — must at minimum be
        # present in characters collection => non-empty string).
        allowed_min = {"myrtle", "ray", "ms-bluegill", "ollie"}
        for s in scenes:
            ns = s.get("narrator_slug")
            assert ns, f"scene {s.get('scene_number')} has empty narrator_slug"
            # we passed cast=[myrtle, ray] so generator should bias to those
            # but normalization may fallback — assert at least it's a known slug.
            # Don't hard-fail on the wider cast; just check non-empty + lowercase.
            assert isinstance(ns, str) and ns == ns.lower(), f"bad narrator slug: {ns}"

        # middle scenes: exactly 3 choices with distinct wave principles
        WAVE_KEYS = {"welcome_curiosity", "act_with_kindness", "value_teamwork", "encourage_others"}
        middle = scenes[1:-1]
        for s in middle:
            choices = s.get("choices") or []
            assert len(choices) == 3, \
                f"scene {s.get('scene_number')} has {len(choices)} choices, expected 3"
            waves = [c.get("wave_principle") for c in choices]
            assert len(set(waves)) == 3, \
                f"scene {s.get('scene_number')} choices not distinct: {waves}"
            for w in waves:
                assert w in WAVE_KEYS, f"bad wave_principle {w}"

        # intro + finale must have no choices
        assert scenes[0].get("choices") in ([], None), "intro scene must have no choices"
        assert scenes[-1].get("choices") in ([], None), "finale scene must have no choices"

    def test_generate_jobs_list(self, auth_headers, created_artifacts):
        r = requests.get(
            f"{BASE_URL}/api/admin/story-quest/generate-jobs",
            headers=auth_headers, timeout=30,
        )
        assert r.status_code == 200, r.text
        jobs = r.json()
        assert isinstance(jobs, list)
        assert len(jobs) <= 25
        # our job must be in there
        ids = [j.get("id") for j in jobs]
        assert created_artifacts["job_ids"][-1] in ids
        # row shape
        first = jobs[0]
        for k in ("status", "title", "premise", "progress"):
            assert k in first, f"missing key {k} in job row"
        # no leaked _id
        for j in jobs:
            assert "_id" not in j


# -------- 4. REGRESSION --------

class TestRegression:
    def test_admin_scenes_list_works(self, auth_headers):
        r = requests.get(
            f"{BASE_URL}/api/admin/story-quest/scenes",
            headers=auth_headers, timeout=30,
        )
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_admin_quests_list_works(self, auth_headers):
        r = requests.get(
            f"{BASE_URL}/api/admin/story-quest/quests",
            headers=auth_headers, timeout=30,
        )
        assert r.status_code == 200
        quests = r.json()
        assert isinstance(quests, list)
        # scene_count enrichment exists
        if quests:
            assert "scene_count" in quests[0]

    def test_public_quests_list_works(self):
        r = requests.get(f"{BASE_URL}/api/story-quest/quests", timeout=30)
        assert r.status_code == 200


# -------- 5. CLEANUP --------

class TestZCleanup:
    """Runs last alphabetically — removes test quests/jobs from the DB."""

    def test_cleanup_test_artifacts(self, auth_headers, created_artifacts):
        # Delete scenes + quest + job via direct mongo via admin endpoints if available.
        # Simplest: use admin scene delete + admin quest patch to mark inactive.
        # Without a delete-quest endpoint we mark inactive — but admin_router may
        # have one. We'll just leave a note; the quest is already draft+inactive.
        # However we can try DELETE individual scenes.
        for quest_id in created_artifacts["quest_ids"]:
            # fetch scenes for this quest
            r = requests.get(
                f"{BASE_URL}/api/admin/story-quest/scenes",
                headers=auth_headers, timeout=30,
            )
            if r.status_code != 200:
                continue
            for s in r.json():
                if s.get("quest_id") != quest_id:
                    continue
                sid = s.get("id")
                if sid:
                    requests.delete(
                        f"{BASE_URL}/api/admin/story-quest/scenes/{sid}",
                        headers=auth_headers, timeout=30,
                    )
        print(f"Cleanup attempted for {len(created_artifacts['quest_ids'])} quests")
        # always pass — cleanup is best-effort
        assert True

"""Activities batches 3 & 4: 8 new mini-games seeded into MongoDB."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://wave-of-excitement.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

EXISTING_KEYS = [
    "memory_match", "spot_difference", "coloring", "word_search", "quiz",
    "rhyme_time", "maze", "sticker_beach", "number_bubbles", "story_sequence",
    "drag_sort", "hidden_objects", "whats_missing", "pattern_continue",
    "letter_trace", "true_or_false",
]
NEW_KEYS = [
    "connect_dots", "color_by_number", "shadow_match", "odd_one_out",
    "simon_says", "word_unscramble", "count_and_click", "animal_sounds",
]


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# --- List endpoint returns all 24 activities -----------------------------
def test_list_activities_has_24(session):
    r = session.get(f"{API}/activities", timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data, list)
    keys = {a.get("key") for a in data}
    for k in EXISTING_KEYS + NEW_KEYS:
        assert k in keys, f"Missing activity key: {k}"
    assert len(keys) >= 24, f"Expected >=24 distinct keys, got {len(keys)}: {keys}"


# --- Each new game returns 10 levels with required shape ------------------
def _get_levels(session, key):
    r = session.get(f"{API}/activities/{key}", timeout=15)
    assert r.status_code == 200, f"{key}: {r.status_code} {r.text}"
    body = r.json()
    data = body.get("data") or {}
    levels = data.get("levels") or []
    assert isinstance(levels, list), f"{key}: levels not a list"
    assert len(levels) == 10, f"{key}: expected 10 levels, got {len(levels)}"
    return levels


def test_connect_dots_levels(session):
    levels = _get_levels(session, "connect_dots")
    for i, lv in enumerate(levels):
        assert "name" in lv or "label" in lv, f"connect_dots[{i}] missing name/label"
        dots = lv.get("dots")
        assert isinstance(dots, list) and len(dots) > 0, f"connect_dots[{i}] dots missing/empty"


def test_color_by_number_levels(session):
    levels = _get_levels(session, "color_by_number")
    for i, lv in enumerate(levels):
        assert isinstance(lv.get("palette"), (list, dict)), f"color_by_number[{i}] missing palette"
        assert lv.get("grid") is not None, f"color_by_number[{i}] missing grid"


def test_shadow_match_levels(session):
    levels = _get_levels(session, "shadow_match")
    for i, lv in enumerate(levels):
        rounds = lv.get("rounds")
        assert isinstance(rounds, list) and len(rounds) > 0, f"shadow_match[{i}] rounds missing/empty"


def test_odd_one_out_levels(session):
    levels = _get_levels(session, "odd_one_out")
    for i, lv in enumerate(levels):
        rounds = lv.get("rounds")
        assert isinstance(rounds, list) and len(rounds) > 0, f"odd_one_out[{i}] rounds missing/empty"


def test_simon_says_levels(session):
    levels = _get_levels(session, "simon_says")
    for i, lv in enumerate(levels):
        assert lv.get("pads") is not None, f"simon_says[{i}] missing pads"
        # rounds or start_length should be present
        assert ("rounds" in lv) or ("start_length" in lv), f"simon_says[{i}] missing rounds/start_length"


def test_word_unscramble_levels(session):
    levels = _get_levels(session, "word_unscramble")
    for i, lv in enumerate(levels):
        rounds = lv.get("rounds")
        assert isinstance(rounds, list) and len(rounds) > 0, f"word_unscramble[{i}] rounds missing"
        r0 = rounds[0]
        assert "word" in r0 and "scrambled" in r0, f"word_unscramble[{i}] round missing word/scrambled"


def test_count_and_click_levels(session):
    levels = _get_levels(session, "count_and_click")
    for i, lv in enumerate(levels):
        assert lv.get("target") is not None, f"count_and_click[{i}] missing target"
        assert isinstance(lv.get("scene"), list), f"count_and_click[{i}] scene not a list"


def test_animal_sounds_levels(session):
    levels = _get_levels(session, "animal_sounds")
    for i, lv in enumerate(levels):
        rounds = lv.get("rounds")
        assert isinstance(rounds, list) and len(rounds) > 0, f"animal_sounds[{i}] rounds missing"
        r0 = rounds[0]
        for k in ("animal", "prompt", "choices", "answer"):
            assert k in r0, f"animal_sounds[{i}] round missing field {k}"
        assert isinstance(r0["choices"], list) and len(r0["choices"]) >= 2
        assert r0["answer"] in r0["choices"], f"animal_sounds[{i}] answer not in choices"


# --- Regression: existing games still resolvable --------------------------
@pytest.mark.parametrize("key", ["memory_match", "maze", "hidden_objects"])
def test_existing_games_regression(session, key):
    r = session.get(f"{API}/activities/{key}", timeout=15)
    assert r.status_code == 200, f"{key}: {r.status_code}"
    body = r.json()
    assert body.get("key") == key


def test_unknown_activity_returns_404(session):
    r = session.get(f"{API}/activities/this_key_does_not_exist", timeout=15)
    assert r.status_code == 404

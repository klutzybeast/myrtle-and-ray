"""Activities batches 5 & 6: 8 new mini-games (math_pond, time_teller, color_mixer,
emotion_match, tap_target, map_directions, before_after, scales_balance)."""
import os
import pytest
import requests

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://wave-of-excitement.preview.emergentagent.com",
).rstrip("/")
API = f"{BASE_URL}/api"

# Previously-shipped 24 keys (batches 1-4)
PREV_KEYS = [
    "memory_match", "spot_difference", "coloring", "word_search", "quiz",
    "rhyme_time", "maze", "sticker_beach", "number_bubbles", "story_sequence",
    "drag_sort", "hidden_objects", "whats_missing", "pattern_continue",
    "letter_trace", "true_or_false",
    "connect_dots", "color_by_number", "shadow_match", "odd_one_out",
    "simon_says", "word_unscramble", "count_and_click", "animal_sounds",
]
# 8 new keys this iteration (batches 5 & 6)
NEW_KEYS = [
    "math_pond", "time_teller", "color_mixer", "emotion_match",
    "tap_target", "map_directions", "before_after", "scales_balance",
]


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# --- 32-row list check ---------------------------------------------------
def test_list_activities_has_32(session):
    r = session.get(f"{API}/activities", timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data, list)
    keys = {a.get("key") for a in data}
    # All previous + new must be present
    missing = [k for k in PREV_KEYS + NEW_KEYS if k not in keys]
    assert not missing, f"Missing keys: {missing}"
    assert len(keys) >= 32, f"Expected >=32 distinct keys, got {len(keys)}"


def _get_levels(session, key):
    r = session.get(f"{API}/activities/{key}", timeout=15)
    assert r.status_code == 200, f"{key}: {r.status_code} {r.text}"
    body = r.json()
    assert body.get("key") == key
    data = body.get("data") or {}
    levels = data.get("levels") or []
    assert isinstance(levels, list), f"{key}: levels not a list"
    assert len(levels) == 10, f"{key}: expected 10 levels, got {len(levels)}"
    return levels


# --- math_pond: rounds[{a, op, b, emoji, choices}] ------------------------
def test_math_pond_levels(session):
    levels = _get_levels(session, "math_pond")
    for i, lv in enumerate(levels):
        rounds = lv.get("rounds")
        assert isinstance(rounds, list) and len(rounds) > 0, f"math_pond[{i}] rounds empty"
        r0 = rounds[0]
        for k in ("a", "op", "b", "choices"):
            assert k in r0, f"math_pond[{i}] round missing {k}"
        assert isinstance(r0["choices"], list) and len(r0["choices"]) >= 2
        # validate at least one round answer is computable & in choices
        op = r0["op"]
        ans = (r0["a"] + r0["b"]) if op in ("+", "plus") else (r0["a"] - r0["b"])
        assert ans in r0["choices"], f"math_pond[{i}] correct answer {ans} not in choices {r0['choices']}"


# --- time_teller: rounds[{hour, minute, choices, answer}] -----------------
def test_time_teller_levels(session):
    levels = _get_levels(session, "time_teller")
    for i, lv in enumerate(levels):
        rounds = lv.get("rounds")
        assert isinstance(rounds, list) and len(rounds) > 0, f"time_teller[{i}] rounds empty"
        r0 = rounds[0]
        for k in ("hour", "minute", "choices", "answer"):
            assert k in r0, f"time_teller[{i}] round missing {k}"
        assert 0 <= r0["hour"] <= 23
        assert 0 <= r0["minute"] <= 59
        assert isinstance(r0["choices"], list) and len(r0["choices"]) >= 2
        assert r0["answer"] in r0["choices"], f"time_teller[{i}] answer not in choices"


# --- color_mixer: rounds[{target, target_hex, a, b, colors[]}] ------------
def test_color_mixer_levels(session):
    levels = _get_levels(session, "color_mixer")
    for i, lv in enumerate(levels):
        rounds = lv.get("rounds")
        assert isinstance(rounds, list) and len(rounds) > 0, f"color_mixer[{i}] rounds empty"
        r0 = rounds[0]
        for k in ("target", "a", "b", "colors"):
            assert k in r0, f"color_mixer[{i}] round missing {k}"
        assert isinstance(r0["colors"], list) and len(r0["colors"]) >= 2
        # colors are objects {name, hex}; the two correct ingredients (a/b) must appear by name
        color_names = [c.get("name") if isinstance(c, dict) else c for c in r0["colors"]]
        assert r0["a"] in color_names, f"color_mixer[{i}] a={r0['a']} not in {color_names}"
        assert r0["b"] in color_names, f"color_mixer[{i}] b={r0['b']} not in {color_names}"


# --- emotion_match: rounds[{scene, face, choices, answer, coach}] ---------
def test_emotion_match_levels(session):
    levels = _get_levels(session, "emotion_match")
    for i, lv in enumerate(levels):
        rounds = lv.get("rounds")
        assert isinstance(rounds, list) and len(rounds) > 0, f"emotion_match[{i}] rounds empty"
        r0 = rounds[0]
        for k in ("scene", "face", "choices", "answer"):
            assert k in r0, f"emotion_match[{i}] round missing {k}"
        assert isinstance(r0["choices"], list) and len(r0["choices"]) >= 2
        assert r0["answer"] in r0["choices"], f"emotion_match[{i}] answer not in choices"


# --- tap_target: {target, trap, duration_seconds, pop_ms, win_score} ------
def test_tap_target_levels(session):
    levels = _get_levels(session, "tap_target")
    for i, lv in enumerate(levels):
        for k in ("target", "trap", "duration_seconds", "pop_ms", "win_score"):
            assert k in lv, f"tap_target[{i}] missing {k}"
        assert isinstance(lv["duration_seconds"], (int, float)) and lv["duration_seconds"] > 0
        assert isinstance(lv["pop_ms"], (int, float)) and lv["pop_ms"] > 0
        assert isinstance(lv["win_score"], int) and lv["win_score"] > 0


# --- map_directions: {cols, rows, start, goal, steps[]} -------------------
def test_map_directions_levels(session):
    levels = _get_levels(session, "map_directions")
    for i, lv in enumerate(levels):
        for k in ("cols", "rows", "start", "goal", "steps"):
            assert k in lv, f"map_directions[{i}] missing {k}"
        assert isinstance(lv["steps"], list) and len(lv["steps"]) > 0
        # steps should be N/E/S/W (case-insensitive single chars)
        for s in lv["steps"]:
            assert str(s).upper() in {"N", "E", "S", "W"}, f"map_directions[{i}] bad step {s}"


# --- before_after: rounds[{when, anchor_emoji, anchor, choices, answer_idx}]
def test_before_after_levels(session):
    levels = _get_levels(session, "before_after")
    for i, lv in enumerate(levels):
        rounds = lv.get("rounds")
        assert isinstance(rounds, list) and len(rounds) > 0, f"before_after[{i}] rounds empty"
        r0 = rounds[0]
        for k in ("when", "anchor", "choices", "answer_idx"):
            assert k in r0, f"before_after[{i}] round missing {k}"
        assert isinstance(r0["choices"], list) and len(r0["choices"]) >= 2
        assert 0 <= r0["answer_idx"] < len(r0["choices"]), \
            f"before_after[{i}] answer_idx {r0['answer_idx']} out of range"


# --- scales_balance: rounds[{left:[{emoji,weight}], right:[{emoji,weight}]}]
def test_scales_balance_levels(session):
    levels = _get_levels(session, "scales_balance")
    for i, lv in enumerate(levels):
        rounds = lv.get("rounds")
        assert isinstance(rounds, list) and len(rounds) > 0, f"scales_balance[{i}] rounds empty"
        for j, rd in enumerate(rounds):
            assert isinstance(rd.get("left"), list) and len(rd["left"]) > 0, \
                f"scales_balance[{i}].rounds[{j}] left missing"
            assert isinstance(rd.get("right"), list) and len(rd["right"]) > 0, \
                f"scales_balance[{i}].rounds[{j}] right missing"
            for side in ("left", "right"):
                for item in rd[side]:
                    assert "weight" in item, f"scales_balance[{i}].rounds[{j}].{side} item missing weight"


# --- Verify the scales sum-equality example from the request -------------
def test_scales_balance_sum_logic():
    """left=[{w:3}], right=[{w:1},{w:1},{w:1}] → both sum to 3 → equal."""
    left = [{"emoji": "🐢", "weight": 3}]
    right = [{"emoji": "🐠", "weight": 1}, {"emoji": "🐠", "weight": 1}, {"emoji": "🐠", "weight": 1}]
    sl = sum(x["weight"] for x in left)
    sr = sum(x["weight"] for x in right)
    assert sl == sr == 3
    answer = "left" if sl > sr else "right" if sr > sl else "equal"
    assert answer == "equal"


# --- Regression: 8 of the previously-shipped keys still resolve ----------
@pytest.mark.parametrize("key", [
    "memory_match", "maze", "hidden_objects", "connect_dots",
    "color_by_number", "odd_one_out", "word_unscramble", "animal_sounds",
])
def test_regression_prev_games(session, key):
    r = session.get(f"{API}/activities/{key}", timeout=15)
    assert r.status_code == 200, f"{key}: {r.status_code}"
    body = r.json()
    assert body.get("key") == key


def test_unknown_activity_returns_404(session):
    r = session.get(f"{API}/activities/zz_unknown_game", timeout=15)
    assert r.status_code == 404

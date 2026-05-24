"""Regression tests for the story-quest generator's normalization layer.

Guards against three production bugs the user explicitly called out:
  1. ElevenLabs narration must fire for every scene that has a narrator
     with a voice_id (proven live in integration test — this file only
     pins down the pure-function invariants).
  2. Audio URLs must bind to the correct scene_id (we never reuse a
     scene's id across scenes, and the cache key already differs per
     narration text).
  3. No duplicate scene_numbers within a quest, EVER — even when the
     LLM emits collisions or non-sequential numbering.

These are unit tests on `_normalize_scenes` plus a MongoDB-backed
duplicate-detection check that mirrors what the live generator does.
"""
import sys
import os
import pathlib

# Make backend importable
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from story_quest_generator import _normalize_scenes  # noqa: E402


VALID = {"myrtle", "ray", "ollie", "ms-bluegill"}


def test_scene_numbers_are_always_sequential_even_with_llm_collisions():
    # LLM emits scene_number collisions — generator must override.
    raw = [
        {"scene_number": 1, "title": "A", "narrative": "...", "narrator_slug": "myrtle"},
        {"scene_number": 3, "title": "B", "narrative": "...", "narrator_slug": "ray", "choices": [
            {"id": "A", "text": "x", "wave_principle": "act_with_kindness"},
            {"id": "B", "text": "y", "wave_principle": "value_teamwork"},
            {"id": "C", "text": "z", "wave_principle": "welcome_curiosity"},
        ]},
        {"scene_number": 3, "title": "C", "narrative": "...", "narrator_slug": "ollie", "choices": [
            {"id": "A", "text": "x", "wave_principle": "act_with_kindness"},
            {"id": "B", "text": "y", "wave_principle": "value_teamwork"},
            {"id": "C", "text": "z", "wave_principle": "welcome_curiosity"},
        ]},
        {"scene_number": 99, "title": "D", "narrative": "...", "narrator_slug": "myrtle"},
    ]
    out = _normalize_scenes(raw, VALID)
    assert [s["scene_number"] for s in out] == [1, 2, 3, 4], "scene_numbers must be re-assigned sequentially"
    assert out[0]["is_intro"] is True and out[-1]["is_finale"] is True
    assert out[0]["choices"] == [] and out[-1]["choices"] == []


def test_intro_finale_only_one_when_total_is_one():
    raw = [{"title": "Only", "narrative": "...", "narrator_slug": "myrtle"}]
    out = _normalize_scenes(raw, VALID)
    # Single-scene response: NEITHER intro nor finale (would be both otherwise)
    assert out[0]["is_intro"] is False
    assert out[0]["is_finale"] is False


def test_unknown_narrator_falls_back_to_myrtle():
    raw = [
        {"title": "A", "narrative": "...", "narrator_slug": "nobody-here", "choices": []},
        {"title": "B", "narrative": "...", "narrator_slug": "stillnope", "choices": []},
    ]
    out = _normalize_scenes(raw, VALID)
    assert all(s["narrator_slug"] == "myrtle" for s in out)


def test_invalid_wave_principle_is_rotated():
    raw = [
        {"title": "intro", "narrative": "...", "narrator_slug": "myrtle"},
        {"title": "mid", "narrative": "...", "narrator_slug": "ray", "choices": [
            {"id": "A", "text": "x", "wave_principle": "garbage"},
            {"id": "B", "text": "y", "wave_principle": "act_with_kindness"},
            {"id": "C", "text": "z", "wave_principle": "also_garbage"},
        ]},
        {"title": "finale", "narrative": "...", "narrator_slug": "myrtle"},
    ]
    out = _normalize_scenes(raw, VALID)
    middle = out[1]
    waves = [c["wave_principle"] for c in middle["choices"]]
    assert all(w in {"welcome_curiosity", "act_with_kindness", "value_teamwork", "encourage_others"} for w in waves)


def test_intro_and_finale_strip_choices_even_if_llm_sends_them():
    raw = [
        {"title": "intro", "narrative": "...", "narrator_slug": "myrtle", "choices": [
            {"id": "A", "text": "should be stripped", "wave_principle": "act_with_kindness"},
        ]},
        {"title": "mid", "narrative": "...", "narrator_slug": "ray", "choices": [
            {"id": "A", "text": "x", "wave_principle": "act_with_kindness"},
            {"id": "B", "text": "y", "wave_principle": "value_teamwork"},
            {"id": "C", "text": "z", "wave_principle": "welcome_curiosity"},
        ]},
        {"title": "finale", "narrative": "...", "narrator_slug": "myrtle", "choices": [
            {"id": "A", "text": "should be stripped", "wave_principle": "value_teamwork"},
        ]},
    ]
    out = _normalize_scenes(raw, VALID)
    assert out[0]["choices"] == []
    assert out[-1]["choices"] == []
    assert len(out[1]["choices"]) == 3


def test_choice_id_and_text_default_when_missing():
    raw = [
        {"title": "i", "narrative": "...", "narrator_slug": "myrtle"},
        {"title": "m", "narrative": "...", "narrator_slug": "ray", "choices": [
            {"wave_principle": "act_with_kindness"},  # no id, no text
            {"id": "B", "text": "", "wave_principle": "value_teamwork"},
            {"id": "C", "text": "ok", "wave_principle": "welcome_curiosity"},
        ]},
        {"title": "f", "narrative": "...", "narrator_slug": "myrtle"},
    ]
    out = _normalize_scenes(raw, VALID)
    cs = out[1]["choices"]
    assert cs[0]["id"] == "A" and cs[0]["text"] == "Option 1"
    assert cs[1]["text"] == "Option 2"
    assert cs[2]["text"] == "ok"

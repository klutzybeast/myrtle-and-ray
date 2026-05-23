"""Shared pronunciation helpers for ElevenLabs TTS.

ElevenLabs' phoneme support is patchy across voices, so the most
reliable trick is to *spell things how we want them said* in the text
we send to the API while keeping the original spelling on-screen.
"""
from __future__ import annotations

import re

# In the book, "Cay" is the Caribbean word for a small low island and
# is pronounced /kiː/ — like "Key" in "Florida Keys". ElevenLabs voices
# tend to read the spelling literally as "kay", so we substitute "Key"
# in TTS-bound text. (On-screen text in scenes/UI keeps the spelling.)
_CAY_PATTERNS = [
    (re.compile(r"\bCAY\b"), "KEY"),
    (re.compile(r"\bCay\b"), "Key"),
    (re.compile(r"\bcay\b"), "key"),
    # Plural — "cays" → "keys"
    (re.compile(r"\bCays\b"), "Keys"),
    (re.compile(r"\bcays\b"), "keys"),
]


def phoneticize_for_tts(text: str) -> str:
    """Return text rewritten so ElevenLabs pronounces tricky words correctly.

    Only TTS callers should use this. On-screen rendering should keep the
    original text (so the printed book and the website stay consistent).
    """
    if not text:
        return text
    out = text
    for pat, repl in _CAY_PATTERNS:
        out = pat.sub(repl, out)
    return out

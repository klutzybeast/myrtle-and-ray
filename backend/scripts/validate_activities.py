"""Validates every game's seed data for self-consistency.

Catches the class of bugs where a game asks the player to do X but the
data does not actually contain X (e.g. 'find the turtle' in a scene with
no turtle).
"""
import os
import sys
import asyncio

sys.path.insert(0, "/app/backend")

from motor.motor_asyncio import AsyncIOMotorClient


async def validate():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    errors = []
    warnings = []

    cur = db.activity_content.find({}, {"_id": 0})
    activities = await cur.to_list(length=1000)
    print(f"Validating {len(activities)} activities…\n")

    by_key = {a["key"]: a for a in activities}

    def err(key, lvl_idx, lvl_name, msg):
        errors.append(f"  ❌ {key}[{lvl_idx} '{lvl_name}']: {msg}")

    def warn(key, lvl_idx, lvl_name, msg):
        warnings.append(f"  ⚠️  {key}[{lvl_idx} '{lvl_name}']: {msg}")

    for key, a in by_key.items():
        levels = (a.get("data") or {}).get("levels") or []
        if not levels:
            err(key, -1, "(no levels)", "0 levels seeded")
            continue
        for li, lvl in enumerate(levels):
            name = lvl.get("name", f"#{li}")

            # ========= Per-game-type checks =========
            if key == "count_and_click":
                target = lvl.get("target")
                scene = lvl.get("scene") or []
                hits = [s for s in scene if s.get("emoji") == target]
                if not hits:
                    err(key, li, name, f"target '{target}' not in scene (scene has {[s.get('emoji') for s in scene]})")
                if len(hits) < 2:
                    warn(key, li, name, f"only {len(hits)} target(s) — usually want 3+")

            elif key == "shadow_match":
                for ri, r in enumerate(lvl.get("rounds") or []):
                    if r.get("target") not in (r.get("options") or []):
                        err(key, li, name, f"round {ri}: target '{r.get('target')}' not in options {r.get('options')}")

            elif key == "odd_one_out":
                for ri, r in enumerate(lvl.get("rounds") or []):
                    items = r.get("items") or []
                    oi = r.get("odd_index")
                    if oi is None or oi < 0 or oi >= len(items):
                        err(key, li, name, f"round {ri}: odd_index={oi} out of bounds (items={items})")

            elif key == "animal_sounds":
                for ri, r in enumerate(lvl.get("rounds") or []):
                    if r.get("answer") not in (r.get("choices") or []):
                        err(key, li, name, f"round {ri}: answer '{r.get('answer')}' not in choices {r.get('choices')}")

            elif key == "emotion_match":
                for ri, r in enumerate(lvl.get("rounds") or []):
                    if r.get("answer") not in (r.get("choices") or []):
                        err(key, li, name, f"round {ri}: answer '{r.get('answer')}' not in choices {r.get('choices')}")

            elif key == "before_after":
                for ri, r in enumerate(lvl.get("rounds") or []):
                    choices = r.get("choices") or []
                    ai = r.get("answer_idx")
                    if ai is None or ai < 0 or ai >= len(choices):
                        err(key, li, name, f"round {ri}: answer_idx={ai} out of bounds (choices={len(choices)})")

            elif key == "time_teller":
                for ri, r in enumerate(lvl.get("rounds") or []):
                    if r.get("answer") not in (r.get("choices") or []):
                        err(key, li, name, f"round {ri}: answer '{r.get('answer')}' not in choices {r.get('choices')}")
                    h, m = r.get("hour"), r.get("minute")
                    if h is None or h < 1 or h > 12:
                        err(key, li, name, f"round {ri}: hour={h} out of 1-12")
                    if m is None or m < 0 or m > 59:
                        err(key, li, name, f"round {ri}: minute={m} out of 0-59")
                    # Answer string should agree with hour:minute
                    expected = f"{h}:{m:02d}" if m else f"{h}:00"
                    if r.get("answer") and r["answer"] != expected:
                        warn(key, li, name, f"round {ri}: answer '{r.get('answer')}' doesn't match {h}:{m:02d}")

            elif key == "math_pond":
                for ri, r in enumerate(lvl.get("rounds") or []):
                    a_, op, b_ = r.get("a", 0), r.get("op", "+"), r.get("b", 0)
                    expected = a_ - b_ if op == "-" else a_ + b_
                    if expected not in (r.get("choices") or []):
                        err(key, li, name, f"round {ri}: expected answer {expected} ({a_}{op}{b_}) not in choices {r.get('choices')}")

            elif key == "color_mixer":
                for ri, r in enumerate(lvl.get("rounds") or []):
                    palette_names = {c.get("name") for c in (r.get("colors") or [])}
                    if r.get("a") not in palette_names:
                        err(key, li, name, f"round {ri}: ingredient a='{r.get('a')}' not in palette {palette_names}")
                    if r.get("b") not in palette_names:
                        err(key, li, name, f"round {ri}: ingredient b='{r.get('b')}' not in palette {palette_names}")

            elif key == "word_unscramble":
                for ri, r in enumerate(lvl.get("rounds") or []):
                    word = (r.get("word") or "").upper()
                    scrambled = (r.get("scrambled") or "").upper()
                    if not word:
                        err(key, li, name, f"round {ri}: missing word")
                        continue
                    if scrambled and sorted(word) != sorted(scrambled):
                        err(key, li, name, f"round {ri}: scrambled '{scrambled}' is not a permutation of '{word}'")

            elif key == "map_directions":
                cols = lvl.get("cols", 4)
                rows = lvl.get("rows", 4)
                start = lvl.get("start") or [0, 0]
                goal = lvl.get("goal") or [0, 0]
                steps = lvl.get("steps") or []
                # Walk the path and check it lands on the goal and stays in bounds
                r0, c0 = start
                for si, s in enumerate(steps):
                    if s == "N":
                        r0 = max(0, r0 - 1)
                    elif s == "S":
                        r0 = min(rows - 1, r0 + 1)
                    elif s == "E":
                        c0 = min(cols - 1, c0 + 1)
                    elif s == "W":
                        c0 = max(0, c0 - 1)
                    else:
                        err(key, li, name, f"unknown step '{s}'")
                        break
                if [r0, c0] != list(goal):
                    err(key, li, name, f"steps {steps} end at [{r0},{c0}] not goal {goal}")

            elif key == "tap_target":
                if not lvl.get("target") or not lvl.get("trap"):
                    err(key, li, name, "missing target or trap")

            elif key == "color_by_number":
                palette = lvl.get("palette") or {}
                grid = lvl.get("grid") or []
                cells = {n for row in grid for n in row}
                missing = {str(c) for c in cells if str(c) not in palette}
                if missing:
                    err(key, li, name, f"grid has number(s) {missing} with no palette entry (palette keys: {list(palette)})")

            elif key == "connect_dots":
                dots = lvl.get("dots") or []
                if not dots:
                    err(key, li, name, "0 dots")
                    continue
                nums = sorted({d.get("n") for d in dots})
                # dots can repeat (closing a shape) — just check 1..max is contiguous
                max_n = max(nums) if nums else 0
                if set(nums) != set(range(1, max_n + 1)):
                    warn(key, li, name, f"dot numbers {nums} have gaps")

            elif key == "scales_balance":
                # Just verify each round has both trays
                for ri, r in enumerate(lvl.get("rounds") or []):
                    if not (r.get("left") and r.get("right")):
                        err(key, li, name, f"round {ri}: missing left or right tray")

            elif key == "simon_says":
                if (lvl.get("pads") or 4) < 2:
                    err(key, li, name, f"pads={lvl.get('pads')} < 2")

    print(f"\n{'='*60}")
    if errors:
        print(f"❌ {len(errors)} ERRORS")
        for e in errors:
            print(e)
    else:
        print("✅ Zero data errors — every game's prompts match its data.")
    if warnings:
        print(f"\n⚠️  {len(warnings)} warnings")
        for w in warnings:
            print(w)
    print(f"{'='*60}")
    return len(errors)


if __name__ == "__main__":
    rc = asyncio.run(validate())
    sys.exit(1 if rc > 0 else 0)

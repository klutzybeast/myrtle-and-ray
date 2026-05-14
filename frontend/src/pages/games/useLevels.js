// Tiny shared helpers for the level-rotation system used by every game.
import { useEffect, useMemo, useState, useCallback } from "react";

const LS_KEY = (gameKey) => `mr_level_${gameKey}`;

export function useRotatingLevel(gameKey, levels) {
  // levels can be undefined while loading or admin-empty
  const safeLevels = useMemo(() => Array.isArray(levels) && levels.length ? levels : [], [levels]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!safeLevels.length) return;
    const raw = parseInt(localStorage.getItem(LS_KEY(gameKey)) || "0", 10);
    const safe = Number.isFinite(raw) ? Math.max(0, raw) % safeLevels.length : 0;
    setIdx(safe);
  }, [gameKey, safeLevels.length]);

  const advance = useCallback(() => {
    if (!safeLevels.length) return;
    const next = (idx + 1) % safeLevels.length;
    setIdx(next);
    localStorage.setItem(LS_KEY(gameKey), String(next));
  }, [idx, safeLevels.length, gameKey]);

  const setLevel = useCallback((n) => {
    if (!safeLevels.length) return;
    const safe = Math.max(0, n) % safeLevels.length;
    setIdx(safe);
    localStorage.setItem(LS_KEY(gameKey), String(safe));
  }, [safeLevels.length, gameKey]);

  return { level: safeLevels[idx] || null, idx, total: safeLevels.length, advance, setLevel, levels: safeLevels };
}

export function LevelHeader({ idx, total, levels, onPick, onAdvance }) {
  if (total <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-2 bg-[#eef9fb] rounded-2xl px-3 py-2 text-sm" data-testid="level-header">
      <div className="font-bold text-[#3a4a55]">
        Level {idx + 1} of {total}
        {levels?.[idx]?.name && <span className="text-[#5a8a6f]"> — {levels[idx].name}</span>}
      </div>
      <div className="flex gap-1 flex-wrap justify-end">
        {levels.map((l, i) => (
          <button key={i} onClick={() => onPick(i)} className={`text-[11px] font-bold px-2 py-1 rounded-full ${i === idx ? "bg-[#7fcfc7] text-white" : "bg-white text-[#5a8a6f] border border-[#f4e4c6]"}`} data-testid={`level-pick-${i}`}>
            {l?.name || i + 1}
          </button>
        ))}
        <button onClick={onAdvance} className="text-[11px] font-bold px-2 py-1 rounded-full bg-[#fcd5b4] text-[#8b6f4d]" data-testid="level-next">Next →</button>
      </div>
    </div>
  );
}

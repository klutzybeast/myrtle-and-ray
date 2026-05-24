import { useEffect, useMemo, useState } from "react";
import { useRotatingLevel, LevelHeader } from "./useLevels";

// Click on hidden items in a scene to find them all.
// data.levels[i] = { name, scene_emoji_grid: [["🌊","🐚",...], ...], finds: ["🐚","🐠",...] }
export default function HiddenObjects({ data, onComplete }) {
  const levels = useMemo(() => data?.levels || [], [data]);
  const { level, idx, total, advance, setLevel, levels: L } = useRotatingLevel("hidden_objects", levels);
  const [found, setFound] = useState([]);
  const [hint, setHint] = useState(null);
  const [done, setDone] = useState(false);

  useEffect(() => { setFound([]); setHint(null); setDone(false); }, [level, idx]);

  if (!level) return <Empty />;
  const grid = level.scene_emoji_grid || [];
  const finds = level.finds || [];
  const remaining = finds.filter((f) => !found.includes(f));
  const target = remaining[0];

  const onCellClick = (emoji, r, c) => {
    if (done) return;
    if (emoji === target) {
      setFound((f) => [...f, emoji]);
      if (found.length + 1 >= finds.length) {
        setDone(true);
        onComplete?.();
      }
    } else {
      setHint({ r, c });
      setTimeout(() => setHint(null), 500);
    }
  };

  return (
    <div className="space-y-3" data-testid="game-hidden-objects">
      <LevelHeader idx={idx} total={total} levels={L} onPick={setLevel} onAdvance={advance} />
      <div className="bg-[#fff8ec] rounded-2xl px-3 py-2 text-sm text-center">
        <div className="font-bold text-[#3a4a55] flex items-center justify-center gap-2">
          {level.difficulty && (
            <span className={`text-[10px] uppercase tracking-wider font-black px-2 py-0.5 rounded-full ${level.difficulty === "easy" ? "bg-[#eaf7f5] text-[#5a8a6f]" : level.difficulty === "medium" ? "bg-[#fff4d6] text-[#a36b29]" : "bg-[#fde2e7] text-[#b04a5c]"}`}>{level.difficulty}</span>
          )}
          <span>Find: <span className="text-2xl mx-1">{done ? "🎉" : target}</span></span>
        </div>
        <div className="text-xs text-[#6b7280] mt-1">Found {found.length} / {finds.length}: <span className="text-lg">{found.join(" ")}</span></div>
      </div>
      <div className="bg-gradient-to-b from-[#e8f8f5] to-[#cfeef0] rounded-3xl p-2 overflow-auto" style={{ maxHeight: 420 }}>
        <div className="inline-grid mx-auto gap-0.5" style={{ gridTemplateColumns: `repeat(${grid[0]?.length || 0}, 1fr)` }}>
          {grid.map((row, r) => row.map((e, c) => {
            const isWrong = hint?.r === r && hint?.c === c;
            return (
              <button
                key={`${r}-${c}`}
                onClick={() => onCellClick(e, r, c)}
                className={`text-2xl w-10 h-10 grid place-items-center rounded transition-colors ${isWrong ? "bg-red-200" : "hover:bg-white/40"}`}
                data-testid={`hidden-cell-${r}-${c}`}
              >
                {e}
              </button>
            );
          }))}
        </div>
      </div>
      {done && (
        <div className="text-center bg-[#fff8ec] rounded-2xl py-3">
          <div className="font-accent text-xl font-bold text-[#5a8a6f]">🌟 Sharp eyes!</div>
          <button onClick={advance} className="btn-primary mt-2" data-testid="hidden-next">Next scene →</button>
        </div>
      )}
    </div>
  );
}

function Empty() { return <div className="text-center text-[#6b7280] py-10">No Hidden Object levels yet.</div>; }

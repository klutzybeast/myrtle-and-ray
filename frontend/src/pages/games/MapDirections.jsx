import { useEffect, useMemo, useState } from "react";
import { useRotatingLevel, LevelHeader } from "./useLevels";

// Follow compass directions to reach the goal on a small grid.
// data.levels[i] = { name, cols, rows, start: [r,c], goal: [r,c], steps: ["N","E","E","S"], hint?: "..." }
export default function MapDirections({ data, onComplete }) {
  const levels = useMemo(() => data?.levels || [], [data]);
  const { level, idx, total, advance, setLevel, levels: L } = useRotatingLevel("map_directions", levels);
  const [pos, setPos] = useState(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (level) setPos(level.start || [0, 0]);
    setStepIdx(0); setFeedback(null); setDone(false);
  }, [level, idx]);

  if (!level) return <Empty />;

  const cols = level.cols || 4;
  const rows = level.rows || 4;
  const goal = level.goal || [0, 0];
  const steps = level.steps || [];
  const expected = steps[stepIdx];

  const move = (dir) => {
    if (done || !pos) return;
    if (dir !== expected) {
      setFeedback({ correct: false, expected });
      setTimeout(() => setFeedback(null), 700);
      return;
    }
    const [r, c] = pos;
    let nr = r, nc = c;
    if (dir === "N") nr = Math.max(0, r - 1);
    if (dir === "S") nr = Math.min(rows - 1, r + 1);
    if (dir === "E") nc = Math.min(cols - 1, c + 1);
    if (dir === "W") nc = Math.max(0, c - 1);
    setPos([nr, nc]);
    const ns = stepIdx + 1;
    setStepIdx(ns);
    setFeedback({ correct: true });
    setTimeout(() => setFeedback(null), 400);
    if (ns >= steps.length) {
      if (nr === goal[0] && nc === goal[1]) {
        setDone(true);
        onComplete?.();
      } else {
        setFeedback({ correct: false, expected: "(goal missed)" });
      }
    }
  };

  return (
    <div className="space-y-3" data-testid="game-map-directions">
      <LevelHeader idx={idx} total={total} levels={L} onPick={setLevel} onAdvance={advance} />
      <div className="text-center text-sm text-[#4a5568]">
        {!done && (
          <>Follow the trail: tap the matching arrow. Next step: <span className="font-accent font-black text-xl text-[#f0a988]">{expected || "🎉"}</span></>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[#fffbf3] rounded-3xl p-2 border-2 border-[#f4e4c6]">
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }} data-testid="map-grid">
            {Array.from({ length: rows * cols }, (_, i) => {
              const r = Math.floor(i / cols);
              const c = i % cols;
              const isStart = level.start && r === level.start[0] && c === level.start[1];
              const isGoal = r === goal[0] && c === goal[1];
              const isPos = pos && r === pos[0] && c === pos[1];
              return (
                <div key={i} className={`aspect-square rounded-md grid place-items-center text-xl border ${isPos ? "bg-[#7fcfc7] border-[#5a8a6f]" : "bg-white border-[#e9eef2]"}`}
                  data-testid={`map-cell-${r}-${c}`}
                >
                  {isPos ? "🐢" : isGoal ? "🏁" : isStart ? "·" : ""}
                </div>
              );
            })}
          </div>
        </div>
        <div className="bg-gradient-to-b from-[#eef9fb] to-[#cfeef0] rounded-3xl p-3 border-2 border-[#7fcfc7]">
          <div className="text-xs text-[#5a6b76] text-center mb-2">Step {stepIdx} / {steps.length}</div>
          <div className="grid grid-cols-3 gap-2 max-w-[180px] mx-auto" data-testid="map-pad">
            <div />
            <button onClick={() => move("N")} className="aspect-square bg-white rounded-2xl border-2 border-[#7fcfc7] font-bold text-2xl hover:bg-[#eaf7f5]" data-testid="map-N">⬆️</button>
            <div />
            <button onClick={() => move("W")} className="aspect-square bg-white rounded-2xl border-2 border-[#7fcfc7] font-bold text-2xl hover:bg-[#eaf7f5]" data-testid="map-W">⬅️</button>
            <div className="aspect-square grid place-items-center text-xs font-bold text-[#5a6b76]">N/E/S/W</div>
            <button onClick={() => move("E")} className="aspect-square bg-white rounded-2xl border-2 border-[#7fcfc7] font-bold text-2xl hover:bg-[#eaf7f5]" data-testid="map-E">➡️</button>
            <div />
            <button onClick={() => move("S")} className="aspect-square bg-white rounded-2xl border-2 border-[#7fcfc7] font-bold text-2xl hover:bg-[#eaf7f5]" data-testid="map-S">⬇️</button>
            <div />
          </div>
          {level.hint && <p className="text-xs text-[#5a6b76] mt-2 text-center">💡 {level.hint}</p>}
        </div>
      </div>
      {feedback && !done && (
        <div className={`rounded-2xl p-2 text-center text-sm font-bold ${feedback.correct ? "bg-[#eaf7f5] text-[#5a8a6f]" : "bg-red-50 text-red-700"}`} data-testid="map-feedback">
          {feedback.correct ? "✅" : `❌ Try ${feedback.expected}`}
        </div>
      )}
      {done && (
        <div className="text-center bg-[#fff8ec] rounded-2xl py-3">
          <div className="font-accent text-xl font-bold text-[#5a8a6f]">🌟 You reached the goal!</div>
          <button onClick={advance} className="btn-primary mt-2" data-testid="map-next">Next trail →</button>
        </div>
      )}
    </div>
  );
}

function Empty() { return <div className="text-center text-[#6b7280] py-10">No Map Directions levels yet.</div>; }

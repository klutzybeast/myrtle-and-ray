import { useEffect, useMemo, useState } from "react";
import { useRotatingLevel, LevelHeader } from "./useLevels";

// Show items briefly, hide one, ask which is missing.
// data.levels[i] = { name, items: ["🐚","🐠",...], reveal_seconds: 3 }
export default function WhatsMissing({ data, onComplete }) {
  const levels = useMemo(() => data?.levels || [], [data]);
  const { level, idx, total, advance, setLevel, levels: L } = useRotatingLevel("whats_missing", levels);
  const [phase, setPhase] = useState("show"); // show | guess | done
  const [missing, setMissing] = useState(null);
  const [visible, setVisible] = useState([]);
  const [wrong, setWrong] = useState(null);

  useEffect(() => {
    if (!level) return;
    setPhase("show");
    const items = level.items || [];
    const m = items[Math.floor(Math.random() * items.length)];
    setMissing(m);
    setVisible(items);
    const t = setTimeout(() => {
      setVisible(items.filter((x) => x !== m));
      setPhase("guess");
    }, (level.reveal_seconds || 3) * 1000);
    return () => clearTimeout(t);
  }, [level, idx]);

  if (!level) return <Empty />;

  const onPick = (it) => {
    if (phase !== "guess") return;
    if (it === missing) {
      setPhase("done");
      onComplete?.();
    } else {
      setWrong(it);
      setTimeout(() => setWrong(null), 500);
    }
  };

  return (
    <div className="space-y-3" data-testid="game-whats-missing">
      <LevelHeader idx={idx} total={total} levels={L} onPick={setLevel} onAdvance={advance} />
      <div className="text-center text-sm text-[#4a5568]">
        {phase === "show" && <p>🔍 Memorize the items… <span className="text-xs text-[#6b7280]">({level.reveal_seconds || 3}s)</span></p>}
        {phase === "guess" && <p className="font-bold text-[#3a4a55]">Which one is missing? Tap your guess.</p>}
        {phase === "done" && <p className="font-accent text-xl font-bold text-[#5a8a6f]">🌟 Sharp memory!</p>}
      </div>

      {phase === "show" ? (
        <div className="flex flex-wrap gap-2 justify-center bg-[#fffbf3] rounded-3xl p-4 border border-[#f4e4c6]" data-testid="missing-show">
          {visible.map((it, i) => <span key={i} className="text-4xl">{it}</span>)}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 justify-center bg-[#fffbf3] rounded-3xl p-4 border border-[#f4e4c6] opacity-80" data-testid="missing-remaining">
            {visible.map((it, i) => <span key={i} className="text-4xl">{it}</span>)}
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2" data-testid="missing-options">
            {(level.items || []).map((it, i) => (
              <button
                key={i}
                onClick={() => onPick(it)}
                disabled={phase === "done"}
                className={`text-4xl bg-white rounded-2xl border-2 py-3 hover:bg-[#eef9fb] transition-colors ${wrong === it ? "border-red-400 bg-red-50 animate-pulse" : "border-[#f4e4c6]"} ${phase === "done" && it === missing ? "border-[#5a8a6f] bg-[#eaf7f5]" : ""}`}
                data-testid={`missing-option-${i}`}
              >{it}</button>
            ))}
          </div>
        </div>
      )}

      {phase === "done" && <button onClick={advance} className="btn-primary w-full justify-center" data-testid="missing-next">Next level →</button>}
    </div>
  );
}

function Empty() { return <div className="text-center text-[#6b7280] py-10">No What's Missing levels yet.</div>; }

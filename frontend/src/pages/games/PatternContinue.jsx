import { useEffect, useMemo, useState } from "react";
import { useRotatingLevel, LevelHeader } from "./useLevels";

// Show a repeating pattern, ask which item comes next.
// data.levels[i] = { name, pattern: ["🌊","🐚","🌊","🐚","🌊","?"], answer: "🐚", choices: ["🐚","🦀","🐠"] }
export default function PatternContinue({ data, onComplete }) {
  const levels = useMemo(() => data?.levels || [], [data]);
  const { level, idx, total, advance, setLevel, levels: L } = useRotatingLevel("pattern_continue", levels);
  const [done, setDone] = useState(false);
  const [wrong, setWrong] = useState(null);

  useEffect(() => { setDone(false); setWrong(null); }, [level, idx]);
  if (!level) return <Empty />;

  const pick = (c) => {
    if (done) return;
    if (c === level.answer) { setDone(true); onComplete?.(); }
    else { setWrong(c); setTimeout(() => setWrong(null), 500); }
  };

  return (
    <div className="space-y-3" data-testid="game-pattern-continue">
      <LevelHeader idx={idx} total={total} levels={L} onPick={setLevel} onAdvance={advance} />
      <p className="text-sm text-[#4a5568] text-center font-bold">What comes next in the pattern?</p>
      <div className="flex gap-1.5 justify-center bg-gradient-to-r from-[#fff8ec] to-[#eaf7f5] rounded-3xl p-4 border border-[#f4e4c6] overflow-x-auto" data-testid="pattern-display">
        {(level.pattern || []).map((p, i) => (
          <span key={i} className={`text-4xl ${p === "?" ? "bg-white rounded-2xl border-2 border-dashed border-[#f0a988] px-2 animate-pulse" : ""}`}>{done && p === "?" ? level.answer : p}</span>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2" data-testid="pattern-choices">
        {(level.choices || []).map((c, i) => (
          <button
            key={i}
            onClick={() => pick(c)}
            disabled={done}
            className={`text-4xl bg-white rounded-2xl border-2 py-3 hover:bg-[#eef9fb] ${wrong === c ? "border-red-400 bg-red-50 animate-pulse" : "border-[#f4e4c6]"} ${done && c === level.answer ? "border-[#5a8a6f] bg-[#eaf7f5]" : ""}`}
            data-testid={`pattern-choice-${i}`}
          >{c}</button>
        ))}
      </div>
      {done && (
        <div className="text-center bg-[#fff8ec] rounded-2xl py-2">
          <div className="font-accent text-lg font-bold text-[#5a8a6f]">🌟 Pattern pro!</div>
          <button onClick={advance} className="btn-primary mt-2" data-testid="pattern-next">Next level →</button>
        </div>
      )}
    </div>
  );
}

function Empty() { return <div className="text-center text-[#6b7280] py-10">No Pattern levels yet.</div>; }

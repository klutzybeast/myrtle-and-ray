import { useEffect, useMemo, useState } from "react";
import { useRotatingLevel, LevelHeader } from "./useLevels";

// Balance the scales: pick which side is heavier (or equal).
// data.levels[i] = { name, rounds: [{ left: [{emoji,weight}], right: [{emoji,weight}], prompt?: "...", explain?: "..." }] }
// Answer is computed: "left" | "right" | "equal".
export default function ScalesBalance({ data, onComplete }) {
  const levels = useMemo(() => data?.levels || [], [data]);
  const { level, idx, total, advance, setLevel, levels: L } = useRotatingLevel("scales_balance", levels);
  const [r, setR] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [done, setDone] = useState(false);

  useEffect(() => { setR(0); setScore(0); setFeedback(null); setDone(false); }, [level, idx]);
  if (!level) return <Empty />;

  const rounds = level.rounds || [];
  const cur = rounds[r];
  const sumL = (cur?.left || []).reduce((s, x) => s + (x.weight || 1), 0);
  const sumR = (cur?.right || []).reduce((s, x) => s + (x.weight || 1), 0);
  const answer = sumL === sumR ? "equal" : sumL > sumR ? "left" : "right";

  const pick = (c) => {
    if (feedback || done) return;
    const correct = c === answer;
    setFeedback({ correct, picked: c, explain: cur.explain });
    if (correct) setScore((s) => s + 1);
    setTimeout(() => {
      if (r + 1 >= rounds.length) { setDone(true); onComplete?.(); }
      else { setR(r + 1); setFeedback(null); }
    }, 1600);
  };

  if (done) {
    return (
      <div className="space-y-3 text-center" data-testid="game-scales-balance-done">
        <LevelHeader idx={idx} total={total} levels={L} onPick={setLevel} onAdvance={advance} />
        <div className="bg-[#fff8ec] rounded-3xl p-6">
          <div className="text-5xl mb-2">⚖️</div>
          <div className="font-accent text-2xl font-bold text-[#5a8a6f]">Balance master! {score} / {rounds.length}</div>
          <button onClick={advance} className="btn-primary mt-3" data-testid="scales-next">Next level →</button>
        </div>
      </div>
    );
  }

  // tilt angle for the beam
  const diff = sumL - sumR;
  const tilt = Math.max(-12, Math.min(12, -diff * 4));

  return (
    <div className="space-y-3" data-testid="game-scales-balance">
      <LevelHeader idx={idx} total={total} levels={L} onPick={setLevel} onAdvance={advance} />
      <div className="flex justify-between text-xs text-[#6b7280]">
        <span>Puzzle {r + 1} / {rounds.length}</span><span>Score: {score}</span>
      </div>
      <div className="bg-gradient-to-b from-[#fffbf3] to-[#fff3d6] rounded-3xl border-2 border-[#f4e4c6] p-4 text-center">
        <p className="text-sm text-[#5a6b76]">{cur?.prompt || "Which side is heavier?"}</p>
        <div className="relative h-44 mt-2">
          <div className="absolute left-1/2 -translate-x-1/2 bottom-2 w-2 h-32 bg-[#8b6f4d] rounded" />
          <div className="absolute left-1/2 -translate-x-1/2 top-4 w-72 max-w-full" style={{ transform: `translateX(-50%) rotate(${tilt}deg)`, transformOrigin: "center", transition: "transform .35s" }}>
            <div className="relative h-2 bg-[#8b6f4d] rounded">
              <div className="absolute -top-12 -left-3 flex flex-col items-center w-20">
                <div className="bg-white border-2 border-[#7fcfc7] rounded-lg px-1 py-0.5 text-base flex flex-wrap justify-center gap-0.5 min-h-[28px]" data-testid="scales-left-tray">
                  {(cur?.left || []).map((it, i) => <span key={i}>{it.emoji}</span>)}
                </div>
                <div className="text-xs font-bold text-[#5a6b76] mt-1">LEFT</div>
              </div>
              <div className="absolute -top-12 -right-3 flex flex-col items-center w-20">
                <div className="bg-white border-2 border-[#7fcfc7] rounded-lg px-1 py-0.5 text-base flex flex-wrap justify-center gap-0.5 min-h-[28px]" data-testid="scales-right-tray">
                  {(cur?.right || []).map((it, i) => <span key={i}>{it.emoji}</span>)}
                </div>
                <div className="text-xs font-bold text-[#5a6b76] mt-1">RIGHT</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2" data-testid="scales-options">
        {["left", "equal", "right"].map((opt) => {
          const isAns = feedback && opt === answer;
          const isWrong = feedback && feedback.picked === opt && !feedback.correct;
          return (
            <button
              key={opt}
              onClick={() => pick(opt)}
              disabled={!!feedback}
              className={`bg-white rounded-2xl border-2 py-3 font-accent text-lg font-bold capitalize transition-colors ${isAns ? "border-[#5a8a6f] bg-[#eaf7f5] text-[#5a8a6f]" : isWrong ? "border-red-400 bg-red-50 text-red-600" : "border-[#f4e4c6] text-[#3a4a55] hover:bg-[#fffbf3]"}`}
              data-testid={`scales-option-${opt}`}
            >{opt === "left" ? "⬅️ Left" : opt === "right" ? "Right ➡️" : "⚖️ Equal"}</button>
          );
        })}
      </div>
      {feedback && (
        <div className={`rounded-2xl p-3 text-center ${feedback.correct ? "bg-[#eaf7f5] text-[#5a8a6f]" : "bg-red-50 text-red-700"}`} data-testid="scales-feedback">
          <div className="font-bold">{feedback.correct ? "✅ Right!" : `❌ It was ${answer}`}</div>
          {feedback.explain && <div className="text-sm mt-1">{feedback.explain}</div>}
        </div>
      )}
    </div>
  );
}

function Empty() { return <div className="text-center text-[#6b7280] py-10">No Scales Balance levels yet.</div>; }

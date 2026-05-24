import { useEffect, useMemo, useState } from "react";
import { useRotatingLevel, LevelHeader } from "./useLevels";

// Visual addition / subtraction problems with emoji counters.
// data.levels[i] = { name, rounds: [{ a, op: "+"|"-", b, emoji, choices: [n,n,n] }] }
// Answer is computed from a op b.
export default function MathPond({ data, onComplete }) {
  const levels = useMemo(() => data?.levels || [], [data]);
  const { level, idx, total, advance, setLevel, levels: L } = useRotatingLevel("math_pond", levels);
  const [r, setR] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [done, setDone] = useState(false);

  useEffect(() => { setR(0); setScore(0); setFeedback(null); setDone(false); }, [level, idx]);
  if (!level) return <Empty />;

  const rounds = level.rounds || [];
  const cur = rounds[r];
  const answer = cur ? (cur.op === "-" ? cur.a - cur.b : cur.a + cur.b) : 0;

  const pick = (n) => {
    if (feedback || done) return;
    const correct = n === answer;
    setFeedback({ correct, picked: n });
    if (correct) setScore((s) => s + 1);
    setTimeout(() => {
      if (r + 1 >= rounds.length) { setDone(true); onComplete?.(); }
      else { setR(r + 1); setFeedback(null); }
    }, 1300);
  };

  if (done) {
    return (
      <div className="space-y-3 text-center" data-testid="game-math-pond-done">
        <LevelHeader idx={idx} total={total} levels={L} onPick={setLevel} onAdvance={advance} />
        <div className="bg-[#fff8ec] rounded-3xl p-6">
          <div className="text-5xl mb-2">🌟</div>
          <div className="font-accent text-2xl font-bold text-[#5a8a6f]">Math champ! {score} / {rounds.length}</div>
          <button onClick={advance} className="btn-primary mt-3" data-testid="math-next">Next level →</button>
        </div>
      </div>
    );
  }

  const emoji = cur?.emoji || "🐠";
  const groupA = Array.from({ length: cur?.a || 0 }, (_, i) => i);
  const groupB = Array.from({ length: cur?.b || 0 }, (_, i) => i);

  return (
    <div className="space-y-3" data-testid="game-math-pond">
      <LevelHeader idx={idx} total={total} levels={L} onPick={setLevel} onAdvance={advance} />
      <div className="flex justify-between text-xs text-[#6b7280]">
        <span>Question {r + 1} / {rounds.length}</span><span>Score: {score}</span>
      </div>
      <div className="bg-gradient-to-b from-[#dff3f3] to-[#aedde0] rounded-3xl border-2 border-[#7fcfc7] p-4">
        <div className="text-center font-accent text-3xl font-bold text-[#3a4a55] mb-3">
          {cur?.a} {cur?.op || "+"} {cur?.b} = ?
        </div>
        <div className="flex items-center justify-center gap-4 flex-wrap" data-testid="math-counters">
          <div className="bg-white/70 rounded-2xl p-2 flex flex-wrap max-w-[40%] justify-center gap-1">
            {groupA.map((i) => <span key={i} className="text-3xl">{emoji}</span>)}
          </div>
          <span className="text-3xl font-black text-[#5a8a6f]">{cur?.op || "+"}</span>
          <div className={`rounded-2xl p-2 flex flex-wrap max-w-[40%] justify-center gap-1 ${cur?.op === "-" ? "bg-red-100/70" : "bg-white/70"}`}>
            {groupB.map((i) => <span key={i} className="text-3xl" style={cur?.op === "-" ? { filter: "grayscale(0.6)", opacity: 0.6 } : {}}>{emoji}</span>)}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2" data-testid="math-options">
        {(cur?.choices || []).map((c, i) => {
          const isAns = feedback && c === answer;
          const isWrong = feedback && feedback.picked === c && !feedback.correct;
          return (
            <button
              key={i}
              onClick={() => pick(c)}
              disabled={!!feedback}
              className={`bg-white rounded-2xl border-2 py-4 font-accent text-3xl font-black transition-colors ${isAns ? "border-[#5a8a6f] bg-[#eaf7f5] text-[#5a8a6f]" : isWrong ? "border-red-400 bg-red-50 text-red-600" : "border-[#f4e4c6] text-[#3a4a55] hover:bg-[#fffbf3]"}`}
              data-testid={`math-option-${i}`}
            >{c}</button>
          );
        })}
      </div>
      {feedback && (
        <div className={`rounded-2xl p-3 text-center text-sm font-bold ${feedback.correct ? "bg-[#eaf7f5] text-[#5a8a6f]" : "bg-red-50 text-red-700"}`} data-testid="math-feedback">
          {feedback.correct ? `✅ Right! ${cur.a} ${cur.op || "+"} ${cur.b} = ${answer}` : `❌ It was ${answer}`}
        </div>
      )}
    </div>
  );
}

function Empty() { return <div className="text-center text-[#6b7280] py-10">No Math Pond levels yet.</div>; }

import { useEffect, useMemo, useState } from "react";
import { useRotatingLevel, LevelHeader } from "./useLevels";

// Pick the item that doesn't belong with the others.
// data.levels[i] = { name, rounds: [{ prompt, items: ["🐠","🐠","🐢","🐠"], odd_index: 2, explain: "..." }] }
export default function OddOneOut({ data, onComplete }) {
  const levels = useMemo(() => data?.levels || [], [data]);
  const { level, idx, total, advance, setLevel, levels: L } = useRotatingLevel("odd_one_out", levels);
  const [r, setR] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [done, setDone] = useState(false);

  useEffect(() => { setR(0); setScore(0); setFeedback(null); setDone(false); }, [level, idx]);
  if (!level) return <Empty />;

  const rounds = level.rounds || [];
  const cur = rounds[r];

  const pick = (i) => {
    if (feedback || done) return;
    const correct = i === cur.odd_index;
    setFeedback({ correct, explain: cur.explain });
    if (correct) setScore((s) => s + 1);
    setTimeout(() => {
      if (r + 1 >= rounds.length) { setDone(true); onComplete?.(); }
      else { setR(r + 1); setFeedback(null); }
    }, 1500);
  };

  if (done) {
    return (
      <div className="space-y-3 text-center" data-testid="game-odd-done">
        <LevelHeader idx={idx} total={total} levels={L} onPick={setLevel} onAdvance={advance} />
        <div className="bg-[#fff8ec] rounded-3xl p-6">
          <div className="text-5xl mb-2">🌟</div>
          <div className="font-accent text-2xl font-bold text-[#5a8a6f]">Sharp eye! {score} / {rounds.length}</div>
          <button onClick={advance} className="btn-primary mt-3" data-testid="odd-next">Next round →</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="game-odd-one-out">
      <LevelHeader idx={idx} total={total} levels={L} onPick={setLevel} onAdvance={advance} />
      <div className="flex justify-between text-xs text-[#6b7280]">
        <span>Round {r + 1} / {rounds.length}</span><span>Score: {score}</span>
      </div>
      <div className="bg-white rounded-3xl p-4 border-2 border-[#f4e4c6] text-center">
        <p className="font-accent text-lg text-[#3a4a55]" data-testid="odd-prompt">{cur?.prompt || "Which one doesn't belong?"}</p>
      </div>
      <div className="grid grid-cols-4 gap-2" data-testid="odd-options">
        {(cur?.items || []).map((it, i) => {
          const isPicked = feedback && i === cur.odd_index;
          return (
            <button
              key={i}
              onClick={() => pick(i)}
              className={`text-5xl bg-white rounded-2xl border-2 py-4 hover:bg-[#eef9fb] transition-colors ${isPicked ? "border-[#5a8a6f] bg-[#eaf7f5] scale-110" : "border-[#f4e4c6]"}`}
              data-testid={`odd-option-${i}`}
            >{it}</button>
          );
        })}
      </div>
      {feedback && (
        <div className={`rounded-2xl p-3 text-center ${feedback.correct ? "bg-[#eaf7f5] text-[#5a8a6f]" : "bg-red-50 text-red-700"}`} data-testid="odd-feedback">
          <div className="font-bold">{feedback.correct ? "✅ Right!" : "❌ Try again next time"}</div>
          {feedback.explain && <div className="text-sm mt-1">{feedback.explain}</div>}
        </div>
      )}
    </div>
  );
}

function Empty() { return <div className="text-center text-[#6b7280] py-10">No Odd-One-Out levels yet.</div>; }

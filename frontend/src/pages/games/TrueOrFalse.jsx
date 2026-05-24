import { useEffect, useMemo, useState } from "react";
import { useRotatingLevel, LevelHeader } from "./useLevels";

// Quick-fire true/false trivia about Stingray Cay.
// data.levels[i] = { name, statements: [{ text, answer: true|false, explain: "..." }] }
export default function TrueOrFalse({ data, onComplete }) {
  const levels = useMemo(() => data?.levels || [], [data]);
  const { level, idx, total, advance, setLevel, levels: L } = useRotatingLevel("true_or_false", levels);
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [done, setDone] = useState(false);

  useEffect(() => { setI(0); setScore(0); setFeedback(null); setDone(false); }, [level, idx]);
  if (!level) return <Empty />;

  const statements = level.statements || [];
  const current = statements[i];

  const pick = (val) => {
    if (feedback) return;
    const correct = val === current.answer;
    setFeedback({ correct, explain: current.explain });
    if (correct) setScore((s) => s + 1);
    setTimeout(() => {
      if (i + 1 >= statements.length) { setDone(true); onComplete?.(); }
      else { setI(i + 1); setFeedback(null); }
    }, 1600);
  };

  if (done) {
    return (
      <div className="space-y-3 text-center" data-testid="game-true-false-done">
        <LevelHeader idx={idx} total={total} levels={L} onPick={setLevel} onAdvance={advance} />
        <div className="bg-[#fff8ec] rounded-3xl p-6">
          <div className="text-5xl mb-2">🌟</div>
          <div className="font-accent text-2xl font-bold text-[#5a8a6f]">Score: {score} / {statements.length}</div>
          <button onClick={advance} className="btn-primary mt-3" data-testid="tf-next">Next round →</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="game-true-false">
      <LevelHeader idx={idx} total={total} levels={L} onPick={setLevel} onAdvance={advance} />
      <div className="flex justify-between text-xs text-[#6b7280]">
        <span>Question {i + 1} / {statements.length}</span><span>Score: {score}</span>
      </div>
      <div className="bg-white rounded-3xl p-5 border-2 border-[#f4e4c6] min-h-[140px] flex items-center justify-center">
        <p className="font-accent text-xl text-center text-[#3a4a55]" data-testid="tf-statement">{current?.text}</p>
      </div>
      {feedback ? (
        <div className={`rounded-2xl p-4 text-center ${feedback.correct ? "bg-[#eaf7f5] text-[#5a8a6f]" : "bg-red-50 text-red-700"}`} data-testid="tf-feedback">
          <div className="font-bold text-lg">{feedback.correct ? "✅ Right!" : "❌ Not quite"}</div>
          <div className="text-sm mt-1">{feedback.explain}</div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => pick(true)} className="bg-[#5a8a6f] hover:bg-[#4a7a5f] text-white py-4 rounded-2xl font-accent text-xl font-bold shadow" data-testid="tf-true">✅ TRUE</button>
          <button onClick={() => pick(false)} className="bg-[#e89bab] hover:bg-[#d88b9b] text-white py-4 rounded-2xl font-accent text-xl font-bold shadow" data-testid="tf-false">❌ FALSE</button>
        </div>
      )}
    </div>
  );
}

function Empty() { return <div className="text-center text-[#6b7280] py-10">No True/False levels yet.</div>; }

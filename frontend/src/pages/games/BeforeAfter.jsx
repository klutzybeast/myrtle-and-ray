import { useEffect, useMemo, useState } from "react";
import { useRotatingLevel, LevelHeader } from "./useLevels";

// "What happens BEFORE / AFTER this scene?" Pick the correct moment.
// data.levels[i] = { name, rounds: [{ when: "before"|"after", anchor_emoji, anchor: "Sami opens his lunch box", choices: ["...","...","..."], answer_idx: 1, fun?: "..." }] }
export default function BeforeAfter({ data, onComplete }) {
  const levels = useMemo(() => data?.levels || [], [data]);
  const { level, idx, total, advance, setLevel, levels: L } = useRotatingLevel("before_after", levels);
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
    const correct = i === cur.answer_idx;
    setFeedback({ correct, picked: i, fun: cur.fun });
    if (correct) setScore((s) => s + 1);
    setTimeout(() => {
      if (r + 1 >= rounds.length) { setDone(true); onComplete?.(); }
      else { setR(r + 1); setFeedback(null); }
    }, 1700);
  };

  if (done) {
    return (
      <div className="space-y-3 text-center" data-testid="game-before-after-done">
        <LevelHeader idx={idx} total={total} levels={L} onPick={setLevel} onAdvance={advance} />
        <div className="bg-[#fff8ec] rounded-3xl p-6">
          <div className="text-5xl mb-2">🌟</div>
          <div className="font-accent text-2xl font-bold text-[#5a8a6f]">Story sleuth! {score} / {rounds.length}</div>
          <button onClick={advance} className="btn-primary mt-3" data-testid="ba-next">Next level →</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="game-before-after">
      <LevelHeader idx={idx} total={total} levels={L} onPick={setLevel} onAdvance={advance} />
      <div className="flex justify-between text-xs text-[#6b7280]">
        <span>Story {r + 1} / {rounds.length}</span><span>Score: {score}</span>
      </div>
      <div className="bg-gradient-to-b from-[#eef9fb] to-[#cfeef0] rounded-3xl border-2 border-[#7fcfc7] p-5 text-center">
        <div className="text-5xl mb-2" aria-hidden>{cur?.anchor_emoji}</div>
        <p className="font-accent text-lg text-[#3a4a55]">{cur?.anchor}</p>
        <p className="font-bold text-sm text-[#5a8a6f] mt-2 uppercase tracking-wider">What happens {cur?.when}?</p>
      </div>
      <div className="space-y-2" data-testid="ba-options">
        {(cur?.choices || []).map((c, i) => {
          const isAns = feedback && i === cur.answer_idx;
          const isWrong = feedback && feedback.picked === i && !feedback.correct;
          return (
            <button
              key={i}
              onClick={() => pick(i)}
              disabled={!!feedback}
              className={`w-full text-left bg-white rounded-2xl border-2 px-4 py-3 font-bold transition-colors ${isAns ? "border-[#5a8a6f] bg-[#eaf7f5] text-[#5a8a6f]" : isWrong ? "border-red-400 bg-red-50 text-red-600" : "border-[#f4e4c6] text-[#3a4a55] hover:bg-[#fffbf3]"}`}
              data-testid={`ba-option-${i}`}
            >{c}</button>
          );
        })}
      </div>
      {feedback && (
        <div className={`rounded-2xl p-3 text-center ${feedback.correct ? "bg-[#eaf7f5] text-[#5a8a6f]" : "bg-red-50 text-red-700"}`} data-testid="ba-feedback">
          <div className="font-bold">{feedback.correct ? "✅ Yes!" : "❌ Not quite"}</div>
          {feedback.fun && <div className="text-sm mt-1">{feedback.fun}</div>}
        </div>
      )}
    </div>
  );
}

function Empty() { return <div className="text-center text-[#6b7280] py-10">No Before/After levels yet.</div>; }

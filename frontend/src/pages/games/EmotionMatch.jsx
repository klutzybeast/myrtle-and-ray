import { useEffect, useMemo, useState } from "react";
import { useRotatingLevel, LevelHeader } from "./useLevels";

// Read a short situation and pick the feeling that fits.
// data.levels[i] = { name, rounds: [{ scene: "Sami spills paint on his picture.", face: "😢", choices: ["happy","sad","angry"], answer: "sad", coach: "..." }] }
export default function EmotionMatch({ data, onComplete }) {
  const levels = useMemo(() => data?.levels || [], [data]);
  const { level, idx, total, advance, setLevel, levels: L } = useRotatingLevel("emotion_match", levels);
  const [r, setR] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [done, setDone] = useState(false);

  useEffect(() => { setR(0); setScore(0); setFeedback(null); setDone(false); }, [level, idx]);
  if (!level) return <Empty />;

  const rounds = level.rounds || [];
  const cur = rounds[r];

  const pick = (c) => {
    if (feedback || done) return;
    const correct = c === cur.answer;
    setFeedback({ correct, picked: c, coach: cur.coach });
    if (correct) setScore((s) => s + 1);
    setTimeout(() => {
      if (r + 1 >= rounds.length) { setDone(true); onComplete?.(); }
      else { setR(r + 1); setFeedback(null); }
    }, 1700);
  };

  if (done) {
    return (
      <div className="space-y-3 text-center" data-testid="game-emotion-match-done">
        <LevelHeader idx={idx} total={total} levels={L} onPick={setLevel} onAdvance={advance} />
        <div className="bg-[#fff8ec] rounded-3xl p-6">
          <div className="text-5xl mb-2">🫶</div>
          <div className="font-accent text-2xl font-bold text-[#5a8a6f]">Heart-smart! {score} / {rounds.length}</div>
          <button onClick={advance} className="btn-primary mt-3" data-testid="emotion-next">Next level →</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="game-emotion-match">
      <LevelHeader idx={idx} total={total} levels={L} onPick={setLevel} onAdvance={advance} />
      <div className="flex justify-between text-xs text-[#6b7280]">
        <span>Story {r + 1} / {rounds.length}</span><span>Score: {score}</span>
      </div>
      <div className="bg-gradient-to-b from-[#fff3d6] to-[#fde0b3] rounded-3xl border-2 border-[#f4d28a] p-5 text-center">
        <div className="text-7xl mb-2" aria-hidden>{cur?.face}</div>
        <p className="font-accent text-lg text-[#3a4a55] max-w-md mx-auto" data-testid="emotion-scene">{cur?.scene}</p>
      </div>
      <div className="grid grid-cols-3 gap-2" data-testid="emotion-options">
        {(cur?.choices || []).map((c, i) => {
          const isAns = feedback && c === cur.answer;
          const isWrong = feedback && feedback.picked === c && !feedback.correct;
          return (
            <button
              key={i}
              onClick={() => pick(c)}
              disabled={!!feedback}
              className={`bg-white rounded-2xl border-2 py-3 font-accent text-lg font-bold capitalize transition-colors ${isAns ? "border-[#5a8a6f] bg-[#eaf7f5] text-[#5a8a6f]" : isWrong ? "border-red-400 bg-red-50 text-red-600" : "border-[#f4e4c6] text-[#3a4a55] hover:bg-[#fffbf3]"}`}
              data-testid={`emotion-option-${i}`}
            >{c}</button>
          );
        })}
      </div>
      {feedback && (
        <div className={`rounded-2xl p-3 text-center ${feedback.correct ? "bg-[#eaf7f5] text-[#5a8a6f]" : "bg-red-50 text-red-700"}`} data-testid="emotion-feedback">
          <div className="font-bold">{feedback.correct ? "✅ Spot on!" : `❌ More like "${cur.answer}"`}</div>
          {feedback.coach && <div className="text-sm mt-1">{feedback.coach}</div>}
        </div>
      )}
    </div>
  );
}

function Empty() { return <div className="text-center text-[#6b7280] py-10">No Emotion Match levels yet.</div>; }

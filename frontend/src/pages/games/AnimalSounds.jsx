import { useEffect, useMemo, useState } from "react";
import { useRotatingLevel, LevelHeader } from "./useLevels";

// Match the animal to the sound it makes (or to its habitat / favorite food).
// data.levels[i] = { name, rounds: [{ animal: "🐢", prompt: "What sound does Myrtle make?", choices: ["Sploosh","Roar","Tweet"], answer: "Sploosh", fun: "..." }] }
export default function AnimalSounds({ data, onComplete }) {
  const levels = useMemo(() => data?.levels || [], [data]);
  const { level, idx, total, advance, setLevel, levels: L } = useRotatingLevel("animal_sounds", levels);
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
    setFeedback({ correct, fun: cur.fun, answer: cur.answer });
    if (correct) setScore((s) => s + 1);
    setTimeout(() => {
      if (r + 1 >= rounds.length) { setDone(true); onComplete?.(); }
      else { setR(r + 1); setFeedback(null); }
    }, 1700);
  };

  if (done) {
    return (
      <div className="space-y-3 text-center" data-testid="game-animal-sounds-done">
        <LevelHeader idx={idx} total={total} levels={L} onPick={setLevel} onAdvance={advance} />
        <div className="bg-[#fff8ec] rounded-3xl p-6">
          <div className="text-5xl mb-2">🌟</div>
          <div className="font-accent text-2xl font-bold text-[#5a8a6f]">Sound smarts: {score} / {rounds.length}</div>
          <button onClick={advance} className="btn-primary mt-3" data-testid="sounds-next">Next round →</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="game-animal-sounds">
      <LevelHeader idx={idx} total={total} levels={L} onPick={setLevel} onAdvance={advance} />
      <div className="flex justify-between text-xs text-[#6b7280]">
        <span>Question {r + 1} / {rounds.length}</span><span>Score: {score}</span>
      </div>
      <div className="bg-gradient-to-b from-[#dff3f3] to-[#aedde0] rounded-3xl border-2 border-[#7fcfc7] p-5 grid place-items-center text-center">
        <span className="text-8xl mb-2" aria-hidden>{cur?.animal}</span>
        <p className="font-accent text-lg text-[#3a4a55] font-bold" data-testid="sounds-prompt">{cur?.prompt}</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" data-testid="sounds-options">
        {(cur?.choices || []).map((c, i) => {
          const isCorrect = feedback && c === feedback.answer;
          return (
            <button
              key={i}
              onClick={() => pick(c)}
              disabled={!!feedback}
              className={`bg-white rounded-2xl border-2 py-3 font-accent text-lg font-bold transition-colors ${isCorrect ? "border-[#5a8a6f] bg-[#eaf7f5] text-[#5a8a6f]" : "border-[#f4e4c6] text-[#3a4a55] hover:bg-[#fffbf3]"}`}
              data-testid={`sounds-option-${i}`}
            >{c}</button>
          );
        })}
      </div>
      {feedback && (
        <div className={`rounded-2xl p-3 text-center ${feedback.correct ? "bg-[#eaf7f5] text-[#5a8a6f]" : "bg-red-50 text-red-700"}`} data-testid="sounds-feedback">
          <div className="font-bold">{feedback.correct ? "✅ Right!" : `❌ It was "${feedback.answer}"`}</div>
          {feedback.fun && <div className="text-sm mt-1">{feedback.fun}</div>}
        </div>
      )}
    </div>
  );
}

function Empty() { return <div className="text-center text-[#6b7280] py-10">No Animal Sounds levels yet.</div>; }

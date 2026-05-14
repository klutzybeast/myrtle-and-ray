import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import { useRotatingLevel, LevelHeader } from "./useLevels";

export default function Quiz({ data, onComplete }) {
  // Back-compat: { questions: [...] } maps to a single level
  const levels = useMemo(() => {
    if (Array.isArray(data?.levels) && data.levels.length) return data.levels;
    if (Array.isArray(data?.questions)) return [{ name: "Quiz", questions: data.questions }];
    return [];
  }, [data]);
  const { level, idx, total, advance, setLevel, levels: L } = useRotatingLevel("quiz", levels);
  const questions = level?.questions || [];

  const [chars, setChars] = useState({});
  const [step, setStep] = useState(0);
  const [tally, setTally] = useState({});
  const [done, setDone] = useState(false);

  useEffect(() => {
    api.get("/characters").then(({ data }) => {
      const map = {}; data.forEach((c) => { map[c.slug] = c; }); setChars(map);
    });
  }, []);

  useEffect(() => { setStep(0); setTally({}); setDone(false); }, [idx]);

  const pick = (slug) => {
    const t = { ...tally }; t[slug] = (t[slug] || 0) + 1; setTally(t);
    if (step + 1 >= questions.length) { setDone(true); onComplete?.(); }
    else setStep(step + 1);
  };

  const winner = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0];
  const winnerChar = winner ? chars[winner] : null;

  if (!questions.length) return <div className="text-[#4a5568] text-center py-10">No quiz questions yet. Add some in the admin.</div>;

  if (done) {
    return (
      <div data-testid="game-quiz">
        <LevelHeader idx={idx} total={total} levels={L} onPick={setLevel} onAdvance={advance} />
        <div className="text-center py-6" data-testid="game-quiz-result">
          <p className="text-[#4a5568]">You are most like…</p>
          {winnerChar && (
            <>
              <img src={winnerChar.image_url} alt={winnerChar.name} className="w-40 h-40 mx-auto rounded-full mt-3 border-4 border-[#f4e4c6] object-contain bg-[#fffbf3]" />
              <div className="font-accent text-4xl font-bold mt-3 text-[#5a8a6f]">{winnerChar.name}!</div>
              <p className="text-xs uppercase tracking-widest text-[#7cbf94] font-bold">{winnerChar.role}</p>
              <p className="text-[#4a5568] mt-3 max-w-md mx-auto">{winnerChar.bio}</p>
            </>
          )}
          <div className="flex gap-2 justify-center mt-5">
            <button onClick={() => { setStep(0); setTally({}); setDone(false); }} className="btn-ghost" data-testid="quiz-restart">Take it again</button>
            {total > 1 && <button onClick={advance} className="btn-primary" data-testid="quiz-next-level">Next pack →</button>}
          </div>
        </div>
      </div>
    );
  }

  const q = questions[step];
  return (
    <div data-testid="game-quiz">
      <LevelHeader idx={idx} total={total} levels={L} onPick={setLevel} onAdvance={advance} />
      <div className="text-xs uppercase tracking-widest font-bold text-[#7cbf94] text-center mt-3">Question {step + 1} of {questions.length}</div>
      <h3 className="font-accent text-2xl md:text-3xl font-bold text-center mt-2" data-testid="quiz-question">{q.q}</h3>
      <div className="grid sm:grid-cols-2 gap-3 mt-6">
        {(q.options || []).map((o, i) => (
          <button key={i} onClick={() => pick(o.char)} className="card-soft p-4 text-left hover:scale-[1.02] transition-transform" data-testid={`quiz-opt-${i}`}>
            <div className="font-accent font-bold text-[#3a4a55]">{o.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

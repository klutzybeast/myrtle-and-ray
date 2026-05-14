import { useEffect, useMemo, useState } from "react";
import { useRotatingLevel, LevelHeader } from "./useLevels";

export default function RhymeTime({ data, onComplete }) {
  const levels = useMemo(() => {
    if (Array.isArray(data?.levels) && data.levels.length) return data.levels;
    if (Array.isArray(data?.prompts)) return [{ name: "Rhymes", prompts: data.prompts }];
    return [];
  }, [data]);
  const { level, idx, total, advance, setLevel, levels: L } = useRotatingLevel("rhyme_time", levels);
  const prompts = level?.prompts || [];

  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => { setStep(0); setPicked(null); setScore(0); setDone(false); }, [idx]);

  if (!prompts.length) return <div className="text-[#4a5568] text-center py-10">No rhyme prompts yet.</div>;

  const p = prompts[step];
  const correct = (p.answer || "").toLowerCase().trim();
  const next = () => {
    if (step + 1 >= prompts.length) { setDone(true); onComplete?.(); }
    else { setStep(step + 1); setPicked(null); }
  };
  const choose = (c) => {
    if (picked) return;
    setPicked(c);
    if (c.toLowerCase().trim() === correct) setScore((s) => s + 1);
  };

  if (done) {
    return (
      <div data-testid="game-rhyme">
        <LevelHeader idx={idx} total={total} levels={L} onPick={setLevel} onAdvance={advance} />
        <div className="text-center py-8" data-testid="game-rhyme-result">
          <div className="text-6xl">🎤</div>
          <div className="font-accent text-3xl font-bold mt-2 text-[#5a8a6f]">You scored {score}/{prompts.length}!</div>
          <p className="text-[#4a5568] mt-2">Rhyme on, Sea Star.</p>
          <div className="flex gap-2 justify-center mt-4">
            <button onClick={() => { setStep(0); setScore(0); setDone(false); setPicked(null); }} className="btn-ghost" data-testid="rhyme-restart">Play again</button>
            {total > 1 && <button onClick={advance} className="btn-primary" data-testid="rhyme-next-level">Next pack →</button>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="game-rhyme">
      <LevelHeader idx={idx} total={total} levels={L} onPick={setLevel} onAdvance={advance} />
      <div className="text-xs uppercase tracking-widest font-bold text-[#7cbf94] text-center mt-3">Rhyme {step + 1} of {prompts.length}</div>
      <p className="font-accent text-xl md:text-2xl text-center mt-3 text-[#3a4a55]" data-testid="rhyme-line">{p.line}</p>
      <div className="flex justify-center gap-3 mt-6 flex-wrap">
        {(p.choices || []).map((c, i) => {
          const isCorrect = c.toLowerCase().trim() === correct;
          const isPicked = picked === c;
          let cls = "card-soft px-6 py-3 font-accent text-lg font-bold";
          if (picked) {
            if (isCorrect) cls += " ring-4 ring-[#7cbf94] bg-[#dff3df]";
            else if (isPicked) cls += " ring-4 ring-[#e89bab] bg-[#fce0e6]";
            else cls += " opacity-50";
          }
          return <button key={i} onClick={() => choose(c)} className={cls} data-testid={`rhyme-choice-${i}`} disabled={!!picked}>{c}</button>;
        })}
      </div>
      {picked && (
        <div className="text-center mt-5">
          <button onClick={next} className="btn-primary" data-testid="rhyme-next">{step + 1 >= prompts.length ? "See score" : "Next rhyme →"}</button>
        </div>
      )}
    </div>
  );
}

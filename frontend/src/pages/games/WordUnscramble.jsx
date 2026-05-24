import { useEffect, useMemo, useState } from "react";
import { useRotatingLevel, LevelHeader } from "./useLevels";

// Tap the letters in the correct order to spell the word.
// data.levels[i] = { name, rounds: [{ word: "BEACH", scrambled: "EBHCA", hint: "Where Myrtle plays", emoji: "🏖️" }] }
export default function WordUnscramble({ data, onComplete }) {
  const levels = useMemo(() => data?.levels || [], [data]);
  const { level, idx, total, advance, setLevel, levels: L } = useRotatingLevel("word_unscramble", levels);
  const [r, setR] = useState(0);
  const [picked, setPicked] = useState([]); // indices of taken letters
  const [wrong, setWrong] = useState(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => { setR(0); setPicked([]); setWrong(null); setScore(0); setDone(false); }, [level, idx]);
  if (!level) return <Empty />;

  const rounds = level.rounds || [];
  const cur = rounds[r];
  const word = (cur?.word || "").toUpperCase();
  const letters = (cur?.scrambled || cur?.word || "").toUpperCase().split("");

  const tapLetter = (i) => {
    if (done || picked.includes(i)) return;
    const nextIdx = picked.length;
    if (letters[i] !== word[nextIdx]) {
      setWrong(i);
      setTimeout(() => setWrong(null), 400);
      return;
    }
    const np = [...picked, i];
    setPicked(np);
    if (np.length >= word.length) {
      const ns = score + 1;
      setScore(ns);
      setTimeout(() => {
        if (r + 1 >= rounds.length) { setDone(true); onComplete?.(); }
        else { setR(r + 1); setPicked([]); }
      }, 800);
    }
  };

  const undo = () => { if (picked.length) setPicked(picked.slice(0, -1)); };

  const built = picked.map((i) => letters[i]).join("");

  if (done) {
    return (
      <div className="space-y-3 text-center" data-testid="game-word-unscramble-done">
        <LevelHeader idx={idx} total={total} levels={L} onPick={setLevel} onAdvance={advance} />
        <div className="bg-[#fff8ec] rounded-3xl p-6">
          <div className="text-5xl mb-2">🌟</div>
          <div className="font-accent text-2xl font-bold text-[#5a8a6f]">Word wizard! {score} / {rounds.length}</div>
          <button onClick={advance} className="btn-primary mt-3" data-testid="unscramble-next">Next round →</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="game-word-unscramble">
      <LevelHeader idx={idx} total={total} levels={L} onPick={setLevel} onAdvance={advance} />
      <div className="flex justify-between text-xs text-[#6b7280]">
        <span>Round {r + 1} / {rounds.length}</span><span>Score: {score}</span>
      </div>
      <div className="bg-white rounded-3xl p-5 border-2 border-[#f4e4c6] text-center space-y-2">
        <div className="text-5xl" aria-hidden>{cur?.emoji || "🔤"}</div>
        <div className="text-sm text-[#5a6b76]">{cur?.hint || "Unscramble the word"}</div>
        <div className="flex justify-center gap-1 mt-2" data-testid="unscramble-slots">
          {word.split("").map((ch, i) => (
            <span key={i} className={`w-9 h-11 sm:w-10 sm:h-12 grid place-items-center rounded-lg border-2 font-accent text-2xl font-bold ${built[i] ? "bg-[#eaf7f5] border-[#7fcfc7] text-[#3a4a55]" : "bg-[#fffbf3] border-[#f4e4c6] text-transparent"}`}>
              {built[i] || ch}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-6 sm:grid-cols-8 gap-2" data-testid="unscramble-letters">
        {letters.map((ch, i) => {
          const used = picked.includes(i);
          return (
            <button
              key={i}
              onClick={() => tapLetter(i)}
              disabled={used}
              className={`aspect-square rounded-2xl border-2 font-accent text-2xl font-black transition-all ${used ? "bg-[#eef9fb] border-[#cbd5e1] text-[#cbd5e1]" : wrong === i ? "bg-red-50 border-red-400 animate-pulse text-red-600" : "bg-white border-[#f4e4c6] hover:bg-[#fffbf3] text-[#3a4a55]"}`}
              data-testid={`unscramble-letter-${i}`}
            >{ch}</button>
          );
        })}
      </div>
      <div className="flex justify-end">
        <button onClick={undo} className="text-xs text-[#5a6b76] underline" data-testid="unscramble-undo">↩ Undo last</button>
      </div>
    </div>
  );
}

function Empty() { return <div className="text-center text-[#6b7280] py-10">No Word Unscramble levels yet.</div>; }

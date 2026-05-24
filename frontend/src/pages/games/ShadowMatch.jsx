import { useEffect, useMemo, useState } from "react";
import { useRotatingLevel, LevelHeader } from "./useLevels";

// Show a SHADOW (silhouette) of one creature/object. Player taps the matching
// colorful version from the choices. Multiple rounds per level.
// data.levels[i] = { name, rounds: [{ target: "🐢", options: ["🐢","🐠","🦈","🐙"] }] }
export default function ShadowMatch({ data, onComplete }) {
  const levels = useMemo(() => data?.levels || [], [data]);
  const { level, idx, total, advance, setLevel, levels: L } = useRotatingLevel("shadow_match", levels);
  const [r, setR] = useState(0);
  const [score, setScore] = useState(0);
  const [wrong, setWrong] = useState(null);
  const [done, setDone] = useState(false);

  useEffect(() => { setR(0); setScore(0); setWrong(null); setDone(false); }, [level, idx]);
  if (!level) return <Empty />;

  const rounds = level.rounds || [];
  const cur = rounds[r];

  const pick = (opt) => {
    if (!cur || done) return;
    if (opt === cur.target) {
      const ns = score + 1;
      setScore(ns);
      if (r + 1 >= rounds.length) { setDone(true); onComplete?.(); }
      else setR(r + 1);
    } else {
      setWrong(opt);
      setTimeout(() => setWrong(null), 450);
    }
  };

  return (
    <div className="space-y-3" data-testid="game-shadow-match">
      <LevelHeader idx={idx} total={total} levels={L} onPick={setLevel} onAdvance={advance} />
      <div className="flex justify-between text-xs text-[#6b7280]">
        <span>Round {Math.min(r + 1, rounds.length)} / {rounds.length}</span>
        <span>Score: {score}</span>
      </div>

      {done ? (
        <div className="text-center bg-[#fff8ec] rounded-3xl p-6" data-testid="shadow-done">
          <div className="text-5xl mb-2">🌟</div>
          <div className="font-accent text-2xl font-bold text-[#5a8a6f]">Sharp shadows, {score} / {rounds.length}!</div>
          <button onClick={advance} className="btn-primary mt-3" data-testid="shadow-next">Next level →</button>
        </div>
      ) : (
        <>
          <div className="relative bg-gradient-to-b from-[#dff3f3] to-[#aedde0] rounded-3xl border-2 border-[#7fcfc7] grid place-items-center" style={{ aspectRatio: "16 / 9" }} data-testid="shadow-stage">
            <span
              className="text-[8rem] sm:text-[10rem] leading-none select-none"
              style={{ filter: "brightness(0) saturate(100%)", opacity: 0.9 }}
              aria-hidden
            >{cur?.target}</span>
            <span className="absolute bottom-3 left-3 text-xs bg-white/70 rounded-full px-2 py-0.5 text-[#5a6b76]">Whose shadow is this?</span>
          </div>
          <div className="grid grid-cols-4 gap-2" data-testid="shadow-options">
            {(cur?.options || []).map((o, i) => (
              <button
                key={i}
                onClick={() => pick(o)}
                className={`text-5xl bg-white rounded-2xl border-2 py-3 hover:bg-[#eef9fb] transition-colors ${wrong === o ? "border-red-400 bg-red-50 animate-pulse" : "border-[#f4e4c6]"}`}
                data-testid={`shadow-option-${i}`}
              >{o}</button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Empty() { return <div className="text-center text-[#6b7280] py-10">No Shadow Match levels yet.</div>; }

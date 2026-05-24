import { useEffect, useMemo, useState } from "react";
import { useRotatingLevel, LevelHeader } from "./useLevels";

// Tap numbered dots IN ORDER to trace a letter shape.
// data.levels[i] = { name, letter, dots: [{x,y,n}], color }
// Coordinates are 0–100 (percent of canvas).
export default function LetterTrace({ data, onComplete }) {
  const levels = useMemo(() => data?.levels || [], [data]);
  const { level, idx, total, advance, setLevel, levels: L } = useRotatingLevel("letter_trace", levels);
  const [tapped, setTapped] = useState([]);
  const [wrong, setWrong] = useState(null);
  const [done, setDone] = useState(false);

  useEffect(() => { setTapped([]); setWrong(null); setDone(false); }, [level, idx]);
  if (!level) return <Empty />;

  const dots = (level.dots || []).slice().sort((a, b) => a.n - b.n);
  const next = tapped.length + 1;

  const onTap = (d) => {
    if (done) return;
    if (d.n !== next) { setWrong(d.n); setTimeout(() => setWrong(null), 400); return; }
    const t = [...tapped, d.n];
    setTapped(t);
    if (t.length >= dots.length) { setDone(true); onComplete?.(); }
  };

  // Build polyline of tapped dots
  const path = tapped
    .map((n) => dots.find((d) => d.n === n))
    .filter(Boolean)
    .map((d, i) => `${i === 0 ? "M" : "L"}${d.x},${d.y}`)
    .join(" ");

  return (
    <div className="space-y-3" data-testid="game-letter-trace">
      <LevelHeader idx={idx} total={total} levels={L} onPick={setLevel} onAdvance={advance} />
      <div className="text-center text-sm text-[#4a5568]">
        Trace the letter <span className="font-accent font-black text-3xl text-[#5a8a6f] mx-1">{level.letter || "?"}</span>
        — tap each dot in order. Next: <span className="font-black text-[#f0a988] text-lg">{done ? "🎉" : next}</span>
      </div>
      <div className="relative bg-gradient-to-b from-[#fffbf3] to-[#fff8ec] rounded-3xl border-2 border-[#f4e4c6]" style={{ aspectRatio: "1 / 1" }} data-testid="trace-canvas">
        {/* Ghost letter */}
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <span className="font-accent text-[18rem] leading-none text-[#f4e4c6] select-none" aria-hidden>{level.letter}</span>
        </div>
        {/* Path */}
        <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
          <path d={path} fill="none" stroke={level.color || "#f0a988"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {/* Dots */}
        {dots.map((d) => {
          const isTapped = tapped.includes(d.n);
          const isWrong = wrong === d.n;
          const isNext = d.n === next && !done;
          return (
            <button
              key={d.n}
              onClick={() => onTap(d)}
              className={`absolute -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full font-black text-sm shadow-md border-2 transition-all ${isTapped ? "bg-[#5a8a6f] text-white border-[#5a8a6f]" : isNext ? "bg-[#f0a988] text-white border-white animate-pulse" : "bg-white text-[#3a4a55] border-[#cbd5e1]"} ${isWrong ? "bg-red-300 border-red-500" : ""}`}
              style={{ left: `${d.x}%`, top: `${d.y}%` }}
              data-testid={`trace-dot-${d.n}`}
            >{d.n}</button>
          );
        })}
      </div>
      {done && (
        <div className="text-center bg-[#fff8ec] rounded-2xl py-3">
          <div className="font-accent text-xl font-bold text-[#5a8a6f]">🌟 Letter mastered!</div>
          <button onClick={advance} className="btn-primary mt-2" data-testid="trace-next">Next letter →</button>
        </div>
      )}
    </div>
  );
}

function Empty() { return <div className="text-center text-[#6b7280] py-10">No Letter Trace levels yet.</div>; }

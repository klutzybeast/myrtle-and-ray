import { useEffect, useMemo, useState } from "react";
import { useRotatingLevel, LevelHeader } from "./useLevels";

// Tap numbered dots 1→N to reveal a hidden picture. Same dot-tap mechanic
// as LetterTrace but the dots draw a full picture (whale, sailboat, etc.).
// data.levels[i] = { name, label, color, dots: [{x,y,n}], reveal_emoji }
export default function ConnectDots({ data, onComplete }) {
  const levels = useMemo(() => data?.levels || [], [data]);
  const { level, idx, total, advance, setLevel, levels: L } = useRotatingLevel("connect_dots", levels);
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

  const path = tapped.map((n) => dots.find((d) => d.n === n)).filter(Boolean)
    .map((d, i) => `${i === 0 ? "M" : "L"}${d.x},${d.y}`).join(" ");

  return (
    <div className="space-y-3" data-testid="game-connect-dots">
      <LevelHeader idx={idx} total={total} levels={L} onPick={setLevel} onAdvance={advance} />
      <div className="text-center text-sm text-[#4a5568]">
        Connect the dots to reveal <span className="font-bold">{level.label || "the picture"}</span> — tap <span className="font-black text-[#f0a988] text-lg">{done ? "🎉" : next}</span> next.
      </div>
      <div className="relative bg-gradient-to-b from-[#e8f8f5] to-[#cfeef0] rounded-3xl border-2 border-[#7fcfc7]" style={{ aspectRatio: "4 / 3" }} data-testid="dots-canvas">
        {done && level.reveal_emoji && (
          <div className="absolute inset-0 grid place-items-center pointer-events-none">
            <span className="text-[10rem] leading-none select-none animate-pulse">{level.reveal_emoji}</span>
          </div>
        )}
        <svg viewBox="0 0 100 75" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
          <path d={path} fill="none" stroke={level.color || "#5a8a6f"} strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {dots.map((d) => {
          const isTapped = tapped.includes(d.n);
          const isWrong = wrong === d.n;
          const isNext = d.n === next && !done;
          return (
            <button
              key={d.n}
              onClick={() => onTap(d)}
              className={`absolute -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full font-black text-xs shadow border-2 transition-all ${isTapped ? "bg-[#5a8a6f] text-white border-[#5a8a6f] opacity-70" : isNext ? "bg-[#f0a988] text-white border-white animate-pulse" : "bg-white text-[#3a4a55] border-[#cbd5e1]"} ${isWrong ? "bg-red-300 border-red-500" : ""}`}
              style={{ left: `${d.x}%`, top: `${d.y / 75 * 100}%` }}
              data-testid={`cd-dot-${d.n}`}
            >{d.n}</button>
          );
        })}
      </div>
      {done && (
        <div className="text-center bg-[#fff8ec] rounded-2xl py-3">
          <div className="font-accent text-xl font-bold text-[#5a8a6f]">🌟 You drew a {level.label}!</div>
          <button onClick={advance} className="btn-primary mt-2" data-testid="cd-next">Next picture →</button>
        </div>
      )}
    </div>
  );
}

function Empty() { return <div className="text-center text-[#6b7280] py-10">No Connect-the-Dots levels yet.</div>; }

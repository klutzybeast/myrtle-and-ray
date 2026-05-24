import { useEffect, useState, useMemo, useRef } from "react";
import { useRotatingLevel, LevelHeader } from "./useLevels";

// Tap the bubbles in the right order (1→max or matching the target value).
// data.levels[i] = { name, mode: "count" | "add" | "sub", numbers: [n,...], target?: n }
export default function NumberBubbles({ data, onComplete }) {
  const levels = useMemo(() => data?.levels || [], [data]);
  const { level, idx, total, advance, setLevel, levels: L } = useRotatingLevel("number_bubbles", levels);
  const [done, setDone] = useState(false);
  const [tapped, setTapped] = useState([]);
  const [bubbles, setBubbles] = useState([]);
  const [wrongShake, setWrongShake] = useState(null);
  const playRef = useRef();

  useEffect(() => {
    if (!level) return;
    setDone(false);
    setTapped([]);
    // Lay bubbles out in random screen positions
    const nums = (level.numbers || []).slice();
    const placed = nums.map((n, i) => ({
      id: `${n}-${i}`,
      n,
      x: 8 + Math.floor(Math.random() * 75),
      y: 10 + Math.floor(Math.random() * 70),
      color: ["#7fcfc7", "#f0a988", "#b8a3d9", "#7cbf94", "#e89bab", "#8fbfe0", "#f4d28a"][i % 7],
    }));
    setBubbles(placed);
  }, [level, idx]);

  if (!level) return <Empty />;

  // Expected next value
  const sortedAsc = [...(level.numbers || [])].sort((a, b) => a - b);
  const expected = sortedAsc[tapped.length];

  const onPop = (b) => {
    if (done) return;
    if (b.n !== expected) {
      setWrongShake(b.id);
      setTimeout(() => setWrongShake(null), 350);
      return;
    }
    const nt = [...tapped, b.n];
    setTapped(nt);
    setBubbles((bs) => bs.filter((x) => x.id !== b.id));
    if (nt.length >= sortedAsc.length) {
      setDone(true);
      onComplete?.();
    }
  };

  return (
    <div className="space-y-3" data-testid="game-number-bubbles">
      <LevelHeader idx={idx} total={total} levels={L} onPick={setLevel} onAdvance={advance} />
      <div className="text-center text-sm text-[#4a5568]">
        <span className="font-bold">Pop the bubbles in order — smallest first!</span><br />
        Next target: <span className="font-mono font-black text-[#5a8a6f] text-lg">{done ? "🎉" : expected}</span>
      </div>
      <div className="relative bg-gradient-to-b from-[#cfeef0] to-[#7fcfc7] rounded-3xl overflow-hidden border border-[#7fcfc7]" style={{ height: 360 }} data-testid="bubble-canvas">
        {bubbles.map((b) => (
          <button
            key={b.id}
            onClick={() => onPop(b)}
            className={`absolute rounded-full font-black text-white text-xl shadow-md transition-transform hover:scale-110 ${wrongShake === b.id ? "animate-pulse" : ""}`}
            style={{
              left: `${b.x}%`, top: `${b.y}%`,
              width: 64, height: 64,
              background: `radial-gradient(circle at 30% 30%, white, ${b.color})`,
              border: `3px solid ${b.color}`,
            }}
            data-testid={`bubble-${b.n}`}
          >
            {b.n}
          </button>
        ))}
        {done && (
          <div className="absolute inset-0 grid place-items-center bg-white/80 rounded-3xl">
            <div className="text-center">
              <div className="text-5xl mb-2">⭐</div>
              <div className="font-accent text-2xl font-bold text-[#5a8a6f]">Bubble Master!</div>
              <button onClick={advance} className="btn-primary mt-3" data-testid="bubbles-next">Next level →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Empty() {
  return <div className="text-center text-[#6b7280] py-10">No Number Bubbles levels yet.</div>;
}

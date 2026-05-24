import { useEffect, useMemo, useState } from "react";
import { useRotatingLevel, LevelHeader } from "./useLevels";

// Tap every target emoji in a busy scene. Counts up as you go.
// data.levels[i] = { name, target: "🐢", prompt, scene: [{emoji,x,y,size?}], background?: "ocean|beach|reef" }
export default function CountAndClick({ data, onComplete }) {
  const levels = useMemo(() => data?.levels || [], [data]);
  const { level, idx, total, advance, setLevel, levels: L } = useRotatingLevel("count_and_click", levels);
  const [found, setFound] = useState([]); // indices
  const [strike, setStrike] = useState(null);
  const [done, setDone] = useState(false);

  useEffect(() => { setFound([]); setStrike(null); setDone(false); }, [level, idx]);
  if (!level) return <Empty />;

  const scene = level.scene || [];
  const targets = scene
    .map((s, i) => ({ ...s, i }))
    .filter((s) => s.emoji === level.target);

  const tap = (i) => {
    if (done) return;
    const item = scene[i];
    if (!item) return;
    if (item.emoji === level.target) {
      if (found.includes(i)) return;
      const nf = [...found, i];
      setFound(nf);
      if (nf.length >= targets.length) { setDone(true); onComplete?.(); }
    } else {
      setStrike(i);
      setTimeout(() => setStrike(null), 350);
    }
  };

  const bg = level.background === "beach"
    ? "from-[#fff3d6] via-[#fde0b3] to-[#f4d28a]"
    : level.background === "reef"
      ? "from-[#dff3f3] via-[#a8e6e1] to-[#7fcfc7]"
      : "from-[#aedde0] via-[#7fcfc7] to-[#5aa9a3]";

  return (
    <div className="space-y-3" data-testid="game-count-and-click">
      <LevelHeader idx={idx} total={total} levels={L} onPick={setLevel} onAdvance={advance} />
      <div className="text-center text-sm text-[#4a5568]">
        <p className="font-bold text-[#3a4a55]">{level.prompt || `Find all the ${level.target}!`}</p>
        <p className="text-xs text-[#6b7280]">{found.length} / {targets.length} found</p>
      </div>
      <div className={`relative rounded-3xl border-2 border-[#7fcfc7] bg-gradient-to-b ${bg} overflow-hidden`} style={{ aspectRatio: "16 / 10" }} data-testid="count-scene">
        {scene.map((s, i) => {
          const isFound = found.includes(i);
          const isStrike = strike === i;
          const size = s.size || 2.4;
          return (
            <button
              key={i}
              onClick={() => tap(i)}
              className={`absolute -translate-x-1/2 -translate-y-1/2 grid place-items-center transition-transform ${isFound ? "scale-125 drop-shadow-[0_0_8px_#fff]" : ""} ${isStrike ? "animate-pulse" : ""}`}
              style={{ left: `${s.x}%`, top: `${s.y}%`, fontSize: `${size}rem`, filter: isFound ? "none" : "none" }}
              data-testid={`count-item-${i}`}
            >
              <span aria-hidden>{s.emoji}</span>
              {isFound && <span className="absolute -top-2 -right-2 text-base">✅</span>}
            </button>
          );
        })}
      </div>
      {done && (
        <div className="text-center bg-[#fff8ec] rounded-2xl py-3">
          <div className="font-accent text-xl font-bold text-[#5a8a6f]">🌟 You found all {targets.length}!</div>
          <button onClick={advance} className="btn-primary mt-2" data-testid="count-next">Next scene →</button>
        </div>
      )}
    </div>
  );
}

function Empty() { return <div className="text-center text-[#6b7280] py-10">No Count-and-Click levels yet.</div>; }

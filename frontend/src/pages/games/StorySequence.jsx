import { useEffect, useMemo, useState } from "react";
import { useRotatingLevel, LevelHeader } from "./useLevels";

// Drag the scenes into the right narrative order.
// data.levels[i] = { name, steps: [{ id, label, emoji }] }  // canonical order
export default function StorySequence({ data, onComplete }) {
  const levels = useMemo(() => data?.levels || [], [data]);
  const { level, idx, total, advance, setLevel, levels: L } = useRotatingLevel("story_sequence", levels);
  const [shuffled, setShuffled] = useState([]);
  const [done, setDone] = useState(false);
  const [dragId, setDragId] = useState(null);
  const [hint, setHint] = useState(false);

  useEffect(() => {
    if (!level) return;
    const steps = (level.steps || []).map((s, i) => ({ ...s, _correct: i }));
    const sh = [...steps].sort(() => Math.random() - 0.5);
    setShuffled(sh);
    setDone(false);
    setHint(false);
  }, [level, idx]);

  if (!level) return <Empty />;

  const swap = (a, b) => {
    if (a === b) return;
    const next = [...shuffled];
    const ai = next.findIndex((x) => x.id === a);
    const bi = next.findIndex((x) => x.id === b);
    if (ai < 0 || bi < 0) return;
    [next[ai], next[bi]] = [next[bi], next[ai]];
    setShuffled(next);
  };

  const check = () => {
    const correct = shuffled.every((s, i) => s._correct === i);
    if (correct) {
      setDone(true);
      onComplete?.();
    } else {
      setHint(true);
      setTimeout(() => setHint(false), 1500);
    }
  };

  return (
    <div className="space-y-3" data-testid="game-story-sequence">
      <LevelHeader idx={idx} total={total} levels={L} onPick={setLevel} onAdvance={advance} />
      <p className="text-sm text-[#4a5568] text-center">{level.intro || "Drag the scenes into the right order from first to last."}</p>
      <div className="grid gap-2">
        {shuffled.map((s, i) => {
          const correctSpot = s._correct === i;
          return (
            <div
              key={s.id}
              draggable
              onDragStart={() => setDragId(s.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => { swap(dragId, s.id); setDragId(null); }}
              className={`flex items-center gap-3 p-3 rounded-2xl border-2 cursor-grab active:cursor-grabbing select-none transition-colors ${hint && !correctSpot ? "border-red-300 bg-red-50" : "border-[#f4e4c6] bg-white"} ${done && correctSpot ? "border-[#5a8a6f] bg-[#eaf7f5]" : ""}`}
              data-testid={`seq-row-${i}`}
            >
              <div className="font-mono font-black text-[#5a8a6f] w-7">{i + 1}.</div>
              <div className="text-3xl">{s.emoji}</div>
              <div className="flex-1 text-sm font-semibold text-[#3a4a55]">{s.label}</div>
              <div className="text-[#cbd5e1]">⋮⋮</div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-2">
        <button onClick={check} className="btn-primary flex-1 justify-center" data-testid="seq-check">Check order</button>
        {done && <button onClick={advance} className="btn-secondary" data-testid="seq-next">Next →</button>}
      </div>
      {done && <div className="text-center font-accent text-xl text-[#5a8a6f]">🌟 Perfect storytelling!</div>}
    </div>
  );
}

function Empty() {
  return <div className="text-center text-[#6b7280] py-10">No Story Sequence levels yet.</div>;
}

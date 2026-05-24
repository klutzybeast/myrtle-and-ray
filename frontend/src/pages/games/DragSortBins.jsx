import { useEffect, useMemo, useState } from "react";
import { useRotatingLevel, LevelHeader } from "./useLevels";

// Drag items into the correct bin/category.
// data.levels[i] = { name, bins: [{ id, label, emoji }], items: [{ id, label, emoji, bin_id }] }
export default function DragSortBins({ data, onComplete }) {
  const levels = useMemo(() => data?.levels || [], [data]);
  const { level, idx, total, advance, setLevel, levels: L } = useRotatingLevel("drag_sort", levels);
  const [placements, setPlacements] = useState({});
  const [pool, setPool] = useState([]);
  const [dragId, setDragId] = useState(null);
  const [wrong, setWrong] = useState(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!level) return;
    const items = (level.items || []).map((it) => ({ ...it }));
    setPool([...items].sort(() => Math.random() - 0.5));
    setPlacements({});
    setDone(false);
    setWrong(null);
  }, [level, idx]);

  if (!level) return <Empty />;

  const bins = level.bins || [];

  const onDrop = (bin) => {
    const item = (level.items || []).find((i) => i.id === dragId);
    setDragId(null);
    if (!item) return;
    if (item.bin_id !== bin.id) {
      setWrong(item.id);
      setTimeout(() => setWrong(null), 600);
      return;
    }
    const next = { ...placements, [item.id]: bin.id };
    setPlacements(next);
    setPool((p) => p.filter((x) => x.id !== item.id));
    if (Object.keys(next).length >= (level.items || []).length) {
      setDone(true);
      onComplete?.();
    }
  };

  return (
    <div className="space-y-3" data-testid="game-drag-sort">
      <LevelHeader idx={idx} total={total} levels={L} onPick={setLevel} onAdvance={advance} />
      <p className="text-sm text-[#4a5568] text-center">{level.intro || "Drag each item to the right bin."}</p>

      {/* Pool of items */}
      <div className="bg-[#fffbf3] rounded-3xl p-3 min-h-[80px] border border-[#f4e4c6]" data-testid="sort-pool">
        <div className="flex gap-2 flex-wrap justify-center">
          {pool.map((it) => (
            <div
              key={it.id}
              draggable
              onDragStart={() => setDragId(it.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-full bg-white border-2 border-[#f4e4c6] font-semibold text-sm cursor-grab active:cursor-grabbing ${wrong === it.id ? "border-red-400 bg-red-50 animate-pulse" : ""}`}
              data-testid={`sort-item-${it.id}`}
            >
              <span className="text-xl">{it.emoji}</span>{it.label}
            </div>
          ))}
        </div>
      </div>

      {/* Bins */}
      <div className={`grid gap-2`} style={{ gridTemplateColumns: `repeat(${Math.min(bins.length, 3)}, minmax(0,1fr))` }}>
        {bins.map((b) => {
          const here = Object.entries(placements).filter(([, binId]) => binId === b.id);
          return (
            <div
              key={b.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(b)}
              className="rounded-3xl border-4 border-dashed border-[#7fcfc7] p-3 bg-[#eaf7f5] min-h-[140px]"
              data-testid={`sort-bin-${b.id}`}
            >
              <div className="text-center font-accent font-bold text-[#3a4a55] flex items-center justify-center gap-1.5 mb-2">
                <span className="text-xl">{b.emoji}</span>{b.label}
              </div>
              <div className="flex gap-1 flex-wrap justify-center">
                {here.map(([itemId]) => {
                  const it = (level.items || []).find((x) => x.id === itemId);
                  return (
                    <div key={itemId} className="px-2 py-1 rounded-full bg-white text-xs font-semibold border border-[#5a8a6f]">
                      <span className="mr-1">{it?.emoji}</span>{it?.label}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {done && (
        <div className="text-center bg-[#fff8ec] rounded-2xl py-3">
          <div className="font-accent text-xl font-bold text-[#5a8a6f]">🌟 All sorted!</div>
          <button onClick={advance} className="btn-primary mt-2" data-testid="sort-next">Next level →</button>
        </div>
      )}
    </div>
  );
}

function Empty() { return <div className="text-center text-[#6b7280] py-10">No Sort levels yet.</div>; }

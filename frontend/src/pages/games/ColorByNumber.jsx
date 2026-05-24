import { useEffect, useMemo, useState } from "react";
import { useRotatingLevel, LevelHeader } from "./useLevels";

// Paint each cell by tapping the matching color in the palette.
// data.levels[i] = { name, label, reveal_emoji, cols, palette: {"1":"#color", ...}, grid: [[1,2,...], ...] }
export default function ColorByNumber({ data, onComplete }) {
  const levels = useMemo(() => data?.levels || [], [data]);
  const { level, idx, total, advance, setLevel, levels: L } = useRotatingLevel("color_by_number", levels);
  const [filled, setFilled] = useState({}); // "r,c" -> color hex
  const [selected, setSelected] = useState(null);
  const [done, setDone] = useState(false);

  useEffect(() => { setFilled({}); setSelected(null); setDone(false); }, [level, idx]);
  if (!level) return <Empty />;

  const grid = level.grid || [];
  const palette = level.palette || {};
  const cols = level.cols || (grid[0] && grid[0].length) || 6;

  const totalCells = grid.reduce((sum, row) => sum + row.length, 0);
  const correctCount = Object.entries(filled).reduce((n, [k, hex]) => {
    const [r, c] = k.split(",").map(Number);
    return n + (palette[String(grid[r]?.[c])] === hex ? 1 : 0);
  }, 0);

  const onCell = (r, c) => {
    if (done || !selected) return;
    const key = `${r},${c}`;
    const expect = palette[String(grid[r][c])];
    if (selected === expect) {
      const next = { ...filled, [key]: selected };
      setFilled(next);
      if (Object.keys(next).length >= totalCells) { setDone(true); onComplete?.(); }
    }
  };

  return (
    <div className="space-y-3" data-testid="game-color-by-number">
      <LevelHeader idx={idx} total={total} levels={L} onPick={setLevel} onAdvance={advance} />
      <div className="text-center text-sm text-[#4a5568]">
        Paint by number to reveal <span className="font-bold">{level.label || "the picture"}</span>.
        Tap a color, then tap each cell with that number.
      </div>

      <div className="flex flex-wrap gap-2 justify-center" data-testid="cbn-palette">
        {Object.entries(palette).map(([num, hex]) => (
          <button
            key={num}
            onClick={() => setSelected(hex)}
            className={`w-12 h-12 rounded-2xl border-2 grid place-items-center font-black text-sm shadow ${selected === hex ? "border-[#3a4a55] scale-110" : "border-white"}`}
            style={{ background: hex, color: contrast(hex) }}
            data-testid={`cbn-color-${num}`}
          >{num}</button>
        ))}
      </div>

      <div className="bg-[#fffbf3] rounded-3xl p-3 border-2 border-[#f4e4c6]" data-testid="cbn-grid">
        <div className="grid gap-1 mx-auto" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`, maxWidth: 480 }}>
          {grid.flatMap((row, r) => row.map((num, c) => {
            const key = `${r},${c}`;
            const fill = filled[key];
            return (
              <button
                key={key}
                onClick={() => onCell(r, c)}
                className="aspect-square rounded-md border border-[#cbd5e1] font-bold text-xs grid place-items-center transition-colors"
                style={{ background: fill || "#fff", color: fill ? contrast(fill) : "#3a4a55" }}
                data-testid={`cbn-cell-${r}-${c}`}
              >{num}</button>
            );
          }))}
        </div>
      </div>

      <div className="text-center text-xs text-[#6b7280]">{correctCount} / {totalCells} cells painted</div>

      {done && (
        <div className="text-center bg-[#fff8ec] rounded-2xl py-3">
          <div className="font-accent text-xl font-bold text-[#5a8a6f]">
            🌟 You painted {level.reveal_emoji || ""} {level.label || "it"}!
          </div>
          <button onClick={advance} className="btn-primary mt-2" data-testid="cbn-next">Next picture →</button>
        </div>
      )}
    </div>
  );
}

function contrast(hex) {
  const h = (hex || "#000").replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) || 0;
  const g = parseInt(h.slice(2, 4), 16) || 0;
  const b = parseInt(h.slice(4, 6), 16) || 0;
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#3a4a55" : "#fff";
}

function Empty() { return <div className="text-center text-[#6b7280] py-10">No Color-by-Number levels yet.</div>; }

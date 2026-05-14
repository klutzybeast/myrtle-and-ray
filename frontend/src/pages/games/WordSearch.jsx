import { useEffect, useMemo, useState } from "react";
import { useRotatingLevel, LevelHeader } from "./useLevels";

const DIRS = [[0,1],[1,0],[1,1],[-1,1]];
const SIZE = 12;
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function buildGrid(words) {
  const grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(""));
  const placements = [];
  for (const wordRaw of words) {
    const word = String(wordRaw || "").toUpperCase().replace(/[^A-Z]/g, "");
    if (!word || word.length > SIZE) continue;
    let placed = false;
    for (let tries = 0; tries < 300 && !placed; tries++) {
      const [dr, dc] = DIRS[Math.floor(Math.random() * DIRS.length)];
      const r0 = Math.floor(Math.random() * SIZE);
      const c0 = Math.floor(Math.random() * SIZE);
      const rEnd = r0 + dr * (word.length - 1);
      const cEnd = c0 + dc * (word.length - 1);
      if (rEnd < 0 || rEnd >= SIZE || cEnd < 0 || cEnd >= SIZE) continue;
      let ok = true;
      for (let i = 0; i < word.length; i++) {
        const r = r0 + dr * i, c = c0 + dc * i;
        if (grid[r][c] && grid[r][c] !== word[i]) { ok = false; break; }
      }
      if (!ok) continue;
      const cells = [];
      for (let i = 0; i < word.length; i++) { const r = r0 + dr * i, c = c0 + dc * i; grid[r][c] = word[i]; cells.push([r, c]); }
      placements.push({ word, cells });
      placed = true;
    }
  }
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (!grid[r][c]) grid[r][c] = LETTERS[Math.floor(Math.random() * 26)];
  return { grid, placements };
}

export default function WordSearch({ data, onComplete }) {
  const levels = useMemo(() => {
    if (Array.isArray(data?.levels) && data.levels.length) return data.levels;
    if (Array.isArray(data?.words)) return [{ name: "Words", words: data.words }];
    return [];
  }, [data]);
  const { level, idx, total, advance, setLevel, levels: L } = useRotatingLevel("word_search", levels);
  // IMPORTANT: stable reference for words so the grid doesn't rebuild on every render.
  const words = useMemo(() => (level?.words || []).filter(Boolean), [level?.words]);

  const [seed, setSeed] = useState(0);
  const { grid, placements } = useMemo(() => buildGrid(words), [words, seed]);
  const [selection, setSelection] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [found, setFound] = useState({});

  useEffect(() => { setFound({}); setSelection([]); setSeed(0); }, [idx]);

  const start = (r, c) => { setSelection([[r, c]]); setDragging(true); };
  const enter = (r, c) => {
    if (!dragging) return;
    setSelection((sel) => {
      if (sel.length === 0) return [[r, c]];
      const [r0, c0] = sel[0];
      const dr = Math.sign(r - r0), dc = Math.sign(c - c0);
      const len = Math.max(Math.abs(r - r0), Math.abs(c - c0)) + 1;
      if (dr !== 0 && dc !== 0 && Math.abs(r - r0) !== Math.abs(c - c0)) return sel;
      const cells = [];
      for (let i = 0; i < len; i++) cells.push([r0 + dr * i, c0 + dc * i]);
      return cells;
    });
  };
  const end = () => {
    if (!dragging) return;
    setDragging(false);
    const word = selection.map(([r, c]) => grid[r][c]).join("");
    const match = placements.find((p) => p.word === word && p.cells.length === selection.length && p.cells.every(([r, c], i) => selection[i][0] === r && selection[i][1] === c));
    if (match && !found[match.word]) {
      const next = { ...found, [match.word]: match.cells };
      setFound(next);
      if (Object.keys(next).length === placements.length) onComplete?.();
    }
    setSelection([]);
  };

  const inSel = (r, c) => selection.some(([sr, sc]) => sr === r && sc === c);
  const inFound = (r, c) => Object.values(found).some((cells) => cells.some(([fr, fc]) => fr === r && fc === c));

  if (!words.length) return <div className="text-[#4a5568] text-center py-10">No words yet. Add a level in the admin.</div>;
  const complete = Object.keys(found).length === placements.length && placements.length > 0;

  return (
    <div className="space-y-3" data-testid="game-word-search">
      <LevelHeader idx={idx} total={total} levels={L} onPick={setLevel} onAdvance={advance} />
      <div className="grid select-none" style={{ gridTemplateColumns: `repeat(${SIZE},1fr)`, touchAction: "none" }} onMouseLeave={end} onMouseUp={end} onTouchEnd={end}>
        {grid.map((row, r) => row.map((ch, c) => (
          <div key={`${r}-${c}`}
            onMouseDown={(e) => { e.preventDefault(); start(r, c); }} onMouseEnter={() => enter(r, c)}
            onTouchStart={(e) => { e.preventDefault(); start(r, c); }}
            onTouchMove={(e) => { e.preventDefault(); const t = e.touches[0]; const el = document.elementFromPoint(t.clientX, t.clientY); const rr = el?.getAttribute("data-r"), cc = el?.getAttribute("data-c"); if (rr !== null && cc !== null) enter(parseInt(rr, 10), parseInt(cc, 10)); }}
            data-r={r} data-c={c} data-testid={`ws-cell-${r}-${c}`}
            style={{ touchAction: "none", userSelect: "none" }}
            className={`aspect-square grid place-items-center font-bold text-sm md:text-base cursor-pointer ${inFound(r, c) ? "bg-[#b8e0c2]" : inSel(r, c) ? "bg-[#a8e6e1]" : "bg-white hover:bg-[#eef9fb]"} border border-[#f4e4c6] text-[#3a4a55]`}>{ch}</div>
        )))}
      </div>
      <div>
        <div className="text-xs uppercase tracking-widest font-bold text-[#7cbf94] mb-1">Find these words</div>
        <div className="flex flex-wrap gap-2">
          {placements.map((p) => (
            <span key={p.word} className={`px-3 py-1 rounded-full text-sm font-bold ${found[p.word] ? "bg-[#b8e0c2] text-[#3a8a6f] line-through" : "bg-[#fffbf3] border-2 border-[#f4e4c6] text-[#3a4a55]"}`} data-testid={`ws-target-${p.word}`}>{p.word}</span>
          ))}
        </div>
      </div>
      <div className="flex justify-between text-sm text-[#4a5568]">
        <div>Found {Object.keys(found).length}/{placements.length}</div>
        <button onClick={() => { setSeed((s) => s + 1); setFound({}); setSelection([]); }} className="btn-ghost text-xs" data-testid="ws-reset">New puzzle</button>
      </div>
      {complete && total > 1 && (
        <div className="text-center pt-2"><button onClick={advance} className="btn-primary" data-testid="ws-next-level">Next pack →</button></div>
      )}
    </div>
  );
}

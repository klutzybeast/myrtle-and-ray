import { useEffect, useMemo, useState } from "react";
import { useRotatingLevel, LevelHeader } from "./useLevels";

function generateMaze(w, h) {
  const cells = Array.from({ length: h }, () => Array.from({ length: w }, () => ({ N: true, S: true, E: true, W: true, visited: false })));
  const stack = [[0, 0]];
  cells[0][0].visited = true;
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const neighbors = [];
    if (y > 0 && !cells[y - 1][x].visited) neighbors.push(["N", x, y - 1]);
    if (y < h - 1 && !cells[y + 1][x].visited) neighbors.push(["S", x, y + 1]);
    if (x < w - 1 && !cells[y][x + 1].visited) neighbors.push(["E", x + 1, y]);
    if (x > 0 && !cells[y][x - 1].visited) neighbors.push(["W", x - 1, y]);
    if (!neighbors.length) { stack.pop(); continue; }
    const [dir, nx, ny] = neighbors[Math.floor(Math.random() * neighbors.length)];
    cells[y][x][dir] = false;
    const opp = { N: "S", S: "N", E: "W", W: "E" }[dir];
    cells[ny][nx][opp] = false;
    cells[ny][nx].visited = true;
    stack.push([nx, ny]);
  }
  return cells;
}

export default function Maze({ data, onComplete }) {
  const levels = useMemo(() => {
    if (Array.isArray(data?.levels) && data.levels.length) return data.levels;
    if (data?.width && data?.height) return [{ name: "Maze", width: data.width, height: data.height }];
    return [{ name: "Default", width: 12, height: 12 }];
  }, [data]);
  const { level, idx, total, advance, setLevel, levels: L } = useRotatingLevel("maze", levels);
  const w = Math.min(Math.max(parseInt(level?.width || 12, 10), 5), 24);
  const h = Math.min(Math.max(parseInt(level?.height || 12, 10), 5), 24);

  const [seed, setSeed] = useState(0);
  const maze = useMemo(() => generateMaze(w, h), [w, h, seed]);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [won, setWon] = useState(false);
  const [moves, setMoves] = useState(0);

  const move = (dir) => {
    if (won) return;
    setPos((p) => {
      const cell = maze[p.y][p.x];
      let nx = p.x, ny = p.y;
      if (dir === "N" && !cell.N) ny--;
      else if (dir === "S" && !cell.S) ny++;
      else if (dir === "E" && !cell.E) nx++;
      else if (dir === "W" && !cell.W) nx--;
      if (nx === p.x && ny === p.y) return p;
      setMoves((m) => m + 1);
      if (nx === w - 1 && ny === h - 1) { setWon(true); onComplete?.(); }
      return { x: nx, y: ny };
    });
  };

  useEffect(() => {
    const onKey = (e) => {
      const map = { ArrowUp: "N", ArrowDown: "S", ArrowLeft: "W", ArrowRight: "E", w: "N", s: "S", a: "W", d: "E" };
      const dir = map[e.key];
      if (dir) { e.preventDefault(); move(dir); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maze, won, w, h]);

  useEffect(() => { setPos({ x: 0, y: 0 }); setWon(false); setMoves(0); }, [maze]);

  const newMaze = () => { setPos({ x: 0, y: 0 }); setWon(false); setMoves(0); setSeed((s) => s + 1); };

  // Auto-shrink cell size so big mazes fit on small screens
  const cellSize = Math.max(16, Math.min(30, Math.floor(560 / Math.max(w, h))));

  return (
    <div className="space-y-3" data-testid="game-maze">
      <LevelHeader idx={idx} total={total} levels={L} onPick={setLevel} onAdvance={advance} />
      <div className="flex items-center justify-between text-sm text-[#4a5568] flex-wrap gap-2">
        <div><b>Moves:</b> {moves} — Help Billy reach the shell 🐚</div>
        <button onClick={newMaze} className="btn-ghost text-xs" data-testid="maze-reset">New maze</button>
      </div>
      <div className="mx-auto rounded-2xl p-2 bg-[#eef9fb] border-4 border-white shadow-inner" style={{ width: "fit-content", maxWidth: "100%" }}>
        <svg width={w * cellSize} height={h * cellSize} viewBox={`0 0 ${w * cellSize} ${h * cellSize}`} className="max-w-full h-auto">
          {maze.flatMap((row, y) => row.map((cell, x) => (
            <g key={`${x}-${y}`}>
              {cell.N && <line x1={x * cellSize} y1={y * cellSize} x2={(x + 1) * cellSize} y2={y * cellSize} stroke="#3a4a55" strokeWidth="3" strokeLinecap="round" />}
              {cell.W && <line x1={x * cellSize} y1={y * cellSize} x2={x * cellSize} y2={(y + 1) * cellSize} stroke="#3a4a55" strokeWidth="3" strokeLinecap="round" />}
              {y === h - 1 && cell.S && <line x1={x * cellSize} y1={(y + 1) * cellSize} x2={(x + 1) * cellSize} y2={(y + 1) * cellSize} stroke="#3a4a55" strokeWidth="3" strokeLinecap="round" />}
              {x === w - 1 && cell.E && <line x1={(x + 1) * cellSize} y1={y * cellSize} x2={(x + 1) * cellSize} y2={(y + 1) * cellSize} stroke="#3a4a55" strokeWidth="3" strokeLinecap="round" />}
            </g>
          )))}
          <text x={(w - 1) * cellSize + cellSize / 2} y={(h - 1) * cellSize + cellSize * 0.72} textAnchor="middle" fontSize={cellSize * 0.7}>🐚</text>
          <text x={pos.x * cellSize + cellSize / 2} y={pos.y * cellSize + cellSize * 0.72} textAnchor="middle" fontSize={cellSize * 0.7} data-testid="maze-player">🐳</text>
        </svg>
      </div>
      <div className="flex justify-center gap-2 sm:hidden">
        <div></div>
        <button onClick={() => move("N")} className="btn-secondary px-4 py-2" aria-label="Up" data-testid="maze-up">↑</button>
        <div></div>
      </div>
      <div className="flex justify-center gap-2 sm:hidden">
        <button onClick={() => move("W")} className="btn-secondary px-4 py-2" aria-label="Left" data-testid="maze-left">←</button>
        <button onClick={() => move("S")} className="btn-secondary px-4 py-2" aria-label="Down" data-testid="maze-down">↓</button>
        <button onClick={() => move("E")} className="btn-secondary px-4 py-2" aria-label="Right" data-testid="maze-right">→</button>
      </div>
      <p className="hidden sm:block text-center text-xs text-[#6b7280]">Use the arrow keys or WASD to move.</p>
      {won && (
        <div className="text-center bg-[#eef9fb] rounded-2xl p-4">
          <div className="font-accent text-2xl font-bold text-[#5a8a6f]">You made it in {moves} moves!</div>
          {total > 1 && <button onClick={advance} className="btn-primary mt-3" data-testid="maze-next-level">Try next level →</button>}
        </div>
      )}
    </div>
  );
}

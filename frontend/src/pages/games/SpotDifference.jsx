import { useEffect, useMemo, useState } from "react";
import { useRotatingLevel, LevelHeader } from "./useLevels";

const BEACH_A = (
  <g>
    <rect x="0" y="0" width="600" height="220" fill="#a8e6e1" />
    <circle cx="500" cy="60" r="34" fill="#fdd47e" />
    <path d="M0 260 Q150 220 300 260 T600 260 L600 360 L0 360 Z" fill="#7fcfc7" />
    <path d="M0 360 L600 360 L600 400 L0 400 Z" fill="#f4e4c6" />
    <circle cx="120" cy="382" r="9" fill="#f0a988" />
    <circle cx="220" cy="388" r="7" fill="#e89bab" />
    <circle cx="380" cy="385" r="6" fill="#b8a3d9" />
    <circle cx="520" cy="390" r="8" fill="#fdd47e" />
    <g transform="translate(70,150)"><circle r="22" fill="#fff" /><circle cx="-6" cy="-4" r="3" fill="#3a4a55" /><circle cx="6" cy="-4" r="3" fill="#3a4a55" /></g>
    <g transform="translate(420,170)"><path d="M0 0 L20 -16 L40 0 Z" fill="#b8e0c2" /></g>
  </g>
);
const BEACH_B = (
  <g>
    <rect x="0" y="0" width="600" height="220" fill="#a8e6e1" />
    <ellipse cx="180" cy="80" rx="40" ry="14" fill="white" />
    <circle cx="500" cy="60" r="34" fill="#fdd47e" />
    <path d="M0 260 Q150 220 300 260 T600 260 L600 360 L0 360 Z" fill="#7fcfc7" />
    <path d="M0 360 L600 360 L600 400 L0 400 Z" fill="#f4e4c6" />
    <circle cx="120" cy="382" r="9" fill="#f0a988" />
    <circle cx="380" cy="385" r="6" fill="#b8a3d9" />
    <circle cx="560" cy="384" r="9" fill="#e89bab" />
    <circle cx="520" cy="390" r="8" fill="#fdd47e" />
    <g transform="translate(70,150)"><circle r="22" fill="#fdd47e" /><circle cx="-6" cy="-4" r="3" fill="#3a4a55" /><circle cx="6" cy="-4" r="3" fill="#3a4a55" /></g>
    <g transform="translate(330,90)"><path d="M0 0 L12 -12 L24 0 L12 12 Z" fill="#f0a988" /><line x1="12" y1="12" x2="12" y2="36" stroke="#3a4a55" /></g>
    <g transform="translate(420,170)"><path d="M0 0 L20 -16 L40 0 Z" fill="#b8e0c2" /></g>
  </g>
);

const CAMP_A = (
  <g>
    <rect x="0" y="0" width="600" height="220" fill="#cfe9f7" />
    <circle cx="80" cy="60" r="30" fill="#fdd47e" />
    <path d="M120 240 L180 170 L240 240 Z" fill="#f0a988" />
    <rect x="135" y="240" width="90" height="60" fill="#f4e4c6" />
    <rect x="170" y="270" width="20" height="30" fill="#3a4a55" />
    <path d="M450 320 Q455 220 470 200 Q485 230 510 200 Q500 240 470 250 Q455 280 450 320 Z" fill="#7cbf94" />
    <rect x="445" y="300" width="10" height="60" fill="#9b7b56" />
    <path d="M0 300 Q300 290 600 300 L600 400 L0 400 Z" fill="#f4e4c6" />
    <circle cx="320" cy="370" r="8" fill="#e89bab" />
  </g>
);
const CAMP_B = (
  <g>
    <rect x="0" y="0" width="600" height="220" fill="#cfe9f7" />
    <circle cx="80" cy="60" r="30" fill="#fdd47e" />
    {/* diff 1: bird in sky */}
    <path d="M260 80 q10 -8 20 0 q10 -8 20 0" fill="none" stroke="#3a4a55" strokeWidth="3" />
    <path d="M120 240 L180 170 L240 240 Z" fill="#f0a988" />
    <rect x="135" y="240" width="90" height="60" fill="#f4e4c6" />
    {/* diff 2: door color */}
    <rect x="170" y="270" width="20" height="30" fill="#f0a988" />
    <path d="M450 320 Q455 220 470 200 Q485 230 510 200 Q500 240 470 250 Q455 280 450 320 Z" fill="#7cbf94" />
    <rect x="445" y="300" width="10" height="60" fill="#9b7b56" />
    {/* diff 3: coconut on palm */}
    <circle cx="476" cy="245" r="6" fill="#5b3a1a" />
    <path d="M0 300 Q300 290 600 300 L600 400 L0 400 Z" fill="#f4e4c6" />
    <circle cx="320" cy="370" r="8" fill="#e89bab" />
    {/* diff 4: extra shell */}
    <circle cx="120" cy="370" r="7" fill="#fdd47e" />
    {/* diff 5: cloud */}
    <ellipse cx="520" cy="80" rx="40" ry="14" fill="white" />
  </g>
);

const SCENES = {
  beach: {
    a: BEACH_A, b: BEACH_B,
    diffs: [
      { id: "cloud", cx: 180, cy: 80, r: 40, label: "Cloud" },
      { id: "shell-missing", cx: 220, cy: 388, r: 24, label: "Missing shell" },
      { id: "extra-shell", cx: 560, cy: 384, r: 22, label: "Extra shell" },
      { id: "char-color", cx: 70, cy: 150, r: 36, label: "Color change" },
      { id: "kite", cx: 342, cy: 110, r: 30, label: "Kite" },
    ],
  },
  camp: {
    a: CAMP_A, b: CAMP_B,
    diffs: [
      { id: "bird", cx: 280, cy: 80, r: 36, label: "Bird in sky" },
      { id: "door", cx: 180, cy: 285, r: 24, label: "Door color" },
      { id: "coconut", cx: 476, cy: 245, r: 18, label: "Coconut" },
      { id: "shell2", cx: 120, cy: 370, r: 20, label: "Extra shell" },
      { id: "cloud", cx: 520, cy: 80, r: 40, label: "Cloud" },
    ],
  },
};

export default function SpotDifference({ data, onComplete }) {
  const levels = useMemo(() => {
    if (Array.isArray(data?.levels) && data.levels.length) return data.levels;
    return [{ name: "Beach day", scene_key: "beach" }, { name: "Camp scene", scene_key: "camp" }];
  }, [data]);
  const { level, idx, total, advance, setLevel, levels: L } = useRotatingLevel("spot_difference", levels);
  const sceneKey = SCENES[level?.scene_key] ? level.scene_key : "beach";
  const scene = SCENES[sceneKey];

  const [foundIds, setFoundIds] = useState(new Set());
  useEffect(() => { setFoundIds(new Set()); }, [sceneKey]);

  const handleClick = (e) => {
    const svg = e.currentTarget;
    const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const cursor = pt.matrixTransform(svg.getScreenCTM().inverse());
    for (const d of scene.diffs) {
      const dx = cursor.x - d.cx, dy = cursor.y - d.cy;
      if (Math.sqrt(dx * dx + dy * dy) <= d.r && !foundIds.has(d.id)) {
        const next = new Set(foundIds); next.add(d.id);
        setFoundIds(next);
        if (next.size === scene.diffs.length) onComplete?.();
        return;
      }
    }
  };

  return (
    <div className="space-y-3" data-testid="game-spot-difference">
      <LevelHeader idx={idx} total={total} levels={L} onPick={setLevel} onAdvance={advance} />
      <div className="text-center text-sm text-[#4a5568]">Tap the differences in the right-hand picture. Find all {scene.diffs.length}!</div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border-4 border-[#f4e4c6] overflow-hidden"><svg viewBox="0 0 600 400" className="w-full h-auto">{scene.a}</svg></div>
        <div className="bg-white rounded-2xl border-4 border-[#f4e4c6] overflow-hidden">
          <svg viewBox="0 0 600 400" className="w-full h-auto cursor-crosshair" onClick={handleClick} data-testid="sd-image-b">
            {scene.b}
            {Array.from(foundIds).map((id) => { const d = scene.diffs.find((x) => x.id === id); return <circle key={id} cx={d.cx} cy={d.cy} r={d.r} fill="none" stroke="#7cbf94" strokeWidth="4" data-testid={`sd-found-${id}`} />; })}
          </svg>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 justify-center">
        {scene.diffs.map((d) => (
          <span key={d.id} className={`px-3 py-1 rounded-full text-xs font-bold ${foundIds.has(d.id) ? "bg-[#b8e0c2] text-[#3a8a6f] line-through" : "bg-[#fffbf3] border border-[#f4e4c6] text-[#3a4a55]"}`}>{d.label}</span>
        ))}
      </div>
      <div className="flex justify-between text-sm text-[#4a5568] flex-wrap gap-2">
        <div>Found {foundIds.size}/{scene.diffs.length}</div>
        <div className="flex gap-2">
          <button onClick={() => setFoundIds(new Set())} className="btn-ghost text-xs" data-testid="sd-reset">Start over</button>
          {foundIds.size === scene.diffs.length && total > 1 && (
            <button onClick={advance} className="btn-primary text-xs" data-testid="sd-next-level">Next scene →</button>
          )}
        </div>
      </div>
    </div>
  );
}

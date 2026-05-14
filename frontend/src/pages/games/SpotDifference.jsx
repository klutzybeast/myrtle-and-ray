import { useMemo, useState } from "react";

// Built-in scene: same beach SVG drawn twice with N intentional differences.
// Differences are recorded as circles on image B with normalized [0..1] coordinates.
function BeachA() {
  return (
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
}
function BeachB() {
  return (
    <g>
      <rect x="0" y="0" width="600" height="220" fill="#a8e6e1" />
      {/* diff 1: extra sun cloud — added cloud */}
      <ellipse cx="180" cy="80" rx="40" ry="14" fill="white" />
      <circle cx="500" cy="60" r="34" fill="#fdd47e" />
      <path d="M0 260 Q150 220 300 260 T600 260 L600 360 L0 360 Z" fill="#7fcfc7" />
      <path d="M0 360 L600 360 L600 400 L0 400 Z" fill="#f4e4c6" />
      <circle cx="120" cy="382" r="9" fill="#f0a988" />
      {/* diff 2: shell missing at (220,388) — removed */}
      <circle cx="380" cy="385" r="6" fill="#b8a3d9" />
      {/* diff 3: extra shell on right */}
      <circle cx="560" cy="384" r="9" fill="#e89bab" />
      <circle cx="520" cy="390" r="8" fill="#fdd47e" />
      {/* diff 4: smiley character — different color */}
      <g transform="translate(70,150)"><circle r="22" fill="#fdd47e" /><circle cx="-6" cy="-4" r="3" fill="#3a4a55" /><circle cx="6" cy="-4" r="3" fill="#3a4a55" /></g>
      {/* diff 5: kite added in sky */}
      <g transform="translate(330,90)"><path d="M0 0 L12 -12 L24 0 L12 12 Z" fill="#f0a988" /><line x1="12" y1="12" x2="12" y2="36" stroke="#3a4a55" /></g>
      <g transform="translate(420,170)"><path d="M0 0 L20 -16 L40 0 Z" fill="#b8e0c2" /></g>
    </g>
  );
}

// Coordinates are in viewBox units (0..600 x 0..400). Tolerance radius in same units.
const DIFFS = [
  { id: "cloud", cx: 180, cy: 80, r: 40, label: "Cloud" },
  { id: "shell-missing", cx: 220, cy: 388, r: 24, label: "Missing shell" },
  { id: "extra-shell", cx: 560, cy: 384, r: 22, label: "Extra shell" },
  { id: "char-color", cx: 70 + 0, cy: 150, r: 36, label: "Color change" },
  { id: "kite", cx: 342, cy: 110, r: 30, label: "Kite" },
];

export default function SpotDifference({ data, onComplete }) {
  // Admin can supply custom scenes (image_a / image_b). For MVP we ship a built-in.
  const userScenes = (data?.scenes || []).filter((s) => s.image_a && s.image_b);
  const [foundIds, setFoundIds] = useState(new Set());
  const handleClick = (e, refDiffs) => {
    const svg = e.currentTarget;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const cursor = pt.matrixTransform(svg.getScreenCTM().inverse());
    for (const d of refDiffs) {
      const dx = cursor.x - d.cx, dy = cursor.y - d.cy;
      if (Math.sqrt(dx * dx + dy * dy) <= d.r && !foundIds.has(d.id)) {
        const next = new Set(foundIds); next.add(d.id);
        setFoundIds(next);
        if (next.size === refDiffs.length) onComplete?.();
        return;
      }
    }
  };

  // If admin uploaded a real pair, we still need a way to record diffs; for now we use the built-in.
  return (
    <div className="space-y-3" data-testid="game-spot-difference">
      <div className="text-center text-sm text-[#4a5568]">Tap the differences in the right-hand picture. Find all {DIFFS.length}!</div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border-4 border-[#f4e4c6] overflow-hidden">
          <svg viewBox="0 0 600 400" className="w-full h-auto"><BeachA /></svg>
        </div>
        <div className="bg-white rounded-2xl border-4 border-[#f4e4c6] overflow-hidden">
          <svg viewBox="0 0 600 400" className="w-full h-auto cursor-crosshair" onClick={(e) => handleClick(e, DIFFS)} data-testid="sd-image-b">
            <BeachB />
            {Array.from(foundIds).map((id) => {
              const d = DIFFS.find((x) => x.id === id);
              return <circle key={id} cx={d.cx} cy={d.cy} r={d.r} fill="none" stroke="#7cbf94" strokeWidth="4" data-testid={`sd-found-${id}`} />;
            })}
          </svg>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 justify-center">
        {DIFFS.map((d) => (
          <span key={d.id} className={`px-3 py-1 rounded-full text-xs font-bold ${foundIds.has(d.id) ? "bg-[#b8e0c2] text-[#3a8a6f] line-through" : "bg-[#fffbf3] border border-[#f4e4c6] text-[#3a4a55]"}`}>{d.label}</span>
        ))}
      </div>
      <div className="flex justify-between text-sm text-[#4a5568]">
        <div>Found {foundIds.size}/{DIFFS.length}</div>
        <button onClick={() => setFoundIds(new Set())} className="btn-ghost text-xs" data-testid="sd-reset">Start over</button>
      </div>
      {userScenes.length > 0 && (
        <p className="text-center text-[10px] text-[#9aa3ab]">Admin has uploaded {userScenes.length} custom scene(s) — coming soon!</p>
      )}
    </div>
  );
}

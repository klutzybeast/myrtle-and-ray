import { useEffect, useRef, useState } from "react";

const DEFAULT_PALETTE = ["#40E0D0", "#FF9B71", "#87CEEB", "#3CB371", "#FFB347", "#9B72CB", "#FFFFFF", "#3a4a55"];

// Pre-baked SVG line art scenes that take fill from CSS variables. Each region has a unique data-region id.
const SCENES = [
  {
    key: "wave",
    title: "Big Wave",
    svg: (
      <>
        <rect data-region="sky" x="0" y="0" width="600" height="220" fill="white" stroke="#3a4a55" strokeWidth="3" />
        <path data-region="sun" d="M520 80 a40 40 0 1 0 0.1 0 z" fill="white" stroke="#3a4a55" strokeWidth="3" />
        <path data-region="wave" d="M0 260 Q150 180 300 260 T600 260 L600 360 L0 360 Z" fill="white" stroke="#3a4a55" strokeWidth="3" />
        <path data-region="curl" d="M180 250 Q210 220 260 230 Q220 260 200 270 Z" fill="white" stroke="#3a4a55" strokeWidth="3" />
        <path data-region="sand" d="M0 360 L600 360 L600 400 L0 400 Z" fill="white" stroke="#3a4a55" strokeWidth="3" />
        <circle data-region="shell" cx="120" cy="380" r="10" fill="white" stroke="#3a4a55" strokeWidth="3" />
        <circle data-region="shell2" cx="480" cy="385" r="8" fill="white" stroke="#3a4a55" strokeWidth="3" />
      </>
    ),
  },
  {
    key: "camp",
    title: "Stingray Cay",
    svg: (
      <>
        <rect data-region="sky" x="0" y="0" width="600" height="240" fill="white" stroke="#3a4a55" strokeWidth="3" />
        <path data-region="hut" d="M120 240 L180 170 L240 240 Z" fill="white" stroke="#3a4a55" strokeWidth="3" />
        <rect data-region="hut-body" x="135" y="240" width="90" height="60" fill="white" stroke="#3a4a55" strokeWidth="3" />
        <path data-region="palm" d="M450 320 Q455 220 470 200 Q485 230 510 200 Q500 240 470 250 Q455 280 450 320 Z" fill="white" stroke="#3a4a55" strokeWidth="3" />
        <rect data-region="trunk" x="445" y="300" width="10" height="60" fill="white" stroke="#3a4a55" strokeWidth="3" />
        <path data-region="sand" d="M0 300 Q300 290 600 300 L600 400 L0 400 Z" fill="white" stroke="#3a4a55" strokeWidth="3" />
        <circle data-region="sun" cx="80" cy="80" r="30" fill="white" stroke="#3a4a55" strokeWidth="3" />
      </>
    ),
  },
];

export default function Coloring({ data, onComplete }) {
  const palette = (data?.palette || DEFAULT_PALETTE).filter(Boolean);
  const [scene, setScene] = useState(SCENES[0].key);
  const [color, setColor] = useState(palette[0] || "#7fcfc7");
  const [colors, setColors] = useState({});
  const containerRef = useRef(null);
  const [completed, setCompleted] = useState(false);

  useEffect(() => { setColors({}); setCompleted(false); }, [scene]);

  const onPaint = (e) => {
    const region = e.target.getAttribute?.("data-region");
    if (!region) return;
    setColors((c) => {
      const next = { ...c, [region]: color };
      // Award badge once 4+ regions are painted
      if (!completed && Object.keys(next).length >= 4) { setCompleted(true); onComplete?.(); }
      return next;
    });
  };

  const downloadPng = () => {
    const svg = containerRef.current?.querySelector("svg");
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `myrtle-coloring-${scene}.svg`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  const current = SCENES.find((s) => s.key === scene);

  return (
    <div className="space-y-3" data-testid="game-coloring">
      <div className="flex flex-wrap gap-2 justify-center">
        {SCENES.map((s) => (
          <button key={s.key} onClick={() => setScene(s.key)} className={`text-xs font-bold px-3 py-1 rounded-full ${scene === s.key ? "bg-[#7fcfc7] text-white" : "bg-[#eef9fb] text-[#5a8a6f]"}`} data-testid={`color-scene-${s.key}`}>{s.title}</button>
        ))}
      </div>
      <div ref={containerRef} className="bg-white rounded-2xl border-4 border-[#f4e4c6] overflow-hidden">
        <svg viewBox="0 0 600 400" className="w-full h-auto cursor-pointer" onClick={onPaint} onTouchEnd={onPaint}>
          <g style={{}}>{current.svg}</g>
          {/* re-apply colors via style on selected regions */}
          <style>{Object.entries(colors).map(([r, c]) => `[data-region="${r}"]{fill:${c} !important}`).join("\n")}</style>
        </svg>
      </div>
      <div className="flex flex-wrap gap-2 items-center justify-center">
        <span className="text-xs uppercase tracking-widest font-bold text-[#7cbf94]">Palette</span>
        {palette.map((p) => (
          <button key={p} onClick={() => setColor(p)} className={`w-9 h-9 rounded-full border-4 transition-transform ${color === p ? "border-[#3a4a55] scale-110" : "border-white"}`} style={{ background: p }} data-testid={`color-swatch-${p}`} aria-label={`Pick ${p}`} />
        ))}
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-9 h-9 rounded-full border-2 border-[#f4e4c6] overflow-hidden" data-testid="color-custom" />
      </div>
      <div className="flex justify-center gap-2 flex-wrap">
        <button onClick={() => setColors({})} className="btn-ghost text-xs" data-testid="color-clear">Start over</button>
        <button onClick={downloadPng} className="btn-secondary text-xs" data-testid="color-save">Save my picture</button>
      </div>
    </div>
  );
}

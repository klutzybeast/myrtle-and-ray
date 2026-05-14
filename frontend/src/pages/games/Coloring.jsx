import { useEffect, useMemo, useRef, useState } from "react";
import { useRotatingLevel, LevelHeader } from "./useLevels";

const DEFAULT_PALETTE = ["#40E0D0", "#FF9B71", "#87CEEB", "#3CB371", "#FFB347", "#9B72CB", "#FFFFFF", "#3a4a55"];

const SCENES = {
  wave: (
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
  camp: (
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
};

export default function Coloring({ data, onComplete }) {
  const palette = (data?.palette || DEFAULT_PALETTE).filter(Boolean);
  const levels = useMemo(() => {
    if (Array.isArray(data?.levels) && data.levels.length) return data.levels;
    return [{ name: "Big Wave", scene_key: "wave" }, { name: "Stingray Cay", scene_key: "camp" }];
  }, [data]);
  const { level, idx, total, advance, setLevel, levels: L } = useRotatingLevel("coloring", levels);
  const sceneKey = SCENES[level?.scene_key] ? level.scene_key : Object.keys(SCENES)[0];

  const [color, setColor] = useState(palette[0] || "#7fcfc7");
  const [colors, setColors] = useState({});
  const [completed, setCompleted] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => { setColors({}); setCompleted(false); }, [sceneKey]);

  const onPaint = (e) => {
    const region = e.target.getAttribute?.("data-region");
    if (!region) return;
    setColors((c) => {
      const next = { ...c, [region]: color };
      if (!completed && Object.keys(next).length >= 4) { setCompleted(true); onComplete?.(); }
      return next;
    });
  };

  const download = () => {
    const svg = containerRef.current?.querySelector("svg");
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `myrtle-coloring-${sceneKey}.svg`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3" data-testid="game-coloring">
      <LevelHeader idx={idx} total={total} levels={L} onPick={setLevel} onAdvance={advance} />
      <div ref={containerRef} className="bg-white rounded-2xl border-4 border-[#f4e4c6] overflow-hidden">
        <svg viewBox="0 0 600 400" className="w-full h-auto cursor-pointer" onClick={onPaint} onTouchEnd={onPaint} data-testid={`color-scene-${sceneKey}`}>
          {SCENES[sceneKey]}
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
        <button onClick={download} className="btn-secondary text-xs" data-testid="color-save">Save my picture</button>
        {completed && total > 1 && <button onClick={advance} className="btn-primary text-xs" data-testid="color-next-level">Next scene →</button>}
      </div>
    </div>
  );
}

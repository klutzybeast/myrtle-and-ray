import { useEffect, useMemo, useRef, useState } from "react";
import { useRotatingLevel, LevelHeader } from "./useLevels";

const STICKERS = ["🐢", "🐠", "🐙", "🌊", "🐚", "⭐", "🦀", "🪼", "🐬", "🐟", "🏖️", "☀️", "🌺", "🐳", "🐡"];
const DEFAULT_SCENE = "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&h=700&fit=crop";

export default function StickerBeach({ data, onComplete }) {
  const levels = useMemo(() => {
    if (Array.isArray(data?.levels) && data.levels.length) return data.levels;
    return [{ name: "Beach", scene_image: data?.scene_image || DEFAULT_SCENE }];
  }, [data]);
  const { level, idx, total, advance, setLevel, levels: L } = useRotatingLevel("sticker_beach", levels);
  const sceneImg = level?.scene_image || DEFAULT_SCENE;

  const [items, setItems] = useState([]);
  const [picked, setPicked] = useState(STICKERS[0]);
  const [awarded, setAwarded] = useState(false);
  const stageRef = useRef(null);
  const draggingRef = useRef(null);

  useEffect(() => { setItems([]); setAwarded(false); }, [idx]);

  const addAt = (e) => {
    if (e.target?.closest?.('[data-sticker="1"]')) return; // ignore clicks on existing stickers
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const point = e.touches?.[0] || e;
    const x = ((point.clientX - rect.left) / rect.width) * 100;
    const y = ((point.clientY - rect.top) / rect.height) * 100;
    if (x < 0 || x > 100 || y < 0 || y > 100) return;
    const id = `s_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setItems((arr) => {
      const next = [...arr, { id, emoji: picked, x, y, size: 44 }];
      if (!awarded && next.length >= 5) { setAwarded(true); onComplete?.(); }
      return next;
    });
  };

  const removeOne = (id, e) => { e?.stopPropagation(); setItems((arr) => arr.filter((it) => it.id !== id)); };
  const onDown = (id, e) => { e.stopPropagation(); draggingRef.current = id; };
  const onMove = (e) => {
    if (!draggingRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const p = e.touches?.[0] || e;
    const x = ((p.clientX - rect.left) / rect.width) * 100;
    const y = ((p.clientY - rect.top) / rect.height) * 100;
    setItems((arr) => arr.map((it) => it.id === draggingRef.current ? { ...it, x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) } : it));
  };
  const onUp = () => { draggingRef.current = null; };

  return (
    <div className="space-y-3" data-testid="game-sticker-beach">
      <LevelHeader idx={idx} total={total} levels={L} onPick={setLevel} onAdvance={advance} />
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs uppercase tracking-widest font-bold text-[#7cbf94]">Pick a sticker</span>
        {STICKERS.map((s) => (
          <button key={s} onClick={() => setPicked(s)} className={`w-10 h-10 rounded-2xl text-2xl border-2 ${picked === s ? "border-[#3a4a55] bg-[#eef9fb]" : "border-[#f4e4c6] bg-white hover:bg-[#fffbf3]"}`} data-testid={`sticker-${s}`}>{s}</button>
        ))}
      </div>
      <div ref={stageRef} onClick={addAt} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp} onTouchMove={(e) => { e.preventDefault(); onMove(e); }} onTouchEnd={onUp}
        className="relative rounded-2xl overflow-hidden border-4 border-white shadow-inner select-none"
        style={{ aspectRatio: "16/9", background: `center/cover no-repeat url(${sceneImg})`, touchAction: "none" }} data-testid="sticker-stage">
        {items.map((it) => (
          <div key={it.id} data-sticker="1" onMouseDown={(e) => onDown(it.id, e)} onTouchStart={(e) => onDown(it.id, e)} onDoubleClick={(e) => removeOne(it.id, e)}
            className="absolute -translate-x-1/2 -translate-y-1/2 cursor-move drop-shadow-md hover:scale-110 active:scale-105 transition-transform"
            style={{ left: `${it.x}%`, top: `${it.y}%`, fontSize: it.size }} data-testid={`placed-${it.id}`} title="Drag to move. Double-click to remove.">{it.emoji}</div>
        ))}
        {items.length === 0 && (
          <div className="absolute inset-0 grid place-items-center pointer-events-none">
            <div className="bg-white/90 rounded-full px-5 py-2 font-accent font-bold text-[#3a4a55]">Tap the scene to place a sticker</div>
          </div>
        )}
      </div>
      <div className="flex justify-between text-sm text-[#4a5568] flex-wrap gap-2">
        <div>Stickers placed: {items.length}</div>
        <div className="flex gap-2">
          <button onClick={() => setItems([])} className="btn-ghost text-xs" data-testid="sticker-clear">Clear scene</button>
          {awarded && total > 1 && <button onClick={advance} className="btn-primary text-xs" data-testid="sticker-next-level">Next scene →</button>}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useRotatingLevel, LevelHeader } from "./useLevels";

// Tap two paint blobs to mix them and reveal a target color.
// data.levels[i] = { name, rounds: [{ target: "Green", target_hex: "#5a8a6f", a: "Yellow", b: "Blue", colors: [{name,hex}, ...] }] }
export default function ColorMixer({ data, onComplete }) {
  const levels = useMemo(() => data?.levels || [], [data]);
  const { level, idx, total, advance, setLevel, levels: L } = useRotatingLevel("color_mixer", levels);
  const [r, setR] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState([]); // hex strings
  const [feedback, setFeedback] = useState(null);
  const [done, setDone] = useState(false);

  useEffect(() => { setR(0); setScore(0); setPicked([]); setFeedback(null); setDone(false); }, [level, idx]);
  if (!level) return <Empty />;

  const rounds = level.rounds || [];
  const cur = rounds[r];
  const required = new Set([cur?.a, cur?.b]);

  const pickColor = (cname) => {
    if (feedback || done) return;
    if (picked.find((p) => p.name === cname)) return;
    const c = (cur.colors || []).find((x) => x.name === cname);
    if (!c) return;
    const next = [...picked, c];
    setPicked(next);
    if (next.length >= 2) {
      const correct = next.every((p) => required.has(p.name)) && required.size === 2 && next.length === 2;
      setFeedback({ correct });
      if (correct) setScore((s) => s + 1);
      setTimeout(() => {
        if (r + 1 >= rounds.length) { setDone(true); onComplete?.(); }
        else { setR(r + 1); setPicked([]); setFeedback(null); }
      }, 1500);
    }
  };

  if (done) {
    return (
      <div className="space-y-3 text-center" data-testid="game-color-mixer-done">
        <LevelHeader idx={idx} total={total} levels={L} onPick={setLevel} onAdvance={advance} />
        <div className="bg-[#fff8ec] rounded-3xl p-6">
          <div className="text-5xl mb-2">🌟</div>
          <div className="font-accent text-2xl font-bold text-[#5a8a6f]">Color genius! {score} / {rounds.length}</div>
          <button onClick={advance} className="btn-primary mt-3" data-testid="mix-next">Next level →</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="game-color-mixer">
      <LevelHeader idx={idx} total={total} levels={L} onPick={setLevel} onAdvance={advance} />
      <div className="flex justify-between text-xs text-[#6b7280]">
        <span>Round {r + 1} / {rounds.length}</span><span>Score: {score}</span>
      </div>
      <div className="bg-white rounded-3xl border-2 border-[#f4e4c6] p-5 text-center space-y-3">
        <div className="text-sm text-[#5a6b76]">Mix two colors to make</div>
        <div className="flex items-center justify-center gap-2">
          <span className="w-12 h-12 rounded-full border-4 border-white shadow-lg" style={{ background: cur?.target_hex }} aria-hidden />
          <span className="font-accent text-3xl font-bold text-[#3a4a55]">{cur?.target}</span>
        </div>
        <div className="flex items-center justify-center gap-3" data-testid="mix-picked-row">
          {[0, 1].map((i) => (
            <div key={i} className={`w-14 h-14 rounded-full border-4 border-[#f4e4c6] grid place-items-center text-xs font-bold ${picked[i] ? "" : "bg-[#fffbf3] text-[#cbd5e1]"}`}
              style={picked[i] ? { background: picked[i].hex, borderColor: "#fff" } : {}}
            >{picked[i] ? "" : "?"}</div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2" data-testid="mix-palette">
        {(cur?.colors || []).map((c, i) => {
          const used = picked.find((p) => p.name === c.name);
          return (
            <button
              key={i}
              disabled={!!feedback || !!used}
              onClick={() => pickColor(c.name)}
              className={`rounded-2xl border-2 py-3 font-bold text-sm shadow transition-all ${used ? "opacity-50" : "hover:scale-105"}`}
              style={{ background: c.hex, color: contrast(c.hex), borderColor: used ? "#cbd5e1" : "#fff" }}
              data-testid={`mix-color-${i}`}
            >{c.name}</button>
          );
        })}
      </div>
      {feedback && (
        <div className={`rounded-2xl p-3 text-center font-bold ${feedback.correct ? "bg-[#eaf7f5] text-[#5a8a6f]" : "bg-red-50 text-red-700"}`} data-testid="mix-feedback">
          {feedback.correct ? `✅ ${cur.a} + ${cur.b} = ${cur.target}!` : `❌ Try: ${cur.a} + ${cur.b}`}
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

function Empty() { return <div className="text-center text-[#6b7280] py-10">No Color Mixer levels yet.</div>; }

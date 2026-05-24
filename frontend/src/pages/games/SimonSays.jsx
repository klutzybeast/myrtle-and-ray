import { useEffect, useMemo, useRef, useState } from "react";
import { useRotatingLevel, LevelHeader } from "./useLevels";

// Watch a sequence flash on colored pads, then repeat it by tapping.
// data.levels[i] = { name, rounds: number (default 3), start_length: 2, pads: 4 }
const PADS = [
  { color: "#7fcfc7", label: "Teal",   emoji: "🐢" },
  { color: "#f0a988", label: "Coral",  emoji: "🦞" },
  { color: "#b8a3d9", label: "Lilac",  emoji: "🐙" },
  { color: "#7cbf94", label: "Algae",  emoji: "🪸" },
];

export default function SimonSays({ data, onComplete }) {
  const levels = useMemo(() => data?.levels || [], [data]);
  const { level, idx, total, advance, setLevel, levels: L } = useRotatingLevel("simon_says", levels);
  const [phase, setPhase] = useState("idle"); // idle | watch | repeat | done | fail
  const [sequence, setSequence] = useState([]);
  const [userIdx, setUserIdx] = useState(0);
  const [flash, setFlash] = useState(null);
  const [round, setRound] = useState(0);
  const timer = useRef([]);

  const padCount = Math.min(4, Math.max(2, level?.pads || 4));
  const totalRounds = level?.rounds || 3;
  const startLen = level?.start_length || 2;

  useEffect(() => {
    clearTimers();
    setPhase("idle");
    setSequence([]);
    setUserIdx(0);
    setRound(0);
    setFlash(null);
    if (!level) return;
    startRound(0);
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, idx]);

  function clearTimers() {
    timer.current.forEach((t) => clearTimeout(t));
    timer.current = [];
  }

  function startRound(rIdx) {
    const len = startLen + rIdx;
    const seq = Array.from({ length: len }, () => Math.floor(Math.random() * padCount));
    setSequence(seq);
    setUserIdx(0);
    setPhase("watch");
    seq.forEach((pad, i) => {
      timer.current.push(setTimeout(() => setFlash(pad), 600 + i * 700));
      timer.current.push(setTimeout(() => setFlash(null), 600 + i * 700 + 400));
    });
    timer.current.push(setTimeout(() => { setPhase("repeat"); setFlash(null); }, 600 + seq.length * 700 + 100));
  }

  function onPadTap(padIdx) {
    if (phase !== "repeat") return;
    setFlash(padIdx);
    setTimeout(() => setFlash(null), 250);
    if (sequence[userIdx] !== padIdx) {
      setPhase("fail");
      return;
    }
    const nu = userIdx + 1;
    if (nu >= sequence.length) {
      const nextRound = round + 1;
      if (nextRound >= totalRounds) { setPhase("done"); onComplete?.(); return; }
      setRound(nextRound);
      setTimeout(() => startRound(nextRound), 600);
    } else {
      setUserIdx(nu);
    }
  }

  if (!level) return <Empty />;

  return (
    <div className="space-y-3" data-testid="game-simon-says">
      <LevelHeader idx={idx} total={total} levels={L} onPick={setLevel} onAdvance={advance} />
      <div className="text-center text-sm text-[#4a5568]">
        {phase === "watch" && <p className="font-bold">👀 Watch the pattern…</p>}
        {phase === "repeat" && <p className="font-bold text-[#3a4a55]">Your turn! Tap the pads in order. <span className="text-[#6b7280]">({userIdx + 1} / {sequence.length})</span></p>}
        {phase === "fail" && <p className="font-bold text-red-600">Oops! Try again.</p>}
        {phase === "done" && <p className="font-accent text-xl font-bold text-[#5a8a6f]">🌟 You finished {totalRounds} rounds!</p>}
        {phase !== "done" && <div className="text-xs text-[#6b7280] mt-1">Round {round + 1} of {totalRounds}</div>}
      </div>

      <div className={`grid gap-3 ${padCount === 2 ? "grid-cols-2" : "grid-cols-2"} max-w-md mx-auto`} data-testid="simon-pads">
        {PADS.slice(0, padCount).map((p, i) => {
          const lit = flash === i;
          return (
            <button
              key={i}
              onClick={() => onPadTap(i)}
              disabled={phase !== "repeat"}
              className={`aspect-square rounded-3xl grid place-items-center text-5xl shadow border-4 transition-all ${lit ? "scale-105 border-white" : "border-transparent opacity-80"} ${phase !== "repeat" ? "cursor-default" : "cursor-pointer hover:opacity-100"}`}
              style={{ background: p.color, filter: lit ? "brightness(1.25)" : "brightness(1)" }}
              data-testid={`simon-pad-${i}`}
              aria-label={p.label}
            >
              <span style={{ filter: lit ? "none" : "grayscale(0.3)" }}>{p.emoji}</span>
            </button>
          );
        })}
      </div>

      {phase === "fail" && (
        <button onClick={() => startRound(round)} className="btn-secondary w-full justify-center" data-testid="simon-retry">Retry round</button>
      )}
      {phase === "done" && (
        <button onClick={advance} className="btn-primary w-full justify-center" data-testid="simon-next">Next level →</button>
      )}
    </div>
  );
}

function Empty() { return <div className="text-center text-[#6b7280] py-10">No Simon Says levels yet.</div>; }

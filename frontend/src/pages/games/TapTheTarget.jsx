import { useEffect, useMemo, useRef, useState } from "react";
import { useRotatingLevel, LevelHeader } from "./useLevels";

// Whack-a-mole: tap target emojis as they pop up. Avoid traps.
// data.levels[i] = { name, target: "🐢", trap: "🦈", duration_seconds: 20, pop_ms: 900, win_score: 10 }
export default function TapTheTarget({ data, onComplete }) {
  const levels = useMemo(() => data?.levels || [], [data]);
  const { level, idx, total, advance, setLevel, levels: L } = useRotatingLevel("tap_target", levels);
  const [phase, setPhase] = useState("ready"); // ready | play | done | fail
  const [score, setScore] = useState(0);
  const [time, setTime] = useState(0);
  const [holes, setHoles] = useState(Array(9).fill(null)); // each: {emoji, isTarget} or null
  const popTimer = useRef(null);
  const tickTimer = useRef(null);

  const duration = level?.duration_seconds || 20;
  const popMs = level?.pop_ms || 900;
  const winScore = level?.win_score || 10;

  useEffect(() => {
    stop();
    setPhase("ready"); setScore(0); setTime(0); setHoles(Array(9).fill(null));
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, idx]);

  function stop() {
    if (popTimer.current) clearInterval(popTimer.current);
    if (tickTimer.current) clearInterval(tickTimer.current);
  }

  function start() {
    if (!level) return;
    setPhase("play"); setScore(0); setTime(0); setHoles(Array(9).fill(null));
    popTimer.current = setInterval(() => {
      setHoles((prev) => {
        const next = [...prev];
        // Clear oldest first
        const filled = next.map((h, i) => ({ h, i })).filter((x) => x.h);
        if (filled.length >= 3) {
          next[filled[0].i] = null;
        }
        // Pop in an empty hole
        const empty = next.map((h, i) => ({ h, i })).filter((x) => !x.h);
        if (empty.length) {
          const spot = empty[Math.floor(Math.random() * empty.length)].i;
          const r = Math.random();
          const isTarget = r > 0.35; // ~65% targets
          next[spot] = { emoji: isTarget ? (level.target || "🐢") : (level.trap || "🦈"), isTarget };
          // Auto-disappear after a moment
          setTimeout(() => {
            setHoles((p) => {
              const np = [...p];
              if (np[spot] && np[spot] === next[spot]) np[spot] = null;
              return np;
            });
          }, popMs);
        }
        return next;
      });
    }, popMs / 1.5);
    tickTimer.current = setInterval(() => {
      setTime((t) => {
        const nt = t + 1;
        if (nt >= duration) {
          stop();
          setPhase("done");
          // Don't call onComplete unless score threshold met — handled in render
        }
        return nt;
      });
    }, 1000);
  }

  // When phase becomes done with score >= win → complete
  useEffect(() => {
    if (phase === "done" && score >= winScore) onComplete?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  if (!level) return <Empty />;

  const tap = (i) => {
    if (phase !== "play") return;
    const h = holes[i];
    if (!h) return;
    setHoles((p) => { const np = [...p]; np[i] = null; return np; });
    if (h.isTarget) setScore((s) => s + 1);
    else setScore((s) => Math.max(0, s - 1));
  };

  return (
    <div className="space-y-3" data-testid="game-tap-target">
      <LevelHeader idx={idx} total={total} levels={L} onPick={setLevel} onAdvance={advance} />
      <div className="flex justify-between text-xs text-[#6b7280]">
        <span>Goal: {winScore} {level.target} • Avoid {level.trap}</span>
        <span>Score: {score} • {Math.max(0, duration - time)}s</span>
      </div>

      {phase === "ready" && (
        <div className="bg-[#fff8ec] rounded-3xl p-6 text-center">
          <div className="text-6xl mb-2">{level.target}</div>
          <p className="text-sm text-[#5a6b76]">Tap every <span className="font-bold">{level.target}</span> that pops up — avoid the <span className="font-bold">{level.trap}</span>. You have {duration}s.</p>
          <button onClick={start} className="btn-primary mt-3" data-testid="tap-start">Start</button>
        </div>
      )}

      {(phase === "play" || phase === "done") && (
        <div className="bg-gradient-to-b from-[#dff3f3] to-[#7fcfc7] rounded-3xl border-2 border-[#7fcfc7] p-4">
          <div className="grid grid-cols-3 gap-3" data-testid="tap-grid">
            {holes.map((h, i) => (
              <button
                key={i}
                onClick={() => tap(i)}
                className="aspect-square rounded-full bg-[#3a4a55]/15 grid place-items-center text-5xl border-4 border-white/30 transition-transform active:scale-95"
                data-testid={`tap-hole-${i}`}
              >
                {h && <span className={h.isTarget ? "animate-bounce" : ""}>{h.emoji}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {phase === "done" && (
        <div className={`text-center rounded-3xl p-5 ${score >= winScore ? "bg-[#fff8ec]" : "bg-red-50"}`} data-testid="tap-result">
          <div className="text-5xl mb-2">{score >= winScore ? "🌟" : "🙃"}</div>
          <div className="font-accent text-2xl font-bold text-[#3a4a55]">
            {score >= winScore ? `Caught ${score}! Goal hit.` : `Caught ${score} — try for ${winScore}.`}
          </div>
          <div className="flex gap-2 justify-center mt-3">
            <button onClick={start} className="btn-secondary" data-testid="tap-retry">Play again</button>
            {score >= winScore && <button onClick={advance} className="btn-primary" data-testid="tap-next">Next level →</button>}
          </div>
        </div>
      )}
    </div>
  );
}

function Empty() { return <div className="text-center text-[#6b7280] py-10">No Tap-the-Target levels yet.</div>; }

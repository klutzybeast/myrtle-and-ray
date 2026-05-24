import { useEffect, useMemo, useState } from "react";
import { useRotatingLevel, LevelHeader } from "./useLevels";

// Read an analog clock and pick the matching time string.
// data.levels[i] = { name, rounds: [{ hour: 1-12, minute: 0|15|30|45, choices: ["1:00","3:00","6:30"], answer: "3:00" }] }
export default function TimeTeller({ data, onComplete }) {
  const levels = useMemo(() => data?.levels || [], [data]);
  const { level, idx, total, advance, setLevel, levels: L } = useRotatingLevel("time_teller", levels);
  const [r, setR] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [done, setDone] = useState(false);

  useEffect(() => { setR(0); setScore(0); setFeedback(null); setDone(false); }, [level, idx]);
  if (!level) return <Empty />;

  const rounds = level.rounds || [];
  const cur = rounds[r];

  const pick = (c) => {
    if (feedback || done) return;
    const correct = c === cur.answer;
    setFeedback({ correct, picked: c });
    if (correct) setScore((s) => s + 1);
    setTimeout(() => {
      if (r + 1 >= rounds.length) { setDone(true); onComplete?.(); }
      else { setR(r + 1); setFeedback(null); }
    }, 1400);
  };

  if (done) {
    return (
      <div className="space-y-3 text-center" data-testid="game-time-teller-done">
        <LevelHeader idx={idx} total={total} levels={L} onPick={setLevel} onAdvance={advance} />
        <div className="bg-[#fff8ec] rounded-3xl p-6">
          <div className="text-5xl mb-2">🌟</div>
          <div className="font-accent text-2xl font-bold text-[#5a8a6f]">Time keeper! {score} / {rounds.length}</div>
          <button onClick={advance} className="btn-primary mt-3" data-testid="time-next">Next level →</button>
        </div>
      </div>
    );
  }

  const hour = cur?.hour || 12;
  const minute = cur?.minute || 0;
  const hourAngle = ((hour % 12) + minute / 60) * 30; // 360/12
  const minuteAngle = minute * 6; // 360/60

  return (
    <div className="space-y-3" data-testid="game-time-teller">
      <LevelHeader idx={idx} total={total} levels={L} onPick={setLevel} onAdvance={advance} />
      <div className="flex justify-between text-xs text-[#6b7280]">
        <span>Clock {r + 1} / {rounds.length}</span><span>Score: {score}</span>
      </div>
      <div className="bg-gradient-to-b from-[#fff8ec] to-[#fde0b3] rounded-3xl border-2 border-[#f4d28a] p-5 grid place-items-center">
        <svg viewBox="-110 -110 220 220" className="w-56 h-56" data-testid="time-clock">
          <circle r="100" fill="#fffbf3" stroke="#5a8a6f" strokeWidth="6" />
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i + 1) * 30 * Math.PI / 180;
            const x = Math.sin(a) * 80;
            const y = -Math.cos(a) * 80;
            return <text key={i} x={x} y={y + 6} textAnchor="middle" fontSize="16" fontWeight="bold" fill="#3a4a55">{i + 1}</text>;
          })}
          {Array.from({ length: 12 }, (_, i) => {
            const a = i * 30 * Math.PI / 180;
            return <line key={`t${i}`} x1={Math.sin(a) * 92} y1={-Math.cos(a) * 92} x2={Math.sin(a) * 98} y2={-Math.cos(a) * 98} stroke="#3a4a55" strokeWidth="2" />;
          })}
          {/* Hour hand */}
          <line x1="0" y1="0"
            x2={Math.sin(hourAngle * Math.PI / 180) * 50}
            y2={-Math.cos(hourAngle * Math.PI / 180) * 50}
            stroke="#3a4a55" strokeWidth="6" strokeLinecap="round" />
          {/* Minute hand */}
          <line x1="0" y1="0"
            x2={Math.sin(minuteAngle * Math.PI / 180) * 75}
            y2={-Math.cos(minuteAngle * Math.PI / 180) * 75}
            stroke="#f0a988" strokeWidth="4" strokeLinecap="round" />
          <circle r="5" fill="#3a4a55" />
        </svg>
        <p className="text-sm text-[#5a6b76] mt-2">What time does the clock show?</p>
      </div>
      <div className="grid grid-cols-3 gap-2" data-testid="time-options">
        {(cur?.choices || []).map((c, i) => {
          const isAns = feedback && c === cur.answer;
          const isWrong = feedback && feedback.picked === c && !feedback.correct;
          return (
            <button
              key={i}
              onClick={() => pick(c)}
              disabled={!!feedback}
              className={`bg-white rounded-2xl border-2 py-3 font-accent text-lg font-bold transition-colors ${isAns ? "border-[#5a8a6f] bg-[#eaf7f5] text-[#5a8a6f]" : isWrong ? "border-red-400 bg-red-50 text-red-600" : "border-[#f4e4c6] text-[#3a4a55] hover:bg-[#fffbf3]"}`}
              data-testid={`time-option-${i}`}
            >{c}</button>
          );
        })}
      </div>
      {feedback && (
        <div className={`rounded-2xl p-3 text-center text-sm font-bold ${feedback.correct ? "bg-[#eaf7f5] text-[#5a8a6f]" : "bg-red-50 text-red-700"}`} data-testid="time-feedback">
          {feedback.correct ? `✅ Yes — it's ${cur.answer}!` : `❌ It was ${cur.answer}`}
        </div>
      )}
    </div>
  );
}

function Empty() { return <div className="text-center text-[#6b7280] py-10">No Time Teller levels yet.</div>; }

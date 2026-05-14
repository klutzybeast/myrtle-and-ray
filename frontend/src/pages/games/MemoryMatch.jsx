import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import { useRotatingLevel, LevelHeader } from "./useLevels";

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function MemoryMatch({ data, onComplete }) {
  // Back-compat: support old { difficulties: [6,10,13] } too
  const levels = useMemo(() => {
    if (Array.isArray(data?.levels) && data.levels.length) return data.levels;
    return (data?.difficulties || [6, 10, 13]).map((n) => ({ name: `${n} pairs`, pairs: n }));
  }, [data]);

  const { level, idx, total, advance, setLevel, levels: L } = useRotatingLevel("memory_match", levels);
  const pairs = Math.max(2, Math.min(parseInt(level?.pairs || 6, 10), 13));
  const [chars, setChars] = useState([]);
  const [deck, setDeck] = useState([]);
  const [flipped, setFlipped] = useState([]);
  const [matched, setMatched] = useState(new Set());
  const [moves, setMoves] = useState(0);
  const [won, setWon] = useState(false);
  const [reshuffleSeed, setReshuffleSeed] = useState(0);

  useEffect(() => { api.get("/characters").then(({ data }) => setChars(data)); }, []);

  useEffect(() => {
    if (!chars.length) return;
    const pool = shuffle(chars).slice(0, pairs);
    const cards = shuffle(pool.flatMap((c) => [
      { id: c.slug + "_a", slug: c.slug, name: c.name, image: c.image_url },
      { id: c.slug + "_b", slug: c.slug, name: c.name, image: c.image_url },
    ]));
    setDeck(cards);
    setFlipped([]); setMatched(new Set()); setMoves(0); setWon(false);
  }, [chars, pairs, reshuffleSeed]);

  const onFlip = (i) => {
    if (flipped.length === 2 || flipped.includes(i) || matched.has(deck[i].slug)) return;
    const next = [...flipped, i];
    setFlipped(next);
    if (next.length === 2) {
      setMoves((m) => m + 1);
      const [a, b] = next;
      if (deck[a].slug === deck[b].slug) {
        setTimeout(() => {
          setMatched((m) => {
            const out = new Set(m); out.add(deck[a].slug);
            if (out.size === pairs) { setWon(true); onComplete?.(); }
            return out;
          });
          setFlipped([]);
        }, 450);
      } else {
        setTimeout(() => setFlipped([]), 900);
      }
    }
  };

  const cols = pairs <= 6 ? 4 : pairs <= 10 ? 5 : 6;

  return (
    <div className="space-y-4" data-testid="game-memory-match">
      <LevelHeader idx={idx} total={total} levels={L} onPick={setLevel} onAdvance={advance} />
      <div className="text-sm text-[#4a5568] flex justify-between flex-wrap gap-2">
        <div><b>Moves:</b> {moves} &nbsp; <b>Found:</b> {matched.size}/{pairs}</div>
        <button onClick={() => setReshuffleSeed((s) => s + 1)} className="btn-ghost text-xs" data-testid="mm-reshuffle">Shuffle</button>
      </div>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols},minmax(0,1fr))` }}>
        {deck.map((c, i) => {
          const isOpen = flipped.includes(i) || matched.has(c.slug);
          return (
            <button key={i} onClick={() => onFlip(i)} className="aspect-square rounded-2xl overflow-hidden border-2 border-[#f4e4c6]"
              style={{ background: isOpen ? "white" : "linear-gradient(135deg,#a8e6e1,#fcd5b4)" }}
              data-testid={`mm-card-${i}`}>
              {isOpen ? <img src={c.image} alt={c.name} className="w-full h-full object-cover" /> : <div className="grid place-items-center h-full text-3xl">🌊</div>}
            </button>
          );
        })}
      </div>
      {won && (
        <div className="text-center bg-[#eef9fb] rounded-2xl p-4">
          <div className="font-accent text-2xl font-bold text-[#5a8a6f]">You found them all in {moves} moves!</div>
          {total > 1 && <button onClick={advance} className="btn-primary mt-3" data-testid="mm-next-level">Try next level →</button>}
        </div>
      )}
    </div>
  );
}

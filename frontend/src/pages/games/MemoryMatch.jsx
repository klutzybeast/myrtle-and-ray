import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function MemoryMatch({ data, onComplete }) {
  const [chars, setChars] = useState([]);
  const [difficulty, setDifficulty] = useState((data?.difficulties || [6, 10, 13])[0]);
  const [deck, setDeck] = useState([]);
  const [flipped, setFlipped] = useState([]);
  const [matched, setMatched] = useState(new Set());
  const [moves, setMoves] = useState(0);
  const [won, setWon] = useState(false);

  useEffect(() => {
    api.get("/characters").then(({ data }) => setChars(data));
  }, []);

  useEffect(() => {
    if (!chars.length) return;
    const pool = shuffle(chars).slice(0, difficulty);
    const cards = shuffle(pool.flatMap((c) => [
      { id: c.slug + "_a", slug: c.slug, name: c.name, image: c.image_url },
      { id: c.slug + "_b", slug: c.slug, name: c.name, image: c.image_url },
    ]));
    setDeck(cards);
    setFlipped([]); setMatched(new Set()); setMoves(0); setWon(false);
  }, [chars, difficulty]);

  const onFlip = (idx) => {
    if (flipped.length === 2 || flipped.includes(idx) || matched.has(deck[idx].slug)) return;
    const next = [...flipped, idx];
    setFlipped(next);
    if (next.length === 2) {
      setMoves((m) => m + 1);
      const [a, b] = next;
      if (deck[a].slug === deck[b].slug) {
        setTimeout(() => {
          setMatched((m) => {
            const out = new Set(m); out.add(deck[a].slug);
            if (out.size === difficulty) { setWon(true); onComplete?.(); }
            return out;
          });
          setFlipped([]);
        }, 450);
      } else {
        setTimeout(() => setFlipped([]), 900);
      }
    }
  };

  const cols = useMemo(() => {
    if (difficulty <= 6) return 4;
    if (difficulty <= 10) return 5;
    return 6;
  }, [difficulty]);

  return (
    <div className="space-y-4" data-testid="game-memory-match">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div className="text-sm text-[#4a5568]"><b>Moves:</b> {moves} &nbsp; <b>Found:</b> {matched.size}/{difficulty}</div>
        <div className="flex gap-1 flex-wrap">
          {(data?.difficulties || [6, 10, 13]).map((d) => (
            <button key={d} onClick={() => setDifficulty(d)} className={`text-xs px-3 py-1 rounded-full font-bold ${difficulty === d ? "bg-[#7fcfc7] text-white" : "bg-[#eef9fb] text-[#5a8a6f]"}`} data-testid={`mm-diff-${d}`}>{d} pairs</button>
          ))}
        </div>
      </div>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols},minmax(0,1fr))` }}>
        {deck.map((c, i) => {
          const isOpen = flipped.includes(i) || matched.has(c.slug);
          return (
            <button key={i} onClick={() => onFlip(i)} className="aspect-square rounded-2xl overflow-hidden border-2 border-[#f4e4c6] transition-transform"
              style={{ background: isOpen ? "white" : "linear-gradient(135deg,#a8e6e1,#fcd5b4)", transform: isOpen ? "rotateY(0deg)" : "rotateY(0deg)" }}
              data-testid={`mm-card-${i}`}>
              {isOpen ? (
                <img src={c.image} alt={c.name} className="w-full h-full object-cover" />
              ) : (
                <div className="grid place-items-center h-full text-3xl">🌊</div>
              )}
            </button>
          );
        })}
      </div>
      {won && (
        <div className="text-center bg-[#eef9fb] rounded-2xl p-4">
          <div className="font-accent text-2xl font-bold text-[#5a8a6f]">You found them all in {moves} moves!</div>
          <p className="text-sm text-[#4a5568]">Wave badge unlocked. Want to play again?</p>
        </div>
      )}
    </div>
  );
}

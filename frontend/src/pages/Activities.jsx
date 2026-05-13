import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { toast } from "sonner";
import { Puzzle, Search, Map as MapIcon, Award, Star, Palette, Music, Sticker } from "lucide-react";

const TILES = [
  { key: "memory_match", title: "Memory Match", icon: Puzzle, color: "#7fcfc7" },
  { key: "spot_difference", title: "Spot the Difference", icon: Search, color: "#f0a988" },
  { key: "coloring", title: "Coloring", icon: Palette, color: "#b8a3d9" },
  { key: "word_search", title: "Word Search", icon: Search, color: "#7cbf94" },
  { key: "quiz", title: "Which Sea Star Are You?", icon: Star, color: "#e89bab" },
  { key: "rhyme_time", title: "Rhyme Time", icon: Music, color: "#8fbfe0" },
  { key: "maze", title: "Maze with Billy", icon: MapIcon, color: "#f4d28a" },
  { key: "sticker_beach", title: "Sticker Beach", icon: Sticker, color: "#f0a988" },
];

export default function Activities() {
  const [active, setActive] = useState(null);

  return (
    <main className="pt-24 pb-12 bg-foam-grad min-h-screen" data-testid="activities-page">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <header className="text-center mb-10">
          <Award className="w-10 h-10 text-[#f0a988] mx-auto mb-3" />
          <h1 className="font-accent text-5xl md:text-6xl font-bold">Activities & Games</h1>
          <p className="text-[#4a5568] mt-2 max-w-2xl mx-auto">Eight little games to play with Myrtle, Ray, and the crew. Collect W.A.V.E. badges as you go!</p>
        </header>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {TILES.map((t) => (
            <button key={t.key} onClick={() => setActive(t)} className="card-soft p-6 text-left" data-testid={`activity-tile-${t.key}`}>
              <div className="w-12 h-12 rounded-2xl grid place-items-center mb-3" style={{ background: `${t.color}22` }}>
                <t.icon className="w-6 h-6" style={{ color: t.color }} strokeWidth={2.5} />
              </div>
              <div className="font-accent text-lg font-bold">{t.title}</div>
              <div className="text-xs text-[#6b7280] mt-1">Tap to play</div>
            </button>
          ))}
        </div>

        {active && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setActive(null)} data-testid="activity-modal">
            <div className="bg-white rounded-[28px] max-w-2xl w-full p-8 shadow-2xl text-center" onClick={(e) => e.stopPropagation()}>
              <h3 className="font-accent text-3xl font-bold mb-2">{active.title}</h3>
              <p className="text-[#4a5568]">This activity is being built right now. Bookmark this page — we are rolling out all 8 games soon.</p>
              <button onClick={() => { toast.success("Wave badge saved!"); const list = JSON.parse(localStorage.getItem("mr_badges") || "[]"); if (!list.includes(active.key)) { list.push(active.key); localStorage.setItem("mr_badges", JSON.stringify(list)); } setActive(null); }} className="btn-primary mt-5" data-testid="claim-badge">
                Claim a "Tried It" Wave Badge
              </button>
            </div>
          </div>
        )}

        <section className="mt-12 card-cream p-6 md:p-8">
          <h3 className="font-accent text-2xl font-bold">My Wave Badges</h3>
          <p className="text-[#4a5568] mt-1">Every activity you try earns a badge.</p>
          <Badges />
        </section>
      </div>
    </main>
  );
}

function Badges() {
  const [badges, setBadges] = useState([]);
  useEffect(() => { setBadges(JSON.parse(localStorage.getItem("mr_badges") || "[]")); }, []);
  if (!badges.length) return <div className="text-[#6b7280] mt-3">No badges yet — tap an activity above to start.</div>;
  return (
    <div className="flex flex-wrap gap-2 mt-3" data-testid="badges-list">
      {badges.map((b) => <span key={b} className="bg-white px-3 py-1 rounded-full text-sm font-bold border-2 border-[#f4e4c6]">🌟 {b.replace(/_/g, " ")}</span>)}
    </div>
  );
}

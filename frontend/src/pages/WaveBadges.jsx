import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Award, ArrowLeft, Puzzle, Search, Map as MapIcon, Star, Palette, Music, Sticker } from "lucide-react";

const BADGES = [
  { key: "memory_match", title: "Memory Master", subtitle: "Matched every pair", icon: Puzzle, color: "#7fcfc7" },
  { key: "spot_difference", title: "Sharp Eyes", subtitle: "Spotted every difference", icon: Search, color: "#f0a988" },
  { key: "coloring", title: "Color Champ", subtitle: "Filled a whole scene", icon: Palette, color: "#b8a3d9" },
  { key: "word_search", title: "Word Wizard", subtitle: "Found every word", icon: Search, color: "#7cbf94" },
  { key: "quiz", title: "Sea Star Self", subtitle: "Took the quiz", icon: Star, color: "#e89bab" },
  { key: "rhyme_time", title: "Rhyme Rider", subtitle: "Finished a rhyme pack", icon: Music, color: "#8fbfe0" },
  { key: "maze", title: "Maze Maker", subtitle: "Reached the shell", icon: MapIcon, color: "#f4d28a" },
  { key: "sticker_beach", title: "Beach Builder", subtitle: "Decorated the beach", icon: Sticker, color: "#f0a988" },
];

function readBadges() { try { return JSON.parse(localStorage.getItem("mr_badges") || "[]"); } catch { return []; } }

export default function WaveBadges() {
  const [badges, setBadges] = useState(readBadges());
  useEffect(() => {
    const onStorage = () => setBadges(readBadges());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  const earned = badges.length;
  const total = BADGES.length;
  const pct = Math.round((earned / total) * 100);
  const captain = earned === total;

  return (
    <main className="pt-24 pb-16 bg-foam-grad min-h-screen" data-testid="wave-badges-page">
      <div className="max-w-5xl mx-auto px-4 md:px-6">
        <Link to="/activities" className="inline-flex items-center gap-2 text-sm font-bold text-[#5a8a6f] hover:underline mb-3" data-testid="back-to-activities"><ArrowLeft className="w-4 h-4" />Back to Activities</Link>
        <header className="text-center mb-8">
          <Award className="w-10 h-10 text-[#f0a988] mx-auto mb-2" />
          <h1 className="font-accent text-5xl md:text-6xl font-bold">My Wave Badges</h1>
          <p className="text-[#4a5568] mt-2 max-w-2xl mx-auto">Finish each game to collect all 8 badges. Catch them all to become <b>Captain of the Cay</b>.</p>
        </header>

        <section className="card-soft p-6 mb-8" data-testid="badge-progress">
          <div className="flex items-end justify-between flex-wrap gap-2 mb-2">
            <div className="font-accent text-2xl font-bold">{earned} of {total} earned</div>
            <div className="text-sm text-[#5a6b76]">{pct}% complete</div>
          </div>
          <div className="h-4 rounded-full bg-[#eef9fb] overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: "linear-gradient(90deg,#a8e6e1 0%,#fcd5b4 100%)" }} />
          </div>
          {captain && (
            <div className="mt-4 text-center bg-gradient-to-r from-[#a8e6e1] to-[#fcd5b4] rounded-2xl px-4 py-3" data-testid="captain-banner">
              <div className="font-accent text-2xl font-bold text-[#3a4a55]">👑 Captain of the Cay</div>
              <p className="text-sm text-[#3a4a55]/80">All 8 badges collected. Catch the W.A.V.E.!</p>
            </div>
          )}
        </section>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {BADGES.map((b) => {
            const got = badges.includes(b.key);
            return (
              <div key={b.key} className={`card-soft p-5 relative ${got ? "" : "opacity-50 grayscale"}`} data-testid={`badge-tile-${b.key}`}>
                <div className="w-14 h-14 rounded-2xl grid place-items-center mb-3" style={{ background: got ? `${b.color}33` : "#e6e9ec" }}>
                  <b.icon className="w-7 h-7" style={{ color: got ? b.color : "#9aa3ab" }} strokeWidth={2.5} />
                </div>
                <div className="font-accent text-lg font-bold">{b.title}</div>
                <div className="text-xs text-[#6b7280] mt-1">{b.subtitle}</div>
                {got && <span className="absolute top-3 right-3 text-xl" title="Earned!">🌟</span>}
              </div>
            );
          })}
        </div>

        <div className="text-center mt-10">
          <Link to="/activities" className="btn-primary" data-testid="cta-play">Keep playing →</Link>
        </div>
      </div>
    </main>
  );
}

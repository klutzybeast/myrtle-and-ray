import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { toast } from "sonner";
import { useAudio } from "../lib/audio";
import { Puzzle, Search, Map as MapIcon, Award, Star, Palette, Music, Sticker, X } from "lucide-react";

import MemoryMatch from "./games/MemoryMatch";
import Quiz from "./games/Quiz";
import RhymeTime from "./games/RhymeTime";
import WordSearch from "./games/WordSearch";
import Maze from "./games/Maze";
import Coloring from "./games/Coloring";
import StickerBeach from "./games/StickerBeach";
import SpotDifference from "./games/SpotDifference";

const BADGE_LABELS = {
  memory_match: "Memory Master",
  spot_difference: "Sharp Eyes",
  coloring: "Color Champ",
  word_search: "Word Wizard",
  quiz: "Sea Star Self",
  rhyme_time: "Rhyme Rider",
  maze: "Maze Maker",
  sticker_beach: "Beach Builder",
};

const TILES = [
  { key: "memory_match", title: "Memory Match", subtitle: "Flip cards. Find pairs.", icon: Puzzle, color: "#7fcfc7", Comp: MemoryMatch },
  { key: "spot_difference", title: "Spot the Difference", subtitle: "Sharp-eyed Sea Stars only.", icon: Search, color: "#f0a988", Comp: SpotDifference },
  { key: "coloring", title: "Color the Cay", subtitle: "Paint a scene. Save it.", icon: Palette, color: "#b8a3d9", Comp: Coloring },
  { key: "word_search", title: "Word Search", subtitle: "Drag to find words.", icon: Search, color: "#7cbf94", Comp: WordSearch },
  { key: "quiz", title: "Which Sea Star Are You?", subtitle: "Answer a few questions.", icon: Star, color: "#e89bab", Comp: Quiz },
  { key: "rhyme_time", title: "Rhyme Time", subtitle: "Pick the word that rhymes.", icon: Music, color: "#8fbfe0", Comp: RhymeTime },
  { key: "maze", title: "Maze with Billy", subtitle: "Find the shell.", icon: MapIcon, color: "#f4d28a", Comp: Maze },
  { key: "sticker_beach", title: "Sticker Beach", subtitle: "Build a beach scene.", icon: Sticker, color: "#f0a988", Comp: StickerBeach },
];

function readBadges() {
  try { return JSON.parse(localStorage.getItem("mr_badges") || "[]"); } catch { return []; }
}
function writeBadge(key) {
  const list = readBadges();
  if (!list.includes(key)) {
    list.push(key);
    localStorage.setItem("mr_badges", JSON.stringify(list));
  }
}

export default function Activities() {
  const [active, setActive] = useState(null);
  const [activeData, setActiveData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [badges, setBadges] = useState(readBadges());
  const { pop } = useAudio();

  useEffect(() => {
    if (!active) { setActiveData(null); return; }
    setLoading(true);
    api.get(`/activities/${active.key}`)
      .then(({ data }) => setActiveData(data?.data || {}))
      .catch(() => setActiveData({}))
      .finally(() => setLoading(false));
  }, [active]);

  const onWin = (key) => {
    if (!badges.includes(key)) {
      writeBadge(key);
      setBadges(readBadges());
      toast.success(`Wave badge unlocked: ${BADGE_LABELS[key]}!`);
    }
  };

  return (
    <main className="pt-24 pb-12 bg-foam-grad min-h-screen" data-testid="activities-page">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <header className="text-center mb-10">
          <Award className="w-10 h-10 text-[#f0a988] mx-auto mb-3" />
          <h1 className="font-accent text-5xl md:text-6xl font-bold">Activities & Games</h1>
          <p className="text-[#4a5568] mt-2 max-w-2xl mx-auto">Eight little games to play with Myrtle, Ray, and the crew. Collect W.A.V.E. badges as you go!</p>
        </header>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {TILES.map((t) => {
            const earned = badges.includes(t.key);
            return (
              <button key={t.key} onClick={() => { pop(); setActive(t); }} className="card-soft p-5 text-left relative" data-testid={`activity-tile-${t.key}`}>
                <div className="w-12 h-12 rounded-2xl grid place-items-center mb-3" style={{ background: `${t.color}22` }}>
                  <t.icon className="w-6 h-6" style={{ color: t.color }} strokeWidth={2.5} />
                </div>
                <div className="font-accent text-lg font-bold">{t.title}</div>
                <div className="text-xs text-[#6b7280] mt-1">{t.subtitle}</div>
                {earned && <span className="absolute top-3 right-3 text-xl" title="Wave badge earned">🌟</span>}
              </button>
            );
          })}
        </div>

        {active && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-3 sm:p-6" onClick={() => setActive(null)} data-testid="activity-modal">
            <div className="bg-white rounded-[28px] max-w-4xl w-full max-h-[92vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <header className="sticky top-0 z-10 flex items-center justify-between p-4 sm:p-5 bg-white/95 backdrop-blur border-b border-[#f4e4c6]">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-2xl grid place-items-center shrink-0" style={{ background: `${active.color}22` }}>
                    <active.icon className="w-5 h-5" style={{ color: active.color }} strokeWidth={2.5} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-accent text-xl sm:text-2xl font-bold truncate">{active.title}</h3>
                    <div className="text-xs text-[#6b7280]">{active.subtitle}</div>
                  </div>
                </div>
                <button onClick={() => setActive(null)} className="p-2 -mr-2 rounded-full hover:bg-[#eef9fb]" aria-label="Close" data-testid="activity-close"><X className="w-5 h-5" /></button>
              </header>
              <div className="p-4 sm:p-6">
                {loading ? (
                  <div className="text-center text-[#5a6b76] py-10">Loading game…</div>
                ) : (
                  <active.Comp data={activeData || {}} onComplete={() => onWin(active.key)} />
                )}
              </div>
            </div>
          </div>
        )}

        <section className="mt-12 card-cream p-6 md:p-8" data-testid="badges-section">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <h3 className="font-accent text-2xl font-bold">My Wave Badges</h3>
              <p className="text-[#4a5568] mt-1">Every game you finish earns a badge. {badges.length}/{TILES.length} collected.</p>
            </div>
            <Link to="/wave-badges" className="btn-secondary text-sm" data-testid="see-all-badges">See all badges →</Link>
          </div>
          {badges.length === 0 ? (
            <div className="text-[#6b7280] mt-3">No badges yet — tap a game above to start.</div>
          ) : (
            <div className="flex flex-wrap gap-2 mt-3" data-testid="badges-list">
              {badges.map((b) => (
                <span key={b} className="bg-white px-3 py-1 rounded-full text-sm font-bold border-2 border-[#f4e4c6]" data-testid={`badge-${b}`}>🌟 {BADGE_LABELS[b] || b.replace(/_/g, " ")}</span>
              ))}
              {badges.length === TILES.length && (
                <span className="bg-gradient-to-r from-[#a8e6e1] to-[#fcd5b4] px-3 py-1 rounded-full text-sm font-bold border-2 border-white">👑 All 8 — Captain of the Cay!</span>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

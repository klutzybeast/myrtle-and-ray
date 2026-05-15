import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { HOTSPOTS, MAP_IMG } from "../lib/mapData";
import { Sparkles, MapPin } from "lucide-react";
import SEO from "../components/SEO";

export default function MapPage() {
  const [chars, setChars] = useState([]);
  const [hotspot, setHotspot] = useState(null);
  const nav = useNavigate();

  useEffect(() => { api.get("/characters").then(({ data }) => setChars(data)).catch(() => {}); }, []);

  const charBy = (slug) => chars.find((c) => c.slug === slug);
  const hotspotChar = hotspot ? charBy(hotspot.char) : null;

  const playActivity = (key) => {
    setHotspot(null);
    nav(`/activities?game=${key}`);
  };

  return (
    <main className="pt-24 pb-16 bg-foam-grad min-h-screen" data-testid="map-page">
      <SEO title="Map of Stingray Cay" description="Tour Stingray Cay — tap any glowing dot to meet a Sea Star and play their favorite game." />
      <div className="max-w-6xl mx-auto px-4 md:px-6">
        <header className="text-center mb-8">
          <MapPin className="w-10 h-10 text-[#7fcfc7] mx-auto mb-2" />
          <h1 className="font-accent text-5xl md:text-6xl font-bold">Map of Stingray Cay</h1>
          <p className="text-[#4a5568] mt-2 max-w-2xl mx-auto">Tap a glowing dot to meet the Sea Star who hangs out there — and play their favorite game.</p>
        </header>

        <div className="relative rounded-[28px] overflow-hidden shadow-2xl border-4 border-white" data-testid="cay-map">
          <img src={MAP_IMG} alt="Stingray Cay map" className="w-full h-auto block" />
          {HOTSPOTS.map((h) => (
            <button key={h.id} onClick={() => setHotspot(h)}
              className="absolute w-8 h-8 -ml-4 -mt-4 rounded-full bg-white/80 border-2 border-[#f0a988] shadow-md hover:scale-125 transition"
              style={{ left: `${h.x}%`, top: `${h.y}%` }} aria-label={h.title} data-testid={`map-hotspot-${h.id}`}>
              <span className="absolute inset-0 rounded-full animate-ping bg-[#f0a988]/50" />
            </button>
          ))}
        </div>

        <p className="text-center text-sm text-[#5a6b76] mt-6">{HOTSPOTS.length} spots on the map · each one unlocks a game.</p>

        {hotspot && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={() => setHotspot(null)} data-testid="map-modal">
            <div className="bg-white rounded-[24px] max-w-md w-full p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-3">
                {hotspotChar && (
                  <div className="gradient-ring shrink-0" style={{ width: 72, height: 72 }}>
                    <img src={hotspotChar.image_url} alt="" className="w-full h-full rounded-full object-contain bg-[#fffbf3]" />
                  </div>
                )}
                <div className="min-w-0">
                  <h3 className="font-accent text-2xl font-bold leading-tight">{hotspot.title}</h3>
                  {hotspotChar && <div className="text-sm text-[#7cbf94] font-bold">With {hotspotChar.name}</div>}
                </div>
              </div>
              <p className="text-[#4a5568] leading-relaxed">{hotspot.desc}</p>
              <div className="bg-[#eef9fb] rounded-2xl px-4 py-3 mt-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#f0a988] shrink-0" />
                <div className="text-sm text-[#3a4a55]">Play <b>{hotspot.activity_label}</b></div>
              </div>
              <div className="flex gap-2 mt-4 flex-wrap">
                <button onClick={() => playActivity(hotspot.activity)} className="btn-primary flex-1 justify-center" data-testid={`map-play-${hotspot.activity}`}>
                  Play game →
                </button>
                {hotspotChar && (
                  <Link to={`/story#${hotspotChar.slug}`} onClick={() => setHotspot(null)} className="btn-ghost text-sm">See bio</Link>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

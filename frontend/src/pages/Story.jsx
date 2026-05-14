import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAudio } from "../lib/audio";
import { Volume2, Palette, VolumeOff } from "lucide-react";

const HOTSPOTS = [
  { id: "welcome-sign", title: "Welcome Sign", x: 22, y: 78, char: "ms-bluegill", desc: "Ms Bluegill welcomes every camper here on the very first day." },
  { id: "arts-craft", title: "Arts & Crafts Hut", x: 44, y: 58, char: "ollie", desc: "Ollie's eight-armed sculpture lab. Bring your imagination." },
  { id: "lunch-tables", title: "Lunch Tables", x: 72, y: 55, char: "louie", desc: "Picnic tables under the striped tent — Louie's drum kit is right behind." },
  { id: "pool", title: "The Pool", x: 36, y: 36, char: "dani", desc: "Dani's high-dive home. Triple-flip splashes happen here." },
  { id: "playground", title: "Playground", x: 80, y: 30, char: "frankie", desc: "Frankie teaches ballet on the sand near the wooden castle." },
  { id: "soccer-field", title: "Sports Field", x: 78, y: 18, char: "sami", desc: "Sami cheers on every player on both teams." },
  { id: "climbing-palms", title: "Climbing Palms", x: 56, y: 22, char: "izzy", desc: "Izzy knows the secret paths up the tallest palms." },
  { id: "bunkhouses", title: "Bunkhouses", x: 16, y: 60, char: "myrtle", desc: "The colorful cottages where Sea Stars sleep. Myrtle's is the green one." },
  { id: "sand-castle", title: "Sand Castle Beach", x: 90, y: 60, char: "casey", desc: "Casey builds the tallest, sturdiest towers right here." },
];

export default function Story() {
  const [chars, setChars] = useState([]);
  const [flipped, setFlipped] = useState({});
  const [hotspot, setHotspot] = useState(null);
  const { playClip } = useAudio();

  useEffect(() => {
    api.get("/characters").then(({ data }) => setChars(data)).catch(() => {});
  }, []);

  const toggle = (slug) => setFlipped((f) => ({ ...f, [slug]: !f[slug] }));
  const hotspotChar = hotspot ? chars.find((c) => c.slug === hotspot.char) : null;

  return (
    <main className="pt-24 pb-12 bg-foam-grad min-h-screen" data-testid="story-page">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <header className="text-center mb-10">
          <h1 className="font-accent text-5xl md:text-6xl font-bold">Meet the Sea Stars of Stingray Cay</h1>
          <p className="text-[#4a5568] mt-3 max-w-2xl mx-auto">Tap any card to flip it and meet our crew. Each one has a wave to ride and a way to be brave.</p>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 mb-20">
          {chars.map((c) => (
            <div key={c.slug} id={c.slug} className="relative pt-14" data-testid={`character-card-${c.slug}`}>
              <div className="absolute left-1/2 -translate-x-1/2 -top-4 z-10 gradient-ring animate-bob" style={{ width: 132, height: 132 }}>
                <img src={c.image_url} alt={c.name} className="w-full h-full rounded-full object-cover bg-white" />
              </div>
              <div className="card-soft p-6 pt-20 text-center min-h-[320px]">
                <h3 className="font-accent text-2xl font-bold">{c.name}</h3>
                <p className="text-xs uppercase tracking-widest text-[#7cbf94] font-bold mt-1">{c.role}</p>
                {!flipped[c.slug] ? (
                  <>
                    <p className="text-[#4a5568] mt-3 leading-relaxed">{c.bio}</p>
                    <button onClick={() => toggle(c.slug)} className="mt-4 btn-ghost text-sm" data-testid={`flip-${c.slug}`}>More about me →</button>
                  </>
                ) : (
                  <div className="text-left mt-3 space-y-2 text-[#4a5568]">
                    <p><b className="text-[#5a8a6f]">Species:</b> {c.species}</p>
                    <p><b className="text-[#5a8a6f]">W.A.V.E. value:</b> {waveLabel(c.wave_value)}</p>
                    <p><b className="text-[#5a8a6f]">Fun fact:</b> {c.fun_fact}</p>
                    <button onClick={() => toggle(c.slug)} className="btn-ghost text-sm" data-testid={`flip-back-${c.slug}`}>← Back</button>
                  </div>
                )}
                <div className="mt-5 flex flex-wrap gap-2 justify-center">
                  {c.audio_url ? (
                    <button onClick={() => playClip(c.audio_url)} className="btn-ghost text-xs" data-testid={`voice-${c.slug}`}><Volume2 className="w-4 h-4" />Hear my voice</button>
                  ) : (
                    <button disabled title="Coming soon — admin can upload an audio clip" className="btn-ghost text-xs opacity-50 cursor-not-allowed"><VolumeOff className="w-4 h-4" />Hear my voice</button>
                  )}
                  <Link to={`/downloads/color-${c.slug}`} className="btn-ghost text-xs"><Palette className="w-4 h-4" />Color me</Link>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Map */}
        <header className="text-center mb-6">
          <h2 className="font-accent text-4xl md:text-5xl font-bold">Map of Stingray Cay</h2>
          <p className="text-[#4a5568] mt-2">Tap a glowing spot to peek inside.</p>
        </header>
        <div className="relative rounded-[28px] overflow-hidden shadow-2xl border-4 border-white" data-testid="cay-map">
          <img src="https://customer-assets.emergentagent.com/job_wave-of-excitement/artifacts/np2lq4do_IMG_2972.jpeg" alt="Stingray Cay map" className="w-full h-auto block" />
          {HOTSPOTS.map((h) => (
            <button key={h.id} onClick={() => setHotspot(h)} className="absolute w-7 h-7 -ml-3.5 -mt-3.5 rounded-full bg-white/80 border-2 border-[#f0a988] shadow-md hover:scale-125 transition" style={{ left: `${h.x}%`, top: `${h.y}%` }} aria-label={h.title} data-testid={`map-hotspot-${h.id}`}>
              <span className="absolute inset-0 rounded-full animate-ping bg-[#f0a988]/50" />
            </button>
          ))}
        </div>

        {hotspot && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setHotspot(null)} data-testid="map-modal">
            <div className="bg-white rounded-[24px] max-w-md w-full p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-3">
                {hotspotChar && <div className="gradient-ring" style={{ width: 64, height: 64 }}><img src={hotspotChar.image_url} alt="" className="w-full h-full rounded-full object-cover bg-white" /></div>}
                <div>
                  <h3 className="font-accent text-2xl font-bold">{hotspot.title}</h3>
                  {hotspotChar && <div className="text-sm text-[#7cbf94]">With {hotspotChar.name}</div>}
                </div>
              </div>
              <p className="text-[#4a5568] leading-relaxed">{hotspot.desc}</p>
              {hotspotChar && <Link to={`/story#${hotspotChar.slug}`} onClick={() => setHotspot(null)} className="btn-primary mt-4 inline-flex">See bio →</Link>}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function waveLabel(l) {
  const m = { W: "W — Welcome Curiosity", A: "A — Act with Kindness", V: "V — Value Teamwork", E: "E — Encourage Others" };
  return m[l] || l;
}

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useSite } from "../lib/site";
import CharacterPortrait from "../components/CharacterPortrait";
import ProductCard from "../components/ProductCard";
import DownloadCard from "../components/DownloadCard";
import WaveDivider from "../components/WaveDivider";
import { BookOpen, Heart, Users, Sparkles, ArrowRight } from "lucide-react";
import { toast } from "sonner";

const HERO_IMG = "https://customer-assets.emergentagent.com/job_wave-of-excitement/artifacts/np2lq4do_IMG_2972.jpeg";

export default function Home() {
  const site = useSite();
  const [chars, setChars] = useState([]);
  const [waveCards, setWaveCards] = useState([]);
  const [products, setProducts] = useState([]);
  const [downloads, setDownloads] = useState([]);
  const [hero, setHero] = useState({});
  const [banner, setBanner] = useState({ quote: "", author: "" });
  const [bottleEmail, setBottleEmail] = useState("");
  const [flippedIdx, setFlippedIdx] = useState(null);

  useEffect(() => {
    api.get("/characters").then(({ data }) => setChars(data)).catch(() => {});
    api.get("/pages/wave_values").then(({ data }) => setWaveCards(data.content?.cards || [])).catch(() => {});
    api.get("/pages/homepage_hero").then(({ data }) => setHero(data.content || {})).catch(() => {});
    api.get("/pages/sand_banner").then(({ data }) => setBanner(data.content || {})).catch(() => {});
    api.get("/products?featured=true&sort=featured").then(({ data }) => setProducts(data.slice(0, 8))).catch(() => {});
    api.get("/downloads?sort=newest").then(({ data }) => setDownloads(data.slice(0, 4))).catch(() => {});
  }, []);

  const submitBottle = async (e) => {
    e.preventDefault();
    try { await api.post("/mailing-list", { email: bottleEmail, source: "homepage" }); toast.success("Bottled and sent!"); setBottleEmail(""); }
    catch { toast.error("Try again in a moment."); }
  };

  return (
    <main className="pt-16">
      {/* HERO */}
      <section className="relative bg-wave-hero overflow-hidden" data-testid="hero-section">
        <div className="absolute inset-0">
          <img src={hero.background_image || HERO_IMG} alt="Stingray Cay Summer Camp" className="w-full h-full object-cover opacity-95" />
          <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-white/0 to-[#fff9f0]" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 md:px-6 pt-12 pb-24 md:pb-32 grid md:grid-cols-2 gap-10 items-center">
          <div className="text-center md:text-left">
            <span className="inline-block bg-white/80 backdrop-blur px-4 py-1 rounded-full font-accent font-semibold text-[#3cb371] text-sm mb-4">A rhyming picture book · Ages 3–8</span>
            <h1 className="font-accent text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.05] text-[#2e3a3a] drop-shadow-sm" data-testid="hero-headline">
              {hero.headline || "Welcome to Stingray Cay"}
            </h1>
            <p className="mt-4 text-lg md:text-xl text-[#2e3a3a]/90 max-w-xl">
              {hero.subheadline || "Catch the W.A.V.E. of Excitement with Myrtle, Ray, and every Sea Star at camp."}
            </p>
            <div className="mt-7 flex flex-wrap gap-3 justify-center md:justify-start">
              <a href={site.amazon_book_url || "#"} target="_blank" rel="noopener noreferrer" className="btn-primary text-lg" data-testid="hero-amazon-cta">
                <BookOpen className="w-5 h-5" /> {hero.cta_primary || "Buy the Book on Amazon"}
              </a>
              <Link to="/story" className="btn-secondary text-lg" data-testid="hero-meet-cta">
                <Users className="w-5 h-5" /> {hero.cta_secondary || "Meet the Sea Stars"}
              </Link>
            </div>
          </div>
          <div className="relative h-72 md:h-[420px]">
            <div className="absolute right-2 md:right-10 top-4 animate-bob">
              <div className="w-56 md:w-72 aspect-[3/4] rounded-3xl overflow-hidden shadow-[0_30px_60px_rgba(46,58,58,0.35)] rotate-[3deg] border-8 border-white">
                <img src={hero.book_cover || HERO_IMG} alt="Book cover" className="w-full h-full object-cover" />
              </div>
            </div>
          </div>
        </div>
        <WaveDivider color="#fff9f0" />
      </section>

      {/* MEET THE SEA STARS */}
      <section className="bg-[#fff9f0] py-16 md:py-24" data-testid="sea-stars-band">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="text-center mb-10">
            <h2 className="font-accent text-4xl md:text-5xl font-bold">Meet the Sea Stars</h2>
            <p className="text-[#4a5568] mt-2">Tap a portrait to read their bio.</p>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-13 gap-6 justify-items-center">
            {chars.map((c) => (
              <CharacterPortrait key={c.slug} slug={c.slug} name={c.name.split(" ")[0]} image={c.image_url} size={88} />
            ))}
          </div>
        </div>
      </section>

      {/* CATCH THE W.A.V.E. */}
      <section className="bg-foam-grad py-16 md:py-24" data-testid="wave-section">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="text-center mb-10">
            <h2 className="font-accent text-4xl md:text-5xl font-bold">Catch the W.A.V.E.</h2>
            <p className="text-[#4a5568] mt-2">Four little ideas for big-hearted Sea Stars. Tap a card.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {waveCards.map((w, i) => (
              <button
                key={w.letter}
                onClick={() => setFlippedIdx(flippedIdx === i ? null : i)}
                className="relative card-soft p-6 text-left h-48 overflow-hidden"
                style={{ background: flippedIdx === i ? "white" : w.color }}
                data-testid={`wave-card-${w.letter}`}
              >
                {flippedIdx === i ? (
                  <div>
                    <div className="font-accent text-3xl font-bold mb-2" style={{ color: w.color }}>{w.letter}</div>
                    <div className="text-[#2e3a3a] leading-snug">{w.description}</div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col justify-end text-white">
                    <div className="font-accent text-7xl font-bold leading-none drop-shadow">{w.letter}</div>
                    <div className="font-accent text-xl font-bold mt-2">{w.title}</div>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* SHOP THE CREW */}
      <section className="bg-[#fff9f0] py-16 md:py-24" data-testid="shop-the-crew">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="flex items-end justify-between mb-8 flex-wrap gap-3">
            <div>
              <h2 className="font-accent text-4xl md:text-5xl font-bold">Shop the Crew</h2>
              <p className="text-[#4a5568] mt-2">Take a Sea Star home with you.</p>
            </div>
            <Link to="/shop" className="btn-secondary">All Stuffies <ArrowRight className="w-4 h-4" /></Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {products.map((p) => <ProductCard key={p.slug} p={p} />)}
          </div>
        </div>
      </section>

      {/* FREE DOWNLOADS */}
      <section className="bg-sand-texture py-16 md:py-24" data-testid="downloads-band">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="flex items-end justify-between mb-8 flex-wrap gap-3">
            <div>
              <h2 className="font-accent text-4xl md:text-5xl font-bold">Free Downloads for Parents and Teachers</h2>
              <p className="text-[#4a5568] mt-2">Coloring pages, classroom kits, and more — all free.</p>
            </div>
            <Link to="/downloads" className="btn-secondary">Browse All <ArrowRight className="w-4 h-4" /></Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {downloads.map((d) => <DownloadCard key={d.slug} d={d} />)}
          </div>
        </div>
      </section>

      {/* TESTIMONIAL */}
      <section className="bg-[#fde6c8] py-16 md:py-20 text-center px-4" data-testid="sand-banner">
        <Sparkles className="w-8 h-8 text-[#ff9b71] mx-auto mb-3" />
        <blockquote className="max-w-3xl mx-auto font-accent text-2xl md:text-3xl font-semibold text-[#2e3a3a] leading-snug">
          “{banner.quote || "Our campers cheer Catch the W.A.V.E. all summer. It became our shared language for kindness."}”
        </blockquote>
        <div className="mt-4 text-[#6b7280]">— {banner.author || "A Rolling River Camp parent"}</div>
      </section>

      {/* MESSAGE IN A BOTTLE */}
      <section className="bg-[#fff9f0] py-16 md:py-24" data-testid="bottle-signup">
        <div className="max-w-2xl mx-auto px-4 md:px-6 text-center">
          <div className="text-6xl mb-3">📜</div>
          <h2 className="font-accent text-3xl md:text-4xl font-bold">Send Us a Message in a Bottle</h2>
          <p className="text-[#4a5568] mt-2">Join the mailing list for new downloads, sneak peeks, and gentle first-day tips.</p>
          <form onSubmit={submitBottle} className="mt-6 flex gap-2 max-w-lg mx-auto" data-testid="bottle-form">
            <input required type="email" value={bottleEmail} onChange={(e) => setBottleEmail(e.target.value)} placeholder="your@email.com"
              className="flex-1 px-4 py-3 rounded-full border-2 border-[#fde6c8] bg-white focus:outline-none focus:border-[#40e0d0]" data-testid="bottle-email" />
            <button className="btn-primary" data-testid="bottle-submit">Send</button>
          </form>
        </div>
      </section>
    </main>
  );
}

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
import SEO from "../components/SEO";
import JsonLd from "../components/JsonLd";

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
      <SEO title="Welcome to Stingray Cay" description={hero.subheadline || ""} image={hero.background_image || HERO_IMG} />
      <JsonLd data={[
        {
          "@context": "https://schema.org",
          "@type": "Organization",
          "name": site.site_name || "Myrtle and Ray",
          "url": typeof window !== "undefined" ? window.location.origin : "",
          "logo": site.logo_url || hero.background_image || HERO_IMG,
          "sameAs": [site.facebook_url, site.instagram_url, site.tiktok_url, site.youtube_url, site.pinterest_url, site.twitter_url].filter(Boolean),
        },
        {
          "@context": "https://schema.org",
          "@type": "WebSite",
          "name": site.site_name || "Myrtle and Ray",
          "url": typeof window !== "undefined" ? window.location.origin : "",
          "potentialAction": {
            "@type": "SearchAction",
            "target": `${typeof window !== "undefined" ? window.location.origin : ""}/shop?q={search_term_string}`,
            "query-input": "required name=search_term_string",
          },
        },
        {
          "@context": "https://schema.org",
          "@type": "Book",
          "name": "Myrtle and Ray and the First Day of Camp",
          "author": [
            { "@type": "Person", "name": "Marissa Allaben" },
            { "@type": "Person", "name": "Alison Rothenberg" },
          ],
          "publisher": { "@type": "Organization", "name": "KingApe Media" },
          "audience": { "@type": "Audience", "suggestedMinAge": 3, "suggestedMaxAge": 8 },
          "image": hero.background_image || HERO_IMG,
          "url": site.amazon_book_url || undefined,
          "inLanguage": "en",
        },
      ]} />
      {/* HERO */}
      <section className="relative bg-wave-hero overflow-hidden" data-testid="hero-section">
        <div className="absolute inset-0">
          <img src={hero.background_image || HERO_IMG} alt="Stingray Cay Summer Camp" className="w-full h-full object-cover" />
          {/* Darker scrim so the headline is always readable */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#1e2a35]/55 via-[#1e2a35]/30 to-[#fffbf3]" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 md:px-6 pt-20 pb-28 md:pt-28 md:pb-36 flex items-center justify-center">
          <div className="w-full max-w-3xl mx-auto text-center bg-white/35 backdrop-blur-md rounded-[32px] px-6 py-8 md:px-10 md:py-10 border border-white/60 shadow-[0_20px_60px_rgba(30,42,53,0.25)]">
            {site.logo_url && (
              <img
                src={site.logo_url}
                alt={site.site_name || "Myrtle and Ray"}
                className="mx-auto mb-5 w-20 h-20 md:w-24 md:h-24 object-contain rounded-3xl bg-white/70 p-2 shadow-md"
                data-testid="hero-logo"
              />
            )}
            <span className="inline-block bg-white/90 px-4 py-1 rounded-full font-accent font-semibold text-[#5a8a6f] text-sm mb-4" data-testid="hero-wave-tag">Catch the W.A.V.E. of Excitement</span>
            <h1 className="font-accent text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.05] text-[#1e2a35] whitespace-pre-line" data-testid="hero-headline">
              {hero.headline || "Welcome\nto\nStingray Cay"}
            </h1>
            <p className="mt-4 text-base md:text-lg text-[#2e3a3a] max-w-xl mx-auto">
              {hero.subheadline || "Catch the W.A.V.E. of Excitement with Myrtle, Ray, and every Sea Star at camp."}
            </p>
            <div className="mt-7 flex flex-wrap gap-3 justify-center">
              <a href={site.amazon_book_url || "#"} target="_blank" rel="noopener noreferrer" className="btn-primary text-base md:text-lg" data-testid="hero-amazon-cta">
                <BookOpen className="w-5 h-5" /> {hero.cta_primary || "Buy the Book on Amazon"}
              </a>
              <Link to="/story" className="btn-secondary text-base md:text-lg" data-testid="hero-meet-cta">
                <Users className="w-5 h-5" /> {hero.cta_secondary || "Meet the Sea Stars"}
              </Link>
            </div>
          </div>
        </div>
        <WaveDivider color="#fffbf3" />
      </section>

      {/* MEET THE SEA STARS */}
      <section className="bg-[#fffbf3] py-16 md:py-24" data-testid="sea-stars-band">
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
      <section className="bg-[#fffbf3] py-16 md:py-24" data-testid="shop-the-crew">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="flex items-end justify-between mb-8 flex-wrap gap-3">
            <div>
              <h2 className="font-accent text-4xl md:text-5xl font-bold">Shop the Crew</h2>
              <p className="text-[#4a5568] mt-2">Take a Sea Star home with you.</p>
            </div>
            <Link to="/shop" className="btn-secondary">Shop the Store <ArrowRight className="w-4 h-4" /></Link>
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
      <section className="bg-[#f4e4c6] py-16 md:py-20 text-center px-4" data-testid="sand-banner">
        <Sparkles className="w-8 h-8 text-[#f0a988] mx-auto mb-3" />
        <blockquote className="max-w-3xl mx-auto font-accent text-2xl md:text-3xl font-semibold text-[#2e3a3a] leading-snug">
          “{banner.quote || "Our campers cheer Catch the W.A.V.E. all summer. It became our shared language for kindness."}”
        </blockquote>
        <div className="mt-4 text-[#6b7280]">— {banner.author || "A Rolling River Camp parent"}</div>
      </section>

      {/* MESSAGE IN A BOTTLE */}
      <section className="bg-[#fffbf3] py-16 md:py-24" data-testid="bottle-signup">
        <div className="max-w-2xl mx-auto px-4 md:px-6 text-center">
          <div className="text-6xl mb-3">📜</div>
          <h2 className="font-accent text-3xl md:text-4xl font-bold">Send Us a Message in a Bottle</h2>
          <p className="text-[#4a5568] mt-2">Join the mailing list for new downloads, sneak peeks, and gentle first-day tips.</p>
          <form onSubmit={submitBottle} className="mt-6 flex gap-2 max-w-lg mx-auto" data-testid="bottle-form">
            <input required type="email" value={bottleEmail} onChange={(e) => setBottleEmail(e.target.value)} placeholder="your@email.com"
              className="flex-1 px-4 py-3 rounded-full border-2 border-[#f4e4c6] bg-white focus:outline-none focus:border-[#7fcfc7]" data-testid="bottle-email" />
            <button className="btn-primary" data-testid="bottle-submit">Send</button>
          </form>
        </div>
      </section>
    </main>
  );
}

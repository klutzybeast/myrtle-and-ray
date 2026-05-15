import { useEffect, useState } from "react";
import { api } from "../lib/api";
import DownloadCard from "../components/DownloadCard";
import SEO from "../components/SEO";

const AUDIENCES = ["All", "Parents", "Teachers", "Camp Directors", "Kids"];
const WAVE = [{ v: "W", l: "Welcome" }, { v: "A", l: "Act" }, { v: "V", l: "Value" }, { v: "E", l: "Encourage" }];
const SORTS = [
  { v: "newest", l: "Newest" },
  { v: "most_downloaded", l: "Most Downloaded" },
  { v: "alphabetical", l: "A → Z" },
];

export default function Downloads() {
  const [cats, setCats] = useState([]);
  const [chars, setChars] = useState([]);
  const [items, setItems] = useState([]);
  const [featured, setFeatured] = useState([]);
  const [category, setCategory] = useState("All");
  const [audience, setAudience] = useState("All");
  const [wave, setWave] = useState("");
  const [character, setCharacter] = useState("");
  const [sort, setSort] = useState("newest");
  const [q, setQ] = useState("");

  useEffect(() => {
    api.get("/download-categories").then(({ data }) => setCats(data));
    api.get("/characters").then(({ data }) => setChars(data));
    api.get("/downloads?featured=true").then(({ data }) => setFeatured(data));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (category !== "All") params.set("category", category);
    if (audience !== "All") params.set("audience", audience);
    if (wave) params.set("wave", wave);
    if (character) params.set("character", character);
    if (sort) params.set("sort", sort);
    if (q) params.set("q", q);
    api.get(`/downloads?${params.toString()}`).then(({ data }) => setItems(data));
  }, [category, audience, wave, character, sort, q]);

  return (
    <main className="pt-24 pb-12 bg-foam-grad min-h-screen" data-testid="downloads-page">
      <SEO title="Free Printable Downloads" description="Free coloring pages, activity sheets, and W.A.V.E. resources for parents, teachers, and camp directors." />
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <header className="text-center mb-10">
          <h1 className="font-accent text-5xl md:text-6xl font-bold">Free Activities and Resources</h1>
          <p className="text-[#4a5568] mt-2 max-w-2xl mx-auto">Coloring pages, parent guides, classroom kits, and W.A.V.E. lessons. Free to print, free to share.</p>
        </header>

        {featured.length > 0 && (
          <section className="mb-10" data-testid="featured-downloads">
            <h2 className="font-accent text-2xl font-bold mb-4">Featured</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {featured.map((d) => <DownloadCard key={d.slug} d={d} characterImage={chars.find((c) => c.slug === d.character_slug)?.image_url} />)}
            </div>
          </section>
        )}

        <div className="flex flex-wrap gap-2 mb-4" data-testid="download-category-chips">
          <button onClick={() => setCategory("All")} className={`px-4 py-2 rounded-full font-bold text-sm transition ${category === "All" ? "bg-[#7fcfc7] text-white" : "bg-white text-[#4a5568]"}`}>All</button>
          {cats.map((c) => (
            <button key={c.slug} onClick={() => setCategory(c.slug)} className={`px-4 py-2 rounded-full font-bold text-sm transition ${category === c.slug ? "text-white" : "bg-white text-[#4a5568]"}`} style={category === c.slug ? { background: c.color } : {}} data-testid={`download-cat-${c.slug}`}>
              {c.name}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-3 mb-8 items-center" data-testid="download-filters">
          <select value={audience} onChange={(e) => setAudience(e.target.value)} className="px-3 py-2 rounded-full bg-white border-2 border-[#f4e4c6] text-sm font-semibold" data-testid="downloads-audience-filter">
            {AUDIENCES.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={character} onChange={(e) => setCharacter(e.target.value)} className="px-3 py-2 rounded-full bg-white border-2 border-[#f4e4c6] text-sm font-semibold">
            <option value="">All Sea Stars</option>
            {chars.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>
          <div className="flex gap-1">
            {WAVE.map((w) => (
              <button key={w.v} onClick={() => setWave(wave === w.v ? "" : w.v)} className={`px-3 py-2 rounded-full text-sm font-bold ${wave === w.v ? "bg-[#f0a988] text-white" : "bg-white text-[#4a5568]"}`} data-testid={`wave-filter-${w.v}`}>{w.v} · {w.l}</button>
            ))}
          </div>
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="px-3 py-2 rounded-full bg-white border-2 border-[#f4e4c6] text-sm font-semibold">
            {SORTS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
          </select>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="px-4 py-2 rounded-full bg-white border-2 border-[#f4e4c6] text-sm" data-testid="downloads-search" />
        </div>

        {items.length === 0 ? (
          <div className="text-center text-[#6b7280] py-16">No downloads match.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5" data-testid="downloads-grid">
            {items.map((d) => <DownloadCard key={d.slug} d={d} characterImage={chars.find((c) => c.slug === d.character_slug)?.image_url} />)}
          </div>
        )}
      </div>
    </main>
  );
}

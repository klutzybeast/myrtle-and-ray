import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import DownloadCard from "../components/DownloadCard";
import SEO from "../components/SEO";
import { ArrowLeft, FileText, Search } from "lucide-react";

const AUDIENCES = ["All", "Parents", "Teachers", "Camp Directors", "Kids"];
const WAVE = [{ v: "W", l: "Welcome" }, { v: "A", l: "Act" }, { v: "V", l: "Value" }, { v: "E", l: "Encourage" }];
const SORTS = [
  { v: "newest", l: "Newest" },
  { v: "most_downloaded", l: "Most Downloaded" },
  { v: "alphabetical", l: "A → Z" },
];

export default function Downloads() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeCat = searchParams.get("cat") || "";

  const [cats, setCats] = useState([]);
  const [chars, setChars] = useState([]);
  const [items, setItems] = useState([]);
  const [allItems, setAllItems] = useState([]); // for category counts
  const [featured, setFeatured] = useState([]);
  const [audience, setAudience] = useState("All");
  const [wave, setWave] = useState("");
  const [character, setCharacter] = useState("");
  const [sort, setSort] = useState("newest");
  const [q, setQ] = useState("");

  useEffect(() => {
    api.get("/download-categories").then(({ data }) => setCats(data));
    api.get("/characters").then(({ data }) => setChars(data));
    api.get("/downloads?featured=true").then(({ data }) => setFeatured(data));
    api.get("/downloads").then(({ data }) => setAllItems(data));
  }, []);

  useEffect(() => {
    if (!activeCat) { setItems([]); return; }
    const params = new URLSearchParams();
    params.set("category", activeCat);
    if (audience !== "All") params.set("audience", audience);
    if (wave) params.set("wave", wave);
    if (character) params.set("character", character);
    if (sort) params.set("sort", sort);
    if (q) params.set("q", q);
    api.get(`/downloads?${params.toString()}`).then(({ data }) => setItems(data));
  }, [activeCat, audience, wave, character, sort, q]);

  // Reset filters when leaving a category
  useEffect(() => {
    if (!activeCat) {
      setAudience("All"); setWave(""); setCharacter(""); setSort("newest"); setQ("");
    }
  }, [activeCat]);

  const setCat = (slug) => {
    if (slug) setSearchParams({ cat: slug });
    else setSearchParams({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Compute count + cover per category from the master list
  const enrichedCats = useMemo(() => {
    return cats.map((c) => {
      const inCat = allItems.filter((d) => (d.category_slugs || []).includes(c.slug));
      const cover = c.cover_image || inCat.find((d) => d.cover_image)?.cover_image || "";
      return { ...c, count: inCat.length, cover };
    });
  }, [cats, allItems]);

  const activeCatObj = cats.find((c) => c.slug === activeCat);

  return (
    <main className="pt-24 pb-12 bg-foam-grad min-h-screen" data-testid="downloads-page">
      <SEO title="Free Printable Downloads" description="Free coloring pages, activity sheets, and W.A.V.E. resources for parents, teachers, and camp directors." />
      <div className="max-w-7xl mx-auto px-4 md:px-6">

        {/* Hub view — category cards */}
        {!activeCat && (
          <>
            <header className="text-center mb-10">
              <h1 className="font-accent text-5xl md:text-6xl font-bold">Free Activities and Resources</h1>
              <p className="text-[#4a5568] mt-2 max-w-2xl mx-auto">Coloring pages, parent guides, classroom kits, and W.A.V.E. lessons. Free to print, free to share.</p>
            </header>

            {featured.length > 0 && (
              <section className="mb-12" data-testid="featured-downloads">
                <h2 className="font-accent text-2xl font-bold mb-4">Featured</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {featured.slice(0, 6).map((d) => <DownloadCard key={d.slug} d={d} characterImage={chars.find((c) => c.slug === d.character_slug)?.image_url} />)}
                </div>
              </section>
            )}

            <section data-testid="download-category-hub">
              <h2 className="font-accent text-2xl font-bold mb-4">Browse by Category</h2>
              {enrichedCats.length === 0 ? (
                <div className="text-center text-[#6b7280] py-10">Loading categories…</div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5" data-testid="downloads-category-grid">
                  {enrichedCats.map((c) => (
                    <button
                      key={c.slug}
                      onClick={() => setCat(c.slug)}
                      className="group relative overflow-hidden rounded-[28px] bg-white text-left shadow-sm border-2 border-transparent hover:border-[#7fcfc7] hover:-translate-y-1 transition focus:outline-none focus:border-[#7fcfc7]"
                      data-testid={`download-cat-card-${c.slug}`}
                    >
                      <div
                        className="aspect-[5/4] flex items-center justify-center overflow-hidden"
                        style={{ background: `linear-gradient(135deg, ${c.color || "#7fcfc7"}33 0%, ${c.color || "#f0a988"}66 100%)` }}
                      >
                        {c.cover ? (
                          <img src={c.cover} alt={c.name} className="w-full h-full object-cover group-hover:scale-105 transition" />
                        ) : (
                          <div className="w-20 h-20 rounded-3xl bg-white/80 grid place-items-center shadow-md">
                            <FileText className="w-10 h-10" style={{ color: c.color || "#7fcfc7" }} strokeWidth={1.5} />
                          </div>
                        )}
                      </div>
                      <div className="p-4">
                        <div className="font-accent text-xl font-bold text-[#3a4a55] leading-tight">{c.name}</div>
                        <div className="text-xs text-[#6b7280] mt-1">
                          {c.count} {c.count === 1 ? "printable" : "printables"}
                        </div>
                      </div>
                      <span
                        className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wider text-white px-2 py-0.5 rounded-full"
                        style={{ background: c.color || "#7fcfc7" }}
                      >
                        {c.count}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {/* Drilled-in category view */}
        {activeCat && (
          <>
            <header className="mb-6">
              <button onClick={() => setCat("")} className="inline-flex items-center gap-1 text-[#5a8a6f] font-semibold hover:underline mb-3" data-testid="downloads-back-to-cats">
                <ArrowLeft className="w-4 h-4" /> Back to categories
              </button>
              <h1 className="font-accent text-4xl md:text-5xl font-bold" style={{ color: activeCatObj?.color || "#3a4a55" }}>{activeCatObj?.name || "Downloads"}</h1>
              {activeCatObj?.description && <p className="text-[#4a5568] mt-1 max-w-2xl">{activeCatObj.description}</p>}
              <p className="text-sm text-[#6b7280] mt-2">{items.length} {items.length === 1 ? "printable" : "printables"}</p>
            </header>

            <div className="flex flex-wrap gap-2 mb-6" data-testid="download-filters">
              <select value={audience} onChange={(e) => setAudience(e.target.value)} className="px-3 py-2 rounded-full bg-white border-2 border-[#f4e4c6] text-sm font-semibold" data-testid="downloads-audience-filter">
                {AUDIENCES.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
              <select value={character} onChange={(e) => setCharacter(e.target.value)} className="px-3 py-2 rounded-full bg-white border-2 border-[#f4e4c6] text-sm font-semibold">
                <option value="">All Sea Stars</option>
                {chars.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
              </select>
              <div className="flex gap-1 flex-wrap">
                {WAVE.map((w) => (
                  <button key={w.v} onClick={() => setWave(wave === w.v ? "" : w.v)} className={`px-3 py-2 rounded-full text-sm font-bold ${wave === w.v ? "bg-[#f0a988] text-white" : "bg-white text-[#4a5568]"}`} data-testid={`wave-filter-${w.v}`}>{w.v} · {w.l}</button>
                ))}
              </div>
              <select value={sort} onChange={(e) => setSort(e.target.value)} className="px-3 py-2 rounded-full bg-white border-2 border-[#f4e4c6] text-sm font-semibold">
                {SORTS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
              </select>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#7f8b94]" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="pl-9 pr-4 py-2 rounded-full bg-white border-2 border-[#f4e4c6] text-sm" data-testid="downloads-search" />
              </div>
            </div>

            {items.length === 0 ? (
              <div className="bg-white rounded-3xl p-10 text-center text-[#6b7280]" data-testid="downloads-empty">
                <FileText className="w-10 h-10 mx-auto text-[#7fcfc7] mb-2" />
                No printables match your filters yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5" data-testid="downloads-grid">
                {items.map((d) => <DownloadCard key={d.slug} d={d} characterImage={chars.find((c) => c.slug === d.character_slug)?.image_url} />)}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

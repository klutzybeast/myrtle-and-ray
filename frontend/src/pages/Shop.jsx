import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import ProductCard from "../components/ProductCard";
import EtsyCard from "../components/EtsyCard";
import SEO from "../components/SEO";
import { ShoppingBag, ChevronLeft } from "lucide-react";

const SORTS = [
  { v: "featured", l: "Featured" },
  { v: "price_asc", l: "Price: Low → High" },
  { v: "price_desc", l: "Price: High → Low" },
  { v: "newest", l: "Newest" },
];

export default function Shop() {
  const [searchParams, setSearchParams] = useSearchParams();
  // URL-driven so the back button and shareable links work.
  const activeCat = searchParams.get("category") || "";
  const setCat = (slug) => {
    const next = new URLSearchParams(searchParams);
    if (slug) next.set("category", slug); else next.delete("category");
    setSearchParams(next, { replace: false });
  };

  const [character, setCharacter] = useState("");
  const [sort, setSort] = useState("featured");
  const [characters, setCharacters] = useState([]);
  const [categories, setCategories] = useState([]);
  const [allProducts, setAllProducts] = useState([]); // master list for counts
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [etsyListings, setEtsyListings] = useState([]);

  // Capture ?code=XYZ on /shop landing so it auto-applies at checkout.
  useEffect(() => {
    const code = (searchParams.get("code") || "").trim();
    if (code) {
      try { sessionStorage.setItem("mr_discount_code", code.toUpperCase()); } catch {}
    }
  }, [searchParams]);

  useEffect(() => { api.get("/characters").then(({ data }) => setCharacters(data)); }, []);
  useEffect(() => { api.get("/shop-categories").then(({ data }) => setCategories(data || [])).catch(() => setCategories([])); }, []);
  // Master product list for category counts + covers.
  useEffect(() => { api.get("/products").then(({ data }) => setAllProducts(data || [])).catch(() => setAllProducts([])); }, []);

  // Filtered fetch (only when a category is active or filters change)
  useEffect(() => {
    const params = new URLSearchParams();
    if (activeCat) params.set("category", activeCat);
    if (character) params.set("character", character);
    if (sort) params.set("sort", sort);
    api.get(`/products?${params.toString()}`).then(({ data }) => setFilteredProducts(data)).catch(() => setFilteredProducts([]));
  }, [activeCat, character, sort]);

  // Etsy listings — direct from your Etsy shop via OAuth-authorized API.
  useEffect(() => {
    api.get("/etsy/listings").then(({ data }) => setEtsyListings(data || [])).catch(() => setEtsyListings([]));
  }, []);

  const sortedEtsy = useMemo(() => {
    const list = activeCat
      ? etsyListings.filter((l) => (l.category || "").toLowerCase() === activeCat.toLowerCase())
      : etsyListings;
    return [...list].sort((a, b) => {
      if (sort === "price_asc") return a.price - b.price;
      if (sort === "price_desc") return b.price - a.price;
      return 0;
    });
  }, [etsyListings, sort, activeCat]);

  // Compute count + cover per category from the master list (case-insensitive match
  // by category-slug OR by historical name match for legacy products).
  const enrichedCats = useMemo(() => {
    return categories.map((c) => {
      const inCat = allProducts.filter((p) => {
        const cat = (p.category || "").toString();
        return cat.toLowerCase() === c.slug.toLowerCase() || cat.toLowerCase() === (c.name || "").toLowerCase();
      });
      return {
        ...c,
        count: inCat.length,
        cover: c.thumbnail_url || (inCat[0]?.primary_image || inCat[0]?.images?.[0] || ""),
      };
    });
  }, [categories, allProducts]);

  const activeCategory = useMemo(() => categories.find((c) => c.slug === activeCat), [categories, activeCat]);
  const totalCount = filteredProducts.length + sortedEtsy.length;

  return (
    <main className="pt-24 pb-12 bg-[#fffbf3] min-h-screen" data-testid="shop-page">
      <SEO title="Shop the Store" description="Stuffies, apparel, books, and accessories from Stingray Cay. Every item ships from our Printify partner." />
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <header className="text-center mb-8">
          <h1 className="font-accent text-5xl md:text-6xl font-bold">Take the Sea Stars Home With You</h1>
          <p className="text-[#4a5568] mt-2 max-w-2xl mx-auto">Plush stuffies, apparel, sticker packs, and more — inspired by the crew at Stingray Cay.</p>
        </header>

        {/* HUB VIEW — category cards */}
        {!activeCat && (
          <>
            {enrichedCats.length > 0 && (
              <section data-testid="shop-category-hub">
                <h2 className="font-accent text-2xl font-bold mb-4">Browse by Category</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5" data-testid="shop-category-grid">
                  {enrichedCats.map((c) => (
                    <button
                      key={c.slug}
                      onClick={() => setCat(c.slug)}
                      className="group relative overflow-hidden rounded-[28px] bg-white text-left shadow-sm border-2 border-transparent hover:border-[#7fcfc7] hover:-translate-y-1 transition focus:outline-none focus:border-[#7fcfc7]"
                      data-testid={`shop-cat-card-${c.slug}`}
                    >
                      <div
                        className="aspect-[5/4] flex items-center justify-center overflow-hidden"
                        style={{ background: `linear-gradient(135deg, ${c.color || "#f0a988"}33 0%, ${c.color || "#7fcfc7"}66 100%)` }}
                      >
                        {c.cover ? (
                          <img src={c.cover} alt={c.name} className="w-full h-full object-cover group-hover:scale-105 transition" />
                        ) : (
                          <div className="w-20 h-20 rounded-3xl bg-white/80 grid place-items-center shadow-md">
                            <ShoppingBag className="w-10 h-10" style={{ color: c.color || "#f0a988" }} strokeWidth={1.5} />
                          </div>
                        )}
                      </div>
                      <div className="p-4">
                        <div className="font-accent text-xl font-bold text-[#3a4a55] leading-tight">{c.name}</div>
                        {c.description && <div className="text-xs text-[#6b7280] mt-1 line-clamp-2">{c.description}</div>}
                        <div className="text-xs text-[#6b7280] mt-1">
                          {c.count} {c.count === 1 ? "item" : "items"}
                        </div>
                      </div>
                      <span
                        className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wider text-white px-2 py-0.5 rounded-full"
                        style={{ background: c.color || "#f0a988" }}
                      >
                        {c.count}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Etsy & all products combined when no category selected */}
            {sortedEtsy.length > 0 && (
              <section className="mt-10" data-testid="shop-etsy-section">
                <h2 className="font-accent text-2xl font-bold text-[#2e3a3a] mb-3">Straight from our Etsy shop</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5" data-testid="etsy-grid">
                  {sortedEtsy.slice(0, 8).map((p) => <EtsyCard key={p.listing_id} p={p} />)}
                </div>
              </section>
            )}
          </>
        )}

        {/* DRILLED-IN VIEW — products in this category */}
        {activeCat && (
          <>
            <header className="mb-6">
              <button onClick={() => setCat("")} className="inline-flex items-center gap-1 text-[#5a8a6f] font-semibold hover:underline mb-3" data-testid="shop-back-to-cats">
                <ChevronLeft className="w-4 h-4" /> All categories
              </button>
              <div className="flex items-end justify-between flex-wrap gap-3">
                <div>
                  <h2 className="font-accent text-3xl font-bold text-[#2e3a3a]">{activeCategory?.name || activeCat}</h2>
                  {activeCategory?.description && <p className="text-sm text-[#6b7280] mt-1">{activeCategory.description}</p>}
                </div>
                <div className="flex gap-3 flex-wrap" data-testid="shop-filters">
                  <select value={character} onChange={(e) => setCharacter(e.target.value)} className="px-4 py-2 rounded-full bg-white border-2 border-[#f4e4c6] text-sm font-semibold" data-testid="shop-character-filter">
                    <option value="">All Sea Stars</option>
                    {characters.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                  </select>
                  <select value={sort} onChange={(e) => setSort(e.target.value)} className="px-4 py-2 rounded-full bg-white border-2 border-[#f4e4c6] text-sm font-semibold" data-testid="shop-sort">
                    {SORTS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
                  </select>
                </div>
              </div>
            </header>

            {sortedEtsy.length > 0 && (
              <section className="mb-10" data-testid="shop-etsy-section">
                <h3 className="font-accent text-2xl font-bold text-[#2e3a3a] mb-3">Straight from our Etsy shop</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5" data-testid="etsy-grid">
                  {sortedEtsy.map((p) => <EtsyCard key={p.listing_id} p={p} />)}
                </div>
              </section>
            )}

            {filteredProducts.length > 0 && (
              <section data-testid="shop-curated-section">
                {sortedEtsy.length > 0 && (
                  <h3 className="font-accent text-2xl font-bold text-[#2e3a3a] mb-3">More from the cove</h3>
                )}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5" data-testid="shop-grid">
                  {filteredProducts.map((p) => <ProductCard key={p.slug} p={p} />)}
                </div>
              </section>
            )}

            {totalCount === 0 && (
              <div className="text-center text-[#6b7280] py-20" data-testid="shop-empty">
                Nothing in this category yet — check back soon.
              </div>
            )}
          </>
        )}

        {/* When no categories configured at all AND no active cat, fall back to a flat list. */}
        {!activeCat && enrichedCats.length === 0 && (
          <section className="mt-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5" data-testid="shop-grid">
              {allProducts.map((p) => <ProductCard key={p.slug} p={p} />)}
            </div>
            {allProducts.length === 0 && (
              <div className="text-center text-[#6b7280] py-20">No products yet — add some in admin.</div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

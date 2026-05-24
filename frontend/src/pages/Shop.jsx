import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import ProductCard from "../components/ProductCard";
import PrintifyCard from "../components/PrintifyCard";
import EtsyCard from "../components/EtsyCard";
import SEO from "../components/SEO";

const CATS = ["All", "Stuffies", "Apparel", "Drinkware", "Stickers", "Bundles", "Books", "Accessories"];
const SORTS = [
  { v: "featured", l: "Featured" },
  { v: "price_asc", l: "Price: Low → High" },
  { v: "price_desc", l: "Price: High → Low" },
  { v: "newest", l: "Newest" },
];

export default function Shop() {
  const [cat, setCat] = useState("All");
  const [character, setCharacter] = useState("");
  const [sort, setSort] = useState("featured");
  const [characters, setCharacters] = useState([]);
  const [products, setProducts] = useState([]);
  const [printifyProducts, setPrintifyProducts] = useState([]);
  const [etsyListings, setEtsyListings] = useState([]);
  const [searchParams] = useSearchParams();

  // Capture ?code=XYZ on /shop landing so it auto-applies at checkout.
  useEffect(() => {
    const code = (searchParams.get("code") || "").trim();
    if (code) {
      try { sessionStorage.setItem("mr_discount_code", code.toUpperCase()); } catch {}
    }
  }, [searchParams]);

  useEffect(() => { api.get("/characters").then(({ data }) => setCharacters(data)); }, []);
  useEffect(() => {
    const params = new URLSearchParams();
    if (cat !== "All") params.set("category", cat);
    if (character) params.set("character", character);
    if (sort) params.set("sort", sort);
    api.get(`/products?${params.toString()}`).then(({ data }) => setProducts(data)).catch(() => setProducts([]));
  }, [cat, character, sort]);

  // Printify products are pulled once — they are filtered client-side below.
  useEffect(() => {
    api.get("/printify/products").then(({ data }) => setPrintifyProducts(data || [])).catch(() => setPrintifyProducts([]));
  }, []);

  // Etsy listings — direct from your Etsy shop via OAuth-authorized API.
  useEffect(() => {
    api.get("/etsy/listings").then(({ data }) => setEtsyListings(data || [])).catch(() => setEtsyListings([]));
  }, []);

  // For Printify products we only respect the active tag filter (category)
  // when a tag with that name exists on the product — otherwise show all.
  const filteredPrintify = printifyProducts.filter((p) => {
    if (cat === "All") return true;
    const tags = (p.tags || []).map((t) => String(t).toLowerCase());
    return tags.includes(cat.toLowerCase());
  }).sort((a, b) => {
    if (sort === "price_asc") return a.min_price - b.min_price;
    if (sort === "price_desc") return b.min_price - a.min_price;
    // Featured first by default
    return (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
  });

  const sortedEtsy = [...etsyListings].sort((a, b) => {
    if (sort === "price_asc") return a.price - b.price;
    if (sort === "price_desc") return b.price - a.price;
    return 0;
  });

  const totalCount = products.length + filteredPrintify.length + sortedEtsy.length;

  return (
    <main className="pt-24 pb-12 bg-[#fffbf3] min-h-screen" data-testid="shop-page">
      <SEO title="Shop the Store" description="Stuffies, apparel, books, and accessories from Stingray Cay. Every item ships from our Printify partner." />
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <header className="text-center mb-8">
          <h1 className="font-accent text-5xl md:text-6xl font-bold">Take the Sea Stars Home With You</h1>
          <p className="text-[#4a5568] mt-2 max-w-2xl mx-auto">Plush stuffies, apparel, sticker packs, and more — inspired by the crew at Stingray Cay.</p>
        </header>
        <div className="flex flex-wrap gap-2 mb-4" data-testid="shop-category-chips">
          {CATS.map((c) => (
            <button key={c} onClick={() => setCat(c)} className={`px-4 py-2 rounded-full font-bold text-sm transition ${cat === c ? "bg-[#7fcfc7] text-white" : "bg-white text-[#4a5568] hover:bg-[#eef9fb]"}`} data-testid={`shop-cat-${c.toLowerCase()}`}>
              {c}
            </button>
          ))}
        </div>
        <div className="flex gap-3 mb-8 flex-wrap" data-testid="shop-filters">
          <select value={character} onChange={(e) => setCharacter(e.target.value)} className="px-4 py-2 rounded-full bg-white border-2 border-[#f4e4c6] text-sm font-semibold" data-testid="shop-character-filter">
            <option value="">All Sea Stars</option>
            {characters.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="px-4 py-2 rounded-full bg-white border-2 border-[#f4e4c6] text-sm font-semibold" data-testid="shop-sort">
            {SORTS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
          </select>
        </div>

        {sortedEtsy.length > 0 && (
          <section className="mb-10" data-testid="shop-etsy-section">
            <h2 className="font-accent text-2xl font-bold text-[#2e3a3a] mb-3">Straight from our Etsy shop</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5" data-testid="etsy-grid">
              {sortedEtsy.map((p) => <EtsyCard key={p.listing_id} p={p} />)}
            </div>
          </section>
        )}

        {filteredPrintify.length > 0 && (
          <section className="mb-10" data-testid="shop-printify-section">
            <h2 className="font-accent text-2xl font-bold text-[#2e3a3a] mb-3">Fresh from the Printify shop</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5" data-testid="printify-grid">
              {filteredPrintify.map((p) => <PrintifyCard key={p.id} p={p} />)}
            </div>
          </section>
        )}

        {products.length > 0 && (
          <section data-testid="shop-curated-section">
            {(filteredPrintify.length > 0 || sortedEtsy.length > 0) && (
              <h2 className="font-accent text-2xl font-bold text-[#2e3a3a] mb-3">More from the cove</h2>
            )}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5" data-testid="shop-grid">
              {products.map((p) => <ProductCard key={p.slug} p={p} />)}
            </div>
          </section>
        )}

        {totalCount === 0 && (
          <div className="text-center text-[#6b7280] py-20">No products match. Try a different filter.</div>
        )}
      </div>
    </main>
  );
}

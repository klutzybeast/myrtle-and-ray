import { useEffect, useState, useMemo } from "react";
import { api } from "../lib/api";
import ProductCard from "../components/ProductCard";

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

  useEffect(() => { api.get("/characters").then(({ data }) => setCharacters(data)); }, []);
  useEffect(() => {
    const params = new URLSearchParams();
    if (cat !== "All") params.set("category", cat);
    if (character) params.set("character", character);
    if (sort) params.set("sort", sort);
    api.get(`/products?${params.toString()}`).then(({ data }) => setProducts(data));
  }, [cat, character, sort]);

  return (
    <main className="pt-24 pb-12 bg-[#fff9f0] min-h-screen" data-testid="shop-page">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <header className="text-center mb-8">
          <h1 className="font-accent text-5xl md:text-6xl font-bold">Take the Sea Stars Home With You</h1>
          <p className="text-[#4a5568] mt-2 max-w-2xl mx-auto">Plush stuffies, apparel, sticker packs, and more — inspired by the crew at Stingray Cay.</p>
        </header>
        <div className="flex flex-wrap gap-2 mb-4" data-testid="shop-category-chips">
          {CATS.map((c) => (
            <button key={c} onClick={() => setCat(c)} className={`px-4 py-2 rounded-full font-bold text-sm transition ${cat === c ? "bg-[#40e0d0] text-white" : "bg-white text-[#4a5568] hover:bg-[#e0f7fa]"}`} data-testid={`shop-cat-${c.toLowerCase()}`}>
              {c}
            </button>
          ))}
        </div>
        <div className="flex gap-3 mb-8 flex-wrap" data-testid="shop-filters">
          <select value={character} onChange={(e) => setCharacter(e.target.value)} className="px-4 py-2 rounded-full bg-white border-2 border-[#fde6c8] text-sm font-semibold" data-testid="shop-character-filter">
            <option value="">All Sea Stars</option>
            {characters.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="px-4 py-2 rounded-full bg-white border-2 border-[#fde6c8] text-sm font-semibold" data-testid="shop-sort">
            {SORTS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
          </select>
        </div>
        {products.length === 0 ? (
          <div className="text-center text-[#6b7280] py-20">No products match. Try a different filter.</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5" data-testid="shop-grid">
            {products.map((p) => <ProductCard key={p.slug} p={p} />)}
          </div>
        )}
      </div>
    </main>
  );
}

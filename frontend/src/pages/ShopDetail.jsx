import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";
import ProductCard from "../components/ProductCard";
import { ChevronRight, ShoppingBag, Heart, Share2 } from "lucide-react";
import { toast } from "sonner";

export default function ShopDetail() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [activeImage, setActiveImage] = useState(0);
  const [qty, setQty] = useState(1);
  const [variantIdx, setVariantIdx] = useState(0);

  useEffect(() => {
    setData(null);
    setActiveImage(0);
    api.get(`/products/${slug}`).then(({ data }) => setData(data)).catch(() => setData("notfound"));
  }, [slug]);

  if (!data) return <main className="pt-24 text-center text-[#6b7280]">Loading...</main>;
  if (data === "notfound") return <main className="pt-24 text-center">Product not found.</main>;

  const p = data.product;
  const variant = (p.variants || [])[variantIdx];
  const buyUrl = variant?.printify_url || p.printify_url;
  const showCompare = p.compare_at_price && p.compare_at_price > p.price;
  const images = (p.images || []).length ? p.images : (p.primary_image ? [p.primary_image] : []);

  return (
    <main className="pt-24 pb-12 bg-[#fffbf3] min-h-screen" data-testid="product-detail-page">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <nav className="text-sm text-[#6b7280] mb-4 flex items-center gap-1 flex-wrap" data-testid="breadcrumb">
          <Link to="/">Home</Link><ChevronRight className="w-4 h-4" />
          <Link to="/shop">Shop</Link><ChevronRight className="w-4 h-4" />
          <span>{p.category}</span><ChevronRight className="w-4 h-4" />
          <span className="text-[#2e3a3a] font-semibold">{p.name}</span>
        </nav>

        <div className="grid lg:grid-cols-2 gap-10">
          <div>
            <div className="aspect-square bg-[#eef9fb] rounded-[28px] overflow-hidden mb-3 p-4">
              {images[activeImage] && <img src={images[activeImage]} alt={p.name} className="w-full h-full object-contain" />}
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto no-scrollbar">
                {images.map((img, i) => (
                  <button key={i} onClick={() => setActiveImage(i)} className={`flex-shrink-0 w-20 h-20 rounded-2xl overflow-hidden border-2 bg-[#eef9fb] p-1 ${activeImage === i ? "border-[#7fcfc7]" : "border-transparent"}`} data-testid={`thumb-${i}`}>
                    <img src={img} alt="" className="w-full h-full object-contain" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <h1 className="font-accent text-4xl md:text-5xl font-bold leading-tight" data-testid="product-name">{p.name}</h1>
            {p.character_slug && (
              <Link to={`/story#${p.character_slug}`} className="inline-block mt-2 text-sm text-[#7cbf94] font-semibold" data-testid="product-character-chip">
                Inspired by {p.character_slug.replace(/-/g, " ").replace(/\b\w/g, (m) => m.toUpperCase())} →
              </Link>
            )}
            <div className="mt-3 flex items-baseline gap-3">
              {showCompare && <span className="text-[#6b7280] line-through text-xl">${p.compare_at_price.toFixed(2)}</span>}
              <span className="font-accent text-4xl font-bold text-[#5a8a6f]">${(p.price || 0).toFixed(2)}</span>
              {p.inventory_status && p.inventory_status !== "In Stock" && (
                <span className="text-xs uppercase tracking-wider font-bold bg-[#fff5ec] text-[#e89bab] px-3 py-1 rounded-full">{p.inventory_status}</span>
              )}
            </div>
            <p className="mt-4 text-[#4a5568] text-lg leading-relaxed">{p.short_description}</p>

            {(p.variants || []).length > 0 && (
              <div className="mt-4">
                <label className="text-sm font-bold text-[#2e3a3a]">Variant</label>
                <select value={variantIdx} onChange={(e) => setVariantIdx(parseInt(e.target.value, 10))} className="block mt-1 px-4 py-3 rounded-full border-2 border-[#f4e4c6] bg-white font-semibold" data-testid="variant-select">
                  {p.variants.map((v, i) => <option key={i} value={i}>{v.label || v.sku || `Option ${i + 1}`}</option>)}
                </select>
              </div>
            )}

            <div className="mt-4 flex items-center gap-3">
              <label className="text-sm font-bold">Qty</label>
              <input type="number" min="1" value={qty} onChange={(e) => setQty(parseInt(e.target.value || "1", 10))} className="w-20 px-3 py-2 rounded-full border-2 border-[#f4e4c6] text-center" data-testid="product-qty" />
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <a href={buyUrl || "#"} target="_blank" rel="noopener noreferrer" className="btn-primary text-lg" data-testid="buy-now-btn">
                <ShoppingBag className="w-5 h-5" /> Buy Now
              </a>
              <button onClick={() => {
                const list = JSON.parse(localStorage.getItem("mr_wishlist") || "[]");
                if (!list.includes(p.slug)) { list.push(p.slug); localStorage.setItem("mr_wishlist", JSON.stringify(list)); toast.success("Added to wishlist"); }
                else toast("Already on your wishlist");
              }} className="btn-secondary" data-testid="wishlist-btn"><Heart className="w-5 h-5" />Save</button>
              <button onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success("Link copied"); }} className="btn-ghost" data-testid="share-btn"><Share2 className="w-5 h-5" />Share</button>
            </div>

            <div className="mt-8 prose max-w-none">
              <h3 className="font-accent text-2xl font-bold">Details</h3>
              <p className="text-[#4a5568] mt-2 leading-relaxed whitespace-pre-line">{p.long_description}</p>
            </div>
          </div>
        </div>

        {data.related?.length > 0 && (
          <section className="mt-16">
            <h2 className="font-accent text-3xl font-bold mb-6">You might also love</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {data.related.map((r) => <ProductCard key={r.slug} p={r} />)}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

import { Link } from "react-router-dom";

export default function ProductCard({ p }) {
  const img = p.primary_image || (p.images && p.images[0]) || "";
  const showCompare = p.compare_at_price && p.compare_at_price > p.price;
  return (
    <Link to={`/shop/${p.slug}`} className="card-soft block overflow-hidden" data-testid={`product-card-${p.slug}`}>
      <div className="aspect-square bg-[#e0f7fa] overflow-hidden">
        {img ? <img src={img} alt={p.name} loading="lazy" className="w-full h-full object-cover" /> : <div className="w-full h-full grid place-items-center text-[#87ceeb] font-accent text-2xl">{p.name}</div>}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-accent text-lg font-bold leading-tight text-[#2e3a3a]" data-testid={`product-name-${p.slug}`}>{p.name}</h3>
          {p.inventory_status && p.inventory_status !== "In Stock" && (
            <span className="text-[10px] uppercase tracking-wider font-bold bg-[#fff5f0] text-[#ff6f91] px-2 py-1 rounded-full">{p.inventory_status}</span>
          )}
        </div>
        <p className="text-sm text-[#4a5568] mt-1 line-clamp-2">{p.short_description}</p>
        <div className="mt-3 flex items-end justify-between">
          <div>
            {showCompare && <span className="text-[#6b7280] line-through mr-2 text-sm">${p.compare_at_price.toFixed(2)}</span>}
            <span className="font-accent text-xl font-bold text-[#2e8b57]" data-testid={`product-price-${p.slug}`}>${(p.price || 0).toFixed(2)}</span>
          </div>
          <span className="btn-ghost text-sm">View →</span>
        </div>
      </div>
    </Link>
  );
}

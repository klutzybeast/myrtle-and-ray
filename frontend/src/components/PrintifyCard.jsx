import { Star, ExternalLink } from "lucide-react";

// Card for a Printify product fetched from /api/printify/products.
// External link card (no internal /shop/:slug route — buy_url goes to
// Etsy or the Printify pop-up store).
export default function PrintifyCard({ p }) {
  const img = p.image_url || (p.images && p.images[0]) || "";
  const price = p.min_price || 0;
  const showRange = p.max_price && p.max_price > p.min_price;
  return (
    <a
      href={p.buy_url}
      target="_blank"
      rel="noopener noreferrer"
      className="card-soft block overflow-hidden relative group"
      data-testid={`printify-card-${p.id}`}
    >
      {p.featured && (
        <span className="absolute top-3 left-3 z-10 text-[10px] uppercase tracking-wider font-bold bg-[#fcd5b4] text-[#8b6f4d] px-2 py-1 rounded-full shadow flex items-center gap-1">
          <Star className="w-3 h-3 fill-[#f0a988]" /> Featured
        </span>
      )}
      <div className="aspect-square bg-[#eef9fb] overflow-hidden p-3">
        {img ? (
          <img
            src={img}
            alt={p.title}
            loading="lazy"
            className="w-full h-full object-contain group-hover:scale-105 transition-transform"
          />
        ) : (
          <div className="w-full h-full grid place-items-center text-[#8fbfe0] font-accent text-2xl text-center px-2">
            {p.title}
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-accent text-lg font-bold leading-tight text-[#2e3a3a] line-clamp-2" data-testid={`printify-name-${p.id}`}>
          {p.title}
        </h3>
        <div className="mt-3 flex items-end justify-between">
          <span className="font-accent text-xl font-bold text-[#5a8a6f]" data-testid={`printify-price-${p.id}`}>
            ${price.toFixed(2)}{showRange ? `+` : ""}
          </span>
          <span className="btn-ghost text-sm flex items-center gap-1">
            Buy <ExternalLink className="w-3 h-3" />
          </span>
        </div>
      </div>
    </a>
  );
}

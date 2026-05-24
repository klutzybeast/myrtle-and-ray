import { ExternalLink } from "lucide-react";

// Direct external link to an Etsy listing.
export default function EtsyCard({ p }) {
  const img = p.image_url || (p.images && p.images[0]) || "";
  return (
    <a
      href={p.listing_url}
      target="_blank"
      rel="noopener noreferrer"
      className="card-soft block overflow-hidden group"
      data-testid={`etsy-card-${p.listing_id}`}
    >
      <div className="aspect-square bg-[#eef9fb] overflow-hidden p-3">
        {img ? (
          <img src={img} alt={p.title} loading="lazy" className="w-full h-full object-contain group-hover:scale-105 transition-transform" />
        ) : (
          <div className="w-full h-full grid place-items-center text-[#8fbfe0] font-accent text-2xl text-center px-2">{p.title}</div>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-accent text-lg font-bold leading-tight text-[#2e3a3a] line-clamp-2" data-testid={`etsy-name-${p.listing_id}`}>
          {p.title}
        </h3>
        <div className="mt-3 flex items-end justify-between">
          <span className="font-accent text-xl font-bold text-[#5a8a6f]" data-testid={`etsy-price-${p.listing_id}`}>
            ${(p.price || 0).toFixed(2)}
          </span>
          <span className="btn-ghost text-sm flex items-center gap-1">
            Buy on Etsy <ExternalLink className="w-3 h-3" />
          </span>
        </div>
      </div>
    </a>
  );
}

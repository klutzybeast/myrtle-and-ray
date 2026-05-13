import { Link } from "react-router-dom";
import { useSite } from "../lib/site";
import { ShoppingBag, BookOpen } from "lucide-react";

export default function StickyActionBar() {
  const site = useSite();
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-[#fde6c8] py-3 px-4 shadow-[0_-10px_30px_rgba(0,0,0,0.06)]" data-testid="sticky-action-bar">
      <div className="max-w-3xl mx-auto flex items-center justify-center gap-3 flex-wrap">
        <a href={site.amazon_book_url || "#"} target="_blank" rel="noopener noreferrer" className="btn-primary text-base md:text-lg" data-testid="bottom-amazon-cta">
          <BookOpen className="w-5 h-5" strokeWidth={2.5} /> Buy the Book on Amazon
        </a>
        <Link to="/shop" className="btn-secondary text-base md:text-lg" data-testid="bottom-shop-cta">
          <ShoppingBag className="w-5 h-5" strokeWidth={2.5} /> Shop Myrtle and Ray Stuffies
        </Link>
      </div>
    </div>
  );
}

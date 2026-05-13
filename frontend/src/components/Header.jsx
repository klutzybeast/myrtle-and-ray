import { Link, NavLink, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useSite } from "../lib/site";
import { Waves, Menu, Volume2, VolumeX, X, ShoppingBag, BookOpen } from "lucide-react";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/story", label: "The Story" },
  { to: "/activities", label: "Activities" },
  { to: "/read-aloud", label: "Read Aloud" },
  { to: "/shop", label: "Shop" },
  { to: "/downloads", label: "Downloads" },
  { to: "/for-camps", label: "For Camps" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
];

export default function Header() {
  const site = useSite();
  const [audio, setAudio] = useState(false);
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-white/85 backdrop-blur-xl border-b border-[#f4e4c6]" data-testid="site-header">
      <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2" data-testid="header-logo">
          <div className="w-9 h-9 rounded-full gradient-wave flex items-center justify-center shadow-sm">
            <Waves className="w-5 h-5 text-white" strokeWidth={2.5} />
          </div>
          <div className="leading-tight">
            <div className="font-accent font-bold text-[17px] text-[#2e3a3a]">{site.site_name || "Myrtle and Ray"}</div>
            <div className="text-[10px] uppercase tracking-widest text-[#7cbf94] font-semibold">Catch the W.A.V.E.</div>
          </div>
        </Link>
        <nav className="hidden lg:flex items-center gap-1" data-testid="primary-nav">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === "/"} className={({ isActive }) =>
              `px-3 py-2 rounded-full font-semibold text-sm transition ${isActive ? "bg-[#eef9fb] text-[#5a8a6f]" : "text-[#4a5568] hover:bg-[#fff5ec]"}`
            } data-testid={`nav-${n.to.replace("/", "") || "home"}`}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <button onClick={() => setAudio((v) => !v)} className="p-2 rounded-full hover:bg-[#eef9fb]" aria-label="Toggle ambient sound" data-testid="audio-toggle">
            {audio ? <Volume2 className="w-5 h-5 text-[#5a8a6f]" /> : <VolumeX className="w-5 h-5 text-[#4a5568]" />}
          </button>
          <button onClick={() => setOpen((v) => !v)} className="lg:hidden p-2 rounded-full hover:bg-[#eef9fb]" aria-label="Open menu" data-testid="mobile-menu-toggle">
            {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>
      {open && (
        <div className="lg:hidden bg-white border-t border-[#f4e4c6] px-4 py-3 flex flex-col gap-1" data-testid="mobile-nav">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === "/"} className={({ isActive }) =>
              `px-3 py-3 rounded-2xl font-semibold ${isActive ? "bg-[#eef9fb] text-[#5a8a6f]" : "text-[#4a5568]"}`
            } data-testid={`mobile-nav-${n.to.replace("/", "") || "home"}`}>
              {n.label}
            </NavLink>
          ))}
        </div>
      )}
    </header>
  );
}

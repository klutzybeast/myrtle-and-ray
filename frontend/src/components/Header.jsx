import { Link, NavLink, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useSite } from "../lib/site";
import { useAudio } from "../lib/audio";
import { Waves, Menu, Volume2, VolumeX, SkipForward, X, LogIn } from "lucide-react";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/story", label: "The Story" },
  { to: "/map", label: "Map" },
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
  const { enabled: audio, toggle: toggleAudio, hasTracks, trackCount, trackIdx, nextTrack } = useAudio();

  const onAudioClick = () => {
    if (!hasTracks) {
      const msg = "No music has been uploaded yet. Admins: Media Library → Upload your MP3s → Site & Emails → Music tracks (one URL per line).";
      try { window.alert(msg); } catch {}
      return;
    }
    toggleAudio();
  };
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-xl border-b border-[#f4e4c6] shadow-[0_2px_12px_rgba(58,74,85,0.04)]" data-testid="site-header">
      {/* TOP ROW — logo + tagline + actions */}
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <div className="h-14 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2.5 group" data-testid="header-logo">
            <div className="w-10 h-10 rounded-full gradient-wave grid place-items-center shadow-sm group-hover:scale-105 transition overflow-hidden">
              {site.logo_url ? (
                <img src={site.logo_url} alt={site.site_name || "Myrtle and Ray"} className="w-full h-full object-contain" data-testid="header-logo-image" />
              ) : (
                <Waves className="w-5 h-5 text-white" strokeWidth={2.5} />
              )}
            </div>
            <div className="leading-tight">
              <div className="font-accent font-bold text-[18px] text-[#3a4a55]">{site.site_name || "Myrtle and Ray"}</div>
              <div className="hidden sm:block text-[10px] uppercase tracking-[0.18em] text-[#7cbf94] font-bold">First Day of Camp</div>
            </div>
          </Link>

          {/* Center badge — pill */}
          <div className="hidden md:flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-[#eef9fb] to-[#fff5ec] border border-[#f4e4c6]">
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#5a8a6f]">Catch the</span>
            <span className="font-accent font-bold text-[#3a4a55]">W.A.V.E.</span>
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#f0a988]">of Excitement</span>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={onAudioClick}
              className="w-9 h-9 grid place-items-center rounded-full hover:bg-[#eef9fb] transition"
              aria-label={!hasTracks ? "No music uploaded yet" : audio ? "Mute music" : "Play music"}
              title={!hasTracks ? "No music yet — upload one in Admin → Media Library" : audio ? `Playing track ${trackIdx + 1}/${trackCount} — click to mute` : "Play music"}
              data-testid="audio-toggle"
            >
              {audio ? <Volume2 className="w-5 h-5 text-[#5a8a6f]" /> : <VolumeX className="w-5 h-5 text-[#5a6b76]" />}
            </button>
            {audio && trackCount > 1 && (
              <button
                onClick={nextTrack}
                className="w-9 h-9 grid place-items-center rounded-full hover:bg-[#eef9fb] transition"
                aria-label="Skip to next track"
                title={`Skip to next track (${trackCount} in playlist)`}
                data-testid="audio-next"
              >
                <SkipForward className="w-5 h-5 text-[#5a8a6f]" />
              </button>
            )}
            <Link
              to="/admin/login"
              className="hidden md:inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white border-2 border-[#f4e4c6] hover:border-[#7fcfc7] hover:bg-[#eef9fb] text-sm font-bold text-[#3a4a55] transition"
              data-testid="header-login-link"
            >
              <LogIn className="w-4 h-4" />Login
            </Link>
            <button
              onClick={() => setOpen((v) => !v)}
              className="lg:hidden w-9 h-9 grid place-items-center rounded-full hover:bg-[#eef9fb] transition"
              aria-label={open ? "Close menu" : "Open menu"}
              data-testid="mobile-menu-toggle"
            >
              {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* NAV ROW — desktop only, centered under the brand row */}
        <nav className="hidden lg:flex items-center justify-center gap-1 pb-2" data-testid="primary-nav">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/"}
              className={({ isActive }) =>
                `relative px-3.5 py-1.5 rounded-full font-semibold text-sm transition ${
                  isActive
                    ? "text-[#3a4a55] bg-[#eef9fb]"
                    : "text-[#5a6b76] hover:text-[#3a4a55] hover:bg-[#fff5ec]"
                }`
              }
              data-testid={`nav-${n.to.replace("/", "") || "home"}`}
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* MOBILE NAV DRAWER */}
      {open && (
        <div className="lg:hidden bg-white border-t border-[#f4e4c6] px-4 py-3 flex flex-col gap-1 max-h-[70vh] overflow-y-auto" data-testid="mobile-nav">
          {/* Mobile W.A.V.E. badge */}
          <div className="flex items-center justify-center gap-2 px-3 py-2 mb-2 rounded-full bg-gradient-to-r from-[#eef9fb] to-[#fff5ec] border border-[#f4e4c6]">
            <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-[#5a8a6f]">Catch the</span>
            <span className="font-accent font-bold text-[#3a4a55]">W.A.V.E.</span>
          </div>
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/"}
              className={({ isActive }) =>
                `px-3 py-3 rounded-2xl font-semibold ${isActive ? "bg-[#eef9fb] text-[#5a8a6f]" : "text-[#4a5568]"}`
              }
              data-testid={`mobile-nav-${n.to.replace("/", "") || "home"}`}
            >
              {n.label}
            </NavLink>
          ))}
          <Link
            to="/admin/login"
            className="mt-2 inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-2xl bg-white border-2 border-[#f4e4c6] font-bold text-[#3a4a55]"
            data-testid="mobile-login-link"
          >
            <LogIn className="w-4 h-4" />Admin Login
          </Link>
        </div>
      )}
    </header>
  );
}

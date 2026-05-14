import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { Waves, LayoutDashboard, Package, Users, FileText, Settings, Inbox, Mail, Image, Sparkles, LogOut, Send, Download, Layers, PenSquare, ExternalLink, Home, Megaphone, Menu, X } from "lucide-react";

const ITEMS = [
  { to: "/admin", end: true, label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/products", label: "Products", icon: Package },
  { to: "/admin/characters", label: "Characters", icon: Users },
  { to: "/admin/downloads", label: "Downloads", icon: Download },
  { to: "/admin/download-categories", label: "Download Cats", icon: Layers },
  { to: "/admin/pages", label: "System Pages", icon: FileText },
  { to: "/admin/custom-pages", label: "Custom Pages", icon: PenSquare },
  { to: "/admin/settings", label: "Site & Emails", icon: Settings },
  { to: "/admin/submissions", label: "Submissions", icon: Inbox },
  { to: "/admin/mailing-list", label: "Mailing List", icon: Mail },
  { to: "/admin/campaigns", label: "Campaigns", icon: Megaphone },
  { to: "/admin/email-outbox", label: "Email Outbox", icon: Send },
  { to: "/admin/media", label: "Media Library", icon: Image },
  { to: "/admin/activities", label: "Activities", icon: Sparkles },
];

function SidebarContent({ user, onLogout, onNavigate }) {
  return (
    <>
      <Link to="/admin" onClick={onNavigate} className="flex items-center gap-2 px-5 py-5 border-b border-[#f4e4c6]">
        <div className="w-9 h-9 rounded-full gradient-wave grid place-items-center"><Waves className="w-5 h-5 text-white" /></div>
        <div className="font-accent font-bold">Myrtle & Ray</div>
      </Link>
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {ITEMS.map((it) => (
          <NavLink key={it.to} to={it.to} end={it.end} onClick={onNavigate}
            className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-2xl font-semibold text-sm ${isActive ? "bg-[#eef9fb] text-[#5a8a6f]" : "text-[#4a5568] hover:bg-[#f3f4f6]"}`}
            data-testid={`admin-nav-${it.to.split("/").pop() || "dashboard"}`}>
            <it.icon className="w-4 h-4" />{it.label}
          </NavLink>
        ))}
      </nav>
      <div className="p-3 border-t border-[#f4e4c6] space-y-2">
        <a href="/" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 px-3 py-2 rounded-2xl text-sm font-semibold bg-[#eef9fb] text-[#5a8a6f] hover:bg-[#dff3f6]" data-testid="admin-view-site"><Home className="w-4 h-4" />View website<ExternalLink className="w-3 h-3" /></a>
        <div className="text-xs text-[#6b7280] truncate">{user?.email}</div>
        <button onClick={onLogout} className="btn-ghost text-sm w-full justify-center" data-testid="admin-logout"><LogOut className="w-4 h-4" />Sign out</button>
      </div>
    </>
  );
}

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const onLogout = async () => { await logout(); nav("/"); };

  // Find current page label for mobile topbar
  const currentItem = [...ITEMS].reverse().find((it) => (it.end ? loc.pathname === it.to : loc.pathname.startsWith(it.to)));

  return (
    <div className="min-h-screen bg-[#f8fafc] flex" data-testid="admin-layout">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 bg-white border-r border-[#f4e4c6] flex-col fixed inset-y-0 left-0">
        <SidebarContent user={user} onLogout={onLogout} onNavigate={() => {}} />
      </aside>

      {/* Mobile top bar */}
      <header className="lg:hidden fixed top-0 inset-x-0 z-40 bg-white border-b border-[#f4e4c6] flex items-center justify-between px-4 h-14" data-testid="admin-mobile-topbar">
        <button onClick={() => setMobileOpen(true)} className="p-2 -ml-2 rounded-full hover:bg-[#eef9fb]" aria-label="Open menu" data-testid="admin-mobile-menu-open">
          <Menu className="w-6 h-6 text-[#3a4a55]" />
        </button>
        <div className="font-accent font-bold text-[#3a4a55] truncate">{currentItem?.label || "Admin"}</div>
        <a href="/" target="_blank" rel="noopener noreferrer" className="p-2 -mr-2 rounded-full hover:bg-[#eef9fb]" aria-label="View site" data-testid="admin-mobile-view-site">
          <ExternalLink className="w-5 h-5 text-[#5a8a6f]" />
        </a>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50" data-testid="admin-mobile-drawer">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white flex flex-col shadow-2xl">
            <button onClick={() => setMobileOpen(false)} className="absolute top-3 right-3 p-2 rounded-full hover:bg-[#f3f4f6] z-10" aria-label="Close menu" data-testid="admin-mobile-menu-close">
              <X className="w-5 h-5" />
            </button>
            <SidebarContent user={user} onLogout={async () => { setMobileOpen(false); await onLogout(); }} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex-1 lg:ml-64 p-4 md:p-8 pt-[72px] lg:pt-8">
        <Outlet />
      </div>
    </div>
  );
}

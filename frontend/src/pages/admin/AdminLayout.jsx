import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { Waves, LayoutDashboard, Package, Users, FileText, Settings, Inbox, Mail, Image, Sparkles, LogOut, Send, Download, Layers, PenSquare } from "lucide-react";

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
  { to: "/admin/email-outbox", label: "Email Outbox", icon: Send },
  { to: "/admin/media", label: "Media Library", icon: Image },
  { to: "/admin/activities", label: "Activities", icon: Sparkles },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const onLogout = async () => { await logout(); nav("/admin/login"); };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex" data-testid="admin-layout">
      <aside className="hidden lg:flex w-64 bg-white border-r border-[#f4e4c6] flex-col fixed inset-y-0 left-0">
        <Link to="/admin" className="flex items-center gap-2 px-5 py-5 border-b border-[#f4e4c6]">
          <div className="w-9 h-9 rounded-full gradient-wave grid place-items-center"><Waves className="w-5 h-5 text-white" /></div>
          <div className="font-accent font-bold">Myrtle & Ray</div>
        </Link>
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {ITEMS.map((it) => (
            <NavLink key={it.to} to={it.to} end={it.end} className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-2xl font-semibold text-sm ${isActive ? "bg-[#eef9fb] text-[#5a8a6f]" : "text-[#4a5568] hover:bg-[#f3f4f6]"}`} data-testid={`admin-nav-${it.to.split("/").pop() || "dashboard"}`}>
              <it.icon className="w-4 h-4" />{it.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-[#f4e4c6]">
          <div className="text-xs text-[#6b7280] mb-2 truncate">{user?.email}</div>
          <button onClick={onLogout} className="btn-ghost text-sm w-full justify-center" data-testid="admin-logout"><LogOut className="w-4 h-4" />Sign out</button>
        </div>
      </aside>
      <div className="flex-1 lg:ml-64 p-4 md:p-8">
        <Outlet />
      </div>
    </div>
  );
}

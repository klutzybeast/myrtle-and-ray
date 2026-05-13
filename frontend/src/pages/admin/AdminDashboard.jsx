import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { Package, Download, Inbox, Users, Send, AlertTriangle } from "lucide-react";

export default function AdminDashboard() {
  const [s, setS] = useState(null);
  useEffect(() => { api.get("/admin/dashboard").then(({ data }) => setS(data)).catch(() => {}); }, []);
  if (!s) return <div className="text-[#6b7280]">Loading...</div>;

  const cards = [
    { label: "Products", value: s.total_products, icon: Package, color: "#40e0d0" },
    { label: "Downloads", value: s.total_downloads, icon: Download, color: "#ff9b71" },
    { label: "Contact Forms", value: s.recent_contacts, icon: Inbox, color: "#87ceeb" },
    { label: "Wholesale", value: s.recent_wholesale, icon: Inbox, color: "#9b72cb" },
    { label: "Mailing List", value: s.recent_mailing, icon: Users, color: "#3cb371" },
    { label: "Download Captures", value: s.recent_captures, icon: Inbox, color: "#ff6f91" },
    { label: "Pending Emails", value: s.pending_emails, icon: Send, color: "#ffb347" },
    { label: "Failed Emails", value: s.failed_emails, icon: AlertTriangle, color: "#ef4444" },
  ];

  return (
    <div data-testid="admin-dashboard">
      <h1 className="font-accent text-4xl font-bold mb-1">Welcome back 🌊</h1>
      <p className="text-[#6b7280] mb-6">Here's how Stingray Cay is doing.</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-3xl p-5 border border-[#fde6c8]" data-testid={`stat-${c.label.toLowerCase().replace(/ /g, "-")}`}>
            <div className="w-10 h-10 rounded-2xl grid place-items-center mb-3" style={{ background: `${c.color}22` }}><c.icon className="w-5 h-5" style={{ color: c.color }} /></div>
            <div className="font-accent text-3xl font-bold">{c.value}</div>
            <div className="text-sm text-[#6b7280]">{c.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

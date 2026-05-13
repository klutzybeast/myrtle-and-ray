import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { toast } from "sonner";

const TABS = [
  { key: "", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "sent", label: "Sent" },
  { key: "failed", label: "Failed" },
];

export default function AdminEmailOutbox() {
  const [tab, setTab] = useState("");
  const [items, setItems] = useState([]);

  const load = () => {
    const url = tab ? `/admin/email-outbox?status=${tab}` : "/admin/email-outbox";
    api.get(url).then(({ data }) => setItems(data));
  };
  useEffect(() => { load(); }, [tab]);

  const retry = async (id) => { await api.post(`/admin/email-outbox/${id}/retry`); toast.success("Retried"); load(); };

  return (
    <div data-testid="admin-email-outbox">
      <h1 className="font-accent text-3xl font-bold mb-1">Email Outbox</h1>
      <p className="text-[#6b7280] mb-4">If RESEND_API_KEY is not set, emails queue here. Once you add the key, click Retry on any pending email.</p>
      <div className="flex gap-2 mb-4">{TABS.map((t) => <button key={t.key} onClick={() => setTab(t.key)} className={`px-4 py-2 rounded-full text-sm font-bold ${tab === t.key ? "bg-[#7fcfc7] text-white" : "bg-white text-[#4a5568]"}`}>{t.label}</button>)}</div>
      <div className="space-y-2">
        {items.map((e) => (
          <div key={e.id} className="bg-white rounded-3xl border border-[#f4e4c6] p-4 flex items-start gap-3">
            <div className={`px-2 py-1 rounded-full text-xs font-bold ${e.status === "sent" ? "bg-[#7cbf94] text-white" : e.status === "failed" ? "bg-red-500 text-white" : "bg-[#f4d28a] text-white"}`}>{e.status}</div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{e.subject}</div>
              <div className="text-xs text-[#6b7280]">To {e.to} · {new Date(e.created_at).toLocaleString()} · {e.purpose}</div>
              {e.error && <div className="text-xs text-red-500 mt-1">{e.error}</div>}
            </div>
            {e.status !== "sent" && <button onClick={() => retry(e.id)} className="btn-ghost text-xs" data-testid={`email-retry-${e.id}`}>Retry</button>}
          </div>
        ))}
        {!items.length && <div className="text-center text-[#6b7280] py-8">No emails yet.</div>}
      </div>
    </div>
  );
}

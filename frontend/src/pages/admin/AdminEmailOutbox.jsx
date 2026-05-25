import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { toast } from "sonner";
import { Trash2, RefreshCw, Eraser } from "lucide-react";

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

  const retry = async (id) => {
    try {
      await api.post(`/admin/email-outbox/${id}/retry`);
      toast.success("Retried");
      load();
    } catch (err) { toast.error(err.response?.data?.detail || "Retry failed"); }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this email permanently?")) return;
    try {
      await api.delete(`/admin/email-outbox/${id}`);
      toast.success("Deleted");
      setItems((prev) => prev.filter((e) => e.id !== id));
    } catch (err) { toast.error(err.response?.data?.detail || "Delete failed"); }
  };

  const clearSent = async () => {
    if (!window.confirm("Permanently delete every email that's already been sent? Pending and failed emails are kept.")) return;
    try {
      const { data } = await api.post("/admin/email-outbox/clear-sent");
      toast.success(`Deleted ${data.deleted ?? 0} sent emails`);
      load();
    } catch (err) { toast.error(err.response?.data?.detail || "Clear failed"); }
  };

  return (
    <div data-testid="admin-email-outbox">
      <header className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <h1 className="font-accent text-3xl font-bold mb-1">Email Outbox</h1>
          <p className="text-[#6b7280] text-sm">If RESEND_API_KEY is not set, emails queue here. Once you add the key, click Retry on any pending email.</p>
        </div>
        <button
          onClick={clearSent}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#fff4d6] border-2 border-[#f0a988] text-[#a36b29] font-bold hover:bg-[#ffe9b8] text-sm"
          data-testid="email-clear-sent"
        >
          <Eraser className="w-4 h-4" /> Delete all sent
        </button>
      </header>
      <div className="flex gap-2 mb-4" data-testid="email-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-full text-sm font-bold transition ${tab === t.key ? "bg-[#7fcfc7] text-white" : "bg-white text-[#4a5568] hover:bg-[#eef9fb]"}`}
            data-testid={`email-tab-${t.key || "all"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {items.map((e) => (
          <div key={e.id} className="bg-white rounded-3xl border border-[#f4e4c6] p-4 flex items-start gap-3" data-testid={`email-row-${e.id}`}>
            <div className={`px-2 py-1 rounded-full text-xs font-bold whitespace-nowrap ${e.status === "sent" ? "bg-[#7cbf94] text-white" : e.status === "failed" ? "bg-red-500 text-white" : "bg-[#f4d28a] text-white"}`}>{e.status}</div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{e.subject}</div>
              <div className="text-xs text-[#6b7280]">To {e.to} · {new Date(e.created_at).toLocaleString()} · {e.purpose}</div>
              {e.error && <div className="text-xs text-red-500 mt-1">{e.error}</div>}
            </div>
            <div className="flex items-center gap-1">
              {e.status !== "sent" && (
                <button onClick={() => retry(e.id)} className="btn-ghost text-xs" data-testid={`email-retry-${e.id}`}>
                  <RefreshCw className="w-3.5 h-3.5" /> Retry
                </button>
              )}
              <button
                onClick={() => remove(e.id)}
                className="text-xs px-2 py-1.5 rounded-full text-red-700 hover:bg-red-50"
                title="Delete email"
                data-testid={`email-delete-${e.id}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
        {!items.length && <div className="text-center text-[#6b7280] py-8">No emails yet.</div>}
      </div>
    </div>
  );
}

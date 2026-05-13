import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { toast } from "sonner";

const TYPES = [
  { key: "contact", label: "Contact" },
  { key: "wholesale", label: "Wholesale" },
  { key: "download_capture", label: "Download Captures" },
];

export default function AdminSubmissions() {
  const [type, setType] = useState("contact");
  const [items, setItems] = useState([]);

  const load = () => api.get(`/admin/submissions?type=${type}`).then(({ data }) => setItems(data));
  useEffect(() => { load(); }, [type]);

  const exportCsv = () => {
    if (!items.length) return;
    const keys = Object.keys(items[0]).filter((k) => k !== "_id");
    const csv = [keys.join(","), ...items.map((r) => keys.map((k) => JSON.stringify(r[k] ?? "")).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${type}-submissions.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div data-testid="admin-submissions">
      <h1 className="font-accent text-3xl font-bold mb-4">Submissions</h1>
      <div className="flex gap-2 mb-4 flex-wrap">
        {TYPES.map((t) => <button key={t.key} onClick={() => setType(t.key)} className={`px-4 py-2 rounded-full font-bold text-sm ${type === t.key ? "bg-[#7fcfc7] text-white" : "bg-white text-[#4a5568]"}`} data-testid={`sub-tab-${t.key}`}>{t.label}</button>)}
        <button onClick={exportCsv} className="btn-secondary text-sm ml-auto">Export CSV</button>
      </div>
      <div className="bg-white rounded-3xl border border-[#f4e4c6] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#fffbf3] text-left">
            <tr><th className="p-3">When</th><th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Details</th><th></th></tr>
          </thead>
          <tbody>
            {items.map((s) => (
              <tr key={s.id} className="border-t border-[#f4e4c6]">
                <td className="p-3 text-xs">{new Date(s.created_at).toLocaleString()}</td>
                <td className="p-3">{s.name}{s.camp_name ? ` · ${s.camp_name}` : ""}</td>
                <td className="p-3"><a href={`mailto:${s.email}`} className="text-[#5a8a6f]">{s.email}</a></td>
                <td className="p-3 max-w-md">
                  {s.subject && <div className="font-semibold">{s.subject}</div>}
                  {s.message && <div className="text-[#4a5568] text-xs whitespace-pre-line">{s.message}</div>}
                  {s.download_title && <div className="text-xs text-[#7cbf94]">{s.download_title} ({s.audience})</div>}
                  {s.quantity && <div className="text-xs">Qty: {s.quantity} · Date: {s.order_date}</div>}
                </td>
                <td className="p-3 text-right"><button onClick={async () => { await api.delete(`/admin/submissions/${s.id}`); toast.success("Removed"); load(); }} className="text-red-500 text-xs">Delete</button></td>
              </tr>
            ))}
            {!items.length && <tr><td colSpan="5" className="p-8 text-center text-[#6b7280]">No submissions yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

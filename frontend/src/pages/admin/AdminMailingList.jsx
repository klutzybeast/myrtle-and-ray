import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import { toast } from "sonner";

export default function AdminMailingList() {
  const [items, setItems] = useState([]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [tagFilter, setTagFilter] = useState("");

  const load = () => api.get("/admin/mailing-list").then(({ data }) => setItems(data));
  useEffect(() => { load(); }, []);

  const add = async (e) => {
    e.preventDefault();
    try { await api.post("/admin/mailing-list", { email, name }); toast.success("Added"); setEmail(""); setName(""); load(); }
    catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
  };
  const remove = async (id) => { if (!window.confirm("Remove subscriber?")) return; await api.delete(`/admin/mailing-list/${id}`); toast.success("Removed"); load(); };

  // Distinct tags for filter chips
  const allTags = useMemo(() => {
    const s = new Set();
    items.forEach((m) => (m.tags || []).forEach((t) => s.add(t)));
    return Array.from(s).sort();
  }, [items]);

  const filtered = useMemo(() => {
    if (!tagFilter) return items;
    return items.filter((m) => (m.tags || []).includes(tagFilter));
  }, [items, tagFilter]);

  const exportCsv = () => {
    const rows = filtered;
    const csv = ["email,name,source,audience,tags,created_at", ...rows.map((r) => `${r.email},${r.name || ""},${r.source || ""},${r.audience || ""},${(r.tags || []).join("|")},${r.created_at}`)].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "mailing-list.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div data-testid="admin-mailing">
      <h1 className="font-accent text-3xl font-bold mb-4">Mailing List ({filtered.length}{tagFilter ? ` of ${items.length}` : ""})</h1>
      <form onSubmit={add} className="card-soft p-4 mb-4 flex flex-wrap gap-2 items-end">
        <input placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} required type="email" className="px-4 py-2 rounded-full border-2 border-[#f4e4c6] flex-1 min-w-[200px]" data-testid="mailing-add-email" />
        <input placeholder="name" value={name} onChange={(e) => setName(e.target.value)} className="px-4 py-2 rounded-full border-2 border-[#f4e4c6] flex-1 min-w-[200px]" data-testid="mailing-add-name" />
        <button className="btn-primary" data-testid="mailing-add-submit">Add</button>
        <button type="button" onClick={exportCsv} className="btn-secondary" data-testid="mailing-export-csv">Export CSV</button>
      </form>

      {allTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4" data-testid="mailing-tag-filters">
          <span className="text-xs font-semibold text-[#6b7280] mr-1">Filter by tag:</span>
          <button onClick={() => setTagFilter("")} className={`px-3 py-1 text-xs rounded-full font-semibold ${!tagFilter ? "bg-[#5a8a6f] text-white" : "bg-[#eef9fb] text-[#5a8a6f]"}`} data-testid="mailing-tag-filter-all">All</button>
          {allTags.map((t) => (
            <button key={t} onClick={() => setTagFilter(t)} className={`px-3 py-1 text-xs rounded-full font-semibold ${tagFilter === t ? "bg-[#5a8a6f] text-white" : "bg-[#eef9fb] text-[#5a8a6f] hover:bg-[#dff3f6]"}`} data-testid={`mailing-tag-filter-${t}`}>{t}</button>
          ))}
        </div>
      )}

      <div className="bg-white rounded-3xl border border-[#f4e4c6] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#fffbf3] text-left"><tr><th className="p-3">Email</th><th className="p-3">Name</th><th className="p-3">Source</th><th className="p-3">Tags</th><th></th></tr></thead>
          <tbody>
            {filtered.map((m) => (
              <tr key={m.id} className="border-t border-[#f4e4c6]" data-testid={`mailing-row-${m.id}`}>
                <td className="p-3">{m.email}</td>
                <td className="p-3">{m.name}</td>
                <td className="p-3 text-xs">{m.source}{m.audience ? ` · ${m.audience}` : ""}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    {(m.tags || []).map((t) => (
                      <span key={t} className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#eef9fb] text-[#5a8a6f]" data-testid={`mailing-tag-${t}`}>{t}</span>
                    ))}
                  </div>
                </td>
                <td className="p-3 text-right"><button onClick={() => remove(m.id)} className="text-red-500 text-xs" data-testid={`mailing-remove-${m.id}`}>Remove</button></td>
              </tr>
            ))}
            {!filtered.length && <tr><td colSpan="5" className="p-8 text-center text-[#6b7280]">{tagFilter ? `No subscribers with tag "${tagFilter}".` : "No subscribers yet."}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { toast } from "sonner";

export default function AdminMailingList() {
  const [items, setItems] = useState([]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  const load = () => api.get("/admin/mailing-list").then(({ data }) => setItems(data));
  useEffect(() => { load(); }, []);

  const add = async (e) => {
    e.preventDefault();
    try { await api.post("/admin/mailing-list", { email, name }); toast.success("Added"); setEmail(""); setName(""); load(); }
    catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
  };
  const remove = async (id) => { if (!window.confirm("Remove subscriber?")) return; await api.delete(`/admin/mailing-list/${id}`); toast.success("Removed"); load(); };
  const exportCsv = () => {
    const csv = ["email,name,source,audience,tags,created_at", ...items.map((r) => `${r.email},${r.name || ""},${r.source || ""},${r.audience || ""},${(r.tags || []).join("|")},${r.created_at}`)].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "mailing-list.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div data-testid="admin-mailing">
      <h1 className="font-accent text-3xl font-bold mb-4">Mailing List ({items.length})</h1>
      <form onSubmit={add} className="card-soft p-4 mb-4 flex flex-wrap gap-2 items-end">
        <input placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} required type="email" className="px-4 py-2 rounded-full border-2 border-[#f4e4c6] flex-1 min-w-[200px]" />
        <input placeholder="name" value={name} onChange={(e) => setName(e.target.value)} className="px-4 py-2 rounded-full border-2 border-[#f4e4c6] flex-1 min-w-[200px]" />
        <button className="btn-primary">Add</button>
        <button type="button" onClick={exportCsv} className="btn-secondary">Export CSV</button>
      </form>
      <div className="bg-white rounded-3xl border border-[#f4e4c6] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#fffbf3] text-left"><tr><th className="p-3">Email</th><th className="p-3">Name</th><th className="p-3">Source</th><th className="p-3">Tags</th><th></th></tr></thead>
          <tbody>
            {items.map((m) => (
              <tr key={m.id} className="border-t border-[#f4e4c6]">
                <td className="p-3">{m.email}</td>
                <td className="p-3">{m.name}</td>
                <td className="p-3 text-xs">{m.source}{m.audience ? ` · ${m.audience}` : ""}</td>
                <td className="p-3 text-xs">{(m.tags || []).join(", ")}</td>
                <td className="p-3 text-right"><button onClick={() => remove(m.id)} className="text-red-500 text-xs">Remove</button></td>
              </tr>
            ))}
            {!items.length && <tr><td colSpan="5" className="p-8 text-center text-[#6b7280]">No subscribers yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, X, Save } from "lucide-react";
import AIThumbnailButton from "../../components/admin/AIThumbnailButton";

export default function AdminDownloadCategories() {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);

  const load = () => api.get("/admin/download-categories").then(({ data }) => setItems(data));
  useEffect(() => { load(); }, []);

  const blank = { name: "", slug: "", icon: "FileText", description: "", color: "#7fcfc7", thumbnail_url: "", order: 99, visible: true };
  const save = async (data) => {
    try {
      if (creating) await api.post("/admin/download-categories", data);
      else await api.put(`/admin/download-categories/${editing.slug}`, data);
      toast.success("Saved");
      setEditing(null); setCreating(false);
      load();
    } catch (err) { toast.error(err.response?.data?.detail || "Save failed"); }
  };
  const remove = async (slug) => {
    if (!window.confirm("Delete this category?")) return;
    await api.delete(`/admin/download-categories/${slug}`); toast.success("Deleted"); load();
  };

  return (
    <div data-testid="admin-download-categories">
      <header className="flex items-center justify-between mb-6">
        <h1 className="font-accent text-3xl font-bold">Download Categories</h1>
        <button onClick={() => { setEditing(blank); setCreating(true); }} className="btn-primary"><Plus className="w-5 h-5" />New Category</button>
      </header>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((c) => (
          <div key={c.slug} className="bg-white rounded-3xl border border-[#f4e4c6] p-5">
            <div className="w-10 h-10 rounded-2xl mb-3 overflow-hidden" style={{ background: c.color }}>
              {c.thumbnail_url && <img src={c.thumbnail_url} alt="" className="w-full h-full object-cover" />}
            </div>
            <div className="font-bold">{c.name}</div>
            <div className="text-xs text-[#6b7280]">/{c.slug}</div>
            <p className="text-sm text-[#4a5568] mt-1">{c.description}</p>
            <div className="flex gap-1 mt-3">
              <button onClick={() => { setEditing(c); setCreating(false); }} className="btn-ghost text-xs"><Pencil className="w-3 h-3" />Edit</button>
              <button onClick={() => remove(c.slug)} className="btn-ghost text-xs text-red-500"><Trash2 className="w-3 h-3" />Delete</button>
            </div>
          </div>
        ))}
      </div>
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" onClick={() => { setEditing(null); setCreating(false); }}>
          <div className="bg-white rounded-[24px] max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4"><h3 className="font-accent text-xl font-bold">{editing.slug ? "Edit" : "New"} Category</h3><button onClick={() => { setEditing(null); setCreating(false); }}><X /></button></div>
            <div className="space-y-3">
              <input placeholder="Name" value={editing.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="inp" />
              <input placeholder="Slug" value={editing.slug || ""} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} className="inp" />
              <input placeholder="Icon (lucide name)" value={editing.icon || ""} onChange={(e) => setEditing({ ...editing, icon: e.target.value })} className="inp" />
              <input placeholder="Description" value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className="inp" />
              <input type="color" value={editing.color || "#7fcfc7"} onChange={(e) => setEditing({ ...editing, color: e.target.value })} className="w-full h-12 rounded-full" />
              <input type="number" placeholder="Order" value={editing.order === 0 || editing.order == null ? "" : editing.order} onChange={(e) => setEditing({ ...editing, order: e.target.value === "" ? 0 : parseInt(e.target.value, 10) || 0 })} className="inp" />
              <label className="flex items-center gap-2"><input type="checkbox" checked={editing.visible !== false} onChange={(e) => setEditing({ ...editing, visible: e.target.checked })} />Visible on site</label>
            </div>
            <div className="flex justify-end gap-2 mt-5"><button onClick={() => { setEditing(null); setCreating(false); }} className="btn-ghost">Cancel</button><button onClick={() => save(editing)} className="btn-primary"><Save className="w-4 h-4" />Save</button></div>
          </div>
          <style>{`.inp{width:100%;padding:10px 14px;border-radius:9999px;border:2px solid #f4e4c6;background:white;font-size:14px}.inp:focus{outline:none;border-color:#7fcfc7}`}</style>
        </div>
      )}
    </div>
  );
}

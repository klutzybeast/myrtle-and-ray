import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, X, Save } from "lucide-react";

export default function AdminShopCategories() {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);

  const load = () => api.get("/admin/shop-categories").then(({ data }) => setItems(data));
  useEffect(() => { load(); }, []);

  const blank = { name: "", slug: "", icon: "ShoppingBag", description: "", color: "#f0a988", thumbnail_url: "", order: 99, visible: true };
  const save = async (data) => {
    try {
      if (creating) await api.post("/admin/shop-categories", data);
      else await api.put(`/admin/shop-categories/${editing.slug}`, data);
      toast.success("Saved");
      setEditing(null); setCreating(false);
      load();
    } catch (err) { toast.error(err.response?.data?.detail || "Save failed"); }
  };
  const remove = async (slug) => {
    if (!window.confirm("Delete this shop category?")) return;
    await api.delete(`/admin/shop-categories/${slug}`); toast.success("Deleted"); load();
  };

  return (
    <div data-testid="admin-shop-categories">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-accent text-3xl font-bold">Shop Categories</h1>
          <p className="text-sm text-[#6b7280] mt-1">These appear as clickable cards on the public Shop page, like Downloads.</p>
        </div>
        <button onClick={() => { setEditing(blank); setCreating(true); }} className="btn-primary" data-testid="shop-cat-new-btn"><Plus className="w-5 h-5" />New Category</button>
      </header>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="shop-cat-grid">
        {items.map((c) => (
          <div key={c.slug} className="bg-white rounded-3xl border border-[#f4e4c6] p-5" data-testid={`shop-cat-${c.slug}`}>
            <div className="w-full h-32 rounded-2xl mb-3 overflow-hidden" style={{ background: `linear-gradient(135deg, ${c.color || "#f0a988"}33 0%, ${c.color || "#7fcfc7"}66 100%)` }}>
              {c.thumbnail_url && <img src={c.thumbnail_url} alt="" className="w-full h-full object-cover" />}
            </div>
            <div className="font-bold">{c.name}</div>
            <div className="text-xs text-[#6b7280]">/{c.slug}</div>
            <p className="text-sm text-[#4a5568] mt-1">{c.description}</p>
            {c.visible === false && <div className="text-[10px] uppercase tracking-wider text-[#a36b29] mt-1">Hidden</div>}
            <div className="flex gap-1 mt-3">
              <button onClick={() => { setEditing(c); setCreating(false); }} className="btn-ghost text-xs" data-testid={`shop-cat-edit-${c.slug}`}><Pencil className="w-3 h-3" />Edit</button>
              <button onClick={() => remove(c.slug)} className="btn-ghost text-xs text-red-500" data-testid={`shop-cat-del-${c.slug}`}><Trash2 className="w-3 h-3" />Delete</button>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="col-span-full text-center text-[#6b7280] py-10 bg-white rounded-3xl border border-dashed border-[#f4e4c6]">
            No shop categories yet. Click <span className="font-bold">New Category</span> to add Stuffies, Apparel, Drinkware, etc.
          </div>
        )}
      </div>
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" onClick={() => { setEditing(null); setCreating(false); }}>
          <div className="bg-white rounded-[24px] max-w-md w-full p-6" onClick={(e) => e.stopPropagation()} data-testid="shop-cat-modal">
            <div className="flex justify-between items-center mb-4"><h3 className="font-accent text-xl font-bold">{creating ? "New" : "Edit"} Shop Category</h3><button onClick={() => { setEditing(null); setCreating(false); }}><X /></button></div>
            <div className="space-y-3">
              <input placeholder="Name (e.g. Stuffies)" value={editing.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="inp" data-testid="shop-cat-input-name" />
              <input placeholder="Slug (auto from name if blank)" value={editing.slug || ""} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} className="inp" data-testid="shop-cat-input-slug" disabled={!creating} />
              <input placeholder="Icon (lucide name, e.g. ShoppingBag)" value={editing.icon || ""} onChange={(e) => setEditing({ ...editing, icon: e.target.value })} className="inp" />
              <input placeholder="Short description shown on card" value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className="inp" />
              <input placeholder="Thumbnail URL (or use Media Library)" value={editing.thumbnail_url || ""} onChange={(e) => setEditing({ ...editing, thumbnail_url: e.target.value })} className="inp" data-testid="shop-cat-input-thumb" />
              <div className="flex items-center gap-2">
                <label className="text-xs uppercase tracking-wider text-[#6b7280] w-16">Color</label>
                <input type="color" value={editing.color || "#f0a988"} onChange={(e) => setEditing({ ...editing, color: e.target.value })} className="w-full h-12 rounded-full" />
              </div>
              <input type="number" placeholder="Order (lower = first)" value={editing.order === 0 || editing.order == null ? "" : editing.order} onChange={(e) => setEditing({ ...editing, order: e.target.value === "" ? 0 : parseInt(e.target.value, 10) || 0 })} className="inp" />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.visible !== false} onChange={(e) => setEditing({ ...editing, visible: e.target.checked })} />Visible on Shop page</label>
            </div>
            <div className="flex justify-end gap-2 mt-5"><button onClick={() => { setEditing(null); setCreating(false); }} className="btn-ghost">Cancel</button><button onClick={() => save(editing)} className="btn-primary" data-testid="shop-cat-save"><Save className="w-4 h-4" />Save</button></div>
          </div>
          <style>{`.inp{width:100%;padding:10px 14px;border-radius:9999px;border:2px solid #f4e4c6;background:white;font-size:14px}.inp:focus{outline:none;border-color:#7fcfc7}.inp:disabled{background:#f6f6f6;color:#6b7280}`}</style>
        </div>
      )}
    </div>
  );
}

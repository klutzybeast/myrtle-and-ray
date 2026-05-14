import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, X, Save } from "lucide-react";
import { ImageGalleryUploader } from "./ImageUploader";
import TagsInput from "./TagsInput";

const CATS = ["Stuffies", "Apparel", "Drinkware", "Stickers", "Bundles", "Books", "Accessories"];
const STATUS = ["In Stock", "Low Stock", "Sold Out", "Coming Soon"];

export default function AdminProducts() {
  const [items, setItems] = useState([]);
  const [chars, setChars] = useState([]);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);

  const load = () => api.get("/admin/products").then(({ data }) => setItems(data));
  useEffect(() => { load(); api.get("/admin/characters").then(({ data }) => setChars(data)); }, []);

  const blank = { name: "", slug: "", category: "Stuffies", character_slug: "", short_description: "", long_description: "", price: null, compare_at_price: null, images: [], primary_image: "", printify_url: "", inventory_status: "In Stock", featured: false, tags: [], published: true };

  const save = async (data) => {
    try {
      const payload = { ...data, price: data.price == null || data.price === "" ? 0 : Number(data.price) };
      if (creating) await api.post("/admin/products", payload);
      else await api.put(`/admin/products/${editing.slug}`, payload);
      toast.success("Saved!");
      setEditing(null); setCreating(false);
      load();
    } catch (err) { toast.error(err.response?.data?.detail || "Save failed"); }
  };

  const remove = async (slug) => {
    if (!window.confirm("Delete this product?")) return;
    await api.delete(`/admin/products/${slug}`);
    toast.success("Deleted");
    load();
  };

  return (
    <div data-testid="admin-products">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-accent text-3xl font-bold">Products</h1>
          <p className="text-[#6b7280]">{items.length} item{items.length === 1 ? "" : "s"}</p>
        </div>
        <button onClick={() => { setEditing(blank); setCreating(true); }} className="btn-primary" data-testid="product-new"><Plus className="w-5 h-5" />New Product</button>
      </header>
      <div className="bg-white rounded-3xl border border-[#f4e4c6] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#fffbf3] text-left">
            <tr>
              <th className="p-3">Name</th><th className="p-3">Category</th><th className="p-3">Character</th><th className="p-3">Price</th><th className="p-3">Status</th><th className="p-3">Featured</th><th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.slug} className="border-t border-[#f4e4c6]">
                <td className="p-3 font-semibold">{p.name}<div className="text-xs text-[#6b7280]">/{p.slug}</div></td>
                <td className="p-3">{p.category}</td>
                <td className="p-3 text-xs">{p.character_slug || "—"}</td>
                <td className="p-3">${(p.price || 0).toFixed(2)}</td>
                <td className="p-3">{p.inventory_status}</td>
                <td className="p-3">{p.featured ? "★" : ""}</td>
                <td className="p-3 text-right">
                  <button onClick={() => { setEditing(p); setCreating(false); }} className="p-2 hover:bg-gray-100 rounded-full" data-testid={`product-edit-${p.slug}`}><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => remove(p.slug)} className="p-2 hover:bg-red-50 rounded-full text-red-500" data-testid={`product-delete-${p.slug}`}><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <Editor item={editing} setItem={setEditing} cats={CATS} chars={chars} statuses={STATUS} onSave={save} onCancel={() => { setEditing(null); setCreating(false); }} />
      )}
    </div>
  );
}

function Editor({ item, setItem, cats, chars, statuses, onSave, onCancel }) {
  const set = (k, v) => setItem({ ...item, [k]: v });
  return (
    <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" onClick={onCancel} data-testid="product-editor">
      <div className="bg-white rounded-[24px] max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-accent text-2xl font-bold">{item.slug ? "Edit Product" : "New Product"}</h3>
          <button onClick={onCancel}><X /></button>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Name"><input value={item.name || ""} onChange={(e) => set("name", e.target.value)} className="inp" data-testid="product-edit-name" /></Field>
          <Field label="Slug (auto if blank)"><input value={item.slug || ""} onChange={(e) => set("slug", e.target.value)} className="inp" /></Field>
          <Field label="Category"><select value={item.category} onChange={(e) => set("category", e.target.value)} className="inp">{cats.map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Character (optional)"><select value={item.character_slug || ""} onChange={(e) => set("character_slug", e.target.value)} className="inp"><option value="">None</option>{chars.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select></Field>
          <Field label="Price (USD)"><input type="number" inputMode="decimal" step="0.01" min="0" value={item.price === 0 || item.price == null ? "" : item.price} onChange={(e) => set("price", e.target.value === "" ? null : e.target.value)} placeholder="0.00" className="inp" data-testid="product-edit-price" /></Field>
          <Field label="Compare-at price"><input type="number" inputMode="decimal" step="0.01" min="0" value={item.compare_at_price === 0 || item.compare_at_price == null ? "" : item.compare_at_price} onChange={(e) => set("compare_at_price", e.target.value === "" ? null : parseFloat(e.target.value))} placeholder="optional" className="inp" /></Field>
          <Field label="Inventory Status"><select value={item.inventory_status} onChange={(e) => set("inventory_status", e.target.value)} className="inp">{statuses.map((s) => <option key={s}>{s}</option>)}</select></Field>
          <Field label="Buy Now URL (direct product link)"><input value={item.printify_url || ""} onChange={(e) => set("printify_url", e.target.value)} className="inp" data-testid="product-edit-buy-url" /></Field>
          <div className="sm:col-span-2">
            <ImageGalleryUploader
              label="Product images (drop files or click)"
              images={item.images && item.images.length ? item.images : (item.primary_image ? [item.primary_image] : [])}
              onChange={(urls) => setItem({ ...item, images: urls, primary_image: urls[0] || "" })}
              testid="product-images"
            />
          </div>
          <Field label="Short Description" full><input value={item.short_description || ""} onChange={(e) => set("short_description", e.target.value)} className="inp" /></Field>
          <Field label="Long Description" full><textarea value={item.long_description || ""} onChange={(e) => set("long_description", e.target.value)} className="inp min-h-[100px]" rows={4} /></Field>
          <Field label="Tags" full>
            <TagsInput value={item.tags || []} onChange={(tags) => set("tags", tags)} testid="product-edit-tags" />
          </Field>
          <label className="flex items-center gap-2 mt-2"><input type="checkbox" checked={!!item.featured} onChange={(e) => set("featured", e.target.checked)} data-testid="product-edit-featured" />Featured (shows in Shop the Crew band)</label>
          <label className="flex items-center gap-2 mt-2"><input type="checkbox" checked={item.published !== false} onChange={(e) => set("published", e.target.checked)} />Published</label>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onCancel} className="btn-ghost">Cancel</button>
          <button onClick={() => onSave(item)} className="btn-primary" data-testid="product-edit-save"><Save className="w-4 h-4" />Save</button>
        </div>
      </div>
      <style>{`.inp{width:100%;padding:10px 14px;border-radius:9999px;border:2px solid #f4e4c6;background:white;font-size:14px}.inp:focus{outline:none;border-color:#7fcfc7}textarea.inp{border-radius:18px}`}</style>
    </div>
  );
}

function Field({ label, children, full }) {
  return <label className={`text-sm ${full ? "sm:col-span-2" : ""}`}><div className="font-semibold text-[#2e3a3a] mb-1">{label}</div>{children}</label>;
}

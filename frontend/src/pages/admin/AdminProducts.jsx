import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, X, Save, ChevronLeft, Search, Star } from "lucide-react";
import { ImageGalleryUploader, ImageUploader } from "./ImageUploader";
import TagsInput from "./TagsInput";
import { slugify, autoTags, truncate } from "../../lib/seo";

const CATS = ["Stuffies", "Apparel", "Drinkware", "Stickers", "Bundles", "Books", "Accessories"];
const STATUS = ["In Stock", "Low Stock", "Sold Out", "Coming Soon"];

export default function AdminProducts() {
  const [items, setItems] = useState([]);
  const [chars, setChars] = useState([]);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);

  const load = () => api.get("/admin/products").then(({ data }) => setItems(data));
  useEffect(() => { load(); api.get("/admin/characters").then(({ data }) => setChars(data)); }, []);

  const blank = { name: "", slug: "", category: "Stuffies", character_slug: "", short_description: "", long_description: "", price: null, compare_at_price: null, images: [], primary_image: "", printify_url: "", variants: [], inventory_status: "In Stock", featured: false, tags: [], seo_title: "", meta_description: "", og_image: "", published: true };

  const save = async (data) => {
    try {
      const payload = {
        ...data,
        slug: (data.slug || slugify(data.name || "")),
        price: data.price == null || data.price === "" ? 0 : Number(data.price),
        og_image: data.og_image || data.primary_image || "",
        variants: (data.variants || []).filter((v) => (v.label || v.printify_url || v.sku)).map((v) => ({
          label: v.label || "",
          sku: v.sku || "",
          printify_url: v.printify_url || "",
          price: v.price == null || v.price === "" ? null : Number(v.price),
        })),
      };
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
      <ProductsBrowser
        items={items}
        onNew={() => { setEditing(blank); setCreating(true); }}
        onEdit={(p) => { setEditing(p); setCreating(false); }}
        onDelete={remove}
        onToggleFeatured={async (p) => {
          try { await api.put(`/admin/products/${p.slug}`, { ...p, featured: !p.featured }); load(); } catch { toast.error("Couldn't update"); }
        }}
      />

      {editing && (
        <Editor item={editing} setItem={setEditing} cats={CATS} chars={chars} statuses={STATUS} onSave={save} onCancel={() => { setEditing(null); setCreating(false); }} />
      )}
    </div>
  );
}

function Editor({ item, setItem, cats, chars, statuses, onSave, onCancel }) {
  const set = (k, v) => setItem({ ...item, [k]: v });

  // Auto-derive slug + tags from name/category/character — only when those user-editable
  // fields are still blank, so admins can override later.
  const setName = (name) => {
    const next = { ...item, name };
    if (!item.slug || item.slug === slugify(item.name || "")) next.slug = slugify(name);
    if (!item.tags || item.tags.length === 0) next.tags = autoTags({ name, category: item.category, character_slug: item.character_slug });
    if (!item.seo_title) next.seo_title = name;
    setItem(next);
  };
  const setCategory = (category) => {
    const next = { ...item, category };
    if (!item.tags || item.tags.length === 0) next.tags = autoTags({ name: item.name, category, character_slug: item.character_slug });
    setItem(next);
  };
  const setCharacter = (character_slug) => {
    const next = { ...item, character_slug };
    if (!item.tags || item.tags.length === 0) next.tags = autoTags({ name: item.name, category: item.category, character_slug });
    setItem(next);
  };
  const setShortDesc = (short_description) => {
    const next = { ...item, short_description };
    if (!item.meta_description) next.meta_description = truncate(short_description, 160);
    setItem(next);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" onClick={onCancel} data-testid="product-editor">
      <div className="bg-white rounded-[24px] max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-accent text-2xl font-bold">{item.slug ? "Edit Product" : "New Product"}</h3>
          <button onClick={onCancel}><X /></button>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Name"><input value={item.name || ""} onChange={(e) => setName(e.target.value)} className="inp" data-testid="product-edit-name" /></Field>
          <Field label="Slug (auto from name)"><input value={item.slug || ""} onChange={(e) => set("slug", slugify(e.target.value))} placeholder="my-product-name" className="inp" data-testid="product-edit-slug" /></Field>
          <Field label="Category"><select value={item.category} onChange={(e) => setCategory(e.target.value)} className="inp">{cats.map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Character (optional)"><select value={item.character_slug || ""} onChange={(e) => setCharacter(e.target.value)} className="inp"><option value="">None</option>{chars.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select></Field>
          <Field label="Price (USD)"><input type="number" inputMode="decimal" step="0.01" min="0" value={item.price === 0 || item.price == null ? "" : item.price} onChange={(e) => set("price", e.target.value === "" ? null : e.target.value)} placeholder="0.00" className="inp" data-testid="product-edit-price" /></Field>
          <Field label="Compare-at price"><input type="number" inputMode="decimal" step="0.01" min="0" value={item.compare_at_price === 0 || item.compare_at_price == null ? "" : item.compare_at_price} onChange={(e) => set("compare_at_price", e.target.value === "" ? null : parseFloat(e.target.value))} placeholder="optional" className="inp" /></Field>
          <Field label="Inventory Status"><select value={item.inventory_status} onChange={(e) => set("inventory_status", e.target.value)} className="inp">{statuses.map((s) => <option key={s}>{s}</option>)}</select></Field>
          <Field label="Buy Now URL (direct product link)"><input value={item.printify_url || ""} onChange={(e) => set("printify_url", e.target.value)} className="inp" data-testid="product-edit-buy-url" /></Field>
          <div className="sm:col-span-2">
            <ImageGalleryUploader
              label="Product images (drop files or click)"
              images={item.images && item.images.length ? item.images : (item.primary_image ? [item.primary_image] : [])}
              onChange={(urls) => setItem({ ...item, images: urls, primary_image: urls[0] || "", og_image: item.og_image || urls[0] || "" })}
              testid="product-images"
            />
          </div>
          <Field label="Short Description" full><input value={item.short_description || ""} onChange={(e) => setShortDesc(e.target.value)} className="inp" /></Field>
          <Field label="Long Description" full><textarea value={item.long_description || ""} onChange={(e) => set("long_description", e.target.value)} className="inp min-h-[100px]" rows={4} /></Field>
          <Field label="Tags" full>
            <TagsInput value={item.tags || []} onChange={(tags) => set("tags", tags)} testid="product-edit-tags" />
          </Field>

          {/* Variants */}
          <div className="sm:col-span-2 mt-2 bg-[#eef9fb] rounded-2xl p-4 border-2 border-[#dff3f6]" data-testid="product-variants-section">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="font-accent font-bold text-[#3a4a55]">Variants (optional)</div>
                <p className="text-xs text-[#6b7280]">Sizes, colors, bundles — each gets its own Buy URL on the product page.</p>
              </div>
              <button
                type="button"
                onClick={() => set("variants", [...(item.variants || []), { label: "", sku: "", printify_url: "", price: null }])}
                className="btn-ghost text-xs"
                data-testid="variant-add"
              ><Plus className="w-4 h-4" />Add variant</button>
            </div>
            {(item.variants || []).length === 0 ? (
              <p className="text-xs text-[#6b7280] italic">No variants — buyers will use the main Buy Now URL above.</p>
            ) : (
              <div className="space-y-2">
                {(item.variants || []).map((v, idx) => (
                  <div key={idx} className="bg-white rounded-2xl border border-[#dff3f6] p-3 grid sm:grid-cols-[1fr_1fr_2fr_100px_36px] gap-2 items-center" data-testid={`variant-row-${idx}`}>
                    <input
                      value={v.label || ""}
                      onChange={(e) => {
                        const next = [...item.variants]; next[idx] = { ...next[idx], label: e.target.value }; set("variants", next);
                      }}
                      placeholder="Label (e.g. Small / Blue)"
                      className="inp"
                      data-testid={`variant-label-${idx}`}
                    />
                    <input
                      value={v.sku || ""}
                      onChange={(e) => { const next = [...item.variants]; next[idx] = { ...next[idx], sku: e.target.value }; set("variants", next); }}
                      placeholder="SKU (optional)"
                      className="inp"
                      data-testid={`variant-sku-${idx}`}
                    />
                    <input
                      value={v.printify_url || ""}
                      onChange={(e) => { const next = [...item.variants]; next[idx] = { ...next[idx], printify_url: e.target.value }; set("variants", next); }}
                      placeholder="Buy URL for this variant"
                      className="inp"
                      data-testid={`variant-url-${idx}`}
                    />
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      value={v.price == null || v.price === "" ? "" : v.price}
                      onChange={(e) => {
                        const next = [...item.variants];
                        next[idx] = { ...next[idx], price: e.target.value === "" ? null : parseFloat(e.target.value) };
                        set("variants", next);
                      }}
                      placeholder="$"
                      className="inp"
                      data-testid={`variant-price-${idx}`}
                    />
                    <button
                      type="button"
                      onClick={() => set("variants", item.variants.filter((_, i) => i !== idx))}
                      className="p-2 rounded-full text-red-500 hover:bg-red-50 justify-self-center"
                      title="Remove variant"
                      data-testid={`variant-remove-${idx}`}
                    ><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SEO + Sharing */}
          <div className="sm:col-span-2 mt-4 bg-[#fffbf3] rounded-2xl p-4 border-2 border-[#f4e4c6]">
            <div className="font-accent font-bold text-[#3a4a55] mb-2">SEO & sharing (search engines + social cards)</div>
            <p className="text-xs text-[#6b7280] mb-3">All optional — we'll auto-fill from name + short description if you leave them blank.</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="SEO title"><input value={item.seo_title || ""} onChange={(e) => set("seo_title", e.target.value)} placeholder={item.name || "Page title"} className="inp" data-testid="product-edit-seo-title" /></Field>
              <Field label="Meta description (≤160 chars)"><input value={item.meta_description || ""} maxLength={160} onChange={(e) => set("meta_description", e.target.value)} placeholder={truncate(item.short_description || "", 160)} className="inp" data-testid="product-edit-meta-desc" /></Field>
              <div className="sm:col-span-2">
                <ImageUploader label="Sharing image (1200×630 ideal — shows on Facebook, iMessage, X)" value={item.og_image || item.primary_image || ""} onChange={(u) => set("og_image", u)} testid="product-edit-og-image" />
              </div>
            </div>
          </div>

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

const CATEGORY_META = {
  "Stuffies": { color: "#7fcfc7", emoji: "🧸" },
  "Apparel": { color: "#f0a988", emoji: "👕" },
  "Books": { color: "#b8a3d9", emoji: "📚" },
  "Accessories": { color: "#fdd47e", emoji: "🎒" },
  "Stationery": { color: "#e89bab", emoji: "✏️" },
  "Other": { color: "#9aa3ab", emoji: "📦" },
};

function ProductsBrowser({ items, onNew, onEdit, onDelete, onToggleFeatured }) {
  const [category, setCategory] = useState(null); // null = category grid, "All" = all products
  const [query, setQuery] = useState("");

  const categories = useMemo(() => {
    const map = new Map();
    for (const p of items) {
      const c = p.category || "Other";
      if (!map.has(c)) map.set(c, []);
      map.get(c).push(p);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [items]);

  // Category landing
  if (category === null) {
    return (
      <>
        <header className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="font-accent text-3xl font-bold">Products</h1>
            <p className="text-[#6b7280]">{items.length} item{items.length === 1 ? "" : "s"} in {categories.length} categor{categories.length === 1 ? "y" : "ies"}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setCategory("All")} className="btn-ghost" data-testid="cat-show-all">View all</button>
            <button onClick={onNew} className="btn-primary" data-testid="product-new"><Plus className="w-5 h-5" />New Product</button>
          </div>
        </header>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="categories-grid">
          {categories.map(([cat, list]) => {
            const meta = CATEGORY_META[cat] || CATEGORY_META.Other;
            const featuredCount = list.filter((p) => p.featured).length;
            return (
              <button key={cat} onClick={() => setCategory(cat)} className="card-soft p-5 text-left hover:scale-[1.02] transition" data-testid={`cat-card-${cat}`}>
                <div className="flex items-start gap-3">
                  <div className="w-14 h-14 rounded-2xl grid place-items-center text-3xl shrink-0" style={{ background: `${meta.color}33` }}>{meta.emoji}</div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-accent text-xl font-bold truncate">{cat}</h3>
                    <p className="text-sm text-[#5a6b76]">{list.length} item{list.length === 1 ? "" : "s"}{featuredCount ? ` · ${featuredCount} featured` : ""}</p>
                  </div>
                </div>
                {/* mini product preview */}
                <div className="flex gap-1.5 mt-3 -mx-1 overflow-hidden">
                  {list.slice(0, 5).map((p) => (
                    <div key={p.slug} className="w-10 h-10 rounded-lg bg-[#fffbf3] border border-[#f4e4c6] overflow-hidden shrink-0">
                      {p.primary_image && <img src={p.primary_image} alt="" className="w-full h-full object-contain" />}
                    </div>
                  ))}
                  {list.length > 5 && <div className="w-10 h-10 rounded-lg grid place-items-center bg-[#eef9fb] text-xs font-bold text-[#5a8a6f]">+{list.length - 5}</div>}
                </div>
              </button>
            );
          })}
          {/* + Add category quick action via New Product */}
          <button onClick={onNew} className="rounded-3xl border-2 border-dashed border-[#f4e4c6] hover:border-[#7fcfc7] hover:bg-[#eef9fb] p-5 grid place-items-center text-[#5a6b76] hover:text-[#5a8a6f] min-h-[140px] transition" data-testid="cat-add-product">
            <div className="text-center">
              <Plus className="w-8 h-8 mx-auto mb-1" />
              <div className="font-accent font-bold text-sm">Add a product</div>
              <div className="text-xs text-[#9aa3ab] mt-0.5">Type a new category to start one</div>
            </div>
          </button>
        </div>
      </>
    );
  }

  // Category detail view (cards inside the selected category)
  const filtered = items.filter((p) => {
    if (category !== "All" && (p.category || "Other") !== category) return false;
    if (query.trim() && !`${p.name} ${p.slug} ${p.character_slug || ""}`.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });
  const meta = CATEGORY_META[category] || CATEGORY_META.Other;

  return (
    <>
      <button onClick={() => { setCategory(null); setQuery(""); }} className="btn-ghost text-sm mb-4" data-testid="cat-back"><ChevronLeft className="w-4 h-4" />All categories</button>
      <header className="flex items-end justify-between mb-6 gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-12 rounded-2xl grid place-items-center text-2xl shrink-0" style={{ background: `${meta.color}33` }}>{meta.emoji}</div>
          <div className="min-w-0">
            <h1 className="font-accent text-3xl font-bold truncate">{category}</h1>
            <p className="text-[#6b7280] text-sm">{filtered.length} of {items.filter((p) => category === "All" || (p.category || "Other") === category).length} item{filtered.length === 1 ? "" : "s"}</p>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa3ab]" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search this category…" className="pl-9 pr-3 py-2 text-sm rounded-full border-2 border-[#f4e4c6] focus:border-[#7fcfc7] outline-none w-56" data-testid="cat-search" />
          </div>
          <button onClick={onNew} className="btn-primary" data-testid="product-new"><Plus className="w-5 h-5" />New</button>
        </div>
      </header>
      {filtered.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-3xl border-2 border-dashed border-[#f4e4c6]"><p className="text-[#6b7280]">No products{query ? ` matching “${query}”` : ""} yet.</p><button onClick={onNew} className="btn-primary mt-3" data-testid="empty-new"><Plus className="w-4 h-4" />Add a product</button></div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((p) => (
            <div key={p.slug} className="card-soft p-3 flex flex-col" data-testid={`product-card-${p.slug}`}>
              <div className="aspect-square rounded-2xl bg-[#fffbf3] overflow-hidden mb-3 relative">
                {p.primary_image
                  ? <img src={p.primary_image} alt={p.name} className="w-full h-full object-contain" />
                  : <div className="w-full h-full grid place-items-center text-[#9aa3ab] text-xs">No image</div>}
                <button onClick={() => onToggleFeatured(p)} className={`absolute top-2 right-2 p-1.5 rounded-full backdrop-blur ${p.featured ? "bg-yellow-100 text-yellow-600" : "bg-white/80 text-[#9aa3ab] hover:text-yellow-500"}`} title={p.featured ? "Featured" : "Mark featured"} data-testid={`featured-${p.slug}`}>
                  <Star className="w-4 h-4" fill={p.featured ? "currentColor" : "none"} />
                </button>
                {!p.published && <span className="absolute top-2 left-2 bg-white/90 px-2 py-0.5 rounded-full text-[10px] font-bold text-[#5a6b76]">Draft</span>}
              </div>
              <h3 className="font-accent font-bold text-[#2e3a3a] truncate" title={p.name}>{p.name}</h3>
              <p className="text-xs text-[#6b7280] truncate">{p.character_slug ? `with ${p.character_slug}` : `/${p.slug}`}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="font-accent text-lg font-bold text-[#5a8a6f]">${(p.price || 0).toFixed(2)}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#7cbf94]">{p.inventory_status}</span>
              </div>
              <div className="flex gap-2 mt-3 pt-3 border-t border-[#f4e4c6]">
                <button onClick={() => onEdit(p)} className="btn-secondary text-xs flex-1 justify-center" data-testid={`product-edit-${p.slug}`}><Pencil className="w-3.5 h-3.5" />Edit</button>
                <button onClick={() => onDelete(p.slug)} className="p-2 rounded-full hover:bg-red-50 text-red-500" data-testid={`product-delete-${p.slug}`} title="Delete"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

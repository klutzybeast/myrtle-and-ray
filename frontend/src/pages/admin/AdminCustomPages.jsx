import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ExternalLink, Eye, EyeOff } from "lucide-react";

export default function AdminCustomPages() {
  const [items, setItems] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");

  const load = () => api.get("/admin/custom-pages").then(({ data }) => setItems(data));
  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post("/admin/custom-pages", { title, slug, blocks: [], published: true });
      toast.success("Page created");
      setShowNew(false); setTitle(""); setSlug("");
      window.location.href = `/admin/custom-pages/${data.slug}`;
    } catch (err) { toast.error(err.response?.data?.detail || "Create failed"); }
  };

  const remove = async (s) => {
    if (!window.confirm(`Delete page "${s}" permanently?`)) return;
    await api.delete(`/admin/custom-pages/${s}`);
    toast.success("Deleted");
    load();
  };

  const togglePublish = async (p) => {
    await api.put(`/admin/custom-pages/${p.slug}`, { published: !p.published });
    toast.success(p.published ? "Unpublished" : "Published");
    load();
  };

  return (
    <div data-testid="admin-custom-pages">
      <header className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-accent text-3xl font-bold">Custom Pages</h1>
          <p className="text-[#5a6b76]">Build any page with drag-and-drop blocks. Galleries, photos, social posts, anything.</p>
        </div>
        <button onClick={() => setShowNew(true)} className="btn-primary" data-testid="custom-page-new"><Plus className="w-5 h-5" />New Page</button>
      </header>

      {items.length === 0 ? (
        <div className="card-soft p-10 text-center text-[#5a6b76]">No custom pages yet. Tap "New Page" to build one.</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((p) => (
            <div key={p.slug} className="card-soft p-5" data-testid={`custom-page-row-${p.slug}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-accent text-lg font-bold truncate">{p.title}</h3>
                  <div className="text-xs text-[#5a6b76]">/p/{p.slug}</div>
                </div>
                <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full ${p.published ? "bg-[#b8e0c2] text-[#5a8a6f]" : "bg-[#f4e4c6] text-[#8b6f4d]"}`}>{p.published ? "Live" : "Draft"}</span>
              </div>
              <div className="text-xs text-[#5a6b76] mt-2">{(p.blocks || []).length} block{(p.blocks || []).length === 1 ? "" : "s"}</div>
              <div className="flex flex-wrap gap-1 mt-3">
                <Link to={`/admin/custom-pages/${p.slug}`} className="btn-ghost text-xs" data-testid={`custom-page-edit-${p.slug}`}><Pencil className="w-3 h-3" />Edit</Link>
                <a href={`/p/${p.slug}`} target="_blank" rel="noopener noreferrer" className="btn-ghost text-xs"><ExternalLink className="w-3 h-3" />View</a>
                <button onClick={() => togglePublish(p)} className="btn-ghost text-xs">{p.published ? <><EyeOff className="w-3 h-3" />Unpublish</> : <><Eye className="w-3 h-3" />Publish</>}</button>
                <button onClick={() => remove(p.slug)} className="btn-ghost text-xs text-red-500" data-testid={`custom-page-delete-${p.slug}`}><Trash2 className="w-3 h-3" />Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showNew && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setShowNew(false)}>
          <form onSubmit={create} className="bg-white rounded-[24px] max-w-md w-full p-6" onClick={(e) => e.stopPropagation()} data-testid="custom-page-new-form">
            <h3 className="font-accent text-2xl font-bold mb-4">New Page</h3>
            <div className="space-y-3">
              <input required placeholder="Page title (e.g. Kids with Books)" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-4 py-3 rounded-full border-2 border-[#f4e4c6] focus:outline-none focus:border-[#7fcfc7]" data-testid="custom-page-new-title" />
              <input placeholder="URL slug (optional)" value={slug} onChange={(e) => setSlug(e.target.value)} className="w-full px-4 py-3 rounded-full border-2 border-[#f4e4c6] focus:outline-none focus:border-[#7fcfc7]" />
              <p className="text-xs text-[#5a6b76]">Slug becomes /p/your-slug. We'll auto-generate one if you leave it blank.</p>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button type="button" onClick={() => setShowNew(false)} className="btn-ghost">Cancel</button>
              <button className="btn-primary" data-testid="custom-page-new-create">Create</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

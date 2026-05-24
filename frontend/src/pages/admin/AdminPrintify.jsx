import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { toast } from "sonner";
import { RefreshCw, Star, EyeOff, Eye, ExternalLink, Link as LinkIcon } from "lucide-react";

export default function AdminPrintify() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [editing, setEditing] = useState({}); // id -> draft etsy_url

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/printify/admin/products");
      setProducts(data || []);
      const drafts = {};
      (data || []).forEach((p) => { drafts[p.id] = p.etsy_url || ""; });
      setEditing(drafts);
    } catch (e) {
      toast.error("Could not load Printify products. Did you click Sync?");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const sync = async () => {
    setSyncing(true);
    try {
      const { data } = await api.post("/printify/sync");
      toast.success(`Synced ${data.synced} product${data.synced === 1 ? "" : "s"} from Printify`);
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Sync failed — check PRINTIFY_API_KEY in .env");
    } finally {
      setSyncing(false);
    }
  };

  const patch = async (id, body, optimisticKey) => {
    if (optimisticKey) {
      setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, [optimisticKey]: body[optimisticKey] } : p)));
    }
    try {
      await api.patch(`/printify/admin/products/${id}`, body);
    } catch (e) {
      toast.error("Update failed");
      await load();
    }
  };

  const saveEtsyUrl = async (id) => {
    const url = (editing[id] || "").trim();
    try {
      await api.patch(`/printify/admin/products/${id}`, { etsy_url: url });
      toast.success(url ? "Etsy URL saved" : "Etsy URL cleared");
      setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, etsy_url: url } : p)));
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Invalid URL — must start with http(s)://");
      // Roll back the input to the last saved value
      setEditing((prev) => ({ ...prev, [id]: products.find((p) => p.id === id)?.etsy_url || "" }));
    }
  };

  return (
    <div className="space-y-4" data-testid="admin-printify-page">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-accent text-3xl font-bold text-[#2e3a3a]">Printify Shop Sync</h1>
          <p className="text-sm text-[#5a6b76]">Pull every product from your connected Printify shop. Star to feature, hide to remove from the storefront, paste an Etsy URL to send buyers there instead of the pop-up store.</p>
        </div>
        <button onClick={sync} disabled={syncing} className="btn-primary flex items-center gap-2" data-testid="printify-sync-btn">
          <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing…" : "Sync from Printify"}
        </button>
      </header>

      {loading ? (
        <div className="text-center text-[#5a6b76] py-12">Loading…</div>
      ) : products.length === 0 ? (
        <div className="text-center bg-white border-2 border-dashed border-[#f4e4c6] rounded-3xl py-12 px-6">
          <p className="font-accent text-xl text-[#3a4a55]">No Printify products yet</p>
          <p className="text-sm text-[#5a6b76] mt-1">Click <span className="font-bold">Sync from Printify</span> to pull everything from shop {process.env.NODE_ENV === "development" ? "27540836" : "your store"}.</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border-2 border-[#f4e4c6] divide-y divide-[#f4e4c6]" data-testid="printify-product-list">
          {products.map((p) => (
            <div key={p.id} className={`p-4 flex flex-wrap items-start gap-4 ${p.hidden ? "opacity-50" : ""}`} data-testid={`printify-row-${p.id}`}>
              <div className="w-20 h-20 rounded-xl bg-[#eef9fb] grid place-items-center overflow-hidden shrink-0">
                {p.image_url
                  ? <img src={p.image_url} alt={p.title} className="w-full h-full object-cover" loading="lazy" />
                  : <span className="text-xs text-[#5a6b76]">no image</span>}
              </div>
              <div className="flex-1 min-w-[260px]">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-accent text-lg font-bold text-[#2e3a3a]">{p.title}</h3>
                  {p.featured && <span className="text-xs bg-[#fcd5b4] text-[#8b6f4d] px-2 py-0.5 rounded-full font-bold">★ Featured</span>}
                  {p.hidden && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">Hidden</span>}
                </div>
                <p className="text-xs text-[#6b7280] mt-0.5">
                  ${(p.min_price || 0).toFixed(2)}{p.max_price && p.max_price !== p.min_price ? ` – $${p.max_price.toFixed(2)}` : ""}
                  {" · "}<span className="font-mono">id={p.id.slice(0, 12)}…</span>
                </p>
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <LinkIcon className="w-3 h-3 text-[#5a6b76]" />
                  <input
                    type="url"
                    value={editing[p.id] ?? ""}
                    onChange={(e) => setEditing((prev) => ({ ...prev, [p.id]: e.target.value }))}
                    onBlur={() => saveEtsyUrl(p.id)}
                    placeholder="Paste Etsy listing URL (optional)…"
                    className="flex-1 min-w-[240px] text-xs px-3 py-2 rounded-full bg-[#fffbf3] border border-[#f4e4c6] focus:outline-none focus:border-[#7fcfc7]"
                    data-testid={`printify-etsy-${p.id}`}
                  />
                  {p.etsy_url && (
                    <a href={p.etsy_url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#5a8a6f] underline flex items-center gap-1" data-testid={`printify-etsy-link-${p.id}`}>
                      open <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                <button
                  onClick={() => patch(p.id, { featured: !p.featured }, "featured")}
                  className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${p.featured ? "bg-[#fcd5b4] text-[#8b6f4d]" : "bg-white border border-[#f4e4c6] text-[#5a6b76]"}`}
                  data-testid={`printify-feature-${p.id}`}
                  title="Feature on the storefront"
                >
                  <Star className={`w-3 h-3 ${p.featured ? "fill-[#f0a988]" : ""}`} />
                  {p.featured ? "Featured" : "Feature"}
                </button>
                <button
                  onClick={() => patch(p.id, { hidden: !p.hidden }, "hidden")}
                  className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${p.hidden ? "bg-red-100 text-red-700" : "bg-white border border-[#f4e4c6] text-[#5a6b76]"}`}
                  data-testid={`printify-hide-${p.id}`}
                  title="Hide from the storefront"
                >
                  {p.hidden ? <><EyeOff className="w-3 h-3" /> Hidden</> : <><Eye className="w-3 h-3" /> Visible</>}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

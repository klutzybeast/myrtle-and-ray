import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import { toast } from "sonner";
import { Download, Trash2, Wand2, Search, Package, RefreshCw } from "lucide-react";
import AIThumbnailButton from "../../components/admin/AIThumbnailButton";
import { characterFirstName } from "../../lib/characterName";

const KIND_LABELS = {
  product: "Product",
  activity: "Activity",
  download: "Download",
  download_category: "Category",
  custom_page: "Custom Page",
  character: "Character",
  general: "General",
};

export default function AdminThumbnails() {
  const [thumbs, setThumbs] = useState([]);
  const [total, setTotal] = useState(0);
  const [filterKind, setFilterKind] = useState("all");
  const [filterCharacter, setFilterCharacter] = useState("all");
  const [characters, setCharacters] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [health, setHealth] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      // Auto-backfill on first empty load — guarantees the library
      // surfaces every existing AI image and upload, not just newly
      // generated ones. Safe + idempotent (skips already-present rows).
      try {
        const { data: pre } = await api.get("/admin/thumbnails?limit=1");
        if (!pre.total || pre.total === 0) {
          await api.post("/admin/thumbnails/backfill");
        }
      } catch {/* non-fatal */}
      // Health check — surface clear banner if AI gen is broken upstream.
      try {
        const { data: h } = await api.get("/admin/thumbnails/health");
        setHealth(h);
      } catch {/* non-fatal */}
      const params = new URLSearchParams();
      if (filterKind !== "all") params.set("kind", filterKind);
      if (filterCharacter !== "all") params.set("character", filterCharacter);
      params.set("limit", "200");
      const { data } = await api.get(`/admin/thumbnails?${params.toString()}`);
      setThumbs(data.thumbnails || []);
      setTotal(data.total || 0);
    } catch {
      toast.error("Failed to load thumbnails");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filterKind, filterCharacter]);
  useEffect(() => { api.get("/characters").then(({ data }) => setCharacters(data || [])).catch(() => {}); }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return thumbs;
    const q = search.toLowerCase();
    return thumbs.filter((t) =>
      (t.title || "").toLowerCase().includes(q) ||
      (t.scene_prompt || "").toLowerCase().includes(q) ||
      (t.character_slugs || []).join(" ").toLowerCase().includes(q)
    );
  }, [thumbs, search]);

  const downloadOne = async (t) => {
    // Force a real download (not a tab-open) by fetching the binary with
    // the admin token and saving via a blob URL. This bypasses the
    // browser's "ignore download attr for cross-origin" behaviour and
    // also works for files served from persistent object storage.
    try {
      const base = process.env.REACT_APP_BACKEND_URL || "";
      const token = localStorage.getItem("mr_admin_token") || "";
      const resp = await fetch(`${base}/api/admin/thumbnails/${t.id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      const dlUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = dlUrl;
      link.download = t.filename || "thumbnail.png";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(dlUrl), 1000);
    } catch (err) {
      toast.error("Download failed");
    }
  };

  const downloadZip = async () => {
    try {
      const params = new URLSearchParams();
      if (filterKind !== "all") params.set("kind", filterKind);
      if (filterCharacter !== "all") params.set("character", filterCharacter);
      const base = process.env.REACT_APP_BACKEND_URL || "";
      const url = `${base}/api/admin/thumbnails/zip?${params.toString()}`;
      // Trigger download via auth-protected fetch
      const token = localStorage.getItem("mr_admin_token") || "";
      const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      const dlUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = dlUrl;
      link.download = `thumbnails-${new Date().toISOString().slice(0, 10)}.zip`;
      link.click();
      URL.revokeObjectURL(dlUrl);
      toast.success(`Downloaded ${filtered.length} thumbnails`);
    } catch (err) {
      toast.error("Zip download failed");
    }
  };

  const deleteOne = async (id) => {
    if (!window.confirm("Delete this thumbnail? This can't be undone.")) return;
    try {
      await api.delete(`/admin/thumbnails/${id}`);
      setThumbs((prev) => prev.filter((t) => t.id !== id));
      toast.success("Deleted");
    } catch {
      toast.error("Delete failed");
    }
  };

  return (
    <div className="space-y-4" data-testid="admin-thumbnails-page">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-accent text-3xl font-bold text-[#2e3a3a]">Thumbnails Library</h1>
          <p className="text-sm text-[#5a6b76]">Every AI thumbnail ever generated, in one place. Filter, preview, download high-res PNG, or grab them all as a zip.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={async () => {
              if (!window.confirm("Scan sing-along covers, character portraits, coloring pages, story quest art, and product images and import them all into your library? Existing entries are skipped.")) return;
              try {
                const { data } = await api.post("/admin/thumbnails/backfill");
                toast.success(`Imported ${data.inserted} new (skipped ${data.already_in_library} already present)`);
                load();
              } catch {
                toast.error("Backfill failed");
              }
            }}
            className="btn-secondary text-sm"
            data-testid="thumb-backfill-btn"
          >
            <RefreshCw className="w-4 h-4" /> Import existing
          </button>
          <AIThumbnailButton
            kind="general"
            buttonClassName="btn-primary"
            label="New thumbnail"
            onChosen={() => load()}
          />
        </div>
      </header>

      {health && (!health.ai_key_configured || (health.storage_enabled && !health.storage_working) || !health.thumbs_dir_writable) && (
        <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-3 text-sm" data-testid="thumb-health-banner">
          <div className="font-bold text-red-800 mb-1">⚠️ AI thumbnail system is unhealthy</div>
          <ul className="text-red-700 space-y-0.5 ml-5 list-disc">
            {!health.ai_key_configured && <li><b>EMERGENT_LLM_KEY not set</b> — generation will fail. Add the key in Profile → Universal Key, or contact Emergent Support.</li>}
            {health.storage_enabled && !health.storage_working && <li><b>Persistent storage is configured but failing</b> — images may not survive deploys. Contact Emergent Support.</li>}
            {!health.thumbs_dir_writable && <li><b>Upload directory is not writable</b> ({health.upload_dir}) — generation cannot save files. Contact Emergent Support.</li>}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-center bg-white border-2 border-[#f4e4c6] rounded-2xl p-3">
        <Search className="w-4 h-4 text-[#5a6b76]" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title or prompt…"
          className="flex-1 min-w-[200px] bg-transparent outline-none text-sm"
          data-testid="thumb-search"
        />
        <select value={filterKind} onChange={(e) => setFilterKind(e.target.value)} className="text-xs px-3 py-1.5 rounded-full bg-[#fffbf3] border border-[#f4e4c6]" data-testid="thumb-filter-kind">
          <option value="all">All kinds</option>
          {Object.entries(KIND_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <select value={filterCharacter} onChange={(e) => setFilterCharacter(e.target.value)} className="text-xs px-3 py-1.5 rounded-full bg-[#fffbf3] border border-[#f4e4c6]" data-testid="thumb-filter-character">
          <option value="all">All characters</option>
          {characters.map((c) => <option key={c.slug} value={c.slug}>{characterFirstName(c.name)}</option>)}
        </select>
        <button onClick={downloadZip} disabled={!filtered.length} className="btn-secondary text-xs disabled:opacity-50" data-testid="thumb-download-zip">
          <Package className="w-3 h-3" /> Download {filtered.length} as zip
        </button>
      </div>

      {loading ? (
        <div className="text-center text-[#5a6b76] py-12">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center bg-white border-2 border-dashed border-[#f4e4c6] rounded-3xl py-12 px-6">
          <Wand2 className="w-8 h-8 mx-auto text-[#7fcfc7] mb-2" />
          <p className="font-accent text-xl text-[#3a4a55]">No thumbnails yet</p>
          <p className="text-sm text-[#5a6b76] mt-1">Click <span className="font-bold">New thumbnail</span> above, or use the AI button on any product/activity/character edit screen.</p>
          <div className="text-xs text-[#5a6b76] mt-3">Library total: {total}</div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3" data-testid="thumb-grid">
          {filtered.map((t) => (
            <div key={t.id} className="bg-white rounded-2xl border-2 border-[#f4e4c6] overflow-hidden group" data-testid={`thumb-card-${t.id}`}>
              <div className="aspect-square bg-[#eef9fb] overflow-hidden relative">
                <img
                  src={`${process.env.REACT_APP_BACKEND_URL || ""}${t.url}`}
                  alt={t.title || t.scene_prompt}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-white/85 text-[10px] font-bold text-[#3a4a55] uppercase tracking-wider">{KIND_LABELS[t.kind] || t.kind}</div>
              </div>
              <div className="p-3 space-y-1">
                {t.title && <div className="text-sm font-bold text-[#2e3a3a] line-clamp-1">{t.title}</div>}
                <p className="text-xs text-[#5a6b76] line-clamp-2">{t.scene_prompt}</p>
                {(t.character_slugs || []).length > 0 && (
                  <div className="text-[10px] text-[#5a8a6f]">{(t.character_slugs || []).join(", ")}</div>
                )}
                <div className="flex gap-1 pt-1">
                  <button onClick={() => downloadOne(t)} className="btn-ghost text-xs flex-1 justify-center" data-testid={`thumb-dl-${t.id}`}>
                    <Download className="w-3 h-3" /> PNG
                  </button>
                  <button onClick={() => deleteOne(t.id)} className="text-xs px-2 py-1.5 rounded-full text-red-700 hover:bg-red-50" data-testid={`thumb-del-${t.id}`}>
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

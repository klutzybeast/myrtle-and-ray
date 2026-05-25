import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import { toast } from "sonner";
import { Download, Trash2, Wand2, Search, Package, RefreshCw, EyeOff, Eye, Scissors } from "lucide-react";
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
  const [showHidden, setShowHidden] = useState(false);
  const [hiddenCount, setHiddenCount] = useState(0);

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
      if (showHidden) params.set("show_hidden", "true");
      params.set("limit", "200");
      const { data } = await api.get(`/admin/thumbnails?${params.toString()}`);
      setThumbs(data.thumbnails || []);
      setTotal(data.total || 0);
      setHiddenCount(data.hidden || 0);
    } catch {
      toast.error("Failed to load thumbnails");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filterKind, filterCharacter, showHidden]);
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
    // Use the shared axios client so the Authorization header is set
    // identically to every other admin call. Asking for `blob` makes
    // axios resolve to the binary file directly.
    try {
      const { data } = await api.get(`/admin/thumbnails/${t.id}/download`, {
        responseType: "blob",
      });
      const dlUrl = URL.createObjectURL(data);
      const link = document.createElement("a");
      link.href = dlUrl;
      link.download = t.filename || "thumbnail.png";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(dlUrl), 1000);
    } catch (err) {
      toast.error(err.response?.status === 401 ? "Session expired — please sign in again." : "Download failed");
    }
  };

  const downloadZip = async () => {
    try {
      const params = new URLSearchParams();
      if (filterKind !== "all") params.set("kind", filterKind);
      if (filterCharacter !== "all") params.set("character", filterCharacter);
      const { data } = await api.get(`/admin/thumbnails/zip?${params.toString()}`, {
        responseType: "blob",
      });
      const dlUrl = URL.createObjectURL(data);
      const link = document.createElement("a");
      link.href = dlUrl;
      link.download = `thumbnails-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(dlUrl), 1000);
      toast.success(`Downloaded ${filtered.length} thumbnails`);
    } catch (err) {
      toast.error(err.response?.status === 401 ? "Session expired — please sign in again." : "Zip download failed");
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

  const hideOne = async (id) => {
    try {
      await api.post(`/admin/thumbnails/${id}/hide`);
      toast.success("Hidden from library");
      load();
    } catch { toast.error("Hide failed"); }
  };

  const unhideOne = async (id) => {
    try {
      await api.post(`/admin/thumbnails/${id}/unhide`);
      toast.success("Restored");
      load();
    } catch { toast.error("Restore failed"); }
  };

  const dedupeCharacters = async () => {
    if (!window.confirm("For every Sea Star with multiple AI portraits, keep only the newest and hide the older ones. Nothing is deleted — you can restore any hidden image later. Continue?")) return;
    try {
      const { data } = await api.post("/admin/thumbnails/dedupe-characters");
      toast.success(`Hid ${data.hidden} older character versions`);
      load();
    } catch { toast.error("Dedupe failed"); }
  };

  const purgeNonAi = async () => {
    if (!window.confirm("PERMANENTLY DELETE every thumbnail entry that wasn't AI-generated (product mockups, manually uploaded photos, external images). The actual files in your Media Library and Products admin are NOT touched — only the duplicate entries in the AI Thumbnails library. Continue?")) return;
    try {
      const { data } = await api.post("/admin/thumbnails/purge-non-ai");
      toast.success(`Removed ${data.removed} non-AI entries`);
      load();
    } catch { toast.error("Cleanup failed"); }
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
            onClick={purgeNonAi}
            className="text-sm inline-flex items-center gap-1.5 px-4 py-2 rounded-full border-2 bg-red-50 border-red-300 text-red-700 hover:bg-red-100 font-bold"
            title="Permanently remove every non-AI entry (uploaded product photos, etc.)"
            data-testid="thumb-purge-non-ai"
          >
            <Trash2 className="w-4 h-4" /> Remove uploaded photos
          </button>
          <button
            onClick={dedupeCharacters}
            className="btn-secondary text-sm"
            title="Hide older AI portraits of each Sea Star — keeps only the newest"
            data-testid="thumb-dedupe-btn"
          >
            <Scissors className="w-4 h-4" /> Dedupe characters
          </button>
          <button
            onClick={() => setShowHidden((v) => !v)}
            className={`text-sm inline-flex items-center gap-1.5 px-4 py-2 rounded-full border-2 font-bold ${showHidden ? "bg-[#fff4d6] border-[#f0a988] text-[#a36b29]" : "bg-white border-[#f4e4c6] text-[#5a6b76]"}`}
            data-testid="thumb-show-hidden"
          >
            {showHidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            {showHidden ? `Hiding (${hiddenCount})` : `Show hidden${hiddenCount ? ` (${hiddenCount})` : ""}`}
          </button>
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
                {t.hidden && (
                  <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-[#a36b29] text-[10px] font-bold text-white uppercase tracking-wider">Hidden</div>
                )}
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
                  {t.hidden ? (
                    <button onClick={() => unhideOne(t.id)} title="Restore to library" className="text-xs px-2 py-1.5 rounded-full text-[#236f6b] hover:bg-[#eef9fb]" data-testid={`thumb-unhide-${t.id}`}>
                      <Eye className="w-3 h-3" />
                    </button>
                  ) : (
                    <button onClick={() => hideOne(t.id)} title="Hide from library (reversible)" className="text-xs px-2 py-1.5 rounded-full text-[#a36b29] hover:bg-[#fff4d6]" data-testid={`thumb-hide-${t.id}`}>
                      <EyeOff className="w-3 h-3" />
                    </button>
                  )}
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

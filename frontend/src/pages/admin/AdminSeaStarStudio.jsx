import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { Wand2, Trash2, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";

function absUrl(p) {
  if (!p) return "";
  return p.startsWith("http") ? p : `${process.env.REACT_APP_BACKEND_URL}${p}`;
}

export default function AdminSeaStarStudio() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [today, setToday] = useState(0);
  const [search, setSearch] = useState("");
  const [character, setCharacter] = useState("");
  const [chars, setChars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (character) params.set("character", character);
      const { data } = await api.get(`/admin/sea-star-studio/keepsakes?${params.toString()}`);
      setRows(data.keepsakes || []); setTotal(data.total || 0); setToday(data.today || 0);
    } catch { toast.error("Failed to load keepsakes"); }
    setLoading(false);
  };

  useEffect(() => {
    api.get("/admin/sea-star-studio/settings").then(({ data }) => setSettings(data)).catch(() => {});
    api.get("/characters").then(({ data }) => setChars(data || [])).catch(() => {});
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(refresh, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, character]);

  const del = async (id) => {
    if (!window.confirm("Hide this keepsake from the kid's history? It stays in the DB for safety review.")) return;
    try { await api.delete(`/admin/sea-star-studio/keepsakes/${id}`); toast.success("Hidden"); refresh(); }
    catch { toast.error("Delete failed"); }
  };

  const saveSettings = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const { data } = await api.put("/admin/sea-star-studio/settings", {
        enabled: !!settings.enabled,
        daily_cap: Number(settings.daily_cap) || 3,
        audio_enabled: !!settings.audio_enabled,
        text_model: settings.text_model || "gemini-3-flash-preview",
        image_model: settings.image_model || "gemini-3.1-flash-image-preview",
      });
      setSettings(data); toast.success("Settings saved");
    } catch { toast.error("Could not save settings"); }
    setSaving(false);
  };

  return (
    <div data-testid="admin-studio">
      <header className="mb-6">
        <h1 className="font-accent text-3xl font-bold flex items-center gap-2"><Wand2 className="w-7 h-7 text-[#5a8a6f]" /> Sea Star Studio</h1>
        <p className="text-sm text-[#6b7280] mt-1">{total} keepsakes · {today} today. Each combines a rhyme + voice + coloring page.</p>
      </header>

      {settings && (
        <section className="bg-white rounded-3xl p-5 mb-6 border border-[#f4e4c6]" data-testid="studio-settings">
          <h2 className="font-accent text-xl font-bold mb-3">Settings</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <label className="text-sm">
              <div className="font-semibold mb-1">Status</div>
              <select value={settings.enabled ? "1" : "0"} onChange={(e) => setSettings({ ...settings, enabled: e.target.value === "1" })} className="inp" data-testid="studio-setting-enabled">
                <option value="1">Enabled</option>
                <option value="0">Disabled</option>
              </select>
            </label>
            <label className="text-sm">
              <div className="font-semibold mb-1">Daily cap per visitor</div>
              <input type="number" min="1" max="20" value={settings.daily_cap} onChange={(e) => setSettings({ ...settings, daily_cap: e.target.value })} className="inp" data-testid="studio-setting-cap" />
            </label>
            <label className="text-sm">
              <div className="font-semibold mb-1">Voice replies (ElevenLabs)</div>
              <select value={settings.audio_enabled ? "1" : "0"} onChange={(e) => setSettings({ ...settings, audio_enabled: e.target.value === "1" })} className="inp" data-testid="studio-setting-audio">
                <option value="1">On</option>
                <option value="0">Off</option>
              </select>
            </label>
          </div>
          <button onClick={saveSettings} disabled={saving} className="btn-primary mt-3 inline-flex" data-testid="studio-settings-save">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save settings"}
          </button>
        </section>
      )}

      <section className="bg-white rounded-3xl p-5 mb-4 border border-[#f4e4c6]">
        <div className="flex flex-wrap gap-3">
          <label className="text-sm flex-1 min-w-[200px]">
            <div className="font-semibold mb-1 flex items-center gap-1"><Search className="w-4 h-4" /> Search</div>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find words..." className="inp" data-testid="studio-search" />
          </label>
          <label className="text-sm w-48">
            <div className="font-semibold mb-1">Character</div>
            <select value={character} onChange={(e) => setCharacter(e.target.value)} className="inp" data-testid="studio-filter-character">
              <option value="">All</option>
              {chars.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
          </label>
        </div>
      </section>

      {loading ? (
        <div className="text-[#6b7280] text-center py-12">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center text-[#6b7280]" data-testid="studio-empty">
          <Wand2 className="w-10 h-10 mx-auto mb-3 text-[#cbd5e1]" />
          <div className="font-semibold mb-1">No keepsakes yet</div>
          <div className="text-sm">When kids start writing, you'll see them here.</div>
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-3" data-testid="studio-list">
          {rows.map((k) => (
            <article key={k.id} className={`bg-white rounded-2xl p-4 border ${k.deleted ? "opacity-50 border-red-200" : "border-[#f4e4c6]"}`} data-testid={`studio-row-${k.id}`}>
              <header className="flex items-center justify-between mb-2 gap-3 flex-wrap">
                <div className="font-semibold text-[#3a4a55]">
                  To <span className="text-[#5a8a6f]">{k.character_name}</span>
                  {k.child_name && <span className="text-[#6b7280] font-normal"> · from "{k.child_name}"</span>}
                </div>
                <div className="flex items-center gap-2 text-xs text-[#6b7280]">
                  <span>{new Date(k.created_at).toLocaleString()}</span>
                  {!k.deleted && (
                    <button onClick={() => del(k.id)} className="p-1.5 rounded-full hover:bg-red-50 text-red-600" data-testid={`studio-delete-${k.id}`}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </header>
              <div className="grid sm:grid-cols-[1fr_140px] gap-3">
                <div className="space-y-2 text-sm">
                  <div className="bg-[#fafbfc] rounded-xl p-2">
                    <div className="text-xs uppercase tracking-wider text-[#6b7280]">Letter</div>
                    <p className="italic text-[#4a5568]">"{k.letter}"</p>
                  </div>
                  <div className="bg-[#fff8ec] rounded-xl p-2">
                    <div className="text-xs uppercase tracking-wider text-[#a36b29]">Reply</div>
                    <p className="whitespace-pre-line text-[#3a4a55] text-xs">{k.reply_text}</p>
                  </div>
                </div>
                {k.image_url && (
                  <a href={absUrl(k.image_url)} target="_blank" rel="noopener noreferrer">
                    <img src={absUrl(k.image_url)} alt={k.scene_prompt} className="w-full aspect-square object-contain rounded-xl bg-white border border-[#f4e4c6]" />
                  </a>
                )}
              </div>
              {k.scene_prompt && <p className="text-xs text-[#6b7280] italic mt-2">scene: "{k.scene_prompt}"</p>}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

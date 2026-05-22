import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { Mail, Trash2, Search, Power, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function AdminPenPals() {
  const [letters, setLetters] = useState([]);
  const [total, setTotal] = useState(0);
  const [today, setToday] = useState(0);
  const [search, setSearch] = useState("");
  const [character, setCharacter] = useState("");
  const [chars, setChars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (character) params.set("character", character);
      const { data } = await api.get(`/admin/pen-pals/letters?${params.toString()}`);
      setLetters(data.letters || []);
      setTotal(data.total || 0);
      setToday(data.today || 0);
    } catch {
      toast.error("Failed to load letters");
    }
    setLoading(false);
  };

  useEffect(() => {
    api.get("/admin/pen-pals/settings").then(({ data }) => setSettings(data)).catch(() => {});
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
    if (!window.confirm("Hide this letter? It stays in the database for safety but is removed from the kid's inbox.")) return;
    try {
      await api.delete(`/admin/pen-pals/letters/${id}`);
      toast.success("Letter hidden");
      refresh();
    } catch {
      toast.error("Delete failed");
    }
  };

  const saveSettings = async () => {
    if (!settings) return;
    setSavingSettings(true);
    try {
      const { data } = await api.put("/admin/pen-pals/settings", {
        enabled: !!settings.enabled,
        daily_cap: Number(settings.daily_cap) || 5,
        max_letter_chars: Number(settings.max_letter_chars) || 500,
        audio_enabled: !!settings.audio_enabled,
        model_provider: settings.model_provider || "gemini",
        model_name: settings.model_name || "gemini-3-flash-preview",
      });
      setSettings(data);
      toast.success("Settings saved");
    } catch {
      toast.error("Could not save settings");
    }
    setSavingSettings(false);
  };

  return (
    <div data-testid="admin-penpals">
      <header className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-accent text-3xl font-bold flex items-center gap-2"><Mail className="w-7 h-7 text-[#5a8a6f]" /> Wave Pal Pen Pals</h1>
          <p className="text-sm text-[#6b7280] mt-1">Kid letters and Sea Star replies. {total} total · {today} today.</p>
        </div>
      </header>

      {settings && (
        <section className="bg-white rounded-3xl p-5 mb-6 border border-[#f4e4c6]" data-testid="penpal-settings">
          <h2 className="font-accent text-xl font-bold mb-3">Settings</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <label className="text-sm">
              <div className="font-semibold mb-1 flex items-center gap-1"><Power className="w-4 h-4" /> Status</div>
              <select value={settings.enabled ? "1" : "0"} onChange={(e) => setSettings({ ...settings, enabled: e.target.value === "1" })} className="inp" data-testid="penpal-setting-enabled">
                <option value="1">Enabled</option>
                <option value="0">Disabled</option>
              </select>
            </label>
            <label className="text-sm">
              <div className="font-semibold mb-1">Daily cap per visitor</div>
              <input type="number" min="1" max="100" value={settings.daily_cap} onChange={(e) => setSettings({ ...settings, daily_cap: e.target.value })} className="inp" data-testid="penpal-setting-cap" />
            </label>
            <label className="text-sm">
              <div className="font-semibold mb-1">Max letter chars</div>
              <input type="number" min="100" max="2000" value={settings.max_letter_chars} onChange={(e) => setSettings({ ...settings, max_letter_chars: e.target.value })} className="inp" data-testid="penpal-setting-maxchars" />
            </label>
            <label className="text-sm">
              <div className="font-semibold mb-1">Voice replies (ElevenLabs)</div>
              <select value={settings.audio_enabled ? "1" : "0"} onChange={(e) => setSettings({ ...settings, audio_enabled: e.target.value === "1" })} className="inp" data-testid="penpal-setting-audio">
                <option value="1">On</option>
                <option value="0">Off</option>
              </select>
            </label>
          </div>
          <button onClick={saveSettings} disabled={savingSettings} className="btn-primary mt-3 inline-flex" data-testid="penpal-settings-save">
            {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save settings"}
          </button>
        </section>
      )}

      <section className="bg-white rounded-3xl p-5 mb-4 border border-[#f4e4c6]">
        <div className="flex flex-wrap gap-3">
          <label className="text-sm flex-1 min-w-[200px]">
            <div className="font-semibold mb-1 flex items-center gap-1"><Search className="w-4 h-4" /> Search letters & replies</div>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find words..." className="inp" data-testid="penpal-search" />
          </label>
          <label className="text-sm w-48">
            <div className="font-semibold mb-1">Filter by character</div>
            <select value={character} onChange={(e) => setCharacter(e.target.value)} className="inp" data-testid="penpal-filter-character">
              <option value="">All</option>
              {chars.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
          </label>
        </div>
      </section>

      {loading ? (
        <div className="text-[#6b7280] text-center py-12">Loading…</div>
      ) : letters.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center text-[#6b7280]" data-testid="penpal-empty">
          <Mail className="w-10 h-10 mx-auto mb-3 text-[#cbd5e1]" />
          <div className="font-semibold mb-1">No letters yet</div>
          <div className="text-sm">When kids start writing in, you'll see them here.</div>
        </div>
      ) : (
        <div className="space-y-3" data-testid="penpal-letters">
          {letters.map((l) => (
            <article key={l.id} className={`bg-white rounded-2xl p-5 border ${l.deleted ? "opacity-50 border-red-200" : "border-[#f4e4c6]"}`} data-testid={`penpal-letter-${l.id}`}>
              <header className="flex items-center justify-between mb-2 gap-3 flex-wrap">
                <div className="font-semibold text-[#3a4a55]">
                  To <span className="text-[#5a8a6f]">{l.character_name}</span>
                  {l.child_name && <span className="text-[#6b7280] font-normal"> · from "{l.child_name}"</span>}
                </div>
                <div className="flex items-center gap-2 text-xs text-[#6b7280]">
                  <span>{new Date(l.created_at).toLocaleString()}</span>
                  {!l.deleted && (
                    <button onClick={() => del(l.id)} className="p-1.5 rounded-full hover:bg-red-50 text-red-600" title="Hide" data-testid={`penpal-delete-${l.id}`}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </header>
              <div className="grid md:grid-cols-2 gap-3 text-sm">
                <div className="bg-[#fafbfc] rounded-xl p-3">
                  <div className="text-xs uppercase tracking-wider text-[#6b7280] mb-1">Letter</div>
                  <p className="italic text-[#4a5568]">"{l.letter}"</p>
                </div>
                <div className="bg-[#fff8ec] rounded-xl p-3">
                  <div className="text-xs uppercase tracking-wider text-[#a36b29] mb-1">Reply</div>
                  <p className="whitespace-pre-line text-[#3a4a55]">{l.reply_text}</p>
                </div>
              </div>
              <div className="text-xs text-[#6b7280] mt-2">Visitor: <span className="font-mono">{(l.visitor_id || "").slice(0, 14)}...</span></div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

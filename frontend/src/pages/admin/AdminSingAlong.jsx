import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import { toast } from "sonner";
import {
  Music2, Plus, Trash2, Edit2, X, Save, ArrowUp, ArrowDown, Loader2, Sparkles, Wand2, Image as ImageIcon,
} from "lucide-react";
import { ImageUploader } from "./ImageUploader";

export default function AdminSingAlong() {
  const [songs, setSongs] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [editing, setEditing] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const [s, c] = await Promise.all([
        api.get("/admin/sing-along/songs"),
        api.get("/characters").catch(() => ({ data: [] })),
      ]);
      setSongs(s.data || []);
      setCharacters(c.data || []);
    } catch {
      toast.error("Failed to load Sing-Along songs");
    }
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const move = async (idx, delta) => {
    if (idx + delta < 0 || idx + delta >= songs.length) return;
    const next = [...songs];
    const [item] = next.splice(idx, 1);
    next.splice(idx + delta, 0, item);
    setSongs(next.map((s, i) => ({ ...s, position: i + 1 })));
    try {
      await api.post("/admin/sing-along/reorder", { song_ids: next.map((s) => s.id) });
    } catch {
      toast.error("Reorder failed");
      refresh();
    }
  };

  const save = async (song) => {
    try {
      if (song.id) {
        await api.patch(`/admin/sing-along/songs/${song.id}`, song);
      } else {
        await api.post("/admin/sing-along/songs", song);
      }
      toast.success("Saved");
      setEditing(null);
      refresh();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Save failed");
    }
  };

  const del = async (s) => {
    if (!window.confirm(`Delete "${s.title}"? This will not remove the MP3 file.`)) return;
    try {
      await api.delete(`/admin/sing-along/songs/${s.id}`);
      toast.success("Deleted");
      refresh();
    } catch { toast.error("Delete failed"); }
  };

  const toggleActive = async (s) => {
    try {
      await api.patch(`/admin/sing-along/songs/${s.id}`, { active: !s.active });
      refresh();
    } catch { toast.error("Update failed"); }
  };

  const regenAlignment = async (s) => {
    try {
      toast.loading("Re-aligning lyrics…", { id: `align-${s.id}` });
      await api.post(`/admin/sing-along/songs/${s.id}/regenerate-alignment`);
      toast.success("Alignment refreshed", { id: `align-${s.id}` });
      refresh();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Alignment failed", { id: `align-${s.id}` });
    }
  };

  const generateCover = async (s) => {
    try {
      toast.loading("Drawing cover with the Sea Stars…", { id: `cov-${s.id}` });
      await api.post(`/admin/sing-along/songs/${s.id}/generate-cover`, {}, { timeout: 120000 });
      toast.success("Cover generated!", { id: `cov-${s.id}` });
      refresh();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Cover generation failed", { id: `cov-${s.id}` });
    }
  };

  const handleGenerate = async (form) => {
    setGenerating(true);
    try {
      toast.loading("Composing song with ElevenLabs (~30–60s)…", { id: "gen" });
      await api.post("/admin/sing-along/generate", form, { timeout: 180000 });
      toast.success("Song generated and aligned!", { id: "gen" });
      setShowGenerate(false);
      refresh();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Generation failed", { id: "gen" });
    }
    setGenerating(false);
  };

  const backfillFromAssets = async () => {
    if (!window.confirm("Backfill audio + LRC from committed seed_assets? Used to fix songs missing audio on production after deploy.")) return;
    try {
      toast.loading("Backfilling from seed assets…", { id: "backfill" });
      const { data } = await api.post("/admin/sing-along/backfill-from-assets", {}, { timeout: 120000 });
      toast.success(`Backfilled ${data.patched}/${data.scanned} songs`, { id: "backfill" });
      refresh();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Backfill failed", { id: "backfill" });
    }
  };

  if (loading) return <div className="text-[#6b7280]">Loading…</div>;

  return (
    <div data-testid="admin-sing-along">
      <header className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-accent text-3xl font-bold flex items-center gap-2"><Music2 className="w-7 h-7 text-[#f0a988]" /> Sing-Along</h1>
          <p className="text-sm text-[#6b7280] mt-1">{songs.length} song{songs.length === 1 ? "" : "s"} · {songs.filter((s) => s.audio_url).length} with audio</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setShowGenerate(true)} className="btn-primary inline-flex" data-testid="sing-along-generate-open">
            <Wand2 className="w-4 h-4" /> Generate from prompt
          </button>
          <button onClick={() => setEditing(blankSong(songs.length + 1))} className="btn-secondary inline-flex" data-testid="sing-along-new-song">
            <Plus className="w-4 h-4" /> Add manually
          </button>
          <button onClick={backfillFromAssets} className="btn-ghost inline-flex text-xs" data-testid="sing-along-backfill">
            <Sparkles className="w-4 h-4" /> Restore audio from seed
          </button>
        </div>
      </header>

      <section className="space-y-3" data-testid="sing-along-list">
        {songs.map((s, i) => (
          <article key={s.id} className="bg-white rounded-2xl p-4 border border-[#f4e4c6] flex items-start gap-3" data-testid={`song-row-${s.slug}`}>
            <div className="flex flex-col items-center gap-1 pt-1">
              <button onClick={() => move(i, -1)} disabled={i === 0} className="p-1 rounded hover:bg-[#eef9fb] disabled:opacity-30" aria-label="Move up"><ArrowUp className="w-4 h-4" /></button>
              <span className="font-mono text-xs text-[#6b7280] tabular-nums">{s.position || i + 1}</span>
              <button onClick={() => move(i, 1)} disabled={i === songs.length - 1} className="p-1 rounded hover:bg-[#eef9fb] disabled:opacity-30" aria-label="Move down"><ArrowDown className="w-4 h-4" /></button>
            </div>
            <div className="shrink-0">
              {s.cover_image_url ? (
                <img src={s.cover_image_url.startsWith("http") ? s.cover_image_url : `${process.env.REACT_APP_BACKEND_URL}${s.cover_image_url}`} alt="" className="w-16 h-16 object-cover rounded-2xl border border-[#f4e4c6]" />
              ) : (
                <div className="w-16 h-16 rounded-2xl border border-[#f4e4c6] bg-[#fffbf3] grid place-items-center text-[#cbd5e1]"><Music2 className="w-7 h-7" /></div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-accent font-bold text-lg truncate">{s.title}</h3>
                {!s.active && <span className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded-full">Disabled</span>}
                {!s.audio_url && <span className="text-xs bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded-full">No audio</span>}
                {s.lyrics_lrc && <span className="text-xs bg-[#eaf7f5] text-[#5a8a6f] px-2 py-0.5 rounded-full">Aligned</span>}
              </div>
              <p className="text-xs text-[#6b7280] mt-1">slug: <code>{s.slug}</code> · {s.duration_seconds || "?"}s {s.character_focus ? `· ${characters.find((c) => c.slug === s.character_focus)?.name || s.character_focus}` : ""}</p>
              <p className="text-sm text-[#4a5568] line-clamp-2 mt-1">{s.theme}</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <button onClick={() => toggleActive(s)} className="p-2 rounded-full hover:bg-[#eef9fb]" title={s.active ? "Disable" : "Enable"} data-testid={`song-toggle-${s.slug}`}>
                <span className={`inline-block w-3 h-3 rounded-full ${s.active ? "bg-[#5a8a6f]" : "bg-[#cbd5e1]"}`} />
              </button>
              <button onClick={() => generateCover(s)} className="p-2 rounded-full hover:bg-[#fff8ec] text-[#f0a988]" title="Generate cover art with the Sea Stars" data-testid={`song-gencover-${s.slug}`}>
                <ImageIcon className="w-4 h-4" />
              </button>
              {s.audio_url && (
                <button onClick={() => regenAlignment(s)} className="p-2 rounded-full hover:bg-[#fff8ec] text-[#a36b29]" title="Re-align lyrics" data-testid={`song-realign-${s.slug}`}>
                  <Sparkles className="w-4 h-4" />
                </button>
              )}
              <button onClick={() => setEditing(s)} className="p-2 rounded-full hover:bg-[#eef9fb]" data-testid={`song-edit-${s.slug}`}><Edit2 className="w-4 h-4" /></button>
              <button onClick={() => del(s)} className="p-2 rounded-full hover:bg-red-50 text-red-600" data-testid={`song-delete-${s.slug}`}><Trash2 className="w-4 h-4" /></button>
            </div>
          </article>
        ))}
        {songs.length === 0 && (
          <div className="bg-white rounded-3xl p-12 text-center text-[#6b7280]">
            <Music2 className="w-10 h-10 mx-auto mb-3 text-[#cbd5e1]" />
            <div className="font-semibold mb-1">No songs yet</div>
            <div className="text-sm">Click "Generate from prompt" to compose your first sing-along.</div>
          </div>
        )}
      </section>

      {editing && (
        <SongEditor
          initial={editing}
          characters={characters}
          onClose={() => setEditing(null)}
          onSave={save}
        />
      )}
      {showGenerate && (
        <GenerateModal
          characters={characters}
          busy={generating}
          onClose={() => !generating && setShowGenerate(false)}
          onGenerate={handleGenerate}
        />
      )}
    </div>
  );
}

function blankSong(nextPos) {
  return {
    title: "",
    slug: "",
    theme: "",
    cover_image_url: "",
    audio_url: "",
    lyrics: "",
    lyrics_lrc: "",
    duration_seconds: 35,
    character_focus: "",
    music_prompt: "",
    active: true,
    position: nextPos,
  };
}

function SongEditor({ initial, characters, onClose, onSave }) {
  const [form, setForm] = useState({ ...initial });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose} data-testid="song-editor-modal">
      <div className="bg-white rounded-[28px] max-w-3xl w-full max-h-[92vh] overflow-y-auto p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <h2 className="font-accent text-2xl font-bold">{initial.id ? "Edit song" : "New song"}</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-[#f3f4f6]" data-testid="song-editor-close"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Title">
              <input value={form.title || ""} onChange={(e) => set("title", e.target.value)} className="inp" data-testid="song-input-title" />
            </Field>
            <Field label="Slug (URL id)">
              <input value={form.slug || ""} onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/\s+/g, "-"))} className="inp font-mono" data-testid="song-input-slug" />
            </Field>
          </div>
          <ImageUploader
            value={form.cover_image_url}
            onChange={(url) => set("cover_image_url", url)}
            label="Cover image"
            testid="song-cover-upload"
          />
          <Field label="Theme / one-line description">
            <input value={form.theme || ""} onChange={(e) => set("theme", e.target.value)} className="inp" data-testid="song-input-theme" />
          </Field>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Character focus">
              <select value={form.character_focus || ""} onChange={(e) => set("character_focus", e.target.value)} className="inp" data-testid="song-input-character">
                <option value="">— none —</option>
                {characters.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Duration (seconds)">
              <input type="number" min={15} max={90} value={form.duration_seconds || 35} onChange={(e) => set("duration_seconds", parseInt(e.target.value, 10) || 35)} className="inp" data-testid="song-input-duration" />
            </Field>
          </div>
          <Field label="Lyrics (one line per row)">
            <textarea value={form.lyrics || ""} onChange={(e) => set("lyrics", e.target.value)} rows={8} className="inp resize-y font-mono text-sm" data-testid="song-input-lyrics" />
          </Field>
          <Field label="Music prompt (sent to ElevenLabs Music)">
            <textarea value={form.music_prompt || ""} onChange={(e) => set("music_prompt", e.target.value)} rows={3} className="inp resize-y text-sm" data-testid="song-input-prompt" />
          </Field>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Audio URL">
              <input value={form.audio_url || ""} onChange={(e) => set("audio_url", e.target.value)} className="inp text-xs font-mono" data-testid="song-input-audio" placeholder="/api/uploads/sing_along/…mp3" />
            </Field>
            <Field label="Active">
              <select value={form.active ? "1" : "0"} onChange={(e) => set("active", e.target.value === "1")} className="inp" data-testid="song-input-active">
                <option value="1">On</option>
                <option value="0">Off</option>
              </select>
            </Field>
          </div>
          <Field label="LRC (synced lyrics; auto-generated by alignment)">
            <textarea value={form.lyrics_lrc || ""} onChange={(e) => set("lyrics_lrc", e.target.value)} rows={6} className="inp resize-y font-mono text-xs" data-testid="song-input-lrc" />
          </Field>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="btn-ghost" data-testid="song-editor-cancel">Cancel</button>
          <button onClick={() => onSave(form)} className="btn-primary" data-testid="song-editor-save"><Save className="w-4 h-4" /> Save song</button>
        </div>
      </div>
    </div>
  );
}

const PROMPT_PRESETS = [
  { label: "Upbeat kids pop", prompt: "An energetic, upbeat kids' pop song with bright synths, hand-claps, and joyful children's group vocals. Beach-summer-camp vibe with steady danceable drum beat (~120 BPM). Catchy, sing-able chorus." },
  { label: "Beachy acoustic", prompt: "Warm acoustic guitar with soft ukulele and gentle ocean shaker percussion. Friendly children's vocals, sunny and laid-back like a campfire on the shore. ~95 BPM." },
  { label: "Marching parade", prompt: "Marching snare and tuba parade groove with a happy kids' choir, shouty refrains and call-and-response sing-along sections. ~110 BPM." },
];

function GenerateModal({ characters, busy, onClose, onGenerate }) {
  const [form, setForm] = useState({
    title: "",
    music_prompt: PROMPT_PRESETS[0].prompt,
    lyrics: "",
    theme: "",
    character_focus: "",
    cover_image_url: "",
    duration_seconds: 35,
    slug: "",
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const canSubmit = useMemo(() => form.title.trim() && form.music_prompt.trim() && form.lyrics.trim() && !busy, [form, busy]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={() => !busy && onClose()} data-testid="song-generate-modal">
      <div className="bg-white rounded-[28px] max-w-3xl w-full max-h-[92vh] overflow-y-auto p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="font-accent text-2xl font-bold flex items-center gap-2"><Wand2 className="w-6 h-6 text-[#f0a988]" /> Generate from prompt</h2>
            <p className="text-sm text-[#6b7280] mt-1">ElevenLabs Music composes the audio, then we run forced alignment for karaoke timing. Takes ~30–60 seconds.</p>
          </div>
          <button onClick={onClose} disabled={busy} className="p-1 rounded-full hover:bg-[#f3f4f6]" data-testid="song-generate-close"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Song title">
              <input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Sunset Shell Shuffle" className="inp" data-testid="gen-input-title" />
            </Field>
            <Field label="Slug (optional — auto from title)">
              <input value={form.slug} onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/\s+/g, "-"))} placeholder="sunset-shell-shuffle" className="inp font-mono" data-testid="gen-input-slug" />
            </Field>
          </div>
          <Field label="Theme (1 line, public-facing description)">
            <input value={form.theme} onChange={(e) => set("theme", e.target.value)} className="inp" data-testid="gen-input-theme" placeholder="A clap-along song about teamwork at sunset" />
          </Field>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Character focus">
              <select value={form.character_focus} onChange={(e) => set("character_focus", e.target.value)} className="inp" data-testid="gen-input-character">
                <option value="">— none —</option>
                {characters.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Duration (seconds, 15–90)">
              <input type="number" min={15} max={90} value={form.duration_seconds} onChange={(e) => set("duration_seconds", parseInt(e.target.value, 10) || 35)} className="inp" data-testid="gen-input-duration" />
            </Field>
          </div>
          <ImageUploader
            value={form.cover_image_url}
            onChange={(url) => set("cover_image_url", url)}
            label="Cover image (optional, can add later)"
            testid="gen-cover-upload"
          />
          <Field label="Music prompt — style & vibe instructions for ElevenLabs">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {PROMPT_PRESETS.map((p) => (
                <button key={p.label} type="button" onClick={() => set("music_prompt", p.prompt)} className="text-[11px] px-2 py-1 rounded-full bg-[#eef9fb] hover:bg-[#dff3f6] text-[#5a8a6f] font-semibold" data-testid={`gen-preset-${p.label.toLowerCase().replace(/\s+/g, "-")}`}>
                  {p.label}
                </button>
              ))}
            </div>
            <textarea value={form.music_prompt} onChange={(e) => set("music_prompt", e.target.value)} rows={4} className="inp resize-y text-sm" data-testid="gen-input-prompt" />
          </Field>
          <Field label="Lyrics (one line per row — these are sung verbatim)">
            <textarea value={form.lyrics} onChange={(e) => set("lyrics", e.target.value)} rows={10} className="inp resize-y font-mono text-sm" data-testid="gen-input-lyrics" placeholder={"Catch the wave, catch the wave,\nEvery friend is brave and brave,\n…"} />
          </Field>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} disabled={busy} className="btn-ghost" data-testid="song-generate-cancel">Cancel</button>
          <button onClick={() => onGenerate(form)} disabled={!canSubmit} className="btn-primary" data-testid="song-generate-submit">
            {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Composing…</> : <><Wand2 className="w-4 h-4" /> Generate song</>}
          </button>
        </div>
        {busy && <p className="text-xs text-[#6b7280] text-center mt-3">Hang tight — ElevenLabs is composing your song. Don't close this tab.</p>}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="text-sm block">
      <div className="font-semibold text-[#3a4a55] mb-1">{label}</div>
      {children}
    </label>
  );
}

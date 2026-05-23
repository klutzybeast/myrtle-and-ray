import { useEffect, useState, useMemo } from "react";
import { api } from "../../lib/api";
import { Sparkles, Plus, Trash2, Edit2, X, Save, BarChart3, GripVertical, ArrowUp, ArrowDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

const WAVE_KEYS = ["welcome_curiosity", "act_with_kindness", "value_teamwork", "encourage_others"];
const WAVE_LABEL = {
  welcome_curiosity: "Welcome curiosity",
  act_with_kindness: "Act with kindness",
  value_teamwork: "Value teamwork",
  encourage_others: "Encourage others",
};

export default function AdminStoryQuest() {
  const [scenes, setScenes] = useState([]);
  const [editing, setEditing] = useState(null);
  const [mappings, setMappings] = useState({});
  const [characters, setCharacters] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingMappings, setSavingMappings] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const [s, m, c, a] = await Promise.all([
        api.get("/admin/story-quest/scenes"),
        api.get("/admin/story-quest/character-mappings"),
        api.get("/characters"),
        api.get("/admin/story-quest/analytics").catch(() => ({ data: null })),
      ]);
      setScenes(s.data || []);
      setMappings(m.data || {});
      setCharacters(c.data || []);
      setAnalytics(a.data);
    } catch {
      toast.error("Failed to load Story Quest");
    }
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const move = async (idx, delta) => {
    if (idx + delta < 0 || idx + delta >= scenes.length) return;
    const next = [...scenes];
    const [item] = next.splice(idx, 1);
    next.splice(idx + delta, 0, item);
    setScenes(next.map((s, i) => ({ ...s, scene_number: i + 1 })));
    try {
      await api.post("/admin/story-quest/reorder", { scene_ids: next.map((s) => s.id) });
    } catch {
      toast.error("Reorder failed");
      refresh();
    }
  };

  const save = async (scene) => {
    try {
      if (scene.id) {
        await api.patch(`/admin/story-quest/scenes/${scene.id}`, scene);
      } else {
        await api.post("/admin/story-quest/scenes", scene);
      }
      toast.success("Saved");
      setEditing(null);
      refresh();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Save failed");
    }
  };

  const del = async (s) => {
    if (!window.confirm(`Delete scene "${s.title}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/admin/story-quest/scenes/${s.id}`);
      toast.success("Deleted");
      refresh();
    } catch { toast.error("Delete failed"); }
  };

  const saveMappings = async () => {
    setSavingMappings(true);
    try {
      await api.put("/admin/story-quest/character-mappings", mappings);
      toast.success("Character mappings saved");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Save failed");
    }
    setSavingMappings(false);
  };

  if (loading) return <div className="text-[#6b7280]">Loading…</div>;

  return (
    <div data-testid="admin-story-quest">
      <header className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-accent text-3xl font-bold flex items-center gap-2"><Sparkles className="w-7 h-7 text-[#5a8a6f]" /> Story Quest</h1>
          <p className="text-sm text-[#6b7280] mt-1">{scenes.length} scene{scenes.length === 1 ? "" : "s"} · {analytics?.total ?? 0} completions ({analytics?.today ?? 0} today)</p>
        </div>
        <button onClick={() => setEditing(blankScene(scenes.length + 1))} className="btn-primary inline-flex" data-testid="story-quest-new-scene"><Plus className="w-4 h-4" /> New scene</button>
      </header>

      {/* Character mappings */}
      <section className="bg-white rounded-3xl p-5 mb-6 border border-[#f4e4c6]" data-testid="story-quest-mappings">
        <h2 className="font-accent text-xl font-bold mb-3">W.A.V.E. → Sea Star</h2>
        <p className="text-xs text-[#6b7280] mb-3">When a kid finishes the quest, their highest-scoring W.A.V.E. principle decides which Sea Star they're matched with.</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {WAVE_KEYS.map((k) => (
            <label key={k} className="text-sm">
              <div className="font-semibold mb-1">{WAVE_LABEL[k]}</div>
              <select
                value={mappings[k] || ""}
                onChange={(e) => setMappings({ ...mappings, [k]: e.target.value })}
                className="inp"
                data-testid={`mapping-${k}`}
              >
                <option value="">— pick a Sea Star —</option>
                {characters.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
              </select>
            </label>
          ))}
        </div>
        <button onClick={saveMappings} disabled={savingMappings} className="btn-primary mt-3 inline-flex" data-testid="mapping-save">
          {savingMappings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save mappings
        </button>
      </section>

      {/* Analytics */}
      {analytics && analytics.total > 0 && (
        <section className="bg-white rounded-3xl p-5 mb-6 border border-[#f4e4c6]" data-testid="story-quest-analytics">
          <h2 className="font-accent text-xl font-bold mb-3 flex items-center gap-2"><BarChart3 className="w-5 h-5 text-[#5a8a6f]" /> Analytics</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <div className="text-sm font-semibold mb-2">Matched character distribution</div>
              <ul className="space-y-1">
                {(analytics.character_distribution || []).map((row) => (
                  <li key={row.character} className="text-sm flex justify-between" data-testid={`char-dist-${row.character}`}>
                    <span>{characters.find((c) => c.slug === row.character)?.name || row.character}</span>
                    <span className="tabular-nums font-bold">{row.count}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-sm font-semibold mb-2">Average W.A.V.E. scores</div>
              <ul className="space-y-1">
                {WAVE_KEYS.map((k) => (
                  <li key={k} className="text-sm flex justify-between">
                    <span>{WAVE_LABEL[k]}</span>
                    <span className="tabular-nums font-bold">{analytics.wave_averages?.[k] ?? 0}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* Scene list */}
      <section className="space-y-3" data-testid="story-quest-scenes">
        {scenes.map((s, i) => (
          <article key={s.id} className="bg-white rounded-2xl p-4 border border-[#f4e4c6] flex items-start gap-3" data-testid={`scene-row-${s.scene_number}`}>
            <div className="flex flex-col items-center gap-1">
              <button onClick={() => move(i, -1)} disabled={i === 0} className="p-1 rounded hover:bg-[#eef9fb] disabled:opacity-30" aria-label="Move up"><ArrowUp className="w-4 h-4" /></button>
              <span className="font-mono text-xs text-[#6b7280] tabular-nums">{s.scene_number}</span>
              <button onClick={() => move(i, 1)} disabled={i === scenes.length - 1} className="p-1 rounded hover:bg-[#eef9fb] disabled:opacity-30" aria-label="Move down"><ArrowDown className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-accent font-bold text-lg">{s.title}</h3>
                {s.is_intro && <span className="text-xs bg-[#eaf7f5] text-[#5a8a6f] px-2 py-0.5 rounded-full">Intro</span>}
                {s.is_finale && <span className="text-xs bg-[#fff8ec] text-[#a36b29] px-2 py-0.5 rounded-full">Finale</span>}
                {!s.active && <span className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded-full">Disabled</span>}
              </div>
              <p className="text-sm text-[#4a5568] line-clamp-2 mt-1">{s.narrative}</p>
              <div className="text-xs text-[#6b7280] mt-1">
                {s.narrator_slug && (
                  <span data-testid={`scene-row-narrator-${s.scene_number}`}>
                    🎙 {characters.find((c) => c.slug === s.narrator_slug)?.name || s.narrator_slug} ·{" "}
                  </span>
                )}
                {(s.choices || []).length} choice{(s.choices || []).length === 1 ? "" : "s"} ·
                {" "}
                {(s.choices || []).map((c) => `${c.id}=${c.wave_principle.replace(/_/g, " ")}`).join(" · ")}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={() => setEditing(s)} className="p-2 rounded-full hover:bg-[#eef9fb]" data-testid={`scene-edit-${s.scene_number}`}><Edit2 className="w-4 h-4" /></button>
              <button onClick={() => del(s)} className="p-2 rounded-full hover:bg-red-50 text-red-600" data-testid={`scene-delete-${s.scene_number}`}><Trash2 className="w-4 h-4" /></button>
            </div>
          </article>
        ))}
        {scenes.length === 0 && (
          <div className="bg-white rounded-3xl p-12 text-center text-[#6b7280]" data-testid="story-quest-empty">
            <Sparkles className="w-10 h-10 mx-auto mb-3 text-[#cbd5e1]" />
            <div className="font-semibold mb-1">No scenes yet</div>
            <div className="text-sm">Click "New scene" to start building.</div>
          </div>
        )}
      </section>

      {editing && <SceneEditor initial={editing} characters={characters} onClose={() => setEditing(null)} onSave={save} />}
    </div>
  );
}

function blankScene(nextNum) {
  return {
    scene_number: nextNum,
    title: "",
    narrative: "",
    background_image_url: "",
    audio_narration_url: "",
    is_intro: false,
    is_finale: false,
    active: true,
    choices: [
      { id: "a", text: "", wave_principle: "welcome_curiosity", character_reaction: "" },
      { id: "b", text: "", wave_principle: "act_with_kindness", character_reaction: "" },
      { id: "c", text: "", wave_principle: "value_teamwork", character_reaction: "" },
    ],
  };
}

function SceneEditor({ initial, characters, onClose, onSave }) {
  const [form, setForm] = useState({
    ...initial,
    choices: initial.choices && initial.choices.length ? initial.choices : blankScene(1).choices,
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setChoice = (idx, key, value) =>
    setForm((f) => ({
      ...f,
      choices: f.choices.map((c, i) => (i === idx ? { ...c, [key]: value } : c)),
    }));
  const addChoice = () =>
    setForm((f) => ({
      ...f,
      choices: [...f.choices, { id: String.fromCharCode(97 + f.choices.length), text: "", wave_principle: "welcome_curiosity", character_reaction: "" }],
    }));
  const removeChoice = (idx) =>
    setForm((f) => ({ ...f, choices: f.choices.filter((_, i) => i !== idx) }));

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose} data-testid="scene-editor-modal">
      <div className="bg-white rounded-[28px] max-w-3xl w-full max-h-[92vh] overflow-y-auto p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <h2 className="font-accent text-2xl font-bold">{initial.id ? "Edit scene" : "New scene"}</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-[#f3f4f6]" data-testid="scene-editor-close"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-4">
          <div className="grid sm:grid-cols-[1fr_auto_auto_auto] gap-3 items-end">
            <Field label="Title">
              <input value={form.title} onChange={(e) => set("title", e.target.value)} className="inp" data-testid="scene-input-title" />
            </Field>
            <Toggle label="Intro" checked={!!form.is_intro} onChange={(v) => set("is_intro", v)} testid="scene-input-intro" />
            <Toggle label="Finale" checked={!!form.is_finale} onChange={(v) => set("is_finale", v)} testid="scene-input-finale" />
            <Toggle label="Active" checked={form.active !== false} onChange={(v) => set("active", v)} testid="scene-input-active" />
          </div>
          <Field label="Narrative (2–3 sentences)">
            <textarea value={form.narrative} onChange={(e) => set("narrative", e.target.value)} rows={4} className="inp resize-none" data-testid="scene-input-narrative" />
          </Field>
          <Field label="Background image URL (optional)">
            <input value={form.background_image_url} onChange={(e) => set("background_image_url", e.target.value)} className="inp" data-testid="scene-input-image" />
          </Field>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Narrator (Sea Star voice)">
              <select
                value={form.narrator_slug || ""}
                onChange={(e) => set("narrator_slug", e.target.value)}
                className="inp"
                data-testid="scene-input-narrator"
              >
                <option value="">— pick a Sea Star —</option>
                {(characters || []).map((c) => (
                  <option key={c.slug} value={c.slug} disabled={!c.voice_id}>
                    {c.name}{c.voice_id ? "" : " (no voice)"}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Audio narration URL (auto-generated)">
              <input value={form.audio_narration_url} onChange={(e) => set("audio_narration_url", e.target.value)} placeholder="Auto-filled from narrator voice" className="inp" data-testid="scene-input-audio" />
            </Field>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold text-[#3a4a55]">Choices</div>
              <button onClick={addChoice} className="text-xs btn-secondary inline-flex" data-testid="scene-add-choice"><Plus className="w-3 h-3" /> Add choice</button>
            </div>
            <div className="space-y-3">
              {form.choices.map((c, i) => (
                <div key={i} className="border border-[#f4e4c6] rounded-2xl p-3 space-y-2" data-testid={`choice-row-${i}`}>
                  <div className="grid sm:grid-cols-[60px_1fr_auto] gap-2 items-center">
                    <input value={c.id} onChange={(e) => setChoice(i, "id", e.target.value.toLowerCase())} maxLength={4} className="inp font-mono text-center" data-testid={`choice-id-${i}`} />
                    <input value={c.text} onChange={(e) => setChoice(i, "text", e.target.value)} placeholder="Choice text shown to the kid" className="inp" data-testid={`choice-text-${i}`} />
                    <button onClick={() => removeChoice(i)} className="p-2 rounded-full hover:bg-red-50 text-red-600" disabled={form.choices.length <= 1}><Trash2 className="w-4 h-4" /></button>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-2">
                    <select value={c.wave_principle} onChange={(e) => setChoice(i, "wave_principle", e.target.value)} className="inp" data-testid={`choice-principle-${i}`}>
                      {WAVE_KEYS.map((k) => <option key={k} value={k}>{WAVE_LABEL[k]}</option>)}
                    </select>
                    <input value={c.character_reaction || ""} onChange={(e) => setChoice(i, "character_reaction", e.target.value)} placeholder="Character reaction (1 sentence)" className="inp" data-testid={`choice-reaction-${i}`} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="btn-ghost" data-testid="scene-editor-cancel">Cancel</button>
          <button onClick={() => onSave(form)} className="btn-primary" data-testid="scene-editor-save"><Save className="w-4 h-4" /> Save scene</button>
        </div>
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

function Toggle({ label, checked, onChange, testid }) {
  return (
    <label className="text-sm block">
      <div className="font-semibold text-[#3a4a55] mb-1">{label}</div>
      <select value={checked ? "1" : "0"} onChange={(e) => onChange(e.target.value === "1")} className="inp" data-testid={testid}>
        <option value="1">On</option>
        <option value="0">Off</option>
      </select>
    </label>
  );
}

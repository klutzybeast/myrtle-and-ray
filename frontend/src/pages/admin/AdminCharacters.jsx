import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { toast } from "sonner";
import { Pencil, X, Save } from "lucide-react";
import AIThumbnailButton from "../../components/admin/AIThumbnailButton";

export default function AdminCharacters() {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);

  const load = () => api.get("/admin/characters").then(({ data }) => setItems(data));
  useEffect(() => { load(); }, []);

  const save = async (data) => {
    try {
      await api.put(`/admin/characters/${editing.slug}`, data);
      toast.success("Saved!");
      setEditing(null);
      load();
    } catch (err) { toast.error("Save failed"); }
  };

  return (
    <div data-testid="admin-characters">
      <h1 className="font-accent text-3xl font-bold mb-4">Sea Stars (Characters)</h1>
      <p className="text-[#6b7280] mb-4">The core thirteen cannot be deleted, but everything else is fully editable.</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((c) => (
          <div key={c.slug} className="bg-white rounded-3xl border border-[#f4e4c6] p-5 flex gap-4" data-testid={`char-row-${c.slug}`}>
            <div className="gradient-ring flex-shrink-0" style={{ width: 64, height: 64 }}><img src={c.image_url} alt="" className="w-full h-full rounded-full object-contain bg-[#fffbf3]" /></div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-[#2e3a3a]">{c.name}</div>
              <div className="text-xs text-[#6b7280] truncate">{c.role}</div>
              <button onClick={() => setEditing(c)} className="btn-ghost text-xs mt-2"><Pencil className="w-3 h-3" />Edit</button>
            </div>
          </div>
        ))}
      </div>
      {editing && (
        <Editor item={editing} setItem={setEditing} onSave={save} onCancel={() => setEditing(null)} />
      )}
    </div>
  );
}

function Editor({ item, setItem, onSave, onCancel }) {
  const set = (k, v) => setItem({ ...item, [k]: v });
  return (
    <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" onClick={onCancel}>
      <div className="bg-white rounded-[24px] max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()} data-testid="char-editor">
        <div className="flex justify-between items-center mb-4"><h3 className="font-accent text-2xl font-bold">Edit {item.name}</h3><button onClick={onCancel}><X /></button></div>
        <div className="grid sm:grid-cols-2 gap-3">
          <F label="Name"><input value={item.name || ""} onChange={(e) => set("name", e.target.value)} className="inp" /></F>
          <F label="Species"><input value={item.species || ""} onChange={(e) => set("species", e.target.value)} className="inp" /></F>
          <F label="Role"><input value={item.role || ""} onChange={(e) => set("role", e.target.value)} className="inp" /></F>
          <F label="W.A.V.E. value (W/A/V/E)"><input value={item.wave_value || ""} onChange={(e) => set("wave_value", e.target.value)} className="inp" /></F>
          <F label="Image URL" full>
            <div className="flex gap-2">
              <input value={item.image_url || ""} onChange={(e) => set("image_url", e.target.value)} className="inp flex-1" data-testid="char-edit-image" />
              <AIThumbnailButton
                kind="character"
                title={item.name || ""}
                defaultPrompt={`Portrait of ${item.name || ""}, ${item.species || ""}, ${item.role || ""}`}
                onChosen={(url) => set("image_url", url)}
              />
            </div>
          </F>
          <F label="Linked product slug"><input value={item.linked_product_slug || ""} onChange={(e) => set("linked_product_slug", e.target.value)} className="inp" /></F>
          <F label="Audio URL"><input value={item.audio_url || ""} onChange={(e) => set("audio_url", e.target.value)} className="inp" /></F>
          <F label="ElevenLabs Voice ID"><input value={item.voice_id || ""} onChange={(e) => set("voice_id", e.target.value)} className="inp" placeholder="e.g. EXAVITQu4vr4xnSDxMaL" data-testid="char-edit-voice-id" /></F>
          <F label="Voice Greeting (what they say when tapped)" full><textarea value={item.voice_greeting || ""} onChange={(e) => set("voice_greeting", e.target.value)} className="inp min-h-[60px]" rows={2} maxLength={300} data-testid="char-edit-voice-greeting" /></F>
          <F label="Bio" full><textarea value={item.bio || ""} onChange={(e) => set("bio", e.target.value)} className="inp min-h-[80px]" rows={3} /></F>
          <F label="Fun Fact" full><input value={item.fun_fact || ""} onChange={(e) => set("fun_fact", e.target.value)} className="inp" /></F>
        </div>
        <div className="flex justify-end gap-2 mt-5"><button onClick={onCancel} className="btn-ghost">Cancel</button><button onClick={() => onSave(item)} className="btn-primary" data-testid="char-save"><Save className="w-4 h-4" />Save</button></div>
      </div>
      <style>{`.inp{width:100%;padding:10px 14px;border-radius:9999px;border:2px solid #f4e4c6;background:white;font-size:14px}.inp:focus{outline:none;border-color:#7fcfc7}textarea.inp{border-radius:18px}`}</style>
    </div>
  );
}
function F({ label, children, full }) { return <label className={`text-sm ${full ? "sm:col-span-2" : ""}`}><div className="font-semibold text-[#2e3a3a] mb-1">{label}</div>{children}</label>; }

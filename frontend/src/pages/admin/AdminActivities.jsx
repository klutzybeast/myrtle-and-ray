import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { toast } from "sonner";
import { Save } from "lucide-react";
import SchemaForm from "./SchemaForm";
import { ACTIVITY_SCHEMAS } from "./schemas";
import AIThumbnailButton from "../../components/admin/AIThumbnailButton";

export default function AdminActivities() {
  const [items, setItems] = useState([]);
  const [active, setActive] = useState(null);
  const [data, setData] = useState({});
  const [thumb, setThumb] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get("/admin/activity-content").then(({ data }) => setItems(data)); }, []);
  useEffect(() => { if (active) { setData(active.data || {}); setThumb(active.thumbnail_url || ""); } }, [active]);

  const save = async () => {
    setBusy(true);
    try {
      await api.put(`/admin/activity-content/${active.key}`, { data, thumbnail_url: thumb });
      toast.success("Saved");
      setItems((arr) => arr.map((p) => p.key === active.key ? { ...p, data, thumbnail_url: thumb } : p));
    } catch { toast.error("Save failed"); }
    finally { setBusy(false); }
  };

  const schema = active ? ACTIVITY_SCHEMAS[active.key] : null;

  return (
    <div data-testid="admin-activities">
      <h1 className="font-accent text-3xl font-bold mb-1">Activities</h1>
      <p className="text-[#5a6b76] mb-4">Edit the content powering each interactive activity.</p>

      <div className="grid lg:grid-cols-[260px,1fr] gap-4">
        <div className="space-y-2">
          {items.map((p) => (
            <button
              key={p.key}
              onClick={() => setActive(p)}
              className={`block w-full text-left p-3 rounded-2xl border-2 transition ${active?.key === p.key ? "border-[#7fcfc7] bg-[#eef9fb]" : "border-[#f4e4c6] bg-white hover:border-[#7fcfc7]"}`}
              data-testid={`activity-row-${p.key}`}
            >
              <div className="font-semibold">{ACTIVITY_SCHEMAS[p.key]?.title || p.title || p.key}</div>
              <div className="text-xs text-[#5a6b76]">{p.key}</div>
            </button>
          ))}
        </div>

        <div className="card-soft p-5">
          {!active && <div className="text-[#5a6b76]">Select an activity to edit.</div>}
          {active && schema && (
            <>
              <h2 className="font-accent text-2xl font-bold">{schema.title}</h2>
              {schema.description && <p className="text-[#5a6b76] text-sm mb-4">{schema.description}</p>}
              <div className="mb-4 p-3 bg-[#fffbf3] rounded-2xl border-2 border-[#f4e4c6]">
                <div className="text-sm font-semibold text-[#3a4a55] mb-1">Tile artwork</div>
                <div className="flex gap-2 items-center flex-wrap">
                  <input value={thumb} onChange={(e) => setThumb(e.target.value)} placeholder="Paste image URL" className="inp flex-1 min-w-[200px]" />
                  <AIThumbnailButton
                    kind="activity"
                    title={schema.title}
                    defaultPrompt={`Tile/badge art for the "${schema.title}" mini-game.`}
                    onChosen={(url) => setThumb(url)}
                  />
                </div>
                {thumb && <img src={thumb} alt="" className="mt-2 w-24 h-24 rounded-2xl object-cover border border-[#f4e4c6]" />}
              </div>
              <SchemaForm fields={schema.fields} value={data} onChange={setData} />
              <button onClick={save} disabled={busy} className="btn-primary mt-5" data-testid="activity-save"><Save className="w-4 h-4" />{busy ? "Saving..." : "Save"}</button>
            </>
          )}
          {active && !schema && (
            <div>
              <h2 className="font-accent text-2xl font-bold mb-2">{active.title || active.key}</h2>
              <p className="text-[#5a6b76] text-sm mb-3">No structured editor for this activity yet.</p>
              <textarea value={JSON.stringify(data, null, 2)} onChange={(e) => { try { setData(JSON.parse(e.target.value)); } catch {} }} rows={16} className="w-full p-4 rounded-2xl border-2 border-[#f4e4c6] font-mono text-sm focus:outline-none focus:border-[#7fcfc7]" />
              <button onClick={save} className="btn-primary mt-3"><Save className="w-4 h-4" />Save</button>
            </div>
          )}
        </div>
      </div>
      <style>{`.inp{width:100%;padding:10px 14px;border-radius:9999px;border:2px solid #f4e4c6;background:white;font-size:14px}.inp:focus{outline:none;border-color:#7fcfc7}textarea.inp{border-radius:18px}`}</style>
    </div>
  );
}

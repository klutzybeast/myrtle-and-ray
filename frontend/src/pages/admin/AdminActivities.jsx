import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { toast } from "sonner";
import { Save } from "lucide-react";

export default function AdminActivities() {
  const [items, setItems] = useState([]);
  const [active, setActive] = useState(null);
  const [text, setText] = useState("");

  useEffect(() => { api.get("/admin/activity-content").then(({ data }) => setItems(data)); }, []);
  useEffect(() => { if (active) setText(JSON.stringify(active.data || {}, null, 2)); }, [active]);

  const save = async () => {
    try {
      const data = JSON.parse(text);
      await api.put(`/admin/activity-content/${active.key}`, { data });
      toast.success("Saved");
      setItems((arr) => arr.map((p) => p.key === active.key ? { ...p, data } : p));
    } catch { toast.error("Invalid JSON or save failed"); }
  };

  return (
    <div data-testid="admin-activities">
      <h1 className="font-accent text-3xl font-bold mb-4">Activity Content</h1>
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="space-y-2">
          {items.map((p) => (
            <button key={p.key} onClick={() => setActive(p)} className={`block w-full text-left p-3 rounded-2xl border-2 ${active?.key === p.key ? "border-[#40e0d0] bg-[#e0f7fa]" : "border-[#fde6c8] bg-white"}`}>
              <div className="font-semibold">{p.title || p.key}</div>
            </button>
          ))}
        </div>
        <div className="lg:col-span-2">
          {active ? (
            <div className="card-soft p-5">
              <div className="font-accent text-xl font-bold mb-2">{active.title}</div>
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={20} className="w-full p-4 rounded-2xl border-2 border-[#fde6c8] font-mono text-sm focus:outline-none focus:border-[#40e0d0]" />
              <button onClick={save} className="btn-primary mt-3"><Save className="w-4 h-4" />Save</button>
            </div>
          ) : <div className="text-[#6b7280]">Select an activity to edit.</div>}
        </div>
      </div>
    </div>
  );
}

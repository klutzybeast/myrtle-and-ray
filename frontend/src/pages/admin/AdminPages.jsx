import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { toast } from "sonner";
import { Save } from "lucide-react";

export default function AdminPages() {
  const [pages, setPages] = useState([]);
  const [active, setActive] = useState(null);
  const [text, setText] = useState("");

  useEffect(() => { api.get("/admin/pages").then(({ data }) => setPages(data)); }, []);
  useEffect(() => { if (active) setText(JSON.stringify(active.content || {}, null, 2)); }, [active]);

  const save = async () => {
    try {
      const content = JSON.parse(text);
      await api.put(`/admin/pages/${active.key}`, { content });
      toast.success("Saved!");
      setPages((arr) => arr.map((p) => p.key === active.key ? { ...p, content } : p));
    } catch (err) { toast.error("Invalid JSON or save failed"); }
  };

  return (
    <div data-testid="admin-pages">
      <h1 className="font-accent text-3xl font-bold mb-4">Pages (Content)</h1>
      <p className="text-[#6b7280] mb-4">Edit the JSON content for any static section. Each page has a flexible content object.</p>
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="space-y-2">
          {pages.map((p) => (
            <button key={p.key} onClick={() => setActive(p)} className={`block w-full text-left p-3 rounded-2xl border-2 ${active?.key === p.key ? "border-[#7fcfc7] bg-[#eef9fb]" : "border-[#f4e4c6] bg-white"}`} data-testid={`page-row-${p.key}`}>
              <div className="font-semibold">{p.title || p.key}</div>
              <div className="text-xs text-[#6b7280]">{p.key}</div>
            </button>
          ))}
        </div>
        <div className="lg:col-span-2">
          {active ? (
            <div className="card-soft p-5">
              <div className="font-accent text-xl font-bold mb-2">{active.title || active.key}</div>
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={20} className="w-full p-4 rounded-2xl border-2 border-[#f4e4c6] font-mono text-sm focus:outline-none focus:border-[#7fcfc7]" data-testid="page-content-editor" />
              <button onClick={save} className="btn-primary mt-3" data-testid="page-save"><Save className="w-4 h-4" />Save</button>
            </div>
          ) : <div className="text-[#6b7280]">Select a page to edit.</div>}
        </div>
      </div>
    </div>
  );
}

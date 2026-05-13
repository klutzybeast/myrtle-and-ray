import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { toast } from "sonner";
import { Save, ExternalLink } from "lucide-react";
import SchemaForm from "./SchemaForm";
import { PAGE_SCHEMAS } from "./schemas";

// Map system-page keys to where they appear on the public site
const PAGE_PREVIEW_PATH = {
  homepage_hero: "/",
  sand_banner: "/",
  wave_values: "/",
  about: "/about",
  for_camps: "/for-camps",
  read_aloud: "/read-aloud",
  contact: "/contact",
};

export default function AdminPages() {
  const [pages, setPages] = useState([]);
  const [active, setActive] = useState(null);
  const [content, setContent] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get("/admin/pages").then(({ data }) => setPages(data)); }, []);
  useEffect(() => {
    if (active) setContent(active.content || {});
  }, [active]);

  const save = async () => {
    setBusy(true);
    try {
      await api.put(`/admin/pages/${active.key}`, { content });
      toast.success("Saved!");
      setPages((arr) => arr.map((p) => p.key === active.key ? { ...p, content } : p));
    } catch (err) { toast.error("Save failed"); }
    finally { setBusy(false); }
  };

  const schema = active ? PAGE_SCHEMAS[active.key] : null;

  return (
    <div data-testid="admin-pages">
      <h1 className="font-accent text-3xl font-bold mb-1">System Pages</h1>
      <p className="text-[#5a6b76] mb-4">Edit the built-in pages and homepage sections. Need a brand new page? Use <a className="text-[#5a8a6f] underline" href="/admin/custom-pages">Custom Pages</a> instead.</p>
      <div className="grid lg:grid-cols-[260px,1fr] gap-4">
        <div className="space-y-2">
          {pages.map((p) => (
            <button
              key={p.key}
              onClick={() => setActive(p)}
              className={`block w-full text-left p-3 rounded-2xl border-2 transition ${active?.key === p.key ? "border-[#7fcfc7] bg-[#eef9fb]" : "border-[#f4e4c6] bg-white hover:border-[#7fcfc7]"}`}
              data-testid={`page-row-${p.key}`}
            >
              <div className="font-semibold">{PAGE_SCHEMAS[p.key]?.title || p.title || p.key}</div>
              <div className="text-xs text-[#5a6b76]">{p.key}</div>
            </button>
          ))}
        </div>

        <div className="card-soft p-5">
          {!active && <div className="text-[#5a6b76]">Select a page on the left to edit.</div>}
          {active && schema && (
            <>
              <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                <div>
                  <h2 className="font-accent text-2xl font-bold">{schema.title}</h2>
                  {schema.description && <p className="text-[#5a6b76] text-sm">{schema.description}</p>}
                </div>
                {PAGE_PREVIEW_PATH[active.key] && (
                  <a href={PAGE_PREVIEW_PATH[active.key]} target="_blank" rel="noopener noreferrer" className="btn-secondary text-sm" data-testid="page-view-on-site"><ExternalLink className="w-4 h-4" />View on site</a>
                )}
              </div>
              <SchemaForm fields={schema.fields} value={content} onChange={setContent} />
              <button onClick={save} disabled={busy} className="btn-primary mt-5" data-testid="page-save"><Save className="w-4 h-4" />{busy ? "Saving..." : "Save"}</button>
            </>
          )}
          {active && !schema && (
            <div>
              <h2 className="font-accent text-2xl font-bold mb-2">{active.title || active.key}</h2>
              <p className="text-[#5a6b76] text-sm mb-3">This page doesn't have a structured editor yet. Edit it as JSON below.</p>
              <textarea value={JSON.stringify(content, null, 2)} onChange={(e) => { try { setContent(JSON.parse(e.target.value)); } catch {} }} rows={16} className="w-full p-4 rounded-2xl border-2 border-[#f4e4c6] font-mono text-sm focus:outline-none focus:border-[#7fcfc7]" />
              <button onClick={save} className="btn-primary mt-3"><Save className="w-4 h-4" />Save</button>
            </div>
          )}
        </div>
      </div>
      <style>{`.inp{width:100%;padding:10px 14px;border-radius:9999px;border:2px solid #f4e4c6;background:white;font-size:14px}.inp:focus{outline:none;border-color:#7fcfc7}textarea.inp{border-radius:18px}`}</style>
    </div>
  );
}

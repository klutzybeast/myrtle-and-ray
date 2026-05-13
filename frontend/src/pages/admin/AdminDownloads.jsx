import { useEffect, useState, useRef } from "react";
import { api } from "../../lib/api";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, X, Save, Upload, FileText, GripVertical } from "lucide-react";

const AUDIENCES = ["Parents", "Teachers", "Camp Directors", "Kids"];
const WAVE = ["W", "A", "V", "E"];

export default function AdminDownloads() {
  const [items, setItems] = useState([]);
  const [cats, setCats] = useState([]);
  const [chars, setChars] = useState([]);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);

  const load = () => api.get("/admin/downloads").then(({ data }) => setItems(data));
  useEffect(() => {
    load();
    api.get("/admin/download-categories").then(({ data }) => setCats(data));
    api.get("/admin/characters").then(({ data }) => setChars(data));
  }, []);

  const blank = { title: "", slug: "", category_slugs: [], character_slug: "", cover_image: "", short_description: "", long_description: "", age_range: "Ages 3 to 8", audiences: [], wave_values: [], files: [], featured: false, is_new: true, published: true, email_gate_override: null };

  const save = async (data) => {
    try {
      if (creating) await api.post("/admin/downloads", data);
      else await api.put(`/admin/downloads/${editing.slug}`, data);
      toast.success("Saved");
      setEditing(null); setCreating(false);
      load();
    } catch (err) { toast.error(err.response?.data?.detail || "Save failed"); }
  };

  const remove = async (slug) => {
    if (!window.confirm("Delete this download?")) return;
    await api.delete(`/admin/downloads/${slug}`); toast.success("Deleted"); load();
  };

  return (
    <div data-testid="admin-downloads">
      <header className="flex items-center justify-between mb-6">
        <div><h1 className="font-accent text-3xl font-bold">Downloads</h1><p className="text-[#5a6b76]">{items.length} item{items.length === 1 ? "" : "s"}</p></div>
        <button onClick={() => { setEditing(blank); setCreating(true); }} className="btn-primary" data-testid="download-new"><Plus className="w-5 h-5" />New Download</button>
      </header>
      <div className="bg-white rounded-3xl border border-[#f4e4c6] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#fffbf3] text-left">
            <tr><th className="p-3">Title</th><th className="p-3">Categories</th><th className="p-3">Files</th><th className="p-3">Status</th><th></th></tr>
          </thead>
          <tbody>
            {items.map((d) => (
              <tr key={d.slug} className="border-t border-[#f4e4c6]">
                <td className="p-3 font-semibold">{d.title}<div className="text-xs text-[#5a6b76]">/{d.slug}</div></td>
                <td className="p-3 text-xs">{(d.category_slugs || []).join(", ")}</td>
                <td className="p-3 text-xs">{(d.files || []).length} file{(d.files || []).length === 1 ? "" : "s"}</td>
                <td className="p-3"><span className={`text-xs font-bold ${d.published ? "text-[#5a8a6f]" : "text-[#5a6b76]"}`}>{d.published ? "Live" : "Draft"}</span>{d.featured && <span className="ml-2 text-[#f0a988]">★</span>}{d.is_new && <span className="ml-2 text-xs bg-[#f0a988] text-white px-2 rounded-full">NEW</span>}</td>
                <td className="p-3 text-right"><button onClick={() => { setEditing(d); setCreating(false); }} className="p-2 hover:bg-gray-100 rounded-full" data-testid={`download-edit-${d.slug}`}><Pencil className="w-4 h-4" /></button><button onClick={() => remove(d.slug)} className="p-2 hover:bg-red-50 rounded-full text-red-500" data-testid={`download-remove-${d.slug}`}><Trash2 className="w-4 h-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && <Editor item={editing} setItem={setEditing} cats={cats} chars={chars} onSave={save} onCancel={() => { setEditing(null); setCreating(false); }} />}
    </div>
  );
}

function Editor({ item, setItem, cats, chars, onSave, onCancel }) {
  const set = (k, v) => setItem({ ...item, [k]: v });
  const toggleArr = (key, val) => { const arr = item[key] || []; set(key, arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]); };

  const fileRef = useRef(null);
  const coverRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const uploadFiles = async (fileList) => {
    setUploading(true);
    const added = [];
    for (const f of fileList) {
      const fd = new FormData(); fd.append("file", f);
      try {
        const { data } = await api.post("/admin/media/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
        added.push({
          label: humanLabelFor(data.filename),
          url: `/api/media/download/${data.id}`,
          filename: data.filename,
          size_kb: data.size_kb,
          page_count: data.page_count,
          mime: data.mime,
          media_id: data.id,
        });
      } catch (err) { toast.error(`${f.name}: ${err.response?.data?.detail || "upload failed"}`); }
    }
    set("files", [...(item.files || []), ...added]);
    setUploading(false);
    toast.success(`${added.length} file${added.length === 1 ? "" : "s"} added`);
  };

  const uploadCover = async (file) => {
    setUploading(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const { data } = await api.post("/admin/media/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      set("cover_image", data.url);
      toast.success("Cover uploaded");
    } catch (err) { toast.error(err.response?.data?.detail || "Upload failed"); }
    finally { setUploading(false); }
  };

  const removeFile = (idx) => set("files", (item.files || []).filter((_, i) => i !== idx));
  const updateFile = (idx, patch) => {
    const next = [...(item.files || [])];
    next[idx] = { ...next[idx], ...patch };
    set("files", next);
  };
  const moveFile = (idx, dir) => {
    const next = [...(item.files || [])];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    set("files", next);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" onClick={onCancel}>
      <div className="bg-white rounded-[24px] max-w-3xl w-full max-h-[92vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()} data-testid="download-editor">
        <div className="flex justify-between items-center mb-4"><h3 className="font-accent text-2xl font-bold">{item.slug ? "Edit Download" : "New Download"}</h3><button onClick={onCancel}><X /></button></div>

        <div className="grid sm:grid-cols-2 gap-3">
          <F label="Title"><input value={item.title || ""} onChange={(e) => set("title", e.target.value)} className="inp" data-testid="download-edit-title" /></F>
          <F label="Slug"><input value={item.slug || ""} onChange={(e) => set("slug", e.target.value)} className="inp" /></F>
          <F label="Character (optional)"><select value={item.character_slug || ""} onChange={(e) => set("character_slug", e.target.value)} className="inp"><option value="">None</option>{chars.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select></F>
          <F label="Age range"><input value={item.age_range || ""} onChange={(e) => set("age_range", e.target.value)} className="inp" /></F>

          <F label="Cover image" full>
            <div className="flex gap-3 items-start">
              <div className="flex-1">
                <input value={item.cover_image || ""} onChange={(e) => set("cover_image", e.target.value)} placeholder="Paste image URL or upload below" className="inp" />
                <div className="flex gap-2 mt-2">
                  <button type="button" onClick={() => coverRef.current?.click()} className="btn-secondary text-xs"><Upload className="w-4 h-4" />Upload cover image</button>
                  <input ref={coverRef} type="file" hidden accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadCover(f); e.target.value = ""; }} data-testid="download-cover-upload-input" />
                  {item.cover_image && <button type="button" onClick={() => set("cover_image", "")} className="btn-ghost text-xs text-red-500"><Trash2 className="w-4 h-4" />Remove</button>}
                </div>
              </div>
              {item.cover_image && <img src={item.cover_image} alt="" className="w-24 h-24 rounded-2xl object-cover border-2 border-[#f4e4c6]" />}
            </div>
          </F>

          <F label="Short description" full><input value={item.short_description || ""} onChange={(e) => set("short_description", e.target.value)} className="inp" /></F>
          <F label="Long description" full><textarea value={item.long_description || ""} onChange={(e) => set("long_description", e.target.value)} className="inp min-h-[100px]" rows={4} /></F>

          <F label="Categories" full><div className="flex flex-wrap gap-2">{cats.map((c) => <button type="button" key={c.slug} onClick={() => toggleArr("category_slugs", c.slug)} className={`px-3 py-1 rounded-full text-xs font-bold ${(item.category_slugs || []).includes(c.slug) ? "bg-[#7fcfc7] text-white" : "bg-[#fffbf3] text-[#4a5568] border border-[#f4e4c6]"}`}>{c.name}</button>)}</div></F>
          <F label="Audiences" full><div className="flex flex-wrap gap-2">{AUDIENCES.map((a) => <button type="button" key={a} onClick={() => toggleArr("audiences", a)} className={`px-3 py-1 rounded-full text-xs font-bold ${(item.audiences || []).includes(a) ? "bg-[#f0a988] text-white" : "bg-[#fffbf3] text-[#4a5568] border border-[#f4e4c6]"}`}>{a}</button>)}</div></F>
          <F label="W.A.V.E. values" full><div className="flex gap-2">{WAVE.map((w) => <button type="button" key={w} onClick={() => toggleArr("wave_values", w)} className={`w-10 h-10 rounded-full font-bold ${(item.wave_values || []).includes(w) ? "bg-[#7cbf94] text-white" : "bg-[#fffbf3] text-[#4a5568] border border-[#f4e4c6]"}`}>{w}</button>)}</div></F>
        </div>

        {/* Files manager */}
        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-accent text-lg font-bold">Files to download</h4>
            <button onClick={() => fileRef.current?.click()} className="btn-primary text-sm" data-testid="download-files-upload"><Upload className="w-4 h-4" />Upload files</button>
            <input ref={fileRef} type="file" multiple hidden accept=".pdf,.png,.jpg,.jpeg,.zip,.webp,.gif" onChange={(e) => { const fs = Array.from(e.target.files || []); if (fs.length) uploadFiles(fs); e.target.value = ""; }} data-testid="download-files-input" />
          </div>
          <p className="text-xs text-[#5a6b76] mb-3">Drop in PDFs, PNGs, or ZIPs. People can download these straight to their device — no browser-print needed.</p>

          {(item.files || []).length === 0 && !uploading && (
            <div onClick={() => fileRef.current?.click()} className="border-4 border-dashed border-[#f4e4c6] rounded-3xl p-8 text-center cursor-pointer hover:bg-[#fffbf3]" data-testid="download-empty-dropzone">
              <Upload className="w-8 h-8 mx-auto text-[#7fcfc7]" />
              <div className="font-bold mt-2">No files yet — click to add</div>
              <div className="text-xs text-[#5a6b76]">PDF up to 25MB each, multiple files allowed</div>
            </div>
          )}

          {uploading && <div className="text-sm text-[#5a6b76]">Uploading...</div>}

          <div className="space-y-2 mt-2">
            {(item.files || []).map((f, idx) => (
              <div key={idx} className="bg-[#fffbf3] border-2 border-[#f4e4c6] rounded-2xl p-3 flex items-center gap-3" data-testid={`download-file-row-${idx}`}>
                <GripVertical className="w-4 h-4 text-[#5a6b76]" />
                <FileText className="w-6 h-6 text-[#f0a988]" />
                <div className="flex-1 min-w-0">
                  <input value={f.label || ""} onChange={(e) => updateFile(idx, { label: e.target.value })} placeholder="Label (e.g. Print-friendly PDF)" className="w-full px-3 py-1.5 rounded-lg border border-[#f4e4c6] text-sm font-semibold" data-testid={`download-file-label-${idx}`} />
                  <div className="text-xs text-[#5a6b76] mt-1 truncate">{f.filename}{f.page_count ? ` · ${f.page_count} page${f.page_count > 1 ? "s" : ""}` : ""}{f.size_kb ? ` · ${(f.size_kb / 1024).toFixed(1)} MB` : ""}{f.mime ? ` · ${f.mime}` : ""}</div>
                </div>
                <div className="flex flex-col gap-1">
                  <button onClick={() => moveFile(idx, -1)} className="text-xs px-2 hover:bg-white rounded">↑</button>
                  <button onClick={() => moveFile(idx, 1)} className="text-xs px-2 hover:bg-white rounded">↓</button>
                </div>
                <button onClick={() => removeFile(idx)} className="text-red-500 p-2 hover:bg-red-50 rounded-full" data-testid={`download-file-remove-${idx}`}><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 mt-5">
          <label className="flex items-center gap-2"><input type="checkbox" checked={!!item.featured} onChange={(e) => set("featured", e.target.checked)} />Featured</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={!!item.is_new} onChange={(e) => set("is_new", e.target.checked)} />NEW badge</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={item.published !== false} onChange={(e) => set("published", e.target.checked)} />Published</label>
          <F label="Email gate override"><select value={item.email_gate_override === null || item.email_gate_override === undefined ? "" : String(item.email_gate_override)} onChange={(e) => set("email_gate_override", e.target.value === "" ? null : e.target.value === "true")} className="inp"><option value="">Use site default</option><option value="true">Force gate ON</option><option value="false">Force gate OFF</option></select></F>
        </div>

        <div className="flex justify-end gap-2 mt-5"><button onClick={onCancel} className="btn-ghost">Cancel</button><button onClick={() => onSave(item)} className="btn-primary" data-testid="download-save"><Save className="w-4 h-4" />Save</button></div>
      </div>
      <style>{`.inp{width:100%;padding:10px 14px;border-radius:9999px;border:2px solid #f4e4c6;background:white;font-size:14px}.inp:focus{outline:none;border-color:#7fcfc7}textarea.inp{border-radius:18px}`}</style>
    </div>
  );
}

function F({ label, children, full }) {
  return <label className={`text-sm ${full ? "sm:col-span-2" : ""}`}><div className="font-semibold text-[#2e3a3a] mb-1">{label}</div>{children}</label>;
}

function humanLabelFor(name = "") {
  // strip extension, replace separators with spaces, title-case
  const base = name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
  return base.replace(/\b\w/g, (c) => c.toUpperCase()) || "File";
}

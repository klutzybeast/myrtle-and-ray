import { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../../lib/api";
import { toast } from "sonner";
import { Save, Send, Trash2, Plus, Heading1, Type, Image as ImageIcon, MousePointer, Quote, Code, Minus, Upload, Eye, ArrowLeft, GripVertical } from "lucide-react";

let bid = 0;
const nextId = () => `b_${Date.now()}_${bid++}`;

const BLOCK_DEFS = [
  { type: "heading", label: "Heading", icon: Heading1, blank: () => ({ id: nextId(), type: "heading", data: { text: "Heading", level: 2, align: "left" } }) },
  { type: "paragraph", label: "Paragraph", icon: Type, blank: () => ({ id: nextId(), type: "paragraph", data: { text: "Write a friendly note here.", align: "left" } }) },
  { type: "image", label: "Image", icon: ImageIcon, blank: () => ({ id: nextId(), type: "image", data: { src: "", alt: "", caption: "" } }) },
  { type: "button", label: "Button", icon: MousePointer, blank: () => ({ id: nextId(), type: "button", data: { label: "Click me", href: "https://", align: "center" } }) },
  { type: "divider", label: "Divider", icon: Minus, blank: () => ({ id: nextId(), type: "divider", data: { color: "#f4e4c6" } }) },
  { type: "spacer", label: "Spacer", icon: Minus, blank: () => ({ id: nextId(), type: "spacer", data: { height: 24 } }) },
  { type: "quote", label: "Quote", icon: Quote, blank: () => ({ id: nextId(), type: "quote", data: { text: "A favorite reader said...", author: "" } }) },
  { type: "html", label: "Raw HTML", icon: Code, blank: () => ({ id: nextId(), type: "html", data: { html: "<!-- paste HTML -->" } }) },
];

export default function AdminCampaignEditor() {
  const { id } = useParams();
  const [c, setC] = useState(null);
  const [previewHtml, setPreviewHtml] = useState("");
  const [subscribers, setSubscribers] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [filterTag, setFilterTag] = useState("");
  const [filterAudience, setFilterAudience] = useState("");
  const [testTo, setTestTo] = useState("");
  const [sending, setSending] = useState(false);
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);
  const fileRef = useRef(null);
  const [uploadTarget, setUploadTarget] = useState(null);

  const load = () => api.get(`/admin/campaigns/${id}`).then(({ data }) => {
    const blocks = (data.blocks || []).map((b) => ({ ...b, id: b.id || nextId() }));
    setC({ ...data, blocks });
  });

  useEffect(() => {
    load();
    api.get("/admin/mailing-list").then(({ data }) => setSubscribers(data));
  }, [id]);

  const refreshPreview = async () => {
    try {
      const { data } = await api.get(`/admin/campaigns/${id}/preview`);
      setPreviewHtml(data.html);
    } catch {}
  };

  useEffect(() => { if (c) refreshPreview(); }, [c?.updated_at]); // re-render after save

  if (!c) return <div className="text-[#5a6b76]">Loading...</div>;

  const set = (patch) => setC({ ...c, ...patch });
  const updateBlock = (idx, dataPatch) => {
    const blocks = [...c.blocks];
    blocks[idx] = { ...blocks[idx], data: { ...blocks[idx].data, ...dataPatch } };
    setC({ ...c, blocks });
  };
  const addBlock = (t) => {
    const def = BLOCK_DEFS.find((b) => b.type === t);
    if (!def) return;
    setC({ ...c, blocks: [...c.blocks, def.blank()] });
  };
  const removeBlock = (i) => setC({ ...c, blocks: c.blocks.filter((_, x) => x !== i) });
  const onDragStart = (i) => setDragIdx(i);
  const onDragOver = (e, i) => { e.preventDefault(); setOverIdx(i); };
  const onDrop = (i) => {
    if (dragIdx === null || dragIdx === i) { setDragIdx(null); setOverIdx(null); return; }
    const blocks = [...c.blocks];
    const [m] = blocks.splice(dragIdx, 1);
    blocks.splice(i, 0, m);
    setC({ ...c, blocks });
    setDragIdx(null); setOverIdx(null);
  };

  const save = async () => {
    try {
      const payload = { name: c.name, subject: c.subject, preview_text: c.preview_text, from_email: c.from_email, reply_to: c.reply_to, background_color: c.background_color, content_background: c.content_background, text_color: c.text_color, accent_color: c.accent_color, content_width: c.content_width, blocks: c.blocks };
      const { data } = await api.put(`/admin/campaigns/${id}`, payload);
      toast.success("Saved");
      setC({ ...data, blocks: (data.blocks || []).map((b) => ({ ...b, id: b.id || nextId() })) });
    } catch (err) { toast.error("Save failed"); }
  };

  const sendTest = async () => {
    if (!testTo) { toast.error("Enter a test email address"); return; }
    try { await api.post(`/admin/campaigns/${id}/test`, { to: testTo }); toast.success(`Test sent to ${testTo}`); }
    catch (err) { toast.error(err.response?.data?.detail || "Test send failed"); }
  };

  const filtered = subscribers.filter((s) => {
    if (filterTag && !(s.tags || []).some((t) => t.toLowerCase().includes(filterTag.toLowerCase()))) return false;
    if (filterAudience && s.audience !== filterAudience) return false;
    return true;
  });
  const toggleAll = () => {
    if (filtered.every((s) => selected.has(s.email))) {
      const next = new Set(selected);
      filtered.forEach((s) => next.delete(s.email));
      setSelected(next);
    } else {
      setSelected(new Set([...selected, ...filtered.map((s) => s.email)]));
    }
  };
  const toggleOne = (email) => {
    const next = new Set(selected);
    if (next.has(email)) next.delete(email); else next.add(email);
    setSelected(next);
  };

  const sendCampaign = async () => {
    if (selected.size === 0) { toast.error("Pick at least one recipient"); return; }
    if (!window.confirm(`Send "${c.subject || c.name}" to ${selected.size} subscriber${selected.size === 1 ? "" : "s"}?`)) return;
    setSending(true);
    try {
      const { data } = await api.post(`/admin/campaigns/${id}/send`, { recipient_emails: Array.from(selected) });
      toast.success(`Sent to ${data.sent}${data.failed ? ` (${data.failed} failed)` : ""}`);
      load();
      setSelected(new Set());
    } catch (err) { toast.error(err.response?.data?.detail || "Send failed"); }
    finally { setSending(false); }
  };

  const uploadImage = async (file) => {
    const fd = new FormData(); fd.append("file", file);
    try {
      const { data } = await api.post("/admin/media/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      const base = process.env.REACT_APP_BACKEND_URL || "";
      const fullUrl = data.url.startsWith("http") ? data.url : `${base}${data.url}`;
      if (uploadTarget?.kind === "block-image") updateBlock(uploadTarget.idx, { src: fullUrl });
      toast.success("Uploaded");
    } catch (err) { toast.error("Upload failed"); }
  };

  return (
    <div data-testid="campaign-editor">
      <header className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="min-w-0">
          <Link to="/admin/campaigns" className="text-sm text-[#5a6b76]"><ArrowLeft className="w-4 h-4 inline" />All campaigns</Link>
          <h1 className="font-accent text-3xl font-bold truncate">{c.name}</h1>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={save} className="btn-primary"><Save className="w-4 h-4" />Save</button>
        </div>
      </header>

      <input ref={fileRef} type="file" hidden accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = ""; }} />

      <div className="grid lg:grid-cols-[1fr,1fr,220px] gap-5">
        {/* LEFT: settings + blocks */}
        <div className="space-y-4">
          <section className="card-soft p-5">
            <h3 className="font-accent font-bold mb-2">Email settings</h3>
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <L lbl="Name"><input value={c.name || ""} onChange={(e) => set({ name: e.target.value })} className="inp" /></L>
              <L lbl="Subject line"><input value={c.subject || ""} onChange={(e) => set({ subject: e.target.value })} className="inp" /></L>
              <L lbl="Preview text (inbox preview)"><input value={c.preview_text || ""} onChange={(e) => set({ preview_text: e.target.value })} className="inp" /></L>
              <L lbl="Reply-to (optional)"><input value={c.reply_to || ""} onChange={(e) => set({ reply_to: e.target.value })} placeholder="community@rollingriver.com" className="inp" /></L>
              <L lbl="Background color"><Color value={c.background_color} onChange={(v) => set({ background_color: v })} /></L>
              <L lbl="Content card color"><Color value={c.content_background} onChange={(v) => set({ content_background: v })} /></L>
              <L lbl="Text color"><Color value={c.text_color} onChange={(v) => set({ text_color: v })} /></L>
              <L lbl="Accent color"><Color value={c.accent_color} onChange={(v) => set({ accent_color: v })} /></L>
              <L lbl="Content width (px)"><input type="number" min="320" max="800" value={c.content_width || 600} onChange={(e) => set({ content_width: parseInt(e.target.value, 10) || 600 })} className="inp" /></L>
            </div>
          </section>

          <h3 className="font-accent text-xl font-bold">Blocks</h3>
          {c.blocks.length === 0 && <div className="card-soft p-6 text-center text-[#5a6b76]">No blocks yet — add one from the right panel.</div>}
          <div className="space-y-3">
            {c.blocks.map((b, i) => {
              const Def = BLOCK_DEFS.find((d) => d.type === b.type);
              return (
                <div key={b.id} draggable onDragStart={() => onDragStart(i)} onDragOver={(e) => onDragOver(e, i)} onDrop={() => onDrop(i)} className={`card-soft p-4 ${overIdx === i && dragIdx !== i ? "ring-2 ring-[#7fcfc7]" : ""}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-bold text-[#5a6b76]"><GripVertical className="w-4 h-4 cursor-grab" />{Def?.label || b.type}</div>
                    <button onClick={() => removeBlock(i)} className="text-red-500 hover:bg-red-50 p-1 rounded-full"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  <BlockEditor block={b} idx={i} update={(p) => updateBlock(i, p)} onUpload={() => { setUploadTarget({ kind: "block-image", idx: i }); fileRef.current?.click(); }} />
                </div>
              );
            })}
          </div>

          {/* Recipients & send */}
          <section id="send" className="card-soft p-5">
            <h3 className="font-accent text-xl font-bold mb-2">Recipients</h3>
            <p className="text-sm text-[#5a6b76] mb-3">Pick subscribers from your mailing list. Use the filters to narrow down by tag or audience.</p>
            <div className="flex gap-2 flex-wrap mb-3">
              <input value={filterTag} onChange={(e) => setFilterTag(e.target.value)} placeholder="Filter by tag (e.g. download:color-myrtle)" className="inp flex-1 min-w-[200px]" />
              <select value={filterAudience} onChange={(e) => setFilterAudience(e.target.value)} className="inp max-w-[180px]">
                <option value="">All audiences</option>
                <option>Parent</option><option>Teacher</option><option>Camp Director</option><option>Other</option>
              </select>
              <button onClick={toggleAll} className="btn-ghost text-sm">{filtered.every((s) => selected.has(s.email)) && filtered.length > 0 ? "Unselect all" : "Select all"}</button>
            </div>
            <div className="text-xs text-[#5a6b76] mb-2">{selected.size} of {filtered.length} selected (mailing list has {subscribers.length} total)</div>
            <div className="max-h-72 overflow-y-auto border border-[#f4e4c6] rounded-2xl">
              {filtered.length === 0 ? <div className="p-4 text-sm text-[#5a6b76] text-center">No subscribers match.</div> : filtered.map((s) => (
                <label key={s.email} className="flex items-center gap-2 px-3 py-2 border-b border-[#f4e4c6] last:border-0 hover:bg-[#fffbf3] text-sm cursor-pointer">
                  <input type="checkbox" checked={selected.has(s.email)} onChange={() => toggleOne(s.email)} />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{s.email}</div>
                    <div className="text-xs text-[#5a6b76] truncate">{s.name} {s.source && `· ${s.source}`} {s.audience && `· ${s.audience}`}{(s.tags || []).length ? ` · ${s.tags.join(", ")}` : ""}</div>
                  </div>
                </label>
              ))}
            </div>

            <div className="mt-4 grid sm:grid-cols-[1fr,auto,auto] gap-2 items-center">
              <input value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="Send test email to..." className="inp" />
              <button onClick={sendTest} className="btn-secondary text-sm"><Send className="w-4 h-4" />Test</button>
              <button onClick={sendCampaign} disabled={sending || selected.size === 0} className="btn-primary"><Send className="w-4 h-4" />{sending ? "Sending..." : `Send to ${selected.size}`}</button>
            </div>
            {c.status === "sent" && <div className="mt-2 text-xs text-[#5a8a6f]">Last sent: {c.last_sent_at} · Total sent so far: {c.total_sent}</div>}
          </section>
        </div>

        {/* MIDDLE: live preview */}
        <aside>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-accent font-bold text-sm uppercase tracking-wider text-[#5a6b76]"><Eye className="w-4 h-4 inline" />Live preview</h3>
            <button onClick={refreshPreview} className="text-xs text-[#5a8a6f] underline">Refresh</button>
          </div>
          <div className="border-2 border-[#f4e4c6] rounded-2xl overflow-hidden bg-white" style={{ height: "calc(100vh - 200px)", minHeight: 500 }}>
            <iframe title="Email preview" srcDoc={previewHtml} className="w-full h-full" />
          </div>
        </aside>

        {/* RIGHT: add blocks */}
        <aside className="card-soft p-3 h-fit sticky top-20">
          <h3 className="font-accent font-bold mb-2 text-sm uppercase tracking-wider text-[#5a6b76]"><Plus className="w-4 h-4 inline" />Add block</h3>
          <div className="grid grid-cols-2 gap-2">
            {BLOCK_DEFS.map((b) => (
              <button key={b.type} onClick={() => addBlock(b.type)} className="flex flex-col items-center gap-1 p-2 rounded-xl bg-[#fffbf3] hover:bg-[#eef9fb] border border-[#f4e4c6] text-xs font-bold">
                <b.icon className="w-5 h-5 text-[#7cbf94]" />{b.label}
              </button>
            ))}
          </div>
        </aside>
      </div>

      <style>{`.inp{width:100%;padding:8px 12px;border-radius:9999px;border:2px solid #f4e4c6;background:white;font-size:13px}.inp:focus{outline:none;border-color:#7fcfc7}textarea.inp{border-radius:14px}`}</style>
    </div>
  );
}

function L({ lbl, children }) { return <label className="block"><div className="font-semibold mb-1 text-[#3a4a55]">{lbl}</div>{children}</label>; }
function Color({ value, onChange }) { return <div className="flex gap-2 items-center"><input type="color" value={value || "#ffffff"} onChange={(e) => onChange(e.target.value)} className="w-12 h-10 rounded-md border border-[#f4e4c6]" /><input value={value || ""} onChange={(e) => onChange(e.target.value)} className="inp" /></div>; }

function BlockEditor({ block, idx, update, onUpload }) {
  const d = block.data || {};
  switch (block.type) {
    case "heading":
      return (
        <div className="grid sm:grid-cols-[1fr,auto,auto] gap-2">
          <input value={d.text || ""} onChange={(e) => update({ text: e.target.value })} className="inp" />
          <select value={d.level || 2} onChange={(e) => update({ level: parseInt(e.target.value, 10) })} className="inp"><option value={1}>H1</option><option value={2}>H2</option><option value={3}>H3</option></select>
          <select value={d.align || "left"} onChange={(e) => update({ align: e.target.value })} className="inp"><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select>
        </div>
      );
    case "paragraph":
      return <div className="grid gap-2"><textarea value={d.text || ""} onChange={(e) => update({ text: e.target.value })} rows={4} className="inp min-h-[100px]" /><select value={d.align || "left"} onChange={(e) => update({ align: e.target.value })} className="inp max-w-[140px]"><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></div>;
    case "image":
      return (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input value={d.src || ""} onChange={(e) => update({ src: e.target.value })} placeholder="Image URL" className="inp flex-1" />
            <button onClick={onUpload} className="btn-secondary text-xs"><Upload className="w-4 h-4" />Upload</button>
          </div>
          {d.src && <img src={d.src} alt="" className="max-h-40 rounded-xl" />}
          <input value={d.alt || ""} onChange={(e) => update({ alt: e.target.value })} placeholder="Alt text" className="inp" />
          <input value={d.caption || ""} onChange={(e) => update({ caption: e.target.value })} placeholder="Caption (optional)" className="inp" />
        </div>
      );
    case "button":
      return (
        <div className="grid sm:grid-cols-2 gap-2">
          <input value={d.label || ""} onChange={(e) => update({ label: e.target.value })} placeholder="Button label" className="inp" />
          <input value={d.href || ""} onChange={(e) => update({ href: e.target.value })} placeholder="Link URL" className="inp" />
          <div className="flex gap-2 items-center"><span className="text-xs">Button color</span><input type="color" value={d.button_color || "#f0a988"} onChange={(e) => update({ button_color: e.target.value })} className="w-10 h-8 rounded" /></div>
          <select value={d.align || "center"} onChange={(e) => update({ align: e.target.value })} className="inp"><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select>
        </div>
      );
    case "divider":
      return <div className="flex gap-2 items-center text-sm"><span>Color</span><input type="color" value={d.color || "#f4e4c6"} onChange={(e) => update({ color: e.target.value })} className="w-12 h-8 rounded" /></div>;
    case "spacer":
      return <label className="text-sm flex items-center gap-2"><span>Height (px)</span><input type="number" value={d.height || 24} onChange={(e) => update({ height: parseInt(e.target.value, 10) || 0 })} className="inp max-w-[120px]" /></label>;
    case "quote":
      return <div className="grid gap-2"><textarea value={d.text || ""} onChange={(e) => update({ text: e.target.value })} rows={3} className="inp" /><input value={d.author || ""} onChange={(e) => update({ author: e.target.value })} placeholder="Author (optional)" className="inp" /></div>;
    case "html":
      return <textarea value={d.html || ""} onChange={(e) => update({ html: e.target.value })} rows={6} className="inp font-mono text-xs min-h-[120px]" />;
    default: return null;
  }
}

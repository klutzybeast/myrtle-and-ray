import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api } from "../../lib/api";
import { toast } from "sonner";
import { Save, Trash2, GripVertical, Plus, Heading1, Type, Image as ImageIcon, Images, Film, MousePointer, Quote, Code, Minus, Eye, EyeOff, Upload, ExternalLink } from "lucide-react";
import AIThumbnailButton from "../../components/admin/AIThumbnailButton";
import BlockPreview from "./BlockPreview";

let blockId = 0;
const nextId = () => `b_${Date.now()}_${blockId++}`;

const BLOCK_TYPES = [
  { type: "heading", label: "Heading", icon: Heading1, blank: () => ({ id: nextId(), type: "heading", data: { text: "New Heading", level: 2, align: "left" } }) },
  { type: "paragraph", label: "Paragraph", icon: Type, blank: () => ({ id: nextId(), type: "paragraph", data: { text: "Write your story here. You can use multiple paragraphs.", align: "left" } }) },
  { type: "image", label: "Single Image", icon: ImageIcon, blank: () => ({ id: nextId(), type: "image", data: { src: "", alt: "", caption: "", width: "full" } }) },
  { type: "gallery", label: "Photo Gallery", icon: Images, blank: () => ({ id: nextId(), type: "gallery", data: { items: [], columns: 3 } }) },
  { type: "video", label: "Video Embed", icon: Film, blank: () => ({ id: nextId(), type: "video", data: { url: "", caption: "" } }) },
  { type: "button", label: "Button / CTA", icon: MousePointer, blank: () => ({ id: nextId(), type: "button", data: { label: "Click me", href: "#", style: "primary", align: "left" } }) },
  { type: "quote", label: "Quote", icon: Quote, blank: () => ({ id: nextId(), type: "quote", data: { text: "A favorite reader said...", author: "" } }) },
  { type: "spacer", label: "Spacer", icon: Minus, blank: () => ({ id: nextId(), type: "spacer", data: { height: 32 } }) },
  { type: "html", label: "Embed / Raw HTML", icon: Code, blank: () => ({ id: nextId(), type: "html", data: { html: "<!-- paste embed code here -->" } }) },
];

export default function AdminCustomPageEditor() {
  const { slug } = useParams();
  const nav = useNavigate();
  const [page, setPage] = useState(null);
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);
  const fileInputRef = useRef(null);
  const [uploadTarget, setUploadTarget] = useState(null); // { blockIdx, galleryIdx? }
  const [showPreview, setShowPreview] = useState(true);

  useEffect(() => {
    api.get(`/admin/custom-pages/${slug}`).then(({ data }) => {
      const blocks = (data.blocks || []).map((b) => ({ ...b, id: b.id || nextId() }));
      setPage({ ...data, blocks });
    }).catch(() => toast.error("Page not found"));
  }, [slug]);

  if (!page) return <div className="text-[#5a6b76]">Loading...</div>;

  const update = (patch) => setPage((p) => ({ ...p, ...patch }));
  const updateBlock = (idx, dataPatch) => {
    setPage((p) => {
      const blocks = [...p.blocks];
      blocks[idx] = { ...blocks[idx], data: { ...blocks[idx].data, ...dataPatch } };
      return { ...p, blocks };
    });
  };
  const removeBlock = (idx) => setPage((p) => ({ ...p, blocks: p.blocks.filter((_, i) => i !== idx) }));
  const addBlock = (typ) => {
    const def = BLOCK_TYPES.find((t) => t.type === typ);
    if (!def) return;
    setPage((p) => ({ ...p, blocks: [...p.blocks, def.blank()] }));
  };

  const onDragStart = (idx) => setDragIdx(idx);
  const onDragOver = (e, idx) => { e.preventDefault(); setOverIdx(idx); };
  const onDrop = (idx) => {
    if (dragIdx === null || dragIdx === idx) { setDragIdx(null); setOverIdx(null); return; }
    setPage((p) => {
      const blocks = [...p.blocks];
      const [moved] = blocks.splice(dragIdx, 1);
      blocks.splice(idx, 0, moved);
      return { ...p, blocks };
    });
    setDragIdx(null); setOverIdx(null);
  };

  const save = async () => {
    try {
      const blocks = page.blocks.map(({ id, ...rest }) => ({ id, ...rest }));
      await api.put(`/admin/custom-pages/${slug}`, {
        title: page.title, blocks, seo_title: page.seo_title || "", meta_description: page.meta_description || "",
        hero_image: page.hero_image || "", published: page.published, show_in_footer: !!page.show_in_footer,
      });
      toast.success("Saved!");
    } catch (err) { toast.error("Save failed"); }
  };

  const uploadFile = async (file, target) => {
    const fd = new FormData(); fd.append("file", file);
    try {
      const { data } = await api.post("/admin/media/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      const fullUrl = data.url;
      if (target.galleryIdx !== undefined) {
        // add to gallery items
        setPage((p) => {
          const blocks = [...p.blocks];
          const items = [...(blocks[target.blockIdx].data.items || []), { src: fullUrl, alt: "", caption: "" }];
          blocks[target.blockIdx] = { ...blocks[target.blockIdx], data: { ...blocks[target.blockIdx].data, items } };
          return { ...p, blocks };
        });
      } else if (target.field === "image-src") {
        updateBlock(target.blockIdx, { src: fullUrl });
      } else if (target.field === "hero") {
        update({ hero_image: fullUrl });
      }
      toast.success("Uploaded");
    } catch (err) { toast.error("Upload failed"); }
  };

  const triggerUpload = (target) => {
    setUploadTarget(target);
    fileInputRef.current?.click();
  };

  const onFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    for (const f of files) await uploadFile(f, uploadTarget);
    e.target.value = "";
  };

  return (
    <div data-testid="custom-page-editor">
      <input ref={fileInputRef} type="file" multiple hidden onChange={onFileChange} accept="image/*,application/pdf" />

      <header className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="min-w-0">
          <Link to="/admin/custom-pages" className="text-sm text-[#5a6b76] hover:text-[#5a8a6f]">← All custom pages</Link>
          <h1 className="font-accent text-3xl font-bold truncate">{page.title || page.slug}</h1>
          <div className="text-xs text-[#5a6b76]">/p/{page.slug}</div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setShowPreview((v) => !v)} className="btn-ghost text-sm" data-testid="toggle-preview">
            {showPreview ? <><EyeOff className="w-4 h-4" />Hide preview</> : <><Eye className="w-4 h-4" />Show preview</>}
          </button>
          <a href={`/p/${page.slug}`} target="_blank" rel="noopener noreferrer" className="btn-secondary text-sm"><ExternalLink className="w-4 h-4" />Open live</a>
          <button onClick={save} className="btn-primary" data-testid="custom-page-save"><Save className="w-4 h-4" />Save</button>
        </div>
      </header>

      <div className={`grid gap-6 ${showPreview ? "lg:grid-cols-[1fr,1fr,240px]" : "lg:grid-cols-[1fr,260px]"}`}>
        {/* Main editor column */}
        <div>
          <section className="card-soft p-5 mb-4">
            <h3 className="font-accent font-bold mb-2">Page meta</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="text-sm"><div className="font-semibold mb-1">Title</div><input value={page.title || ""} onChange={(e) => update({ title: e.target.value })} className="inp" /></label>
              <label className="text-sm"><div className="font-semibold mb-1">SEO Title</div><input value={page.seo_title || ""} onChange={(e) => update({ seo_title: e.target.value })} className="inp" /></label>
              <label className="text-sm sm:col-span-2"><div className="font-semibold mb-1">Meta Description</div><input value={page.meta_description || ""} onChange={(e) => update({ meta_description: e.target.value })} className="inp" /></label>
              <label className="text-sm sm:col-span-2">
                <div className="font-semibold mb-1">Hero Image (optional)</div>
                <div className="flex gap-2">
                  <input value={page.hero_image || ""} onChange={(e) => update({ hero_image: e.target.value })} placeholder="Paste image URL or upload" className="inp flex-1" />
                  <button type="button" onClick={() => triggerUpload({ field: "hero" })} className="btn-ghost text-xs"><Upload className="w-4 h-4" />Upload</button>
                  <AIThumbnailButton
                    kind="custom_page"
                    title={page.title || ""}
                    defaultPrompt={`Hero banner for the page: ${page.title || ""}`}
                    onChosen={(url) => update({ hero_image: url })}
                  />
                </div>
              </label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={page.published !== false} onChange={(e) => update({ published: e.target.checked })} />Published</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!page.show_in_footer} onChange={(e) => update({ show_in_footer: e.target.checked })} />Show in footer Quick Links</label>
            </div>
          </section>

          <h3 className="font-accent text-xl font-bold mb-2">Blocks</h3>
          {page.blocks.length === 0 && (
            <div className="card-soft p-8 text-center text-[#5a6b76]">No blocks yet. Tap a block on the right to add one.</div>
          )}
          <div className="space-y-3">
            {page.blocks.map((b, idx) => {
              const Def = BLOCK_TYPES.find((t) => t.type === b.type);
              return (
                <div
                  key={b.id}
                  draggable
                  onDragStart={() => onDragStart(idx)}
                  onDragOver={(e) => onDragOver(e, idx)}
                  onDrop={() => onDrop(idx)}
                  className={`card-soft p-4 transition ${overIdx === idx && dragIdx !== idx ? "ring-2 ring-[#7fcfc7]" : ""}`}
                  data-testid={`block-${b.type}-${idx}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-bold text-[#5a6b76]">
                      <GripVertical className="w-4 h-4 cursor-grab" /> {Def?.label || b.type}
                    </div>
                    <button onClick={() => removeBlock(idx)} className="text-red-500 hover:bg-red-50 p-1 rounded-full" data-testid={`block-delete-${idx}`}><Trash2 className="w-4 h-4" /></button>
                  </div>
                  <BlockEditor block={b} idx={idx} update={(p) => updateBlock(idx, p)} triggerUpload={triggerUpload} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Live preview column */}
        {showPreview && (
          <aside className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-100px)] overflow-hidden" data-testid="live-preview">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-accent font-bold text-sm uppercase tracking-wider text-[#5a6b76]">Live preview</h3>
              <span className="text-[10px] text-[#5a6b76]">Updates as you type</span>
            </div>
            <BlockPreview page={page} />
          </aside>
        )}

        {/* Sidebar: add block */}
        <aside className="card-soft p-4 h-fit sticky top-20">
          <h3 className="font-accent font-bold mb-3 flex items-center gap-2"><Plus className="w-4 h-4" />Add a block</h3>
          <div className="grid grid-cols-2 gap-2">
            {BLOCK_TYPES.map((bt) => (
              <button key={bt.type} onClick={() => addBlock(bt.type)} className="flex flex-col items-center gap-1 p-3 rounded-2xl bg-[#fffbf3] hover:bg-[#eef9fb] border-2 border-[#f4e4c6] text-xs font-bold" data-testid={`add-block-${bt.type}`}>
                <bt.icon className="w-5 h-5 text-[#7cbf94]" /><span>{bt.label}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-[#5a6b76] mt-3">Drag blocks by their handle to reorder.</p>
        </aside>
      </div>

      <style>{`.inp{width:100%;padding:10px 14px;border-radius:9999px;border:2px solid #f4e4c6;background:white;font-size:14px}.inp:focus{outline:none;border-color:#7fcfc7}textarea.inp{border-radius:18px}`}</style>
    </div>
  );
}

function BlockEditor({ block, idx, update, triggerUpload }) {
  const d = block.data || {};
  switch (block.type) {
    case "heading":
      return (
        <div className="grid sm:grid-cols-[1fr,auto,auto] gap-2">
          <input value={d.text || ""} onChange={(e) => update({ text: e.target.value })} placeholder="Heading text" className="inp" data-testid={`heading-text-${idx}`} />
          <select value={d.level || 2} onChange={(e) => update({ level: parseInt(e.target.value, 10) })} className="inp">
            <option value={1}>H1 (huge)</option><option value={2}>H2 (large)</option><option value={3}>H3 (medium)</option>
          </select>
          <select value={d.align || "left"} onChange={(e) => update({ align: e.target.value })} className="inp">
            <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option>
          </select>
        </div>
      );
    case "paragraph":
      return (
        <div className="grid gap-2">
          <textarea value={d.text || ""} onChange={(e) => update({ text: e.target.value })} rows={5} placeholder="Write your paragraph. Blank lines start new paragraphs." className="inp min-h-[120px]" data-testid={`paragraph-text-${idx}`} />
          <select value={d.align || "left"} onChange={(e) => update({ align: e.target.value })} className="inp max-w-[150px]"><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select>
        </div>
      );
    case "image":
      return (
        <div className="grid gap-2">
          <div className="flex gap-2">
            <input value={d.src || ""} onChange={(e) => update({ src: e.target.value })} placeholder="Image URL or upload" className="inp flex-1" />
            <button onClick={() => triggerUpload({ blockIdx: idx, field: "image-src" })} className="btn-ghost text-xs"><Upload className="w-4 h-4" />Upload</button>
          </div>
          {d.src && <img src={d.src} alt="" className="rounded-2xl max-h-60 object-cover" />}
          <input value={d.alt || ""} onChange={(e) => update({ alt: e.target.value })} placeholder="Alt text (for accessibility)" className="inp" />
          <input value={d.caption || ""} onChange={(e) => update({ caption: e.target.value })} placeholder="Caption (optional)" className="inp" />
          <select value={d.width || "full"} onChange={(e) => update({ width: e.target.value })} className="inp max-w-[200px]"><option value="full">Full width</option><option value="wide">Wide</option><option value="narrow">Narrow</option></select>
        </div>
      );
    case "gallery": {
      const items = d.items || [];
      const setItem = (i, patch) => {
        const next = [...items];
        next[i] = { ...next[i], ...patch };
        update({ items: next });
      };
      const removeItem = (i) => update({ items: items.filter((_, j) => j !== i) });
      const move = (i, dir) => {
        const next = [...items];
        const j = i + dir;
        if (j < 0 || j >= next.length) return;
        [next[i], next[j]] = [next[j], next[i]];
        update({ items: next });
      };
      return (
        <div className="space-y-3">
          <div className="flex gap-2 items-center">
            <label className="text-sm font-semibold">Columns</label>
            <select value={d.columns || 3} onChange={(e) => update({ columns: parseInt(e.target.value, 10) })} className="inp max-w-[100px]"><option value={2}>2</option><option value={3}>3</option><option value={4}>4</option></select>
            <button onClick={() => triggerUpload({ blockIdx: idx, galleryIdx: items.length })} className="btn-primary text-sm ml-auto" data-testid={`gallery-upload-${idx}`}><Upload className="w-4 h-4" />Upload photos</button>
            <button onClick={() => update({ items: [...items, { src: "", alt: "", caption: "" }] })} className="btn-ghost text-sm">+ URL</button>
          </div>
          {items.length === 0 && <div className="text-sm text-[#5a6b76]">No photos yet. Upload one or more to start your gallery.</div>}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {items.map((it, i) => (
              <div key={i} className="bg-[#fffbf3] border-2 border-[#f4e4c6] rounded-2xl overflow-hidden">
                <div className="aspect-square bg-[#eef9fb]">{it.src ? <img src={it.src} alt={it.alt || ""} className="w-full h-full object-cover" /> : <div className="grid place-items-center h-full text-xs text-[#5a6b76]">no image</div>}</div>
                <div className="p-2 space-y-1">
                  <input value={it.src || ""} onChange={(e) => setItem(i, { src: e.target.value })} placeholder="Image URL" className="w-full px-2 py-1 rounded-md border border-[#f4e4c6] text-xs" />
                  <input value={it.caption || ""} onChange={(e) => setItem(i, { caption: e.target.value })} placeholder="Caption" className="w-full px-2 py-1 rounded-md border border-[#f4e4c6] text-xs" />
                  <div className="flex justify-between text-xs">
                    <div className="flex gap-1">
                      <button onClick={() => move(i, -1)} className="px-2 hover:bg-gray-100 rounded">↑</button>
                      <button onClick={() => move(i, 1)} className="px-2 hover:bg-gray-100 rounded">↓</button>
                    </div>
                    <button onClick={() => removeItem(i)} className="text-red-500 hover:bg-red-50 rounded p-1"><Trash2 className="w-3 h-3" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }
    case "video":
      return (
        <div className="grid gap-2">
          <input value={d.url || ""} onChange={(e) => update({ url: e.target.value })} placeholder="YouTube/Vimeo embed URL (e.g. https://www.youtube.com/embed/...)" className="inp" data-testid={`video-url-${idx}`} />
          <input value={d.caption || ""} onChange={(e) => update({ caption: e.target.value })} placeholder="Caption (optional)" className="inp" />
        </div>
      );
    case "button":
      return (
        <div className="grid sm:grid-cols-2 gap-2">
          <input value={d.label || ""} onChange={(e) => update({ label: e.target.value })} placeholder="Button label" className="inp" />
          <input value={d.href || ""} onChange={(e) => update({ href: e.target.value })} placeholder="Link URL" className="inp" />
          <select value={d.style || "primary"} onChange={(e) => update({ style: e.target.value })} className="inp"><option value="primary">Primary (gradient)</option><option value="secondary">Secondary (outline)</option><option value="ghost">Ghost</option></select>
          <select value={d.align || "left"} onChange={(e) => update({ align: e.target.value })} className="inp"><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select>
        </div>
      );
    case "quote":
      return (
        <div className="grid gap-2">
          <textarea value={d.text || ""} onChange={(e) => update({ text: e.target.value })} rows={3} placeholder="Quote text" className="inp" />
          <input value={d.author || ""} onChange={(e) => update({ author: e.target.value })} placeholder="Author (optional)" className="inp" />
        </div>
      );
    case "spacer":
      return (
        <label className="text-sm flex items-center gap-2"><span className="font-semibold">Height (px)</span><input type="number" value={d.height || 32} onChange={(e) => update({ height: parseInt(e.target.value, 10) || 0 })} className="inp max-w-[120px]" /></label>
      );
    case "html":
      return (
        <textarea value={d.html || ""} onChange={(e) => update({ html: e.target.value })} rows={6} placeholder="Paste embed HTML (Instagram, TikTok, X, etc.)" className="inp font-mono text-xs min-h-[120px]" data-testid={`html-block-${idx}`} />
      );
    default:
      return <div className="text-sm text-[#5a6b76]">Unknown block type: {block.type}</div>;
  }
}

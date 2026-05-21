import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../lib/api";
import { toast } from "sonner";
import { Loader2, Upload, Wand2, RefreshCw, Trash2, Play } from "lucide-react";

function fullUrl(u) {
  if (!u) return "";
  if (u.startsWith("http")) return u;
  return `${process.env.REACT_APP_BACKEND_URL}${u}`;
}

const BATCH_LIMIT = 5;

export default function AdminReadAloud() {
  const [loading, setLoading] = useState(true);
  const [book, setBook] = useState({ title: "", pages: [], characters: [] });
  const [busyPage, setBusyPage] = useState(null);  // page number being saved/generated
  const [bulkBusy, setBulkBusy] = useState(false);
  const fileRefs = useRef({});

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/read-aloud/book");
      setBook(data || { pages: [], characters: [] });
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to load book");
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const characterOptions = useMemo(
    () => (book.characters || []).map((c) => ({ slug: c.slug, name: c.name, image_url: c.image_url })),
    [book.characters]
  );

  const patchPage = async (pageNum, patch) => {
    setBusyPage(pageNum);
    try {
      await api.patch(`/admin/read-aloud/page/${pageNum}`, patch);
      setBook((b) => ({
        ...b,
        pages: b.pages.map((p) =>
          p.page === pageNum
            ? {
                ...p,
                ...patch,
                // If text or speaker changed, audio must be regenerated
                audio_url: patch.text !== undefined || patch.character_slug !== undefined ? "" : p.audio_url,
              }
            : p
        ),
      }));
    } catch (e) {
      toast.error(e.response?.data?.detail || "Save failed");
    }
    setBusyPage(null);
  };

  const generatePage = async (pageNum) => {
    setBusyPage(pageNum);
    try {
      const { data } = await api.post(`/admin/read-aloud/generate/${pageNum}`);
      setBook((b) => ({
        ...b,
        pages: b.pages.map((p) => (p.page === pageNum ? { ...p, audio_url: data.audio_url } : p)),
      }));
      toast.success(`Page ${pageNum} audio ready (${data.chars} chars)`);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Generation failed");
    }
    setBusyPage(null);
  };

  const generateAll = async () => {
    setBulkBusy(true);
    try {
      const { data } = await api.post("/admin/read-aloud/generate-all");
      const ok = data.results.filter((r) => r.ok).length;
      const fail = data.results.filter((r) => !r.ok);
      toast.success(`Generated audio for ${ok} of ${data.total} pages`);
      if (fail.length) {
        toast.error(`Failed: ${fail.map((f) => `p${f.page}`).join(", ")}`);
      }
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Bulk generation failed");
    }
    setBulkBusy(false);
  };

  const uploadImage = async (pageNum, file) => {
    setBusyPage(pageNum);
    try {
      const fd = new FormData(); fd.append("file", file); fd.append("tags", "readaloud");
      const { data } = await api.post("/admin/media/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      if (data?.url) {
        await api.patch(`/admin/read-aloud/page/${pageNum}`, { image_url: data.url });
        setBook((b) => ({
          ...b,
          pages: b.pages.map((p) => (p.page === pageNum ? { ...p, image_url: data.url } : p)),
        }));
        toast.success(`Page ${pageNum} image uploaded`);
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || "Upload failed");
    }
    setBusyPage(null);
  };

  const bulkUploadImages = async (startPage, files) => {
    const arr = Array.from(files).slice(0, BATCH_LIMIT);
    if (!arr.length) return;
    setBulkBusy(true);
    let assigned = startPage;
    for (const f of arr) {
      if (assigned > (book.pages.at(-1)?.page || 0)) break;
      try {
        const fd = new FormData(); fd.append("file", f); fd.append("tags", "readaloud");
        const { data } = await api.post("/admin/media/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
        if (data?.url) {
          await api.patch(`/admin/read-aloud/page/${assigned}`, { image_url: data.url });
        }
      } catch (e) {
        toast.error(`Page ${assigned}: ${e.response?.data?.detail || "upload failed"}`);
      }
      assigned += 1;
    }
    setBulkBusy(false);
    toast.success(`Uploaded ${arr.length} image(s) starting at page ${startPage}`);
    await load();
  };

  const pagesWithAudio = (book.pages || []).filter((p) => p.audio_url).length;
  const totalPages = (book.pages || []).length;

  if (loading) {
    return <div className="grid place-items-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-[#7fcfc7]" /></div>;
  }

  return (
    <div className="space-y-6" data-testid="admin-readaloud">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-accent text-3xl md:text-4xl font-bold">Read-Aloud Book</h1>
          <p className="text-sm text-[#6b7280] mt-1">
            {book.title || "Untitled"} — <span className="font-bold text-[#5a8a6f]">{pagesWithAudio}/{totalPages}</span> pages have audio.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <BulkUploader pages={book.pages} onUpload={bulkUploadImages} disabled={bulkBusy} />
          <button onClick={generateAll} disabled={bulkBusy} className="btn-primary" data-testid="readaloud-generate-all">
            {bulkBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            Generate all audio
          </button>
          <button onClick={load} className="btn-ghost" data-testid="readaloud-refresh"><RefreshCw className="w-4 h-4" />Refresh</button>
        </div>
      </header>

      <div className="grid gap-4">
        {(book.pages || []).map((p) => {
          const speaker = characterOptions.find((c) => c.slug === p.character_slug);
          const isBusy = busyPage === p.page;
          return (
            <div key={p.page} className="card-cream p-4 md:p-5" data-testid={`readaloud-row-${p.page}`}>
              <div className="grid md:grid-cols-[120px_1fr_220px] gap-4 items-start">
                {/* Image preview / uploader */}
                <div>
                  <div className="aspect-[4/5] rounded-xl border-2 border-dashed border-[#f4e4c6] bg-[#fffbf3] grid place-items-center overflow-hidden">
                    {p.image_url ? (
                      <img src={fullUrl(p.image_url)} alt={`Page ${p.page}`} className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center text-[#a08660] text-xs px-2">Page {p.page}<br/>No image</div>
                    )}
                  </div>
                  <input
                    ref={(el) => { fileRefs.current[p.page] = el; }}
                    type="file" accept="image/*" hidden
                    onChange={(e) => { if (e.target.files?.[0]) uploadImage(p.page, e.target.files[0]); e.target.value = ""; }}
                  />
                  <button onClick={() => fileRefs.current[p.page]?.click()} disabled={isBusy} className="btn-ghost text-xs w-full justify-center mt-2" data-testid={`readaloud-upload-${p.page}`}>
                    <Upload className="w-3 h-3" />{p.image_url ? "Replace" : "Upload PNG"}
                  </button>
                </div>

                {/* Text editor */}
                <div>
                  <div className="text-xs font-bold uppercase tracking-wide text-[#a08660] mb-1">Page {p.page}</div>
                  <textarea
                    defaultValue={p.text}
                    rows={6}
                    onBlur={(e) => { if (e.target.value.trim() !== p.text) patchPage(p.page, { text: e.target.value }); }}
                    className="input w-full font-accent text-[15px] leading-snug"
                    data-testid={`readaloud-text-${p.page}`}
                  />
                  <p className="text-[11px] text-[#6b7280] mt-1">Changes save when you click away. Editing text clears the audio — regenerate it below.</p>
                </div>

                {/* Speaker + audio */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wide text-[#a08660]">Read by</label>
                  <select
                    value={p.character_slug || ""}
                    onChange={(e) => patchPage(p.page, { character_slug: e.target.value })}
                    className="input w-full"
                    data-testid={`readaloud-speaker-${p.page}`}
                  >
                    <option value="">— No voice —</option>
                    {characterOptions.map((c) => (
                      <option key={c.slug} value={c.slug}>{c.name}</option>
                    ))}
                  </select>
                  {speaker && (
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-[#eef9fb]">
                      {speaker.image_url && <img src={fullUrl(speaker.image_url)} alt="" className="w-9 h-9 rounded-full object-cover" />}
                      <div className="text-sm font-semibold truncate">{speaker.name}</div>
                    </div>
                  )}

                  {p.audio_url ? (
                    <audio src={fullUrl(p.audio_url)} controls className="w-full h-9" data-testid={`readaloud-audio-${p.page}`} />
                  ) : (
                    <div className="text-xs text-[#a08660] italic">No audio yet</div>
                  )}

                  <button
                    onClick={() => generatePage(p.page)}
                    disabled={isBusy || !p.character_slug}
                    className="btn-secondary w-full justify-center text-sm"
                    data-testid={`readaloud-generate-${p.page}`}
                  >
                    {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                    {p.audio_url ? "Regenerate audio" : "Generate audio"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BulkUploader({ pages, onUpload, disabled }) {
  const ref = useRef(null);
  const [startPage, setStartPage] = useState(1);
  const totalPages = pages?.length || 0;
  return (
    <div className="flex items-center gap-2">
      <select value={startPage} onChange={(e) => setStartPage(Number(e.target.value))} className="input text-sm py-1.5" data-testid="readaloud-bulk-start">
        {Array.from({ length: totalPages }).map((_, i) => (
          <option key={i + 1} value={i + 1}>Start at page {i + 1}</option>
        ))}
      </select>
      <input
        ref={ref}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        hidden
        onChange={(e) => { onUpload(startPage, e.target.files); e.target.value = ""; }}
      />
      <button onClick={() => ref.current?.click()} disabled={disabled} className="btn-secondary text-sm" data-testid="readaloud-bulk-upload">
        <Upload className="w-4 h-4" />Upload pages (5 max)
      </button>
    </div>
  );
}

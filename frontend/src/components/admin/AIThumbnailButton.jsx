import { useEffect, useState } from "react";
import { Wand2, Loader2, X, Check, Download, Folder, ImageIcon as ImgIcon } from "lucide-react";
import { api } from "../../lib/api";
import { toast } from "sonner";
import { characterFirstName } from "../../lib/characterName";

// Reusable AI thumbnail button.
//   <AIThumbnailButton kind="product" title="My Product"
//                      onChosen={(url) => setImageUrl(url)} />
// Opens a modal with character multi-select + scene prompt + aspect picker
// and on success returns the saved /api/uploads/thumbnails/... URL.

const ASPECTS = [
  { v: "square", l: "Square 1:1" },
  { v: "wide", l: "Wide 16:9" },
  { v: "tall", l: "Tall 9:16" },
];

export default function AIThumbnailButton({
  kind = "general",
  title = "",
  defaultPrompt = "",
  onChosen,
  label = "Generate with AI",
  buttonClassName = "btn-secondary text-xs",
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("generate"); // "generate" | "library"
  const [characters, setCharacters] = useState([]);
  const [picked, setPicked] = useState([]);
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [aspect, setAspect] = useState("square");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  // Library tab
  const [library, setLibrary] = useState([]);
  const [libLoading, setLibLoading] = useState(false);
  const [libSearch, setLibSearch] = useState("");
  const [libKindFilter, setLibKindFilter] = useState("all");

  useEffect(() => {
    if (!open) return;
    setPrompt(defaultPrompt || prompt);
    api.get("/characters").then(({ data }) => setCharacters((data || []).filter((c) => c.image_url || c.role))).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Auto-load library when user opens that tab
  useEffect(() => {
    if (!open || tab !== "library") return;
    setLibLoading(true);
    const params = new URLSearchParams();
    if (libKindFilter !== "all") params.set("kind", libKindFilter);
    params.set("limit", "200");
    api.get(`/admin/thumbnails?${params.toString()}`)
      .then(({ data }) => setLibrary(data.thumbnails || []))
      .catch(() => setLibrary([]))
      .finally(() => setLibLoading(false));
  }, [open, tab, libKindFilter]);

  const filteredLibrary = library.filter((t) => {
    if (!libSearch.trim()) return true;
    const q = libSearch.toLowerCase();
    return (t.title || "").toLowerCase().includes(q)
        || (t.scene_prompt || "").toLowerCase().includes(q)
        || (t.character_slugs || []).join(" ").toLowerCase().includes(q);
  });

  const reset = () => { setPicked([]); setResult(null); setPrompt(defaultPrompt); };

  const isAll = picked.length === 1 && picked[0] === "all";
  const toggleAll = () => setPicked(isAll ? [] : ["all"]);
  const toggleChar = (slug) => {
    if (isAll) {
      setPicked([slug]);
      return;
    }
    setPicked((prev) => prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug].slice(0, 4));
  };

  const generate = async () => {
    if (!prompt.trim()) { toast.error("Add a short scene prompt."); return; }
    setBusy(true); setResult(null);
    try {
      const body = {
        kind,
        title: title.trim(),
        scene_prompt: prompt.trim(),
        aspect,
        character_slugs: isAll ? ["all"] : picked,
      };
      const { data } = await api.post("/admin/thumbnails/generate", body, { timeout: 180000 });
      setResult(data);
      toast.success("Thumbnail ready!");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Generation failed — try again.");
    } finally {
      setBusy(false);
    }
  };

  const useIt = () => {
    if (!result) return;
    onChosen?.(result.url);
    toast.success("Image attached.");
    setOpen(false);
    reset();
  };

  const downloadPng = async () => {
    if (!result) return;
    // Route through the authenticated admin download endpoint so we
    // get a proper Content-Disposition + reliable cross-origin save.
    try {
      const { data } = await api.get(`/admin/thumbnails/${result.id}/download`, {
        responseType: "blob",
      });
      const dlUrl = URL.createObjectURL(data);
      const link = document.createElement("a");
      link.href = dlUrl;
      link.download = result.filename || "thumbnail.png";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(dlUrl), 1000);
    } catch {
      toast.error("Download failed");
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonClassName}
        data-testid="ai-thumb-open"
      >
        <Wand2 className="w-3 h-3" /> {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm grid place-items-center p-4" onClick={() => !busy && setOpen(false)} data-testid="ai-thumb-modal">
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-3xl shadow-xl max-w-2xl w-full p-5 max-h-[92vh] overflow-y-auto">
            <header className="flex items-center justify-between mb-3">
              <div>
                <h2 className="font-accent text-xl font-bold text-[#2e3a3a]">AI Thumbnail</h2>
                <p className="text-xs text-[#5a6b76]">Powered by Nano Banana — saved to the Thumbnails library.</p>
              </div>
              <button onClick={() => !busy && setOpen(false)} className="p-1 rounded-full hover:bg-[#fffbf3]" disabled={busy} data-testid="ai-thumb-close">
                <X className="w-5 h-5" />
              </button>
            </header>

            {/* Character picker */}
            <div className="mb-3">
              <div className="flex items-center justify-between text-sm font-semibold text-[#3a4a55] mb-1">
                <span>Pick Sea Stars <span className="font-normal text-[#6b7280]">(up to 4 — or use All)</span></span>
                <button type="button" onClick={toggleAll} className={`text-xs font-bold px-2 py-1 rounded-full border-2 ${isAll ? "bg-[#7fcfc7] text-white border-[#7fcfc7]" : "bg-white border-[#f4e4c6] text-[#5a6b76]"}`} data-testid="ai-thumb-all">
                  {isAll ? "All ✓" : "All"}
                </button>
              </div>
              <div className="flex gap-1.5 flex-wrap" data-testid="ai-thumb-characters">
                {characters.map((c) => {
                  const sel = !isAll && picked.includes(c.slug);
                  return (
                    <button
                      key={c.slug}
                      type="button"
                      onClick={() => toggleChar(c.slug)}
                      className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold border-2 ${sel ? "border-[#7fcfc7] bg-[#eaf7f5]" : "border-[#f4e4c6] bg-white hover:bg-[#fffbf3]"}`}
                      data-testid={`ai-thumb-char-${c.slug}`}
                    >
                      {c.image_url && <img src={c.image_url} alt="" className="w-5 h-5 rounded-full object-contain" />}
                      {sel && <Check className="w-3 h-3 text-[#5a8a6f]" />}
                      {characterFirstName(c.name)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Prompt */}
            <label className="block mb-3">
              <div className="text-sm font-semibold text-[#3a4a55] mb-1">Scene prompt</div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value.slice(0, 400))}
                placeholder={`E.g. ${kind === "product" ? "Showcase angle of a plush turtle on a sunny dock" : "Surfing at sunrise, big smile, splashing waves"}`}
                rows={3}
                className="inp resize-none"
                data-testid="ai-thumb-prompt"
              />
              <div className="text-xs text-[#5a6b76] mt-0.5">{400 - prompt.length} characters left</div>
            </label>

            {/* Aspect */}
            <div className="mb-4">
              <div className="text-sm font-semibold text-[#3a4a55] mb-1">Shape</div>
              <div className="flex gap-2" data-testid="ai-thumb-aspect">
                {ASPECTS.map((a) => (
                  <button key={a.v} type="button" onClick={() => setAspect(a.v)} className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 ${aspect === a.v ? "border-[#7fcfc7] bg-[#eaf7f5]" : "border-[#f4e4c6] bg-white"}`}>
                    {a.l}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={generate}
              disabled={busy || !prompt.trim()}
              className="btn-primary w-full justify-center disabled:opacity-50"
              data-testid="ai-thumb-generate"
            >
              {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating… (~20s)</> : <><Wand2 className="w-4 h-4" /> Generate</>}
            </button>

            {/* Result */}
            {tab === "generate" && result && (
              <div className="mt-4 bg-[#fffbf3] border-2 border-[#f4e4c6] rounded-2xl p-3" data-testid="ai-thumb-result">
                <img src={`${process.env.REACT_APP_BACKEND_URL || ""}${result.url}`} alt="AI thumbnail" className="w-full rounded-xl object-contain max-h-80 bg-white" />
                <div className="flex gap-2 mt-3 flex-wrap">
                  <button onClick={useIt} className="btn-primary flex-1 justify-center" data-testid="ai-thumb-use">
                    <Check className="w-4 h-4" /> Use this image
                  </button>
                  <button onClick={downloadPng} className="btn-secondary" data-testid="ai-thumb-download">
                    <Download className="w-4 h-4" /> PNG
                  </button>
                  <button onClick={() => { setResult(null); }} className="btn-ghost" data-testid="ai-thumb-retry">
                    Try again
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

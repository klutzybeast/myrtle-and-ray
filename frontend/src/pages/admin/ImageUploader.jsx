import { useRef, useState } from "react";
import { api } from "../../lib/api";
import { toast } from "sonner";
import { Upload, X, ImagePlus, ArrowUp, ArrowDown } from "lucide-react";

function isImageFile(f) { return /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(f.name); }
function fullUrl(u) { if (!u) return u; if (u.startsWith("http")) return u; return `${process.env.REACT_APP_BACKEND_URL}${u}`; }

async function uploadOne(file, tags = "product") {
  const fd = new FormData(); fd.append("file", file); fd.append("tags", tags);
  const { data } = await api.post("/admin/media/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
  return data?.url || "";
}

// Single-image uploader (e.g. primary product image, character portrait, download cover)
export function ImageUploader({ value, onChange, label = "Image", testid = "image-upload" }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);

  const pick = async (files) => {
    const f = Array.from(files).find(isImageFile);
    if (!f) { toast.error("Pick a JPG, PNG, WEBP, GIF, or SVG"); return; }
    setBusy(true);
    try {
      const url = await uploadOne(f);
      if (url) { onChange(url); toast.success("Image uploaded"); }
    } catch (err) { toast.error(err.response?.data?.detail || "Upload failed"); }
    setBusy(false);
  };

  return (
    <div className="space-y-2" data-testid={testid}>
      <div className="text-sm font-semibold">{label}</div>
      {value ? (
        <div className="relative inline-block">
          <img src={fullUrl(value)} alt="" className="w-32 h-32 object-cover rounded-2xl border-2 border-[#f4e4c6] bg-[#fffbf3]" />
          <button onClick={() => onChange("")} type="button" className="absolute -top-2 -right-2 bg-white border border-[#f4e4c6] rounded-full p-1 shadow hover:bg-red-50 text-red-500" title="Remove" data-testid={`${testid}-remove`}><X className="w-4 h-4" /></button>
          <button onClick={() => ref.current?.click()} type="button" className="absolute bottom-1 right-1 bg-white/90 backdrop-blur rounded-full px-2 py-0.5 text-[10px] font-bold text-[#5a8a6f] shadow hover:bg-white" data-testid={`${testid}-replace`}>Replace</button>
        </div>
      ) : (
        <button onClick={() => ref.current?.click()} type="button" disabled={busy} className="flex flex-col items-center justify-center w-32 h-32 rounded-2xl border-2 border-dashed border-[#f4e4c6] bg-[#fffbf3] hover:bg-[#eef9fb] hover:border-[#7fcfc7] transition" data-testid={`${testid}-pick`}>
          <Upload className="w-6 h-6 text-[#7cbf94] mb-1" />
          <span className="text-xs font-semibold text-[#5a6b76]">{busy ? "Uploading..." : "Upload image"}</span>
        </button>
      )}
      <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => { pick(e.target.files); e.target.value = ""; }} />
    </div>
  );
}

// Multi-image uploader with reorder / remove (for product gallery)
export function ImageGalleryUploader({ images = [], onChange, label = "Image gallery", testid = "gallery-upload" }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);

  const safeImages = Array.isArray(images) ? images : [];

  const pick = async (files) => {
    const imgs = Array.from(files).filter(isImageFile);
    if (!imgs.length) { toast.error("Pick one or more JPG/PNG/WEBP files"); return; }
    setBusy(true);
    const added = [];
    for (const f of imgs) {
      try {
        const url = await uploadOne(f);
        if (url && !safeImages.includes(url)) added.push(url);
      } catch (err) { toast.error(`${f.name}: ${err.response?.data?.detail || "upload failed"}`); }
    }
    setBusy(false);
    if (added.length) { onChange([...safeImages, ...added]); toast.success(`${added.length} image${added.length > 1 ? "s" : ""} added`); }
  };

  const remove = (i) => onChange(safeImages.filter((_, idx) => idx !== i));
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= safeImages.length) return;
    const next = [...safeImages];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="space-y-2" data-testid={testid}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold">{label}</div>
        <button onClick={() => ref.current?.click()} type="button" disabled={busy} className="btn-secondary text-xs" data-testid={`${testid}-add`}><Upload className="w-3.5 h-3.5" />{busy ? "Uploading..." : "Upload images"}</button>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {safeImages.map((u, i) => (
          <div key={u + i} className="relative group" data-testid={`${testid}-item-${i}`}>
            <img src={fullUrl(u)} alt="" className="w-full aspect-square object-cover rounded-xl border border-[#f4e4c6] bg-[#fffbf3]" />
            <div className="absolute inset-x-0 bottom-0 flex justify-between p-1 opacity-0 group-hover:opacity-100 transition">
              <button onClick={() => move(i, -1)} disabled={i === 0} type="button" className="p-1 bg-white/95 rounded-full disabled:opacity-30 shadow"><ArrowUp className="w-3 h-3" /></button>
              <button onClick={() => move(i, 1)} disabled={i === safeImages.length - 1} type="button" className="p-1 bg-white/95 rounded-full disabled:opacity-30 shadow"><ArrowDown className="w-3 h-3" /></button>
            </div>
            <button onClick={() => remove(i)} type="button" className="absolute -top-2 -right-2 bg-white border border-[#f4e4c6] rounded-full p-1 shadow text-red-500 hover:bg-red-50" data-testid={`${testid}-remove-${i}`}><X className="w-3 h-3" /></button>
            {i === 0 && <span className="absolute top-1 left-1 bg-[#7fcfc7] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">Cover</span>}
          </div>
        ))}
        <button onClick={() => ref.current?.click()} type="button" disabled={busy} className="aspect-square rounded-xl border-2 border-dashed border-[#f4e4c6] bg-[#fffbf3] hover:bg-[#eef9fb] hover:border-[#7fcfc7] grid place-items-center transition" data-testid={`${testid}-add-tile`}>
          <ImagePlus className="w-6 h-6 text-[#7cbf94]" />
        </button>
      </div>
      <p className="text-[11px] text-[#6b7280]">First image is the cover. Drag the corners on hover to reorder.</p>
      <input ref={ref} type="file" accept="image/*" multiple hidden onChange={(e) => { pick(e.target.files); e.target.value = ""; }} />
    </div>
  );
}

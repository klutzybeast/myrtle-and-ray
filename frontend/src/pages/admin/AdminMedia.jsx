import { useEffect, useState, useRef } from "react";
import { api } from "../../lib/api";
import { toast } from "sonner";
import { Upload, Trash2, Copy } from "lucide-react";

export default function AdminMedia() {
  const [items, setItems] = useState([]);
  const inputRef = useRef(null);

  const load = () => api.get("/admin/media").then(({ data }) => setItems(data));
  useEffect(() => { load(); }, []);

  const upload = async (files) => {
    for (const file of files) {
      const fd = new FormData();
      fd.append("file", file);
      try { await api.post("/admin/media/upload", fd, { headers: { "Content-Type": "multipart/form-data" } }); }
      catch (err) { toast.error(`${file.name}: ${err.response?.data?.detail || "upload failed"}`); }
    }
    toast.success("Upload complete");
    load();
  };
  const remove = async (id) => { if (!window.confirm("Delete this file?")) return; await api.delete(`/admin/media/${id}`); toast.success("Deleted"); load(); };
  const copyUrl = (url) => { const full = url.startsWith("http") ? url : `${process.env.REACT_APP_BACKEND_URL}${url}`; navigator.clipboard.writeText(full); toast.success("URL copied"); };

  return (
    <div data-testid="admin-media">
      <h1 className="font-accent text-3xl font-bold mb-1">Media Library</h1>
      <p className="text-[#6b7280] mb-4">Upload character portraits, product photos, PDFs, and more. Use the copied URL anywhere on the site.</p>
      <div onDrop={(e) => { e.preventDefault(); upload(Array.from(e.dataTransfer.files)); }} onDragOver={(e) => e.preventDefault()} onClick={() => inputRef.current?.click()} className="border-4 border-dashed border-[#fde6c8] rounded-3xl p-8 text-center cursor-pointer hover:bg-[#fff9f0] mb-6" data-testid="media-dropzone">
        <Upload className="w-8 h-8 mx-auto text-[#40e0d0]" />
        <div className="font-bold mt-2">Drop files here or click to upload</div>
        <div className="text-xs text-[#6b7280]">JPG, PNG, WebP, PDF, ZIP — up to 25MB each</div>
        <input ref={inputRef} type="file" multiple hidden onChange={(e) => upload(Array.from(e.target.files))} data-testid="media-input" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {items.map((m) => (
          <div key={m.id} className="bg-white rounded-3xl border border-[#fde6c8] overflow-hidden">
            <div className="aspect-square bg-[#e0f7fa] grid place-items-center">
              {(m.mime || "").startsWith("image") ? <img src={m.url} alt="" className="w-full h-full object-cover" /> : <div className="text-[#6b7280] text-sm p-3 text-center">{m.filename}</div>}
            </div>
            <div className="p-3">
              <div className="text-xs truncate font-semibold">{m.filename}</div>
              <div className="text-[10px] text-[#6b7280]">{m.size_kb} KB{m.page_count ? ` · ${m.page_count} pages` : ""}</div>
              <div className="flex gap-1 mt-2">
                <button onClick={() => copyUrl(m.url)} className="btn-ghost text-xs flex-1 justify-center"><Copy className="w-3 h-3" />Copy URL</button>
                <button onClick={() => remove(m.id)} className="text-red-500 p-1"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

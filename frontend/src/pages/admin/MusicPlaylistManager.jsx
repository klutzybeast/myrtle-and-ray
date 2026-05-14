import { useEffect, useRef, useState } from "react";
import { api } from "../../lib/api";
import { toast } from "sonner";
import { Upload, Music, Trash2, ArrowUp, ArrowDown, Plus, X, Play, Pause } from "lucide-react";

function isAudioMime(m) {
  return (m || "").startsWith("audio") || /\.(mp3|ogg|wav|m4a|aac)$/i.test(m || "");
}
function isAudioUrl(u) {
  return /\.(mp3|ogg|wav|m4a|aac)$/i.test(u || "");
}
function fileNameFromUrl(u) {
  try { return decodeURIComponent((u || "").split("/").pop() || u); } catch { return u; }
}
function fullUrl(u) {
  if (!u) return u;
  if (u.startsWith("http")) return u;
  return `${process.env.REACT_APP_BACKEND_URL}${u}`;
}

export default function MusicPlaylistManager({ urls, onChange }) {
  const [picker, setPicker] = useState(false);
  const [library, setLibrary] = useState([]);
  const [previewing, setPreviewing] = useState(null);
  const [uploading, setUploading] = useState(false);
  const uploadRef = useRef(null);
  const audioRef = useRef(null);

  const loadLibrary = () => api.get("/admin/media").then(({ data }) => setLibrary(data.filter((m) => isAudioMime(m.mime) || /\.(mp3|ogg|wav|m4a|aac)$/i.test(m.filename || ""))));
  useEffect(() => { if (picker) loadLibrary(); }, [picker]);

  const safeUrls = Array.isArray(urls) ? urls : [];

  const addUrl = (u) => {
    if (!u || safeUrls.includes(u)) return;
    onChange([...safeUrls, u]);
  };
  const remove = (idx) => onChange(safeUrls.filter((_, i) => i !== idx));
  const move = (idx, dir) => {
    const j = idx + dir;
    if (j < 0 || j >= safeUrls.length) return;
    const next = [...safeUrls];
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange(next);
  };

  const togglePreview = (u) => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (previewing === u) { setPreviewing(null); return; }
    const a = new Audio(fullUrl(u));
    a.volume = 0.6;
    a.play().catch(() => toast.error("Couldn't preview"));
    audioRef.current = a;
    setPreviewing(u);
    a.onended = () => setPreviewing(null);
  };

  const upload = async (files) => {
    const audio = Array.from(files).filter((f) => /\.(mp3|ogg|wav|m4a|aac)$/i.test(f.name));
    if (!audio.length) { toast.error("Pick an MP3, OGG, WAV, M4A, or AAC"); return; }
    setUploading(true);
    const added = [];
    for (const file of audio) {
      const fd = new FormData(); fd.append("file", file); fd.append("tags", "music");
      try {
        const { data } = await api.post("/admin/media/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
        if (data?.url) added.push(data.url);
      } catch (err) { toast.error(`${file.name}: ${err.response?.data?.detail || "upload failed"}`); }
    }
    setUploading(false);
    if (added.length) {
      onChange([...safeUrls, ...added.filter((u) => !safeUrls.includes(u))]);
      toast.success(`${added.length} track${added.length > 1 ? "s" : ""} added to playlist`);
      loadLibrary();
    }
  };

  return (
    <section className="card-soft p-5" data-testid="music-playlist-manager">
      <div className="flex items-start justify-between flex-wrap gap-3 mb-3">
        <div>
          <h3 className="font-accent text-lg font-bold flex items-center gap-2"><Music className="w-5 h-5 text-[#f0a988]" />Background music playlist</h3>
          <p className="text-xs text-[#6b7280] mt-1">Upload your MP3s or pick from your library — no copy-pasting. Drag to reorder, click ▶ to preview.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => uploadRef.current?.click()} className="btn-secondary text-sm" data-testid="music-upload-btn"><Upload className="w-4 h-4" />{uploading ? "Uploading..." : "Upload MP3s"}</button>
          <button onClick={() => setPicker(true)} className="btn-ghost text-sm" data-testid="music-pick-btn"><Plus className="w-4 h-4" />Pick from library</button>
          <input ref={uploadRef} type="file" accept=".mp3,.ogg,.wav,.m4a,.aac,audio/*" multiple hidden onChange={(e) => { upload(e.target.files); e.target.value = ""; }} data-testid="music-upload-input" />
        </div>
      </div>

      {safeUrls.length === 0 ? (
        <div className="text-center py-8 bg-[#fffbf3] rounded-2xl border-2 border-dashed border-[#f4e4c6]" data-testid="playlist-empty">
          <Music className="w-10 h-10 text-[#f0a988] mx-auto mb-2 opacity-50" />
          <p className="text-[#5a6b76] text-sm">No music yet — tap <b>Upload MP3s</b> above to drop in your tracks.</p>
        </div>
      ) : (
        <ul className="space-y-2" data-testid="playlist-list">
          {safeUrls.map((u, i) => (
            <li key={u + i} className="flex items-center gap-2 bg-white rounded-2xl border border-[#f4e4c6] px-3 py-2" data-testid={`playlist-item-${i}`}>
              <span className="font-accent font-bold text-[#7cbf94] w-6 text-center text-sm">{i + 1}</span>
              <button onClick={() => togglePreview(u)} className="w-9 h-9 grid place-items-center rounded-full bg-[#eef9fb] hover:bg-[#dff3f6]" title="Preview" data-testid={`preview-${i}`}>
                {previewing === u ? <Pause className="w-4 h-4 text-[#5a8a6f]" /> : <Play className="w-4 h-4 text-[#5a8a6f]" />}
              </button>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{fileNameFromUrl(u)}</div>
                <div className="text-[10px] text-[#9aa3ab] truncate">{u}</div>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => move(i, -1)} disabled={i === 0} className="p-1.5 rounded hover:bg-[#eef9fb] disabled:opacity-30" title="Move up" data-testid={`move-up-${i}`}><ArrowUp className="w-4 h-4" /></button>
                <button onClick={() => move(i, 1)} disabled={i === safeUrls.length - 1} className="p-1.5 rounded hover:bg-[#eef9fb] disabled:opacity-30" title="Move down" data-testid={`move-down-${i}`}><ArrowDown className="w-4 h-4" /></button>
                <button onClick={() => remove(i)} className="p-1.5 rounded hover:bg-red-50 text-red-500" title="Remove" data-testid={`remove-${i}`}><Trash2 className="w-4 h-4" /></button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {picker && (
        <div className="fixed inset-0 z-50 bg-black/50 grid place-items-center p-4" onClick={() => setPicker(false)} data-testid="music-picker-modal">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-accent text-xl font-bold">Pick from your audio files</h4>
              <button onClick={() => setPicker(false)} className="p-2 hover:bg-[#eef9fb] rounded-full"><X className="w-5 h-5" /></button>
            </div>
            {library.length === 0 ? (
              <div className="text-center py-8 text-[#6b7280]">No audio files in your library yet. Use the <b>Upload MP3s</b> button instead.</div>
            ) : (
              <ul className="space-y-2">
                {library.map((m) => {
                  const already = safeUrls.includes(m.url);
                  return (
                    <li key={m.id} className="flex items-center gap-3 bg-[#fffbf3] rounded-2xl px-3 py-2">
                      <Music className="w-5 h-5 text-[#f0a988] shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate">{m.filename}</div>
                        <div className="text-[10px] text-[#9aa3ab]">{m.size_kb} KB</div>
                      </div>
                      <button onClick={() => { addUrl(m.url); toast.success("Added"); }} disabled={already} className="btn-primary text-xs disabled:opacity-50">{already ? "Added" : "Add"}</button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

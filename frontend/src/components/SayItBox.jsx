// "Make Myrtle say..." textbox + Share button.
// Rate-limited server-side (5/visitor/day, 300 chars max).
import { useState } from "react";
import { api } from "../lib/api";
import { toast } from "sonner";
import { Sparkles, Loader2, Download, Play } from "lucide-react";

const MAX = 300;

export default function SayItBox({ slug, characterName }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);

  const generate = async () => {
    const t = text.trim();
    if (!t) { toast.error("Type something first!"); return; }
    if (t.length > MAX) { toast.error(`Keep it to ${MAX} characters or fewer.`); return; }
    setBusy(true);
    setAudioUrl(null);
    try {
      const r = await api.post(`/voice/character/${slug}/say`, { text: t }, { responseType: "blob" });
      const blob = new Blob([r.data], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      // Auto-play
      try { await new Audio(url).play(); } catch {}
    } catch (err) {
      const detail = err.response?.data;
      // The error body is a Blob — parse it
      if (detail instanceof Blob) {
        const txt = await detail.text();
        try { toast.error(JSON.parse(txt).detail || "Voice service hiccup."); }
        catch { toast.error("Voice service hiccup."); }
      } else {
        toast.error(detail?.detail || "Voice service hiccup.");
      }
    } finally { setBusy(false); }
  };

  return (
    <div className="bg-[#fffbf3] rounded-2xl p-4 border-2 border-[#f4e4c6] mt-4" data-testid={`say-it-box-${slug}`}>
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-4 h-4 text-[#f0a988]" />
        <div className="font-accent font-bold text-[#3a4a55]">Make {characterName} say...</div>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, MAX))}
        placeholder={`Type a sweet message for ${characterName}... (max ${MAX} characters)`}
        rows={2}
        className="w-full px-3 py-2 rounded-2xl border-2 border-[#f4e4c6] focus:outline-none focus:border-[#7fcfc7] text-sm resize-none"
        data-testid={`say-it-input-${slug}`}
      />
      <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
        <span className="text-[10px] text-[#6b7280]">{text.length}/{MAX}  ·  5 per day per visitor</span>
        <div className="flex gap-2">
          {audioUrl && (
            <a href={audioUrl} download={`${slug}-message.mp3`} className="btn-ghost text-xs" data-testid={`say-it-download-${slug}`}>
              <Download className="w-4 h-4" /> Save MP3
            </a>
          )}
          <button onClick={generate} disabled={busy || !text.trim()} className="btn-primary text-sm" data-testid={`say-it-go-${slug}`}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {busy ? "Listening..." : "Say it!"}
          </button>
        </div>
      </div>
    </div>
  );
}

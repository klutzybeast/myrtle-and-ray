// "Make Myrtle say..." textbox with character-themed limit-reached modal.
import { useState } from "react";
import { api } from "../lib/api";
import { toast } from "sonner";
import { Sparkles, Loader2, Download, Play, Waves, Heart } from "lucide-react";

const MAX = 500;

export default function SayItBox({ slug, characterName }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [limitReached, setLimitReached] = useState(false);

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
      try { await new Audio(url).play(); } catch {}
    } catch (err) {
      const status = err.response?.status;
      const detail = err.response?.data;
      let message = "Voice service hiccup.";
      if (detail instanceof Blob) {
        try { message = JSON.parse(await detail.text()).detail || message; } catch {}
      } else if (detail?.detail) { message = detail.detail; }
      // 429 = rate limit → show the branded modal
      if (status === 429) { setLimitReached(true); }
      else { toast.error(message); }
    } finally { setBusy(false); }
  };

  return (
    <>
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
          <span className="text-[10px] text-[#6b7280]">{text.length}/{MAX}  ·  daily limit applies</span>
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

      {limitReached && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-[#3a4a55]/60 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setLimitReached(false)} data-testid="voice-limit-modal">
          <div
            className="relative bg-[#fffbf3] rounded-[32px] max-w-md w-full p-8 shadow-2xl border-4 border-white text-center overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Decorative waves */}
            <Waves className="absolute -top-4 -left-4 w-24 h-24 text-[#7fcfc7]/15" strokeWidth={1} />
            <Waves className="absolute -bottom-4 -right-4 w-24 h-24 text-[#f0a988]/15" strokeWidth={1} />

            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-[#7fcfc7] to-[#f0a988] grid place-items-center mb-3 shadow-md">
              <Heart className="w-10 h-10 text-white" strokeWidth={2.5} />
            </div>

            <h3 className="font-accent text-3xl font-bold text-[#3a4a55] mb-2">You're a voice superstar!</h3>
            <p className="text-[#5a6b76] text-base leading-relaxed">
              You've heard from your Sea Star friends a bunch today.
              <br />
              <span className="font-semibold text-[#5a8a6f]">Come back tomorrow</span> for more — and bring a friend!
            </p>

            <div className="mt-5 bg-white rounded-2xl p-3 border-2 border-[#f4e4c6]">
              <p className="text-xs text-[#6b7280] font-semibold uppercase tracking-wider mb-1">Tip from {characterName}</p>
              <p className="text-sm text-[#3a4a55] italic">"Catch the W.A.V.E. of Excitement until we meet again!"</p>
            </div>

            <button
              onClick={() => setLimitReached(false)}
              className="btn-primary mt-5 w-full justify-center"
              data-testid="voice-limit-close"
            >
              Got it!
            </button>
          </div>
        </div>
      )}
    </>
  );
}

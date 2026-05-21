// "Make Myrtle say..." textbox + branded limit modal + share-with-a-friend.
// Reads X-Voice-Remaining response header to show a heads-up before the wall.
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { toast } from "sonner";
import { Sparkles, Loader2, Download, Play, Waves, Heart, Share2, Mail, MessageCircle, Facebook } from "lucide-react";

const MAX = 500;
const WARN_AT = 5; // pop the heads-up when this many messages remain

export default function SayItBox({ slug, characterName }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [limitReached, setLimitReached] = useState(false);
  const [remaining, setRemaining] = useState(null);
  const [warnShown, setWarnShown] = useState(false);

  // Get initial quota on mount so we know remaining without typing
  useEffect(() => {
    api.get("/voice/quota").then(({ data }) => setRemaining(data.remaining)).catch(() => {});
  }, []);

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
      // Read the remaining count from response headers
      const rem = parseInt(r.headers["x-voice-remaining"] || "", 10);
      if (!Number.isNaN(rem)) {
        setRemaining(rem);
        // Show a soft heads-up once when crossing the warn threshold
        if (rem <= WARN_AT && rem > 0 && !warnShown) {
          setWarnShown(true);
          toast(`💙 ${rem} voice ${rem === 1 ? "message" : "messages"} left today`, { duration: 4500 });
        }
      }
    } catch (err) {
      const status = err.response?.status;
      const detail = err.response?.data;
      let message = "Voice service hiccup.";
      if (detail instanceof Blob) {
        try { message = JSON.parse(await detail.text()).detail || message; } catch {}
      } else if (detail?.detail) { message = detail.detail; }
      if (status === 429) { setLimitReached(true); setRemaining(0); }
      else { toast.error(message); }
    } finally { setBusy(false); }
  };

  const remainingLabel = remaining == null
    ? "daily limit applies"
    : remaining === 0 ? "all messages used today"
    : remaining <= WARN_AT ? `${remaining} ${remaining === 1 ? "message" : "messages"} left today`
    : `daily limit applies`;

  const remainingClass = remaining != null && remaining <= WARN_AT && remaining > 0 ? "text-[#c0641d] font-semibold" : "text-[#6b7280]";

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
          <span className={`text-[10px] ${remainingClass}`} data-testid={`say-it-remaining-${slug}`}>
            {text.length}/{MAX}  ·  {remainingLabel}
          </span>
          <div className="flex gap-2">
            {audioUrl && (
              <a href={audioUrl} download={`${slug}-message.mp3`} className="btn-ghost text-xs" data-testid={`say-it-download-${slug}`}>
                <Download className="w-4 h-4" /> Save MP3
              </a>
            )}
            <button onClick={generate} disabled={busy || !text.trim() || remaining === 0} className="btn-primary text-sm" data-testid={`say-it-go-${slug}`}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {busy ? "Listening..." : "Say it!"}
            </button>
          </div>
        </div>
      </div>

      {limitReached && (
        <LimitModal characterName={characterName} onClose={() => setLimitReached(false)} />
      )}
    </>
  );
}

function LimitModal({ characterName, onClose }) {
  const url = typeof window !== "undefined" ? window.location.origin : "https://myrtleandray.com";
  const shareText = `My new favorite kids' site — the characters actually talk to you! Come meet Myrtle, Ray, and the Sea Stars at ${url}`;

  const shareNative = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try { await navigator.share({ title: "Myrtle & Ray — Stingray Cay", text: shareText, url }); }
      catch {}
    } else {
      try { await navigator.clipboard.writeText(`${shareText} ${url}`); toast.success("Link copied — paste it anywhere!"); }
      catch { toast.error("Couldn't copy. Try the buttons below."); }
    }
  };
  const shareFB = () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, "_blank", "noopener,noreferrer,width=600,height=600");
  const shareSMS = () => { window.location.href = `sms:?&body=${encodeURIComponent(shareText)}`; };
  const shareEmail = () => { window.location.href = `mailto:?subject=${encodeURIComponent("Have you seen Myrtle and Ray?")}&body=${encodeURIComponent(shareText)}`; };

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-[#3a4a55]/60 backdrop-blur-sm p-4 animate-fade-in" onClick={onClose} data-testid="voice-limit-modal">
      <div
        className="relative bg-[#fffbf3] rounded-[32px] max-w-md w-full p-7 shadow-2xl border-4 border-white text-center overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <Waves className="absolute -top-4 -left-4 w-24 h-24 text-[#7fcfc7]/15" strokeWidth={1} />
        <Waves className="absolute -bottom-4 -right-4 w-24 h-24 text-[#f0a988]/15" strokeWidth={1} />

        <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-[#7fcfc7] to-[#f0a988] grid place-items-center mb-3 shadow-md">
          <Heart className="w-10 h-10 text-white" strokeWidth={2.5} />
        </div>

        <h3 className="font-accent text-3xl font-bold text-[#3a4a55] mb-2">You're a voice superstar!</h3>
        <p className="text-[#5a6b76] text-sm leading-relaxed">
          You've heard from your Sea Star friends a bunch today.
          <br />
          <span className="font-semibold text-[#5a8a6f]">Come back tomorrow</span> for more — and bring a friend!
        </p>

        <div className="mt-4 bg-white rounded-2xl p-3 border-2 border-[#f4e4c6]">
          <p className="text-xs text-[#6b7280] font-semibold uppercase tracking-wider mb-1">Tip from {characterName}</p>
          <p className="text-sm text-[#3a4a55] italic">"Catch the W.A.V.E. of Excitement until we meet again!"</p>
        </div>

        <div className="mt-5">
          <p className="text-xs uppercase tracking-wider text-[#6b7280] font-bold mb-2">Tell a friend</p>
          <div className="grid grid-cols-4 gap-2" data-testid="voice-limit-share-row">
            <ShareIcon onClick={shareNative} label="Share" testid="share-native">
              <Share2 className="w-5 h-5" />
            </ShareIcon>
            <ShareIcon onClick={shareSMS} label="Text" testid="share-sms">
              <MessageCircle className="w-5 h-5" />
            </ShareIcon>
            <ShareIcon onClick={shareEmail} label="Email" testid="share-email">
              <Mail className="w-5 h-5" />
            </ShareIcon>
            <ShareIcon onClick={shareFB} label="Facebook" testid="share-fb">
              <Facebook className="w-5 h-5" />
            </ShareIcon>
          </div>
        </div>

        <button
          onClick={onClose}
          className="btn-primary mt-5 w-full justify-center"
          data-testid="voice-limit-close"
        >
          Got it!
        </button>
      </div>
    </div>
  );
}

function ShareIcon({ children, onClick, label, testid }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testid}
      className="flex flex-col items-center gap-1 p-2 rounded-2xl bg-[#eef9fb] hover:bg-[#dff3f6] text-[#3a6b78] transition group"
      aria-label={label}
    >
      <span className="w-10 h-10 rounded-full bg-white border-2 border-[#dff3f6] grid place-items-center group-hover:border-[#7fcfc7]">{children}</span>
      <span className="text-[10px] font-bold">{label}</span>
    </button>
  );
}

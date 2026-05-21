// Tap the speaker icon to play a character's cached greeting in their own voice.
import { useRef, useState } from "react";
import { Volume2, Loader2 } from "lucide-react";

export default function VoiceButton({ slug, hasVoice, label = "Play voice", size = 36, className = "", testid = "voice-btn" }) {
  const audioRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(false);

  if (!hasVoice) return null;

  const play = async (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
      return;
    }
    setBusy(true);
    try {
      const url = `${process.env.REACT_APP_BACKEND_URL}/api/voice/character/${slug}/greeting`;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onplaying = () => { setBusy(false); setPlaying(true); };
      audio.onended = () => setPlaying(false);
      audio.onerror = () => { setBusy(false); setPlaying(false); };
      await audio.play();
    } catch {
      setBusy(false);
      setPlaying(false);
    }
  };

  return (
    <button
      type="button"
      onClick={play}
      style={{ width: size, height: size }}
      className={`rounded-full grid place-items-center bg-white/90 border-2 border-[#7fcfc7] text-[#5a8a6f] hover:bg-[#eef9fb] transition shadow-md ${className}`}
      aria-label={label}
      data-testid={testid}
    >
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
    </button>
  );
}

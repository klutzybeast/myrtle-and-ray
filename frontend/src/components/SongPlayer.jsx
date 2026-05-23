import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, SkipBack, SkipForward, X, Sparkles } from "lucide-react";

const CHAR_COLOR = {
  "ms-bluegill": "#5a8a6f",
  myrtle: "#a36b29",
  ray: "#7fcfc7",
  casey: "#b8a3d9",
  louie: "#f0a988",
  sally: "#7cbf94",
  ollie: "#f0a988",
  all: "#7fcfc7",
};

export function characterColor(slug) {
  return CHAR_COLOR[slug] || "#7fcfc7";
}

/**
 * Parse LRC-format synced lyrics if present, otherwise spread the
 * plain-text lyrics evenly across the song duration with a small
 * intro/outro pad.
 */
export function parseLyricsToTimedLines(lrc, plainLyrics, duration) {
  const result = [];
  if (lrc) {
    const lrcLineRe = /^\s*\[(\d{1,2}):(\d{1,2}(?:\.\d{1,3})?)\]\s*(.*)$/;
    lrc.split(/\r?\n/).forEach((raw) => {
      const m = raw.match(lrcLineRe);
      if (m) {
        const minutes = parseInt(m[1], 10);
        const seconds = parseFloat(m[2]);
        result.push({ t: minutes * 60 + seconds, text: m[3] });
      }
    });
    result.sort((a, b) => a.t - b.t);
    if (result.length) return result;
  }
  const textLines = (plainLyrics || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!textLines.length) return [];
  const introPad = Math.min(4, duration * 0.12);
  const tail = Math.min(3, duration * 0.1);
  const span = Math.max(1, duration - introPad - tail);
  const step = span / textLines.length;
  return textLines.map((text, i) => ({ t: introPad + i * step, text }));
}

/**
 * Full-screen karaoke player. Used by /sing-along and the Story Quest
 * finale reveal (matched Sea Star's theme song).
 *
 * Props:
 *   song:    {id, slug, title, theme, character_focus, lyrics, lyrics_lrc,
 *             audio_url, duration_seconds}
 *   onClose: () => void
 *   onNext / onPrev: optional; if absent, the skip buttons render disabled
 *   subtitle: optional string shown above the title (e.g. "Theme song for...")
 */
export default function SongPlayer({ song, onClose, onNext, onPrev, subtitle }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(song.duration_seconds || 30);
  const lineRefs = useRef([]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }, [song.id]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) a.play().then(() => setPlaying(true)).catch(() => {});
    else { a.pause(); setPlaying(false); }
  };

  const lines = useMemo(
    () => parseLyricsToTimedLines(song.lyrics_lrc, song.lyrics, duration),
    [song.lyrics_lrc, song.lyrics, duration]
  );
  const activeIdx = useMemo(() => {
    if (!lines.length) return -1;
    let idx = 0;
    for (let i = 0; i < lines.length; i++) {
      if (currentTime + 0.05 >= lines[i].t) idx = i;
      else break;
    }
    return idx;
  }, [lines, currentTime]);

  useEffect(() => {
    const el = lineRefs.current[activeIdx];
    if (el && el.scrollIntoView) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeIdx]);

  const src = song.audio_url?.startsWith("http")
    ? song.audio_url
    : `${process.env.REACT_APP_BACKEND_URL}${song.audio_url || ""}`;

  const bg = song.character_focus ? characterColor(song.character_focus) : "#7fcfc7";

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="song-player-title"
      data-testid="sing-along-player"
      onClick={onClose}
    >
      <div className="min-h-screen flex items-center justify-center p-3 sm:p-6">
        <div
          className="bg-[#fffbf3] rounded-[28px] w-full max-w-2xl shadow-2xl border-2 border-[#f4e4c6] overflow-hidden flex flex-col"
          style={{ maxHeight: "calc(100dvh - 24px)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="relative p-5 sm:p-6 text-white shrink-0"
            style={{ background: `linear-gradient(135deg, ${bg}, #a36b29)` }}
          >
            <button
              onClick={onClose}
              aria-label="Close player"
              className="absolute top-3 right-3 w-10 h-10 grid place-items-center rounded-full bg-white/20 hover:bg-white/35 text-white"
              data-testid="song-player-close"
            >
              <X className="w-5 h-5" />
            </button>
            <p className="text-[11px] uppercase tracking-[0.2em] opacity-80 mb-1">
              {subtitle || "Sing-Along · Karaoke"}
            </p>
            <h2 id="song-player-title" className="font-accent text-2xl sm:text-3xl md:text-4xl font-bold leading-tight pr-12" data-testid="song-player-title">
              {song.title}
            </h2>
            <p className="text-xs sm:text-sm opacity-90 mt-1">
              {song.theme}{song.character_focus && song.character_focus !== "all" ? ` · ${song.character_focus}` : ""}
              {song.duration_seconds ? ` · ${song.duration_seconds}s` : ""}
            </p>
          </div>

          <div
            className="px-5 sm:px-10 pt-5 sm:pt-6 pb-4 flex-1 overflow-y-auto"
            data-testid="song-player-lyrics"
            aria-live="polite"
          >
            <div className="flex flex-col justify-center min-h-[40vh]">
              {lines.map((line, i) => {
                const isActive = i === activeIdx;
                const isPast = i < activeIdx;
                return (
                  <p
                    key={i}
                    ref={(el) => { lineRefs.current[i] = el; }}
                    className={[
                      "font-accent text-center leading-snug transition-all duration-300 my-2 sm:my-3",
                      isActive
                        ? "text-2xl sm:text-3xl md:text-4xl font-bold scale-105"
                        : isPast
                          ? "text-base sm:text-lg md:text-xl text-[#9aa5b1] opacity-50"
                          : "text-base sm:text-lg md:text-xl text-[#6b7280] opacity-70",
                    ].join(" ")}
                    style={isActive ? { color: bg } : undefined}
                    data-active={isActive ? "true" : "false"}
                  >
                    {line.text}
                  </p>
                );
              })}
            </div>
          </div>

          <div className="px-5 sm:px-8 pb-5 sm:pb-6 bg-gradient-to-t from-[#fffbf3] via-[#fffbf3] to-[#fffbf3]/85 pt-3 border-t border-[#f4e4c6] shrink-0">
            <div className="flex items-center justify-center gap-3 sm:gap-5 mb-3">
              <button
                onClick={onPrev}
                disabled={!onPrev}
                aria-label="Previous song"
                className="w-11 h-11 grid place-items-center rounded-full bg-[#f4e4c6] hover:bg-[#fef3e2] text-[#3a4a55] disabled:opacity-40 disabled:cursor-not-allowed"
                data-testid="song-player-prev"
              >
                <SkipBack className="w-5 h-5" />
              </button>
              <button
                onClick={toggle}
                aria-label={playing ? "Pause" : "Play"}
                className="w-16 h-16 grid place-items-center rounded-full text-white shadow-lg"
                style={{ background: `linear-gradient(135deg, ${bg}, #a36b29)` }}
                data-testid="song-player-toggle"
              >
                {playing ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7" fill="currentColor" />}
              </button>
              <button
                onClick={onNext}
                disabled={!onNext}
                aria-label="Next song"
                className="w-11 h-11 grid place-items-center rounded-full bg-[#f4e4c6] hover:bg-[#fef3e2] text-[#3a4a55] disabled:opacity-40 disabled:cursor-not-allowed"
                data-testid="song-player-next"
              >
                <SkipForward className="w-5 h-5" />
              </button>
            </div>
            <audio
              ref={audioRef}
              key={song.id}
              src={src}
              controls
              onEnded={onNext || onClose}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onLoadedMetadata={(e) => setDuration(e.target.duration || song.duration_seconds || 30)}
              onTimeUpdate={(e) => setCurrentTime(e.target.currentTime || 0)}
              className="w-full"
              data-testid="song-player-audio"
            />
            <p className="text-center text-[11px] text-[#6b7280] mt-2 flex items-center justify-center gap-1">
              <Sparkles className="w-3 h-3 text-[#f0a988]" /> Sing it loud — you're a Sea Star!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

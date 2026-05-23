import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Music2, Play, Pause, SkipBack, SkipForward, Lock, X, Sparkles } from "lucide-react";
import { api } from "../lib/api";
import SEO from "../components/SEO";

export default function SingAlong() {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    api.get("/sing-along/songs")
      .then(({ data }) => setSongs(data || []))
      .catch(() => setSongs([]))
      .finally(() => setLoading(false));
  }, []);

  const playable = songs.filter((s) => s.audio_url);
  const openSong = playable.find((s) => s.id === openId) || null;

  const open = (song) => song.audio_url && setOpenId(song.id);
  const close = () => setOpenId(null);
  const skipBy = (delta) => {
    const idx = playable.findIndex((s) => s.id === openId);
    if (idx < 0) return;
    const next = playable[(idx + delta + playable.length) % playable.length];
    setOpenId(next.id);
  };

  // Lock body scroll while the player sheet is open
  useEffect(() => {
    if (openId) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [openId]);

  return (
    <main className="pt-24 pb-12 bg-foam-grad min-h-screen" data-testid="sing-along-page">
      <SEO title="Sing-Along" description="Sing along with the Sea Stars of Stingray Cay. 10 short songs about kindness, curiosity, teamwork, and encouragement." />
      <div className="max-w-5xl mx-auto px-4">
        <div className="text-center mb-8">
          <Music2 className="w-10 h-10 sm:w-12 sm:h-12 text-[#f0a988] mx-auto mb-2" />
          <h1 className="font-accent text-4xl sm:text-5xl md:text-6xl font-bold leading-tight">Sing-Along with the Sea Stars</h1>
          <p className="text-sm sm:text-base text-[#4a5568] mt-3 max-w-2xl mx-auto px-2">
            Tap a song to start. Read the words and sing along — every line celebrates a W.A.V.E. value.
          </p>
        </div>

        {loading ? (
          <p className="text-center text-[#6b7280]" data-testid="sing-along-loading">Loading songs…</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5" data-testid="sing-along-grid">
            {songs.map((s) => {
              const ready = !!s.audio_url;
              return (
                <article
                  key={s.id}
                  className={`bg-white rounded-[28px] p-4 sm:p-5 border-2 transition shadow-sm ${ready ? "border-[#f4e4c6] hover:border-[#7fcfc7] hover:-translate-y-1" : "border-[#eee] opacity-80"}`}
                  data-testid={`song-card-${s.slug}`}
                >
                  <button
                    type="button"
                    onClick={() => open(s)}
                    disabled={!ready}
                    className={`aspect-square w-full rounded-2xl mb-3 grid place-items-center text-white font-accent text-2xl sm:text-3xl text-center px-3 ${ready ? "cursor-pointer relative group" : "cursor-not-allowed"}`}
                    style={{
                      background: s.cover_image_url ? undefined : `linear-gradient(135deg, ${characterColor(s.character_focus)}, #fef3e2)`,
                      backgroundImage: s.cover_image_url ? `url(${s.cover_image_url})` : undefined,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                    aria-label={`Play ${s.title}`}
                    data-testid={`song-cover-${s.slug}`}
                  >
                    <span className="drop-shadow-md">{!s.cover_image_url && s.title}</span>
                    {ready && (
                      <span className="absolute inset-0 grid place-items-center bg-black/0 group-hover:bg-black/25 transition rounded-2xl">
                        <Play className="w-12 h-12 text-white opacity-0 group-hover:opacity-100 transition drop-shadow-lg" fill="currentColor" />
                      </span>
                    )}
                  </button>
                  <h2 className="font-accent text-lg sm:text-xl font-bold text-[#3a4a55] flex items-center justify-between gap-2">
                    <span className="truncate">{s.title}</span>
                    {!ready && (
                      <span className="text-[10px] uppercase tracking-wider bg-[#fef3e2] text-[#a36b29] px-2 py-1 rounded-full font-semibold flex items-center gap-1 shrink-0">
                        <Lock className="w-3 h-3" /> Soon
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-[#6b7280] uppercase tracking-wider mt-1 mb-3">
                    {s.theme}{s.character_focus && s.character_focus !== "all" ? ` · ${s.character_focus}` : ""}
                    {s.duration_seconds ? ` · ${s.duration_seconds}s` : ""}
                  </p>
                  {ready ? (
                    <button
                      onClick={() => open(s)}
                      className="btn-primary w-full justify-center"
                      data-testid={`song-play-${s.slug}`}
                    >
                      <Play className="w-4 h-4" /> Play &amp; sing
                    </button>
                  ) : (
                    <button disabled className="btn-secondary w-full justify-center cursor-not-allowed opacity-70" data-testid={`song-locked-${s.slug}`}>
                      <Lock className="w-4 h-4" /> Coming soon
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        )}

        <p className="text-center text-xs text-[#6b7280] mt-10 px-2">
          Made with the Sea Stars' favorite tunes. <Link to="/wave-badges" className="underline">Catch more badges →</Link>
        </p>
      </div>

      {openSong && (
        <SongPlayer
          song={openSong}
          onClose={close}
          onNext={() => skipBy(1)}
          onPrev={() => skipBy(-1)}
        />
      )}
    </main>
  );
}

function characterColor(slug) {
  return {
    "ms-bluegill": "#5a8a6f",
    myrtle: "#a36b29",
    ray: "#7fcfc7",
    casey: "#b8a3d9",
    louie: "#f0a988",
    sally: "#7cbf94",
    ollie: "#f0a988",
    all: "#7fcfc7",
  }[slug] || "#7fcfc7";
}

function SongPlayer({ song, onClose, onNext, onPrev }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);

  // Auto-play on mount (the card-click counts as a user gesture)
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }, [song.id]);

  // Esc to close
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) a.play().then(() => setPlaying(true)).catch(() => {});
    else { a.pause(); setPlaying(false); }
  };

  const src = song.audio_url.startsWith("http")
    ? song.audio_url
    : `${process.env.REACT_APP_BACKEND_URL}${song.audio_url}`;

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
          className="bg-[#fffbf3] rounded-[28px] w-full max-w-2xl shadow-2xl border-2 border-[#f4e4c6] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header band */}
          <div
            className="relative p-5 sm:p-6 text-white"
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
            <p className="text-[11px] uppercase tracking-[0.2em] opacity-80 mb-1">Sing-Along</p>
            <h2 id="song-player-title" className="font-accent text-3xl sm:text-4xl font-bold leading-tight" data-testid="song-player-title">
              {song.title}
            </h2>
            <p className="text-xs sm:text-sm opacity-90 mt-1">
              {song.theme}{song.character_focus && song.character_focus !== "all" ? ` · ${song.character_focus}` : ""}
              {song.duration_seconds ? ` · ${song.duration_seconds}s` : ""}
            </p>
          </div>

          {/* Lyrics — the star of the show */}
          <div className="px-5 sm:px-8 pt-5 sm:pt-6 pb-2">
            <div
              className="font-accent text-xl sm:text-2xl md:text-3xl leading-relaxed text-[#3a4a55] whitespace-pre-wrap text-center min-h-[40vh] sm:min-h-[44vh]"
              data-testid="song-player-lyrics"
            >
              {song.lyrics}
            </div>
          </div>

          {/* Native controls + play button */}
          <div className="px-5 sm:px-8 pb-5 sm:pb-6 sticky bottom-0 bg-gradient-to-t from-[#fffbf3] via-[#fffbf3]/95 to-[#fffbf3]/40 pt-3">
            <div className="flex items-center justify-center gap-3 sm:gap-5 mb-3">
              <button
                onClick={onPrev}
                aria-label="Previous song"
                className="w-11 h-11 grid place-items-center rounded-full bg-[#f4e4c6] hover:bg-[#fef3e2] text-[#3a4a55]"
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
                aria-label="Next song"
                className="w-11 h-11 grid place-items-center rounded-full bg-[#f4e4c6] hover:bg-[#fef3e2] text-[#3a4a55]"
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
              onEnded={onNext}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
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

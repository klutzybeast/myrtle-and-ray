import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Music2, Play, Pause, Sparkles, Lock } from "lucide-react";
import { api } from "../lib/api";
import SEO from "../components/SEO";

export default function SingAlong() {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(null); // song id currently playing
  const audioRef = useRef(null);

  useEffect(() => {
    api.get("/sing-along/songs")
      .then(({ data }) => setSongs(data || []))
      .catch(() => setSongs([]))
      .finally(() => setLoading(false));
    return () => { try { audioRef.current?.pause(); } catch {} };
  }, []);

  const play = (song) => {
    if (!song.audio_url) return;
    const el = audioRef.current;
    if (!el) return;
    if (active === song.id && !el.paused) {
      el.pause(); setActive(null); return;
    }
    el.src = song.audio_url.startsWith("http")
      ? song.audio_url
      : `${process.env.REACT_APP_BACKEND_URL}${song.audio_url}`;
    el.play().then(() => setActive(song.id)).catch(() => setActive(null));
  };

  const current = useMemo(() => songs.find((s) => s.id === active) || null, [songs, active]);

  return (
    <main className="pt-24 pb-12 bg-foam-grad min-h-screen" data-testid="sing-along-page">
      <SEO title="Sing-Along" description="Sing along with the Sea Stars of Stingray Cay. 10 short songs about kindness, curiosity, teamwork, and encouragement." />
      <div className="max-w-5xl mx-auto px-4">
        <div className="text-center mb-8">
          <Music2 className="w-12 h-12 text-[#f0a988] mx-auto mb-2" />
          <h1 className="font-accent text-5xl md:text-6xl font-bold">Sing-Along with the Sea Stars</h1>
          <p className="text-[#4a5568] mt-3 max-w-2xl mx-auto">
            Tap a song to start. Read the words and sing along — every line celebrates a W.A.V.E. value.
          </p>
        </div>

        {loading ? (
          <p className="text-center text-[#6b7280]" data-testid="sing-along-loading">Loading songs…</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5" data-testid="sing-along-grid">
            {songs.map((s) => {
              const ready = !!s.audio_url;
              const isPlaying = active === s.id;
              return (
                <article
                  key={s.id}
                  className={`bg-white rounded-[28px] p-5 border-2 transition shadow-sm ${ready ? (isPlaying ? "border-[#7fcfc7] shadow-md" : "border-[#f4e4c6] hover:border-[#7fcfc7] hover:-translate-y-1") : "border-[#eee] opacity-80"}`}
                  data-testid={`song-card-${s.slug}`}
                  data-playing={isPlaying ? "true" : "false"}
                >
                  <div
                    className="aspect-square rounded-2xl mb-3 grid place-items-center text-white font-accent text-3xl text-center px-3"
                    style={{
                      background: `linear-gradient(135deg, ${s.cover_image_url ? "transparent" : "#7fcfc7"}, #fef3e2)`,
                      backgroundImage: s.cover_image_url ? `url(${s.cover_image_url})` : undefined,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                    aria-hidden
                  >
                    {!s.cover_image_url && s.title}
                  </div>
                  <h2 className="font-accent text-xl font-bold text-[#3a4a55] flex items-center justify-between gap-2">
                    {s.title}
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
                      onClick={() => play(s)}
                      className={`w-full justify-center ${isPlaying ? "btn-secondary" : "btn-primary"}`}
                      data-testid={`song-play-${s.slug}`}
                    >
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      {isPlaying ? "Pause" : "Play & sing"}
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

        {/* Sticky lyrics player */}
        {current && (
          <aside
            className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-md bg-white border-2 border-[#7fcfc7] rounded-[28px] p-5 shadow-2xl z-40"
            data-testid="sing-along-now-playing"
          >
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-[#f0a988] shrink-0 mt-1" />
              <div className="flex-1 min-w-0">
                <p className="text-xs uppercase tracking-wider text-[#a36b29] font-semibold">Now playing</p>
                <h3 className="font-accent text-lg font-bold text-[#3a4a55] truncate">{current.title}</h3>
                <pre className="text-sm text-[#3a4a55] font-sans mt-2 max-h-48 overflow-auto whitespace-pre-wrap" data-testid="sing-along-lyrics">
                  {current.lyrics}
                </pre>
              </div>
            </div>
            <audio
              ref={audioRef}
              onEnded={() => setActive(null)}
              onPause={() => { /* keep modal open so kids can re-read */ }}
              controls
              className="w-full mt-3"
              data-testid="sing-along-audio"
            />
          </aside>
        )}
        {/* Hidden audio so unconditional play() works even before current resolves */}
        {!current && (
          <audio ref={audioRef} className="hidden" data-testid="sing-along-audio-hidden" />
        )}

        <p className="text-center text-xs text-[#6b7280] mt-10">
          Made with the Sea Stars' favorite tunes. <Link to="/wave-badges" className="underline">Catch more badges →</Link>
        </p>
      </div>
    </main>
  );
}

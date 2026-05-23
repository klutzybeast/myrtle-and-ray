import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Music2, Play, Lock } from "lucide-react";
import { api } from "../lib/api";
import SEO from "../components/SEO";
import SongPlayer, { characterColor } from "../components/SongPlayer";

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

  return (
    <main className="pt-24 pb-12 bg-foam-grad min-h-screen" data-testid="sing-along-page">
      <SEO title="Sing-Along" description="Sing along with the Sea Stars of Stingray Cay. 10 short songs about kindness, curiosity, teamwork, and encouragement." />
      <div className="max-w-5xl mx-auto px-4">
        <div className="text-center mb-8">
          <Music2 className="w-10 h-10 sm:w-12 sm:h-12 text-[#f0a988] mx-auto mb-2" />
          <h1 className="font-accent text-4xl sm:text-5xl md:text-6xl font-bold leading-tight">Sing-Along with the Sea Stars</h1>
          <p className="text-sm sm:text-base text-[#4a5568] mt-3 max-w-2xl mx-auto px-2">
            Tap a song to start. The words light up as the Sea Stars sing — sing along with them!
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

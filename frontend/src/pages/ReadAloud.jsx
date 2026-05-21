import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import SEO from "../components/SEO";
import { ChevronLeft, ChevronRight, Play, Pause, RotateCcw, BookOpen } from "lucide-react";

function fullUrl(u) {
  if (!u) return "";
  if (u.startsWith("http")) return u;
  return `${process.env.REACT_APP_BACKEND_URL}${u}`;
}

export default function ReadAloud() {
  const [book, setBook] = useState({ title: "", pages: [], characters: {} });
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const audioRef = useRef(null);

  useEffect(() => {
    api.get("/read-aloud/book").then(({ data }) => setBook(data || { pages: [] }));
  }, []);

  const pages = book.pages || [];
  const page = pages[idx];
  const speaker = page ? book.characters?.[page.character_slug] : null;
  const audioUrl = page?.audio_url ? fullUrl(page.audio_url) : "";

  // When audio source changes, reset state
  useEffect(() => {
    setPlaying(false);
    const a = audioRef.current;
    if (a) { a.pause(); a.currentTime = 0; }
  }, [idx, audioUrl]);

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a || !audioUrl) return;
    if (a.paused) { a.play().catch(() => setPlaying(false)); }
    else { a.pause(); }
  };

  const goPrev = () => setIdx((i) => Math.max(0, i - 1));
  const goNext = () => setIdx((i) => Math.min(pages.length - 1, i + 1));
  const restart = () => { setIdx(0); };

  // Keyboard nav
  useEffect(() => {
    const onKey = (e) => {
      if (e.target?.tagName === "INPUT" || e.target?.tagName === "TEXTAREA") return;
      if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === " ") { e.preventDefault(); togglePlay(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioUrl, pages.length]);

  const progress = pages.length ? ((idx + 1) / pages.length) * 100 : 0;

  if (!pages.length) {
    return (
      <main className="pt-24 pb-12 bg-foam-grad min-h-screen" data-testid="read-aloud-page">
        <SEO title="Read Aloud" description="Listen to Myrtle and Ray and the First Day of Camp — read aloud by the characters themselves." />
        <div className="max-w-3xl mx-auto px-4 text-center">
          <BookOpen className="w-12 h-12 mx-auto text-[#7fcfc7]" />
          <h1 className="font-accent text-4xl md:text-5xl font-bold mt-3">Read Aloud</h1>
          <p className="text-[#4a5568] mt-2">The storybook is being prepared — check back soon!</p>
        </div>
      </main>
    );
  }

  return (
    <main className="pt-24 pb-12 bg-foam-grad min-h-screen" data-testid="read-aloud-page">
      <SEO title={`Read Aloud — ${book.title}`} description="Listen to Myrtle and Ray and the First Day of Camp — read aloud by the characters themselves." />
      <div className="max-w-5xl mx-auto px-4 md:px-6">
        <header className="text-center mb-6">
          <h1 className="font-accent text-4xl md:text-5xl font-bold">{book.title || "Read Aloud"}</h1>
          <p className="text-[#4a5568] mt-2 max-w-2xl mx-auto text-sm md:text-base">Press play and the characters will read each page to you. Use the arrows or your keyboard to turn the page.</p>
        </header>

        {/* Progress bar */}
        <div className="w-full h-2 bg-[#eef9fb] rounded-full overflow-hidden mb-4" data-testid="read-aloud-progress">
          <div className="h-full bg-[#7fcfc7] transition-all" style={{ width: `${progress}%` }} />
        </div>

        {/* Page card */}
        <div className="card-cream p-5 md:p-10 relative overflow-hidden" data-testid={`read-aloud-page-${page.page}`}>
          <div className="absolute top-3 right-4 text-xs font-bold text-[#a08660]">Page {page.page} of {pages.length}</div>

          <div className="flex flex-col md:flex-row gap-6 md:gap-10 items-stretch">
            {/* Left: page image or styled text-only */}
            <div className="md:flex-1 min-h-[280px] md:min-h-[420px] rounded-2xl bg-[#fffbf3] border-2 border-[#f4e4c6] grid place-items-center p-6 overflow-hidden">
              {page.image_url ? (
                <img src={fullUrl(page.image_url)} alt={`Page ${page.page}`} className="w-full h-auto max-h-[480px] object-contain rounded-xl" data-testid="read-aloud-page-image" />
              ) : (
                <p className="font-accent text-2xl md:text-3xl leading-snug text-center text-[#3a4a55] whitespace-pre-line" data-testid="read-aloud-page-text">{page.text}</p>
              )}
            </div>

            {/* Right: speaker + controls */}
            <div className="md:w-72 flex flex-col gap-4">
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#eef9fb] border border-[#dff3f6]" data-testid="read-aloud-speaker">
                {speaker?.image_url && <img src={fullUrl(speaker.image_url)} alt={speaker.name} className="w-14 h-14 rounded-full object-cover border-2 border-white shadow" />}
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-[#6b7280] font-bold">Read by</div>
                  <div className="font-accent text-lg font-bold leading-tight">{speaker?.name || "Narrator"}</div>
                </div>
              </div>

              {/* Play / pause */}
              <button
                onClick={togglePlay}
                disabled={!audioUrl}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[#5a8a6f] text-white font-bold py-4 text-base shadow-md hover:bg-[#4a7a5f] disabled:opacity-50 disabled:cursor-not-allowed transition"
                data-testid="read-aloud-play"
              >
                {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                {audioUrl ? (playing ? "Pause" : "Play this page") : "Audio coming soon"}
              </button>

              {/* Hidden audio element */}
              {audioUrl && (
                <audio
                  ref={audioRef}
                  src={audioUrl}
                  preload="auto"
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                  onEnded={() => {
                    setPlaying(false);
                    if (autoAdvance && idx < pages.length - 1) {
                      setTimeout(() => setIdx((i) => Math.min(pages.length - 1, i + 1)), 400);
                    }
                  }}
                  data-testid="read-aloud-audio"
                />
              )}

              <label className="flex items-center gap-2 text-sm text-[#4a5568] cursor-pointer select-none" data-testid="read-aloud-autoadvance">
                <input type="checkbox" checked={autoAdvance} onChange={(e) => setAutoAdvance(e.target.checked)} className="w-4 h-4 accent-[#7fcfc7]" />
                Auto-turn pages
              </label>

              <div className="grid grid-cols-2 gap-2 mt-auto">
                <button onClick={goPrev} disabled={idx === 0} className="btn-secondary justify-center disabled:opacity-40 disabled:cursor-not-allowed" data-testid="read-aloud-prev"><ChevronLeft className="w-4 h-4" />Back</button>
                <button onClick={goNext} disabled={idx === pages.length - 1} className="btn-primary justify-center disabled:opacity-40 disabled:cursor-not-allowed" data-testid="read-aloud-next">Next<ChevronRight className="w-4 h-4" /></button>
              </div>
              {idx === pages.length - 1 && (
                <button onClick={restart} className="btn-ghost justify-center text-sm" data-testid="read-aloud-restart"><RotateCcw className="w-4 h-4" />Read again</button>
              )}
            </div>
          </div>
        </div>

        {/* Page dots */}
        <div className="flex flex-wrap justify-center gap-1.5 mt-6" data-testid="read-aloud-dots">
          {pages.map((p, i) => (
            <button
              key={p.page}
              onClick={() => setIdx(i)}
              aria-label={`Go to page ${p.page}`}
              className={`w-7 h-7 rounded-full text-[11px] font-bold transition ${i === idx ? "bg-[#5a8a6f] text-white shadow" : "bg-white border border-[#f4e4c6] text-[#5a6b76] hover:bg-[#eef9fb]"}`}
              data-testid={`read-aloud-dot-${p.page}`}
            >{p.page}</button>
          ))}
        </div>
      </div>
    </main>
  );
}

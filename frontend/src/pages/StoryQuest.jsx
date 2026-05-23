import { useEffect, useMemo, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { Waves, Sparkles, Volume2, VolumeX, ArrowRight, Trophy, Share2, RotateCcw, Download } from "lucide-react";
import SEO from "../components/SEO";
import { toast } from "sonner";
import { renderStoryQuestShareCard } from "../lib/storyQuestShareCard";

const PROGRESS_KEY = "mr_quest_progress";
const NAME_KEY = "mr_quest_name";
const BADGES_KEY = "mr_badges";
const BADGE_LABEL = "Story Quest Champion";
const BADGE_KEY = "story_quest";

const WAVE_META = {
  welcome_curiosity: { letter: "W", color: "#7fcfc7", label: "Welcome Curiosity" },
  act_with_kindness: { letter: "A", color: "#f0a988", label: "Act with Kindness" },
  value_teamwork:    { letter: "V", color: "#b8a3d9", label: "Value Teamwork" },
  encourage_others:  { letter: "E", color: "#7cbf94", label: "Encourage Others" },
};

const WAVE_LETTER_TO_PRINCIPLE = {
  W: "welcome_curiosity",
  A: "act_with_kindness",
  V: "value_teamwork",
  E: "encourage_others",
};

function loadProgress() {
  try { return JSON.parse(localStorage.getItem(PROGRESS_KEY) || "null"); } catch { return null; }
}
function saveProgress(state) {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(state)); } catch {}
}
function clearProgress() {
  try { localStorage.removeItem(PROGRESS_KEY); } catch {}
}
function readBadges() {
  try { return JSON.parse(localStorage.getItem(BADGES_KEY) || "[]"); } catch { return []; }
}
function awardBadge(key) {
  const list = readBadges();
  if (!list.includes(key)) {
    list.push(key);
    try { localStorage.setItem(BADGES_KEY, JSON.stringify(list)); } catch {}
    return true;
  }
  return false;
}

function emptyScores() {
  return { welcome_curiosity: 0, act_with_kindness: 0, value_teamwork: 0, encourage_others: 0 };
}

export default function StoryQuest() {
  const [scenes, setScenes] = useState([]);
  const [mappings, setMappings] = useState(null);
  const [characters, setCharacters] = useState([]);
  const [stage, setStage] = useState("splash"); // splash | scene | reaction | finale
  const [idx, setIdx] = useState(0);
  const [scores, setScores] = useState(emptyScores);
  const [picks, setPicks] = useState([]); // [{scene_number, scene_title, scene_id, narrator_slug, narrator_name, wave_principle, matched_narrator}]
  const [lastChoice, setLastChoice] = useState(null);
  const [muted, setMuted] = useState(true);
  const [narrationDone, setNarrationDone] = useState(false);
  const [playerName, setPlayerName] = useState(() => {
    try { return (localStorage.getItem(NAME_KEY) || "").slice(0, 24); } catch { return ""; }
  });
  const audioRef = useRef(null);

  useEffect(() => {
    Promise.all([
      api.get("/story-quest/scenes"),
      api.get("/story-quest/character-mappings"),
      api.get("/characters"),
    ]).then(([s, m, c]) => {
      setScenes(s.data || []);
      setMappings(m.data || null);
      setCharacters(c.data || []);
      // Resume progress if any
      const prev = loadProgress();
      if (prev && prev.idx >= 0 && prev.scores) {
        setIdx(prev.idx);
        setScores(prev.scores);
        if (Array.isArray(prev.picks)) setPicks(prev.picks);
        setStage(prev.stage || "scene");
      }
    }).catch(() => {});
    return () => {
      // Pause audio on unmount
      try { audioRef.current?.pause(); } catch {}
    };
  }, []);

  useEffect(() => {
    try { localStorage.setItem(NAME_KEY, playerName || ""); } catch {}
  }, [playerName]);

  useEffect(() => {
    if (stage !== "splash") {
      saveProgress({ idx, scores, picks, stage });
    }
  }, [idx, scores, picks, stage]);

  const current = scenes[idx] || null;
  const narrator = current?.narrator_slug
    ? characters.find((c) => c.slug === current.narrator_slug)
    : null;
  // The W.A.V.E. principle suggested by the narrator's own value — used to
  // gently pulse the matching choice once narration ends.
  const narratorPrinciple = narrator?.wave_value
    ? WAVE_LETTER_TO_PRINCIPLE[narrator.wave_value]
    : null;
  // Choices "open up" once narration finishes. If the kid is in quiet mode or
  // the scene has no audio, choices are open immediately.
  const choicesOpen = narrationDone || muted || !current?.audio_narration_url;

  // Stop audio whenever the scene changes, then auto-play the new
  // narration if the user enabled sound. The user's "Start with
  // narration" click is the gesture that unlocks autoplay.
  useEffect(() => {
    setNarrationDone(false);
    const el = audioRef.current;
    if (!el) return;
    try { el.pause(); el.currentTime = 0; } catch {}
    if (!muted && current?.audio_narration_url && stage === "scene") {
      // microtask: wait for new <audio> src to settle
      const t = setTimeout(() => {
        const a = audioRef.current;
        if (a) a.play().catch(() => {/* autoplay blocked — kid can hit play */});
      }, 30);
      return () => clearTimeout(t);
    }
  }, [idx, stage, muted, current?.audio_narration_url]);

  const totalScenes = scenes.length;

  const start = (withSound = false) => {
    setIdx(0);
    setScores(emptyScores());
    setPicks([]);
    setLastChoice(null);
    setMuted(!withSound);
    setStage("scene");
  };

  const reset = () => {
    clearProgress();
    setIdx(0);
    setScores(emptyScores());
    setPicks([]);
    setLastChoice(null);
    setStage("splash");
  };

  const choose = (choice) => {
    setScores((prev) => ({ ...prev, [choice.wave_principle]: (prev[choice.wave_principle] || 0) + 1 }));
    if (current) {
      setPicks((prev) => [
        ...prev,
        {
          scene_id: current.id,
          scene_number: current.scene_number,
          scene_title: current.title,
          narrator_slug: current.narrator_slug || "",
          narrator_name: narrator?.name || "",
          wave_principle: choice.wave_principle,
          matched_narrator: !!narratorPrinciple && choice.wave_principle === narratorPrinciple,
        },
      ]);
    }
    setLastChoice(choice);
    setStage("reaction");
  };

  const advance = () => {
    // If we just answered the finale choice, go to finale screen
    if (current?.is_finale || idx >= totalScenes - 1) {
      finish();
      return;
    }
    setIdx(idx + 1);
    setLastChoice(null);
    setStage("scene");
  };

  const finish = async () => {
    // Compute matched character(s)
    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const top = sorted[0]?.[1] ?? 0;
    const winners = sorted.filter(([_, v]) => v === top && v > 0).map(([k]) => k);
    const matchedSlugs = winners
      .map((w) => mappings?.[w])
      .filter(Boolean);
    const matchedPrimary = matchedSlugs[0] || (mappings?.act_with_kindness) || "myrtle";
    // Award badge
    const fresh = awardBadge(BADGE_KEY);
    if (fresh) toast.success(`🌟 Wave badge unlocked: ${BADGE_LABEL}!`);
    // Track completion (best-effort)
    api.post("/story-quest/track-completion", {
      wave_scores: scores,
      matched_character: matchedPrimary,
      matched_characters: matchedSlugs,
    }).catch(() => {});
    setStage("finale");
  };

  // ---------- RENDER ----------
  if (!scenes.length) {
    return (
      <main className="pt-24 pb-12 bg-foam-grad min-h-screen text-center" data-testid="story-quest-empty">
        <p className="text-[#5a6b76]">The quest is preparing...</p>
      </main>
    );
  }

  if (stage === "splash") {
    return <Splash totalScenes={totalScenes} onStart={start} playerName={playerName} onNameChange={setPlayerName} />;
  }

  if (stage === "finale") {
    return (
      <Finale
        scores={scores}
        picks={picks}
        mappings={mappings}
        characters={characters}
        playerName={playerName}
        onReplay={(withSound = false) => {
          reset();
          setStage("splash");
          setTimeout(() => start(withSound), 50);
        }}
      />
    );
  }

  // scene or reaction
  return (
    <main className="pt-20 pb-12 bg-foam-grad min-h-screen" data-testid="story-quest-page">
      <SEO title="Story Quest" description="An interactive adventure through Stingray Cay that reveals your Sea Star." />
      <div className="max-w-3xl mx-auto px-4 md:px-6">
        <ProgressBar current={idx + 1} total={totalScenes} muted={muted} onToggleMute={() => setMuted((m) => !m)} hasAudio={!!current?.audio_narration_url} audioRef={audioRef} />

        <article className="bg-white rounded-[28px] p-6 md:p-8 mt-4 shadow-md" data-testid={`scene-${current?.scene_number}`}>
          {current?.background_image_url && (
            <img src={current.background_image_url} alt="" className="w-full max-h-64 object-cover rounded-2xl mb-4" />
          )}
          <h2 className="font-accent text-3xl font-bold mb-1" data-testid="scene-title">{current?.title}</h2>
          <div className="text-xs text-[#6b7280] uppercase tracking-wider mb-3">Scene {current?.scene_number} of {totalScenes}</div>

          {narrator && (
            <div className="flex items-center gap-2 mb-3" data-testid={`scene-narrator-${narrator.slug}`}>
              <div className="gradient-ring shrink-0" style={{ width: 36, height: 36 }}>
                <img src={narrator.image_url || "/logo.png"} alt="" className="w-full h-full rounded-full object-contain bg-[#fffbf3]" />
              </div>
              <div className="text-xs">
                <span className="text-[#6b7280]">Narrated by</span>{" "}
                <span className="font-bold text-[#3a4a55]">{narrator.name}</span>
              </div>
            </div>
          )}

          {current?.audio_narration_url && !muted && (
            <audio
              key={current.id}
              ref={audioRef}
              src={current.audio_narration_url.startsWith("http") ? current.audio_narration_url : `${process.env.REACT_APP_BACKEND_URL}${current.audio_narration_url}`}
              autoPlay
              controls
              onEnded={() => setNarrationDone(true)}
              className="w-full mb-4"
              data-testid={`scene-audio-${current.scene_number}`}
            />
          )}

          <p className="text-lg text-[#3a4a55] leading-relaxed mb-6 whitespace-pre-line" data-testid="scene-narrative">{current?.narrative}</p>

          {stage === "scene" && current?.choices?.length > 0 && (
            <div
              key={`choices-${current.id}-${choicesOpen ? "open" : "wait"}`}
              className={`space-y-3 transition-opacity duration-500 ${choicesOpen ? "opacity-100 animate-choices-rise" : "opacity-40"}`}
              data-testid="scene-choices"
              data-state={choicesOpen ? "open" : "waiting"}
            >
              {current.choices.map((c) => {
                const meta = WAVE_META[c.wave_principle];
                const isNarratorPick = choicesOpen && narratorPrinciple && c.wave_principle === narratorPrinciple;
                return (
                  <button
                    key={c.id}
                    onClick={() => choose(c)}
                    className={`w-full text-left p-4 rounded-2xl border-2 bg-[#fffbf3] hover:border-[#7fcfc7] hover:bg-[#eaf7f5] hover:-translate-y-0.5 transition ${isNarratorPick ? "border-[#7fcfc7] animate-wave-nudge" : "border-[#f4e4c6]"}`}
                    data-testid={`scene-choice-${c.id}`}
                    data-narrator-pick={isNarratorPick ? "true" : "false"}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className="w-9 h-9 rounded-full flex-shrink-0 grid place-items-center font-accent font-bold text-white text-lg"
                        style={{ backgroundColor: meta?.color || "#7fcfc7" }}
                        aria-hidden
                      >
                        {meta?.letter || "?"}
                      </span>
                      <span className="text-[#3a4a55] font-semibold">{c.text}</span>
                    </div>
                  </button>
                );
              })}
              {!choicesOpen && (
                <p className="text-center text-xs text-[#6b7280] italic pt-1" data-testid="choices-waiting-hint">
                  Listening to {narrator?.name || "the narrator"}… your choices will glow when it's your turn.
                </p>
              )}
            </div>
          )}

          {stage === "reaction" && lastChoice && (
            <div className="bg-[#fff8ec] border-2 border-[#f4d59c] rounded-2xl p-4" data-testid="scene-reaction">
              <div className="text-xs uppercase tracking-wider text-[#a36b29] mb-1">What happened next</div>
              <p className="text-[#3a4a55] leading-relaxed mb-3">{lastChoice.character_reaction || "Your choice ripples through the cay."}</p>
              <button onClick={advance} className="btn-primary w-full justify-center" data-testid="scene-continue">
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </article>

        <div className="text-center mt-4">
          <button onClick={reset} className="text-xs text-[#6b7280] underline" data-testid="quest-restart">Start over</button>
        </div>
      </div>
    </main>
  );
}

function Splash({ totalScenes, onStart, playerName, onNameChange }) {
  return (
    <main className="pt-24 pb-12 bg-foam-grad min-h-screen" data-testid="story-quest-splash">
      <SEO title="Story Quest" description="An interactive adventure through Stingray Cay that reveals your Sea Star." />
      <div className="max-w-2xl mx-auto px-4 text-center">
        <Sparkles className="w-12 h-12 text-[#f0a988] mx-auto mb-3" />
        <h1 className="font-accent text-5xl md:text-6xl font-bold mb-3">Story Quest</h1>
        <p className="text-lg text-[#4a5568] mb-2">Adventure through Stingray Cay one scene at a time.</p>
        <p className="text-sm text-[#6b7280] mb-6">Every choice celebrates a W.A.V.E. value — and at the end you'll discover your Sea Star.</p>

        <div className="bg-white rounded-[28px] p-6 mb-6 grid grid-cols-2 md:grid-cols-4 gap-3 text-left">
          {Object.entries(WAVE_META).map(([k, m]) => (
            <div key={k} className="flex items-center gap-2">
              <span className="w-9 h-9 rounded-full grid place-items-center font-accent font-bold text-white" style={{ backgroundColor: m.color }}>{m.letter}</span>
              <span className="text-sm font-semibold text-[#3a4a55]">{m.label}</span>
            </div>
          ))}
        </div>

        <p className="text-xs text-[#6b7280] mb-4">~{Math.max(10, Math.round(totalScenes * 1.1))} minutes · {totalScenes} scenes · earn the Story Quest Champion badge</p>

        <div className="max-w-sm mx-auto mb-5 text-left">
          <label htmlFor="quest-name" className="text-xs font-semibold text-[#3a4a55] uppercase tracking-wider mb-1 block">
            What's your name? <span className="text-[#6b7280] normal-case font-normal">(optional)</span>
          </label>
          <input
            id="quest-name"
            type="text"
            value={playerName}
            onChange={(e) => onNameChange(e.target.value.slice(0, 24))}
            placeholder="So we can say it back to you"
            maxLength={24}
            className="w-full px-4 py-3 rounded-full border-2 border-[#f4e4c6] bg-white focus:border-[#7fcfc7] focus:outline-none text-[#3a4a55] text-center"
            data-testid="quest-name-input"
            autoComplete="given-name"
          />
        </div>

        <p className="text-sm text-[#3a4a55] font-semibold mb-3">Every scene is narrated by a different Sea Star — pick how you want to play:</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center items-stretch">
          <button
            onClick={() => onStart(true)}
            className="btn-primary text-lg justify-center"
            data-testid="quest-start"
          >
            <Volume2 className="w-5 h-5" /> Start with narration
          </button>
          <button
            onClick={() => onStart(false)}
            className="btn-secondary text-base justify-center"
            data-testid="quest-start-silent"
          >
            <VolumeX className="w-5 h-5" /> Quiet mode
          </button>
        </div>
        <p className="text-[11px] text-[#6b7280] mt-3">You can switch sound on or off any time with the speaker button.</p>
      </div>
    </main>
  );
}

function ProgressBar({ current, total, muted, onToggleMute, hasAudio }) {
  const pct = Math.round((current / total) * 100);
  return (
    <div className="flex items-center gap-3" data-testid="quest-progress">
      <div
        className="flex-1 h-2 bg-white/70 rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-label={`Scene ${current} of ${total}`}
      >
        <div className="h-full bg-[#7fcfc7] transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-[#6b7280] tabular-nums">{current}/{total}</span>
      {hasAudio && (
        <button onClick={onToggleMute} className="p-2 rounded-full bg-white hover:bg-[#eef9fb]" aria-label={muted ? "Unmute narration" : "Mute narration"} data-testid="quest-mute-toggle">
          {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-[#5a8a6f]" />}
        </button>
      )}
    </div>
  );
}

function Finale({ scores, picks, mappings, characters, playerName, onReplay }) {
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const top = sorted[0]?.[1] ?? 0;
  const winners = sorted.filter(([_, v]) => v === top && v > 0).map(([k]) => k);
  const matchedSlugs = winners.map((w) => mappings?.[w]).filter(Boolean);
  const matchedChars = matchedSlugs.map((slug) => characters.find((c) => c.slug === slug)).filter(Boolean);
  const cleanName = (playerName || "").trim().slice(0, 24);
  const subject = cleanName || "You";
  const verb = cleanName ? "is" : "'re";  // "Tessa is like…"  vs  "You're like…"

  const total = Object.values(scores).reduce((s, v) => s + v, 0) || 1;
  const fingerprint = Object.entries(WAVE_META).map(([k, meta]) => ({
    key: k, ...meta, score: scores[k] || 0, pct: Math.round(((scores[k] || 0) / total) * 100),
  }));

  // Top 3 W.A.V.E. moments: scenes where the kid's pick matched the narrator's value.
  // If fewer than 3 narrator-matches, fill from remaining picks in scene order.
  const matchedPicks = (picks || []).filter((p) => p.matched_narrator);
  const otherPicks = (picks || []).filter((p) => !p.matched_narrator);
  const topMoments = [...matchedPicks, ...otherPicks].slice(0, 3);
  // Count how many times each narrator the kid "really listened" to.
  const listenedTo = matchedPicks.reduce((acc, p) => {
    if (p.narrator_slug) acc[p.narrator_slug] = (acc[p.narrator_slug] || 0) + 1;
    return acc;
  }, {});
  const topListenedSlug = Object.entries(listenedTo).sort((a, b) => b[1] - a[1])[0]?.[0];
  const topListenedChar = topListenedSlug ? characters.find((c) => c.slug === topListenedSlug) : null;

  // Personalized voice line from the matched Sea Star — synthesized (or cached)
  // by the backend, played from the public /api/uploads cache.
  const [finaleVoice, setFinaleVoice] = useState(null); // { audio_url, text }
  const finaleAudioRef = useRef(null);
  const primaryMatchedSlug = matchedChars[0]?.slug;
  const primaryMatchedHasVoice = !!matchedChars[0]?.voice_id;
  useEffect(() => {
    if (!primaryMatchedSlug || !primaryMatchedHasVoice) return;
    let alive = true;
    api.post("/story-quest/finale-voice", {
      matched_slug: primaryMatchedSlug,
      player_name: cleanName,
    }).then(({ data }) => {
      if (alive) setFinaleVoice(data || null);
    }).catch(() => {});
    return () => { alive = false; };
  }, [primaryMatchedSlug, primaryMatchedHasVoice, cleanName]);
  useEffect(() => {
    if (finaleVoice?.audio_url && finaleAudioRef.current) {
      const t = setTimeout(() => {
        finaleAudioRef.current?.play().catch(() => {/* kid taps play */});
      }, 50);
      return () => clearTimeout(t);
    }
  }, [finaleVoice]);

  const sharePayload = useMemo(() => {
    const names = matchedChars.map((c) => c.name).join(" & ") || "a Sea Star";
    const who = cleanName ? `${cleanName} is` : "I'm";
    return {
      title: "My Story Quest result",
      text: `${who} like ${names} 🌟 on Myrtle and Ray's Story Quest! Take it yourself:`,
      url: typeof window !== "undefined" ? `${window.location.origin}/story-quest` : "/story-quest",
    };
  }, [matchedChars, cleanName]);

  const buildShareBlob = async () => {
    try {
      const primaryMatched = matchedChars[0] || null;
      return await renderStoryQuestShareCard({
        matchedChar: primaryMatched,
        listenedChar: topListenedChar,
        listenedCount: topListenedSlug ? (listenedTo[topListenedSlug] || 0) : 0,
        scores,
        playerName: cleanName,
        siteName: "Myrtle and Ray",
      });
    } catch {
      return null;
    }
  };

  const share = async () => {
    try {
      const blob = await buildShareBlob();
      const file = blob ? new File([blob], "my-sea-star.png", { type: "image/png" }) : null;
      // Modern mobile: share text + image
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ ...sharePayload, files: [file] });
        return;
      }
      if (navigator.share) {
        await navigator.share(sharePayload);
        return;
      }
      // Desktop fallback: download the image AND copy the link
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = "my-sea-star.png"; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        toast.success("Share card downloaded! Drop it into any social post.");
      } else {
        await navigator.clipboard.writeText(`${sharePayload.text} ${sharePayload.url}`);
        toast.success("Link copied!");
      }
    } catch {
      // user cancelled
    }
  };

  const downloadCard = async () => {
    const blob = await buildShareBlob();
    if (!blob) { toast.error("Could not build the share card."); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "my-sea-star.png"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("Saved to your downloads!");
  };

  return (
    <main className="pt-20 pb-16 bg-foam-grad min-h-screen" data-testid="quest-finale">
      <SEO title="Your Story Quest Result" />
      <div className="max-w-2xl mx-auto px-4">
        <div className="text-center mb-6">
          <Trophy className="w-12 h-12 text-[#f0a988] mx-auto mb-2" />
          <div className="text-sm uppercase tracking-wider text-[#a36b29] font-semibold">You completed the quest!</div>
          <h1 className="font-accent text-4xl md:text-5xl font-bold mt-1" data-testid="quest-finale-headline">
            {subject}{verb === "is" ? " is " : verb + " "}like{" "}
            <span className="text-[#5a8a6f]">{matchedChars.map((c) => c.name).join(" & ") || "a true Sea Star"}</span>!
          </h1>
        </div>

        <div className="bg-white rounded-[28px] p-6 mb-5" data-testid="quest-matched-card">
          <div className="flex flex-wrap gap-4 justify-center mb-3">
            {matchedChars.map((c) => (
              <div key={c.slug} className="text-center" data-testid={`matched-${c.slug}`}>
                <div className="gradient-ring mx-auto" style={{ width: 110, height: 110 }}>
                  <img src={c.image_url || "/logo.png"} alt={c.name} className="w-full h-full rounded-full object-contain bg-[#fffbf3]" />
                </div>
                <div className="font-accent text-xl font-bold mt-2">{c.name}</div>
                {c.role && <div className="text-xs text-[#6b7280]">{c.role}</div>}
              </div>
            ))}
          </div>
          <p className="text-center text-[#4a5568] italic">
            {matchedChars.length > 1
              ? "You're tied between two Sea Stars — that's rare! Your W.A.V.E. fingerprint is uniquely you."
              : "Just like your Sea Star match, you make the cay shine in your own special way."}
          </p>
          {finaleVoice?.audio_url && (
            <div className="mt-4 pt-4 border-t border-[#f4e4c6]" data-testid="quest-finale-voice">
              <div className="flex items-center gap-2 mb-2">
                <Volume2 className="w-4 h-4 text-[#5a8a6f] shrink-0" />
                <span className="text-xs font-semibold text-[#3a4a55] uppercase tracking-wider">
                  Hear it from {matchedChars[0]?.name || "your Sea Star"}
                </span>
              </div>
              <audio
                ref={finaleAudioRef}
                src={finaleVoice.audio_url.startsWith("http") ? finaleVoice.audio_url : `${process.env.REACT_APP_BACKEND_URL}${finaleVoice.audio_url}`}
                controls
                className="w-full"
              />
              <p className="text-xs text-[#6b7280] italic mt-2">"{finaleVoice.text}"</p>
            </div>
          )}
        </div>

        {topMoments.length > 0 && (
          <section className="bg-white rounded-[28px] p-6 mb-5" data-testid="quest-top-moments">
            <h2 className="font-accent text-2xl font-bold mb-1 text-center">Your top W.A.V.E. moments</h2>
            {topListenedChar && matchedPicks.length >= 2 ? (
              <p className="text-center text-sm text-[#4a5568] mb-4" data-testid="quest-listened-callout">
                You <b>really listened</b> to <span className="text-[#5a8a6f] font-bold">{topListenedChar.name}</span> — you matched their W.A.V.E. value{" "}
                <b>{listenedTo[topListenedSlug]}×</b>.
              </p>
            ) : (
              <p className="text-center text-sm text-[#4a5568] mb-4">
                The three scenes where your choice felt the most <i>you</i>:
              </p>
            )}
            <ol className="space-y-3">
              {topMoments.map((p, i) => {
                const meta = WAVE_META[p.wave_principle];
                const narrChar = characters.find((c) => c.slug === p.narrator_slug);
                return (
                  <li
                    key={p.scene_id || i}
                    className={`flex items-center gap-3 p-3 rounded-2xl border-2 ${p.matched_narrator ? "border-[#7fcfc7] bg-[#eaf7f5]" : "border-[#f4e4c6] bg-[#fffbf3]"}`}
                    data-testid={`top-moment-${i + 1}`}
                    data-matched={p.matched_narrator ? "true" : "false"}
                  >
                    <span className="font-accent font-bold text-2xl text-[#a36b29] w-6 text-center">{i + 1}</span>
                    {narrChar && (
                      <div className="gradient-ring shrink-0" style={{ width: 40, height: 40 }}>
                        <img src={narrChar.image_url || "/logo.png"} alt="" className="w-full h-full rounded-full object-contain bg-[#fffbf3]" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-[#3a4a55] text-sm truncate">{p.scene_title}</div>
                      <div className="text-xs text-[#6b7280]">
                        Scene {p.scene_number} · {p.narrator_name || "Narrator"}
                        {p.matched_narrator && <span className="ml-1 text-[#5a8a6f] font-bold">· you listened ✓</span>}
                      </div>
                    </div>
                    <span
                      className="w-9 h-9 rounded-full grid place-items-center font-accent font-bold text-white shrink-0"
                      style={{ backgroundColor: meta?.color || "#7fcfc7" }}
                      title={meta?.label}
                      aria-label={meta?.label}
                    >
                      {meta?.letter || "?"}
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        <section className="bg-white rounded-[28px] p-6 mb-5" data-testid="quest-fingerprint">
          <h2 className="font-accent text-2xl font-bold mb-3 text-center">Your W.A.V.E. fingerprint</h2>
          <div className="space-y-3">
            {fingerprint.map((row) => (
              <div key={row.key} className="flex items-center gap-3" data-testid={`fingerprint-${row.key}`}>
                <span className="w-9 h-9 rounded-full grid place-items-center font-accent font-bold text-white flex-shrink-0" style={{ backgroundColor: row.color }}>{row.letter}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-[#3a4a55]">{row.label}</div>
                  <div className="h-2 bg-[#f4e4c6] rounded-full overflow-hidden mt-1">
                    <div className="h-full transition-all" style={{ width: `${row.pct}%`, backgroundColor: row.color }} />
                  </div>
                </div>
                <span className="font-bold tabular-nums text-[#3a4a55] w-12 text-right">
                  {"⭐".repeat(row.score)}
                </span>
              </div>
            ))}
          </div>
        </section>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <button onClick={share} className="btn-primary justify-center" data-testid="quest-share">
            <Share2 className="w-4 h-4" /> Share my result
          </button>
          <button onClick={downloadCard} className="btn-secondary justify-center" data-testid="quest-download-card">
            <Download className="w-4 h-4" /> Save share card
          </button>
          <button onClick={onReplay} className="btn-secondary justify-center" data-testid="quest-replay">
            <RotateCcw className="w-4 h-4" /> Play again
          </button>
          <Link to="/wave-badges" className="btn-secondary justify-center text-center" data-testid="quest-see-badges">
            See my badges
          </Link>
        </div>

        <p className="text-center text-xs text-[#6b7280]">
          🌟 You earned the <b>Story Quest Champion</b> Wave Badge. <Link to="/activities" className="underline">Earn more badges →</Link>
        </p>
      </div>
    </main>
  );
}

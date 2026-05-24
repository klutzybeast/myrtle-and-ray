import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { toast } from "sonner";
import { Sparkles, ChevronLeft, Wand2, Loader2, CheckCircle2, AlertCircle, Image as ImageIcon, Mic, Users } from "lucide-react";

const PRESETS = [
  {
    label: "Tidepool Treasure Hunt",
    premise:
      "The Sea Stars discover a mysterious shimmer beneath the tide pools and follow clues left by past campers. Along the way they help shy creatures, share snacks, and learn that the real treasure is what you bring out in your friends.",
  },
  {
    label: "The Stingray Stage Show",
    premise:
      "Camp talent night is two days away, but the band has stage fright. Ray hatches a plan to help every Sea Star find a part they love — even the ones who'd rather sit in the back row.",
  },
  {
    label: "Lighthouse Detective Mystery",
    premise:
      "Someone has been moving the camp's painted rocks at night! Myrtle leads a midnight investigation. The clues point to teamwork, kindness, and a very polite hermit crab.",
  },
  {
    label: "Rescue at Rainbow Reef",
    premise:
      "A baby seahorse has drifted away from her family. The Sea Stars row out into Rainbow Reef to bring her home, navigating tricky currents by working together and cheering each other on.",
  },
];

const STATUS_LABEL = {
  queued: "Queued",
  generating_script: "Writing scenes",
  creating_quest: "Building quest",
  creating_scenes: "Saving scenes",
  generating_backgrounds: "Painting art",
  generating_narration: "Recording narration",
  done: "Done",
  failed: "Failed",
};

export default function AdminStoryQuestGenerate() {
  const [characters, setCharacters] = useState([]);
  const [title, setTitle] = useState("");
  const [premise, setPremise] = useState("");
  const [sceneCount, setSceneCount] = useState(14);
  const [themeColor, setThemeColor] = useState("#7fcfc7");
  const [generateBackgrounds, setGenerateBackgrounds] = useState(true);
  const [generateNarration, setGenerateNarration] = useState(true);
  const [selectedSlugs, setSelectedSlugs] = useState([]);
  const [publish, setPublish] = useState(false);
  const [job, setJob] = useState(null);
  const [history, setHistory] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const pollRef = useRef(null);

  useEffect(() => {
    api.get("/characters").then(({ data }) => setCharacters(data || [])).catch(() => {});
    refreshHistory();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const refreshHistory = async () => {
    try {
      const { data } = await api.get("/admin/story-quest/generate-jobs");
      setHistory(data || []);
    } catch { /* non-fatal */ }
  };

  const toggleSlug = (slug) => {
    setSelectedSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  const startPolling = (jobId) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await api.get(`/admin/story-quest/generate-status/${jobId}`);
        setJob(data);
        if (data.status === "done" || data.status === "failed") {
          clearInterval(pollRef.current);
          pollRef.current = null;
          refreshHistory();
          if (data.status === "done") toast.success("Quest generated!");
          if (data.status === "failed") toast.error(data.error || "Generation failed");
        }
      } catch {
        // keep polling — could be transient
      }
    }, 2500);
  };

  const submit = async () => {
    if (!title.trim() || premise.trim().length < 10) {
      toast.error("Add a title and a longer premise (at least 10 chars).");
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await api.post("/admin/story-quest/generate-full", {
        title: title.trim(),
        premise: premise.trim(),
        character_focus: selectedSlugs[0] || "all",
        character_slugs: selectedSlugs,
        scene_count: sceneCount,
        theme_color: themeColor,
        generate_backgrounds: generateBackgrounds,
        generate_narration: generateNarration,
        publish,
      });
      setJob({ id: data.job_id, status: "queued", progress: 0, step: "Queued" });
      startPolling(data.job_id);
      toast.success("Generation started — this usually takes 1–3 minutes.");
    } catch (err) {
      const msg = err?.response?.data?.detail || "Failed to start generation";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const applyPreset = (p) => {
    if (!title.trim()) setTitle(p.label);
    setPremise(p.premise);
  };

  const isRunning = job && job.status !== "done" && job.status !== "failed";

  return (
    <div className="space-y-5" data-testid="admin-story-quest-generate">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link to="/admin/story-quest" className="text-xs text-[#5a6b76] hover:underline inline-flex items-center gap-1" data-testid="back-to-story-quest">
            <ChevronLeft className="w-3.5 h-3.5" /> Back to Story Quest
          </Link>
          <h1 className="font-accent text-3xl font-bold text-[#2e3a3a] flex items-center gap-2 mt-1">
            <Sparkles className="w-7 h-7 text-[#7fcfc7]" /> Generate a complete quest
          </h1>
          <p className="text-sm text-[#5a6b76] mt-1">
            One click → a full {sceneCount}-scene adventure with dialogue, choices, AI background art, and narration.
          </p>
        </div>
      </header>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* LEFT: form */}
        <section className="lg:col-span-2 bg-white border-2 border-[#f4e4c6] rounded-3xl p-5 space-y-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-[#5a6b76]">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. The Stingray Stage Show"
              className="mt-1 w-full px-3 py-2 rounded-xl border-2 border-[#f4e4c6] bg-[#fffbf3] focus:border-[#7fcfc7] outline-none text-sm"
              data-testid="quest-gen-title"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-[#5a6b76]">Premise</label>
              <div className="flex gap-1 flex-wrap">
                {PRESETS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => applyPreset(p)}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-[#eef9fb] text-[#236f6b] hover:bg-[#dff4f0]"
                    data-testid={`quest-gen-preset-${p.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              value={premise}
              onChange={(e) => setPremise(e.target.value)}
              rows={5}
              placeholder="Describe the adventure in 2–4 sentences. The LLM will turn this into a full quest with dialogue, choices, and W.A.V.E. lessons."
              className="mt-1 w-full px-3 py-2 rounded-xl border-2 border-[#f4e4c6] bg-[#fffbf3] focus:border-[#7fcfc7] outline-none text-sm"
              data-testid="quest-gen-premise"
            />
            <div className="text-[11px] text-[#8a99a3] mt-1">{premise.length}/2000 chars</div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-[#5a6b76]">Scenes</label>
              <input
                type="number"
                min={6}
                max={24}
                value={sceneCount}
                onChange={(e) => setSceneCount(Math.max(6, Math.min(24, Number(e.target.value) || 14)))}
                className="mt-1 w-full px-3 py-2 rounded-xl border-2 border-[#f4e4c6] bg-[#fffbf3] focus:border-[#7fcfc7] outline-none text-sm"
                data-testid="quest-gen-scene-count"
              />
              <div className="text-[11px] text-[#8a99a3] mt-1">6–24 scenes</div>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-[#5a6b76]">Theme color</label>
              <input
                type="color"
                value={themeColor}
                onChange={(e) => setThemeColor(e.target.value)}
                className="mt-1 w-full h-[42px] px-1 py-1 rounded-xl border-2 border-[#f4e4c6] bg-[#fffbf3] cursor-pointer"
                data-testid="quest-gen-theme-color"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-[#5a6b76]">Publish</label>
              <button
                type="button"
                onClick={() => setPublish((v) => !v)}
                className={`mt-1 w-full h-[42px] px-3 rounded-xl border-2 text-sm font-bold transition-colors ${publish ? "bg-[#dff4f0] border-[#7fcfc7] text-[#236f6b]" : "bg-[#fffbf3] border-[#f4e4c6] text-[#5a6b76]"}`}
                data-testid="quest-gen-publish-toggle"
              >
                {publish ? "Live on launch" : "Save as draft"}
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-[#5a6b76] flex items-center gap-1">
              <Users className="w-3.5 h-3.5" /> Cast available to the LLM ({selectedSlugs.length || "all"})
            </label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {characters.map((c) => {
                const on = selectedSlugs.includes(c.slug);
                return (
                  <button
                    key={c.slug}
                    onClick={() => toggleSlug(c.slug)}
                    className={`text-xs px-2.5 py-1 rounded-full border-2 transition-colors ${on ? "bg-[#7fcfc7] border-[#236f6b] text-white" : "bg-white border-[#f4e4c6] text-[#3a4a55] hover:border-[#7fcfc7]"}`}
                    data-testid={`quest-gen-cast-${c.slug}`}
                  >
                    {c.name?.split(" the ")[0] || c.name || c.slug}
                  </button>
                );
              })}
            </div>
            <div className="text-[11px] text-[#8a99a3] mt-1">Tap to include. Empty = whole cast.</div>
          </div>

          <div className="flex flex-wrap gap-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={generateBackgrounds}
                onChange={(e) => setGenerateBackgrounds(e.target.checked)}
                className="w-4 h-4 accent-[#7fcfc7]"
                data-testid="quest-gen-bg-toggle"
              />
              <ImageIcon className="w-4 h-4 text-[#5a8a6f]" />
              <span>Generate background art (Nano Banana)</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={generateNarration}
                onChange={(e) => setGenerateNarration(e.target.checked)}
                className="w-4 h-4 accent-[#7fcfc7]"
                data-testid="quest-gen-narration-toggle"
              />
              <Mic className="w-4 h-4 text-[#5a8a6f]" />
              <span>Generate narration audio (ElevenLabs)</span>
            </label>
          </div>

          <div className="pt-2 border-t border-[#f4e4c6] flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-[#5a6b76]">
              ⏱ Estimate: ~{Math.ceil(sceneCount * ((generateBackgrounds ? 25 : 0) + (generateNarration ? 6 : 0) + 1) / 60)} min for {sceneCount} scenes.
            </div>
            <button
              onClick={submit}
              disabled={submitting || isRunning}
              className="btn-primary inline-flex disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="quest-gen-submit"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
              {isRunning ? "Generating…" : "Generate quest"}
            </button>
          </div>
        </section>

        {/* RIGHT: progress & history */}
        <aside className="space-y-3">
          {job && (
            <div className="bg-white border-2 border-[#7fcfc7] rounded-3xl p-4 space-y-2" data-testid="quest-gen-progress">
              <div className="flex items-center gap-2">
                {job.status === "done" ? (
                  <CheckCircle2 className="w-5 h-5 text-[#5a8a6f]" />
                ) : job.status === "failed" ? (
                  <AlertCircle className="w-5 h-5 text-red-600" />
                ) : (
                  <Loader2 className="w-5 h-5 animate-spin text-[#7fcfc7]" />
                )}
                <div className="font-bold text-[#2e3a3a]">{STATUS_LABEL[job.status] || job.status}</div>
              </div>
              <div className="text-xs text-[#5a6b76]">{job.step || ""}</div>
              {typeof job.progress === "number" && (
                <div className="h-2 bg-[#f4e4c6] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#7fcfc7] transition-all"
                    style={{ width: `${Math.min(100, Math.max(0, job.progress))}%` }}
                  />
                </div>
              )}
              {job.scenes_done != null && job.total_scenes && (
                <div className="text-[11px] text-[#5a6b76]">{job.scenes_done} / {job.total_scenes} assets generated</div>
              )}
              {job.status === "done" && job.quest_slug && (
                <div className="flex flex-col gap-1 pt-2">
                  <Link
                    to="/admin/story-quest"
                    className="text-xs font-bold text-[#236f6b] hover:underline"
                    data-testid="quest-gen-view-admin"
                  >
                    → Edit in Story Quest admin
                  </Link>
                  <a
                    href={`/story-quest/${job.quest_slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-bold text-[#236f6b] hover:underline"
                    data-testid="quest-gen-view-public"
                  >
                    → Preview public quest
                  </a>
                </div>
              )}
              {job.error && (
                <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-2 mt-2">{job.error}</div>
              )}
            </div>
          )}

          <div className="bg-white border-2 border-[#f4e4c6] rounded-3xl p-4">
            <h3 className="font-bold text-sm text-[#2e3a3a] mb-2">Recent jobs</h3>
            {history.length === 0 ? (
              <div className="text-xs text-[#8a99a3]">No jobs yet — generate your first quest above.</div>
            ) : (
              <ul className="space-y-1.5">
                {history.slice(0, 10).map((h) => (
                  <li key={h.id} className="text-xs flex items-center gap-2" data-testid={`quest-gen-history-${h.id}`}>
                    <span className={`inline-block w-2 h-2 rounded-full ${h.status === "done" ? "bg-[#5a8a6f]" : h.status === "failed" ? "bg-red-500" : "bg-[#f0a988]"}`} />
                    <span className="flex-1 truncate text-[#3a4a55]">{h.title || h.id.slice(0, 8)}</span>
                    <span className="text-[10px] text-[#8a99a3] uppercase">{h.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-[#fff4d6] border-2 border-[#f0a988] rounded-3xl p-4 text-xs text-[#a36b29] space-y-1.5">
            <div className="font-bold">How it works</div>
            <ol className="list-decimal ml-4 space-y-0.5">
              <li>Claude writes the scene-by-scene script.</li>
              <li>A new draft quest is saved instantly.</li>
              <li>Nano Banana paints one background per scene.</li>
              <li>ElevenLabs records each narrator's voice line.</li>
              <li>You can edit any scene in the Story Quest admin.</li>
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}

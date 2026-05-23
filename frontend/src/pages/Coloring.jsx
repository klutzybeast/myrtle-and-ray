import { useEffect, useMemo, useState } from "react";
import { api, extractErrMsg } from "../lib/api";
import { Loader2, Palette, Download, Printer, Sparkles, AlertCircle, Wand2, ArrowLeft } from "lucide-react";
import SEO from "../components/SEO";
import { toast } from "sonner";

const VISITOR_KEY = "mr_visitor_id";
const HISTORY_KEY = "mr_coloring_history_v1";

function getOrCreateVisitorId() {
  try {
    let v = localStorage.getItem(VISITOR_KEY);
    if (!v) {
      v = "v-" + (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, "") : Math.random().toString(36).slice(2) + Date.now());
      localStorage.setItem(VISITOR_KEY, v);
    }
    return v;
  } catch {
    return "v-" + Math.random().toString(36).slice(2) + Date.now();
  }
}

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); } catch { return []; }
}
function saveHistory(rows) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(rows.slice(0, 30))); } catch {}
}

const PROMPT_IDEAS = [
  "building a sandcastle on the beach",
  "riding a friendly wave",
  "having a picnic at camp",
  "flying a colorful kite",
  "doing yoga on the sand",
  "playing soccer with friends",
  "exploring a tide pool",
];

export default function Coloring() {
  const [visitorId] = useState(getOrCreateVisitorId);
  const [characters, setCharacters] = useState([]);
  const [characterSlug, setCharacterSlug] = useState("");
  const [prompt, setPrompt] = useState("");
  const [childName, setChildName] = useState("");
  const [generating, setGenerating] = useState(false);
  const [latest, setLatest] = useState(null);
  const [history, setHistory] = useState(loadHistory);
  const [settings, setSettings] = useState({ enabled: true, daily_cap: 5, max_prompt_chars: 240 });
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/coloring/settings").then(({ data }) => setSettings(data)).catch(() => {});
    api.get("/characters").then(({ data }) => setCharacters((data || []).filter((c) => c.image_url || c.role))).catch(() => {});
  }, []);

  const pagesLeft = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const usedToday = history.filter((h) => (h.created_at || "").slice(0, 10) === today).length;
    return Math.max(0, (settings.daily_cap || 5) - usedToday);
  }, [history, settings.daily_cap]);

  const selectedCharacter = characters.find((c) => c.slug === characterSlug) || null;

  const generate = async () => {
    const text = prompt.trim();
    if (!text) { toast.error("Tell me what to draw!"); return; }
    setGenerating(true); setError(""); setLatest(null);
    try {
      const { data } = await api.post("/coloring/generate", {
        prompt: text,
        character_slug: characterSlug || "",
        visitor_id: visitorId,
        child_name: childName.trim().slice(0, 30),
      });
      const fullUrl = data.image_url.startsWith("http") ? data.image_url : `${process.env.REACT_APP_BACKEND_URL}${data.image_url}`;
      const row = {
        id: data.id,
        prompt: text,
        image_url: fullUrl,
        character_name: data.character_name || "",
        created_at: new Date().toISOString(),
      };
      const next = [row, ...history];
      setHistory(next);
      saveHistory(next);
      setLatest(row);
      toast.success("Your coloring page is ready!");
    } catch (err) {
      setError(extractErrMsg(err, "The art studio is busy — try again."));
    } finally {
      setGenerating(false);
    }
  };

  const printPage = (url) => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<html><head><title>Coloring Page</title><style>@media print { @page { margin: 0.5in; } body { margin: 0; } img { width: 100%; height: auto; } }</style></head><body><img src="${url}" onload="window.print(); setTimeout(() => window.close(), 100);" /></body></html>`);
    win.document.close();
  };

  if (!settings.enabled) {
    return (
      <main className="pt-24 pb-12 bg-foam-grad min-h-screen text-center" data-testid="coloring-disabled">
        <Palette className="w-12 h-12 text-[#7fcfc7] mx-auto mb-3" />
        <h1 className="font-accent text-3xl font-bold">The art studio is closed</h1>
        <p className="text-[#5a6b76] mt-2">Come back later — fresh crayons are on the way.</p>
      </main>
    );
  }

  return (
    <main className="pt-24 pb-16 bg-foam-grad min-h-screen" data-testid="coloring-page">
      <SEO title="AI Coloring Pages" description="Type what you want to draw and a Sea Star will sketch it for you." />
      <div className="max-w-5xl mx-auto px-4 md:px-6">
        <header className="text-center mb-8">
          <Wand2 className="w-10 h-10 text-[#f0a988] mx-auto mb-2" />
          <h1 className="font-accent text-5xl md:text-6xl font-bold">Make-a-Page</h1>
          <p className="text-[#4a5568] mt-2 max-w-2xl mx-auto">Tell us what to draw — a Sea Star, a beach scene, anything kid-friendly! We'll sketch you a coloring page you can print and color.</p>
          <p className="text-xs text-[#6b7280] mt-1" data-testid="coloring-quota">{pagesLeft} page{pagesLeft === 1 ? "" : "s"} left today</p>
        </header>

        <section className="grid lg:grid-cols-[1fr_1.2fr] gap-6">
          {/* Prompt builder */}
          <div className="bg-white rounded-[28px] p-6" data-testid="coloring-form">
            <h2 className="font-accent text-2xl font-bold mb-4">What should we draw?</h2>

            <label className="text-sm block mb-3">
              <div className="font-semibold text-[#3a4a55] mb-1">Pick a Sea Star (optional)</div>
              <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1" data-testid="coloring-character-row">
                <button
                  onClick={() => setCharacterSlug("")}
                  className={`flex-shrink-0 px-3 py-2 rounded-full text-sm font-semibold border-2 ${characterSlug === "" ? "border-[#7fcfc7] bg-[#eaf7f5]" : "border-[#f4e4c6] bg-white"}`}
                  data-testid="coloring-character-none"
                >
                  No character
                </button>
                {characters.map((c) => (
                  <button
                    key={c.slug}
                    onClick={() => setCharacterSlug(c.slug)}
                    className={`flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold border-2 ${characterSlug === c.slug ? "border-[#7fcfc7] bg-[#eaf7f5]" : "border-[#f4e4c6] bg-white"}`}
                    data-testid={`coloring-character-${c.slug}`}
                  >
                    {c.image_url && <img src={c.image_url} alt="" className="w-6 h-6 rounded-full object-contain" />}
                    {c.name.split(" ")[0]}
                  </button>
                ))}
              </div>
            </label>

            <label className="text-sm block mb-3">
              <div className="font-semibold text-[#3a4a55] mb-1">Your prompt</div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value.slice(0, settings.max_prompt_chars))}
                placeholder={selectedCharacter ? `${selectedCharacter.name.split(" ")[0]} doing...` : "A sandcastle on the beach..."}
                rows={3}
                className="inp resize-none"
                data-testid="coloring-input-prompt"
              />
              <div className="flex justify-between text-xs text-[#6b7280] mt-1">
                <span>{settings.max_prompt_chars - prompt.length} characters left</span>
                <span>Keep it friendly!</span>
              </div>
            </label>

            <div className="flex flex-wrap gap-2 mb-4" data-testid="coloring-idea-chips">
              {PROMPT_IDEAS.map((idea) => (
                <button
                  key={idea}
                  onClick={() => setPrompt(idea)}
                  className="text-xs px-3 py-1.5 rounded-full bg-[#fff8ec] hover:bg-[#fef0d8] border border-[#f4d59c] text-[#a36b29]"
                  data-testid={`coloring-idea-${idea.split(" ")[0]}`}
                >
                  {idea}
                </button>
              ))}
            </div>

            <label className="text-sm block mb-4">
              <div className="font-semibold text-[#3a4a55] mb-1">Your first name (optional)</div>
              <input value={childName} onChange={(e) => setChildName(e.target.value)} maxLength={30} placeholder="So we can sign it for you" className="inp" data-testid="coloring-input-name" />
            </label>

            {error && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-2xl p-3 mb-3 flex items-start gap-2" data-testid="coloring-error">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={generate}
              disabled={generating || !prompt.trim() || pagesLeft <= 0}
              className="btn-primary w-full justify-center disabled:opacity-50"
              data-testid="coloring-generate"
            >
              {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Drawing... (about 20 seconds)</> : <><Sparkles className="w-4 h-4" /> Make my coloring page</>}
            </button>
            {pagesLeft <= 0 && <p className="text-xs text-red-600 mt-2 text-center">You've made your pages for today — come back tomorrow!</p>}
          </div>

          {/* Preview / result */}
          <div className="bg-white rounded-[28px] p-6 flex flex-col" data-testid="coloring-result">
            <h2 className="font-accent text-2xl font-bold mb-4">Your coloring page</h2>
            {generating ? (
              <div className="flex-1 flex flex-col items-center justify-center min-h-[400px] bg-[#fafbfc] rounded-2xl border-2 border-dashed border-[#f4e4c6]">
                <Loader2 className="w-10 h-10 animate-spin text-[#7fcfc7] mb-3" />
                <p className="text-sm text-[#6b7280]">The Sea Stars are sketching your page...</p>
                <p className="text-xs text-[#6b7280] mt-1">This takes about 20 seconds</p>
              </div>
            ) : latest ? (
              <>
                <img src={latest.image_url} alt={latest.prompt} className="w-full rounded-2xl border-2 border-[#f4e4c6] bg-white" data-testid="coloring-result-image" />
                <p className="text-xs text-[#6b7280] mt-2 italic">"{latest.prompt}"{latest.character_name ? ` · with ${latest.character_name}` : ""}</p>
                <div className="flex gap-2 mt-3">
                  <a href={latest.image_url} download={`coloring-${latest.id}.png`} className="btn-secondary flex-1 justify-center" data-testid="coloring-download">
                    <Download className="w-4 h-4" /> Download
                  </a>
                  <button onClick={() => printPage(latest.image_url)} className="btn-primary flex-1 justify-center" data-testid="coloring-print">
                    <Printer className="w-4 h-4" /> Print
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center min-h-[400px] bg-[#fafbfc] rounded-2xl border-2 border-dashed border-[#f4e4c6] text-center px-4">
                <Palette className="w-12 h-12 text-[#cbd5e1] mb-3" />
                <p className="text-sm text-[#6b7280]">Your coloring page will appear here.</p>
              </div>
            )}
          </div>
        </section>

        {history.length > 0 && (
          <section className="mt-10" data-testid="coloring-history">
            <h2 className="font-accent text-2xl font-bold mb-3">My coloring pages</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {history.map((h) => (
                <button
                  key={h.id}
                  onClick={() => setLatest(h)}
                  className="bg-white rounded-2xl p-2 hover:shadow-md transition text-left"
                  data-testid={`coloring-history-${h.id}`}
                >
                  <img src={h.image_url} alt={h.prompt} className="w-full aspect-square object-contain rounded-xl bg-white border border-[#f4e4c6]" />
                  <p className="text-xs text-[#3a4a55] mt-1 line-clamp-2">{h.prompt}</p>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

import { useEffect, useMemo, useState } from "react";
import { api, extractErrMsg } from "../lib/api";
import { Loader2, Send, Printer, Sparkles, AlertCircle, ArrowLeft, Wand2 } from "lucide-react";
import SEO from "../components/SEO";
import { toast } from "sonner";

const VISITOR_KEY = "mr_visitor_id";
const HISTORY_KEY = "mr_studio_history_v1";

function getOrCreateVisitorId() {
  try {
    let v = localStorage.getItem(VISITOR_KEY);
    if (!v) {
      v = "v-" + (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, "") : Math.random().toString(36).slice(2) + Date.now());
      localStorage.setItem(VISITOR_KEY, v);
    }
    return v;
  } catch { return "v-" + Math.random().toString(36).slice(2) + Date.now(); }
}
function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); } catch { return []; }
}
function saveHistory(rows) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(rows.slice(0, 20))); } catch {}
}

function absUrl(p) {
  if (!p) return "";
  return p.startsWith("http") ? p : `${process.env.REACT_APP_BACKEND_URL}${p}`;
}

export default function SeaStarStudio() {
  const [visitorId] = useState(getOrCreateVisitorId);
  const [characters, setCharacters] = useState([]);
  const [selected, setSelected] = useState(null);
  const [letter, setLetter] = useState("");
  const [childName, setChildName] = useState("");
  const [creating, setCreating] = useState(false);
  const [keepsake, setKeepsake] = useState(null);
  const [history, setHistory] = useState(loadHistory);
  const [settings, setSettings] = useState({ enabled: true, daily_cap: 3 });
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/sea-star-studio/settings").then(({ data }) => setSettings(data)).catch(() => {});
    api.get("/characters").then(({ data }) => setCharacters((data || []).filter((c) => c.voice_id || c.image_url))).catch(() => {});
  }, []);

  const keepsakesLeft = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const usedToday = history.filter((h) => (h.created_at || "").slice(0, 10) === today).length;
    return Math.max(0, (settings.daily_cap || 3) - usedToday);
  }, [history, settings.daily_cap]);

  const create = async () => {
    if (!selected) { toast.error("Pick a Sea Star first!"); return; }
    const text = letter.trim();
    if (!text) { toast.error("Write a sentence to send!"); return; }
    setCreating(true); setError("");
    try {
      const { data } = await api.post("/sea-star-studio/create", {
        character_slug: selected.slug,
        letter: text,
        visitor_id: visitorId,
        child_name: childName.trim().slice(0, 30),
      });
      const row = {
        id: data.id,
        character_slug: data.character_slug,
        character_name: data.character_name,
        letter: text,
        reply_text: data.reply_text,
        audio_url: absUrl(data.audio_url),
        image_url: absUrl(data.image_url),
        scene_prompt: data.scene_prompt,
        created_at: new Date().toISOString(),
        child_name: childName.trim().slice(0, 30),
      };
      const next = [row, ...history];
      setHistory(next); saveHistory(next);
      setKeepsake(row);
      toast.success(`${data.character_name} made you a keepsake!`);
    } catch (err) {
      setError(extractErrMsg(err, "The studio is busy — try again."));
    } finally {
      setCreating(false);
    }
  };

  const printKeepsake = () => {
    if (!keepsake) return;
    const win = window.open("", "_blank");
    if (!win) return;
    const name = keepsake.child_name || "Friend";
    win.document.write(`<!DOCTYPE html><html><head><title>A keepsake from ${keepsake.character_name}</title>
      <style>
        @page { size: letter; margin: 0.5in; }
        body { font-family: Georgia, serif; color: #1e2a35; }
        h1 { font-family: 'Fraunces', Georgia, serif; font-size: 28px; text-align:center; margin: 0 0 8px; color:#a36b29; }
        .meta { text-align:center; color:#6b7280; font-size:12px; margin-bottom:18px; }
        .rhyme { white-space: pre-line; font-size: 18px; line-height: 1.5; padding: 18px; border: 2px dashed #f4d59c; border-radius: 18px; background:#fff8ec; max-width: 520px; margin: 0 auto 18px; }
        .sig { text-align: right; font-style: italic; color:#a36b29; margin-top: 8px; }
        img { display:block; width: 100%; max-width: 560px; margin: 0 auto; }
        @media print { .rhyme { page-break-after: always; } }
      </style></head>
      <body>
        <h1>A keepsake from ${keepsake.character_name}</h1>
        <div class="meta">made for ${name} • ${new Date(keepsake.created_at).toLocaleDateString()}</div>
        <div class="rhyme">${keepsake.reply_text.replace(/</g, "&lt;")}</div>
        <img src="${keepsake.image_url}" alt="coloring page" onload="setTimeout(()=>window.print(),200);" />
      </body></html>`);
    win.document.close();
  };

  if (!settings.enabled) {
    return (
      <main className="pt-24 pb-12 bg-foam-grad min-h-screen text-center" data-testid="studio-disabled">
        <Wand2 className="w-12 h-12 text-[#7fcfc7] mx-auto mb-3" />
        <h1 className="font-accent text-3xl font-bold">The Sea Star Studio is closed</h1>
        <p className="text-[#5a6b76] mt-2">Come back soon — the Sea Stars are busy making magic.</p>
      </main>
    );
  }

  return (
    <main className="pt-24 pb-16 bg-foam-grad min-h-screen" data-testid="studio-page">
      <SEO title="Sea Star Studio" description="Write a letter — get back a rhyme, a voiced reply, and a coloring page all from your favorite Sea Star." />
      <div className="max-w-5xl mx-auto px-4 md:px-6">
        <header className="text-center mb-8">
          <Sparkles className="w-10 h-10 text-[#f0a988] mx-auto mb-2" />
          <h1 className="font-accent text-5xl md:text-6xl font-bold">Sea Star Studio</h1>
          <p className="text-[#4a5568] mt-2 max-w-2xl mx-auto">Write a letter to your favorite Sea Star. They'll write back in rhyme, in their own voice, AND make you a coloring page — all in one keepsake.</p>
          <p className="text-xs text-[#6b7280] mt-1" data-testid="studio-quota">{keepsakesLeft} keepsake{keepsakesLeft === 1 ? "" : "s"} left today</p>
        </header>

        {!keepsake ? (
          !selected ? (
            <section data-testid="studio-picker">
              <h2 className="font-accent text-2xl font-bold text-center mb-4">Pick a Sea Star</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {characters.map((c) => (
                  <button key={c.slug} onClick={() => setSelected(c)} className="bg-white rounded-3xl p-4 shadow-md hover:shadow-xl hover:-translate-y-1 transition text-center" data-testid={`studio-pick-${c.slug}`}>
                    <div className="gradient-ring mx-auto mb-2" style={{ width: 88, height: 88 }}>
                      <img src={c.image_url || "/logo.png"} alt={c.name} className="w-full h-full rounded-full object-contain bg-[#fffbf3]" />
                    </div>
                    <div className="font-accent text-lg font-bold">{c.name}</div>
                    {c.role && <div className="text-xs text-[#6b7280] line-clamp-1">{c.role}</div>}
                  </button>
                ))}
              </div>
            </section>
          ) : (
            <section className="bg-white rounded-[28px] p-6 max-w-2xl mx-auto" data-testid="studio-compose">
              <button onClick={() => setSelected(null)} className="text-sm text-[#5a8a6f] font-semibold inline-flex items-center gap-1 mb-3" data-testid="studio-back">
                <ArrowLeft className="w-4 h-4" /> Pick a different Sea Star
              </button>
              <div className="flex items-center gap-3 mb-4">
                <div className="gradient-ring" style={{ width: 64, height: 64 }}>
                  <img src={selected.image_url || "/logo.png"} alt="" className="w-full h-full rounded-full object-contain bg-[#fffbf3]" />
                </div>
                <div>
                  <div className="text-xs text-[#6b7280]">Writing to</div>
                  <div className="font-accent text-2xl font-bold">{selected.name}</div>
                </div>
              </div>
              <label className="text-sm block mb-3">
                <div className="font-semibold text-[#3a4a55] mb-1">Your first name (optional)</div>
                <input value={childName} onChange={(e) => setChildName(e.target.value)} maxLength={30} placeholder="So they can address it to you" className="inp" data-testid="studio-input-name" />
              </label>
              <label className="text-sm block mb-2">
                <div className="font-semibold text-[#3a4a55] mb-1">Your letter</div>
                <textarea value={letter} onChange={(e) => setLetter(e.target.value.slice(0, 400))} rows={5} placeholder={`Hi ${selected.name.split(" ")[0]}...`} className="inp resize-none" data-testid="studio-input-letter" />
              </label>
              <div className="text-xs text-[#6b7280] mb-3 text-right">{400 - letter.length} characters left</div>

              {error && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-2xl p-3 mb-3 flex items-start gap-2" data-testid="studio-error">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button onClick={create} disabled={creating || !letter.trim() || keepsakesLeft <= 0} className="btn-primary w-full justify-center disabled:opacity-50" data-testid="studio-create">
                {creating ? <><Loader2 className="w-4 h-4 animate-spin" /> Sea Stars are working... (about 40 seconds)</> : <><Send className="w-4 h-4" /> Make my keepsake</>}
              </button>
              {keepsakesLeft <= 0 && <p className="text-xs text-red-600 mt-2 text-center">You've made your keepsakes for today — come back tomorrow!</p>}
            </section>
          )
        ) : (
          <KeepsakeView keepsake={keepsake} onWriteAnother={() => { setKeepsake(null); setLetter(""); setSelected(null); }} onPrint={printKeepsake} />
        )}

        {history.length > 0 && !keepsake && (
          <section className="mt-10" data-testid="studio-history">
            <h2 className="font-accent text-2xl font-bold mb-3 text-center">My keepsakes</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-w-4xl mx-auto">
              {history.map((h) => (
                <button key={h.id} onClick={() => setKeepsake(h)} className="bg-white rounded-2xl p-2 hover:shadow-md transition text-left" data-testid={`studio-history-${h.id}`}>
                  {h.image_url ? (
                    <img src={h.image_url} alt={h.scene_prompt} className="w-full aspect-square object-contain rounded-xl bg-white border border-[#f4e4c6]" />
                  ) : (
                    <div className="w-full aspect-square rounded-xl bg-[#fafbfc] border border-[#f4e4c6] grid place-items-center text-[#cbd5e1]"><Sparkles /></div>
                  )}
                  <p className="text-xs text-[#3a4a55] mt-1 line-clamp-1">From {h.character_name}</p>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function KeepsakeView({ keepsake, onWriteAnother, onPrint }) {
  return (
    <section className="bg-white rounded-[28px] p-6 max-w-3xl mx-auto" data-testid="studio-keepsake">
      <div className="text-center mb-4">
        <div className="text-sm font-semibold text-[#a36b29] uppercase tracking-wider">A keepsake from</div>
        <div className="font-accent text-3xl font-bold">{keepsake.character_name}</div>
        {keepsake.child_name && <div className="text-sm text-[#6b7280]">made for {keepsake.child_name}</div>}
      </div>

      <div className="bg-[#fff8ec] border-2 border-[#f4d59c] rounded-3xl p-5 mb-5" data-testid="studio-rhyme">
        <p className="whitespace-pre-line font-accent text-lg text-[#3a4a55] leading-relaxed">{keepsake.reply_text}</p>
        {keepsake.audio_url && (
          <div className="mt-4">
            <div className="text-xs text-[#6b7280] mb-1">Hear it in their voice:</div>
            <audio controls src={keepsake.audio_url} className="w-full" data-testid="studio-audio" />
          </div>
        )}
      </div>

      {keepsake.image_url ? (
        <div className="text-center mb-5">
          <div className="text-xs uppercase tracking-wider text-[#6b7280] mb-2">A coloring page made just for you</div>
          <img src={keepsake.image_url} alt={keepsake.scene_prompt || "coloring page"} className="w-full max-w-lg mx-auto rounded-2xl border-2 border-[#f4e4c6] bg-white" data-testid="studio-image" />
          {keepsake.scene_prompt && <p className="text-xs text-[#6b7280] italic mt-1">"{keepsake.scene_prompt}"</p>}
        </div>
      ) : (
        <div className="bg-[#fafbfc] rounded-2xl p-4 text-center text-sm text-[#6b7280] mb-5">The coloring page is taking a moment — try printing again in a bit.</div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <button onClick={onPrint} className="btn-primary justify-center" data-testid="studio-print"><Printer className="w-4 h-4" /> Print my keepsake</button>
        <button onClick={onWriteAnother} className="btn-secondary justify-center" data-testid="studio-write-another">Write another</button>
      </div>
    </section>
  );
}

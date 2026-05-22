import { useEffect, useState, useMemo } from "react";
import { api, extractErrMsg } from "../lib/api";
import { Loader2, Send, Trash2, Waves, ArrowLeft, Sparkles, AlertCircle } from "lucide-react";
import SEO from "../components/SEO";
import { toast } from "sonner";

const VISITOR_KEY = "mr_visitor_id";
const HISTORY_KEY = "mr_penpal_history_v1";

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
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(rows.slice(0, 50))); } catch {}
}

export default function PenPals() {
  const [visitorId] = useState(getOrCreateVisitorId);
  const [characters, setCharacters] = useState([]);
  const [selected, setSelected] = useState(null);
  const [letter, setLetter] = useState("");
  const [childName, setChildName] = useState("");
  const [sending, setSending] = useState(false);
  const [latest, setLatest] = useState(null); // most recent {reply_text, audio_url, character_*}
  const [history, setHistory] = useState(loadHistory);
  const [settings, setSettings] = useState({ enabled: true, daily_cap: 5, max_letter_chars: 500 });
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/pen-pals/settings").then(({ data }) => setSettings(data)).catch(() => {});
    api.get("/characters").then(({ data }) => setCharacters((data || []).filter((c) => c.voice_id || c.image_url))).catch(() => {});
    api.get(`/pen-pals/history/${visitorId}`).then(({ data }) => {
      const remote = Array.isArray(data) ? data : [];
      if (remote.length) {
        setHistory(remote);
        saveHistory(remote);
      }
    }).catch(() => {});
  }, [visitorId]);

  const lettersLeft = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const usedToday = history.filter((h) => (h.created_at || "").slice(0, 10) === today).length;
    return Math.max(0, (settings.daily_cap || 5) - usedToday);
  }, [history, settings.daily_cap]);

  const send = async () => {
    if (!selected) { toast.error("Pick a Sea Star first!"); return; }
    const text = letter.trim();
    if (!text) { toast.error("Write a sentence to send!"); return; }
    setSending(true); setError("");
    try {
      const { data } = await api.post("/pen-pals/letter", {
        character_slug: selected.slug,
        letter: text,
        visitor_id: visitorId,
        child_name: childName.trim().slice(0, 30),
        want_audio: true,
      });
      const row = {
        id: data.id,
        character_slug: data.character_slug,
        character_name: data.character_name,
        letter: text,
        reply_text: data.reply_text,
        audio_url: data.audio_url,
        created_at: new Date().toISOString(),
      };
      const next = [row, ...history];
      setHistory(next);
      saveHistory(next);
      setLatest(row);
      setLetter("");
      toast.success(`${data.character_name} wrote back!`);
    } catch (err) {
      setError(extractErrMsg(err, "Could not send letter."));
    } finally {
      setSending(false);
    }
  };

  const clearHistory = () => {
    if (!window.confirm("Clear your pen-pal inbox? (Letters stay safe on the Sea Stars' side.)")) return;
    setHistory([]); saveHistory([]); setLatest(null);
  };

  if (!settings.enabled) {
    return (
      <main className="pt-24 pb-12 bg-foam-grad min-h-screen text-center" data-testid="penpals-disabled">
        <Waves className="w-12 h-12 text-[#7fcfc7] mx-auto mb-3" />
        <h1 className="font-accent text-3xl font-bold">Pen Pals is napping</h1>
        <p className="text-[#5a6b76] mt-2">Come back later — the Sea Stars will be back soon.</p>
      </main>
    );
  }

  const remaining = settings.max_letter_chars - letter.length;

  return (
    <main className="pt-24 pb-16 bg-foam-grad min-h-screen" data-testid="penpals-page">
      <SEO title="Wave Pal Pen Pals" description="Write a letter to a Sea Star and they'll write back in their own voice." />
      <div className="max-w-5xl mx-auto px-4 md:px-6">
        <header className="text-center mb-8">
          <Sparkles className="w-10 h-10 text-[#f0a988] mx-auto mb-2" />
          <h1 className="font-accent text-5xl md:text-6xl font-bold">Wave Pal Pen Pals</h1>
          <p className="text-[#4a5568] mt-2 max-w-2xl mx-auto">Pick a Sea Star, write a letter, and they'll write back to you in their own voice — in rhyme!</p>
          <p className="text-xs text-[#6b7280] mt-1" data-testid="penpals-quota">{lettersLeft} letter{lettersLeft === 1 ? "" : "s"} left today</p>
        </header>

        {!selected ? (
          <section data-testid="penpals-picker">
            <h2 className="font-accent text-2xl font-bold text-center mb-4">Who do you want to write to?</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {characters.map((c) => (
                <button key={c.slug} onClick={() => setSelected(c)}
                  className="bg-white rounded-3xl p-4 shadow-md hover:shadow-xl hover:-translate-y-1 transition text-center"
                  data-testid={`penpals-pick-${c.slug}`}>
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
          <section className="bg-white rounded-[28px] p-6 max-w-2xl mx-auto" data-testid="penpals-compose">
            <button onClick={() => { setSelected(null); setLatest(null); }} className="text-sm text-[#5a8a6f] font-semibold inline-flex items-center gap-1 mb-3" data-testid="penpals-back">
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

            {latest ? (
              <ReplyCard reply={latest} onWriteAnother={() => setLatest(null)} />
            ) : (
              <>
                <label className="text-sm block mb-3">
                  <div className="font-semibold text-[#3a4a55] mb-1">Your first name (optional)</div>
                  <input value={childName} onChange={(e) => setChildName(e.target.value)} maxLength={30} placeholder="What should they call you?" className="inp" data-testid="penpals-input-name" />
                </label>
                <label className="text-sm block mb-2">
                  <div className="font-semibold text-[#3a4a55] mb-1">Your letter</div>
                  <textarea value={letter} onChange={(e) => setLetter(e.target.value.slice(0, settings.max_letter_chars))} rows={5} placeholder={`Hi ${selected.name.split(" ")[0]}...`} className="inp resize-none" data-testid="penpals-input-letter" />
                </label>
                <div className="flex justify-between text-xs text-[#6b7280] mb-3">
                  <span>{remaining} characters left</span>
                  <span>Keep it kind & friendly</span>
                </div>
                {error && (
                  <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-2xl p-3 mb-3 flex items-start gap-2" data-testid="penpals-error">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
                <button onClick={send} disabled={sending || !letter.trim() || lettersLeft <= 0} className="btn-primary w-full justify-center disabled:opacity-50" data-testid="penpals-send">
                  {sending ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending to {selected.name.split(" ")[0]}...</> : <><Send className="w-4 h-4" /> Send my letter</>}
                </button>
                {lettersLeft <= 0 && <p className="text-xs text-red-600 mt-2 text-center">You've used your letters for today — come back tomorrow!</p>}
              </>
            )}
          </section>
        )}

        {history.length > 0 && (
          <section className="mt-10 max-w-2xl mx-auto" data-testid="penpals-history">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-accent text-2xl font-bold">My Sea Star Inbox</h2>
              <button onClick={clearHistory} className="text-xs text-[#6b7280] hover:text-red-600 inline-flex items-center gap-1" data-testid="penpals-history-clear">
                <Trash2 className="w-3 h-3" /> Clear
              </button>
            </div>
            <div className="space-y-3">
              {history.map((h) => (
                <details key={h.id} className="bg-white rounded-2xl p-4 group" data-testid={`penpals-history-${h.id}`}>
                  <summary className="font-semibold text-[#3a4a55] cursor-pointer flex items-center justify-between">
                    <span>From {h.character_name}</span>
                    <span className="text-xs text-[#6b7280]">{new Date(h.created_at || Date.now()).toLocaleDateString()}</span>
                  </summary>
                  <div className="mt-3 text-sm">
                    <div className="text-xs uppercase tracking-wider text-[#6b7280] mb-1">You wrote:</div>
                    <p className="italic text-[#4a5568] mb-3">"{h.letter}"</p>
                    <div className="text-xs uppercase tracking-wider text-[#6b7280] mb-1">{h.character_name} wrote back:</div>
                    <p className="whitespace-pre-line text-[#3a4a55]">{h.reply_text}</p>
                    {h.audio_url && (
                      <audio controls src={h.audio_url.startsWith("http") ? h.audio_url : `${process.env.REACT_APP_BACKEND_URL}${h.audio_url}`} className="mt-3 w-full" />
                    )}
                  </div>
                </details>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function ReplyCard({ reply, onWriteAnother }) {
  const audioSrc = reply.audio_url ? (reply.audio_url.startsWith("http") ? reply.audio_url : `${process.env.REACT_APP_BACKEND_URL}${reply.audio_url}`) : "";
  return (
    <div className="bg-[#fff8ec] border-2 border-[#f4d59c] rounded-3xl p-5" data-testid="penpals-reply">
      <div className="text-sm font-semibold text-[#a36b29] mb-2">A letter from {reply.character_name}</div>
      <p className="whitespace-pre-line text-[#3a4a55] leading-relaxed font-accent text-lg">{reply.reply_text}</p>
      {audioSrc && (
        <div className="mt-4">
          <div className="text-xs text-[#6b7280] mb-1">Hear it in their voice:</div>
          <audio controls src={audioSrc} className="w-full" data-testid="penpals-reply-audio" />
        </div>
      )}
      <button onClick={onWriteAnother} className="btn-secondary mt-4 inline-flex" data-testid="penpals-write-another">Write another</button>
    </div>
  );
}

import { useState } from "react";
import { api } from "../lib/api";
import { toast } from "sonner";
import { MessageCircle, X, Send } from "lucide-react";

export default function ChatBubble() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const send = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/chat", { name, email, message, page: window.location.pathname });
      setSent(true);
      toast.success("Sent! We'll reply at your email.");
    } catch { toast.error("Try again in a moment."); }
    finally { setBusy(false); }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-[112px] right-4 md:bottom-[104px] md:right-6 z-30 w-14 h-14 rounded-full grid place-items-center shadow-lg hover:scale-105 transition"
        style={{ background: "linear-gradient(135deg,#a8e6e1 0%,#fcd5b4 100%)" }}
        aria-label="Open chat"
        data-testid="chat-bubble-open"
      >
        <MessageCircle className="w-6 h-6 text-[#3a4a55]" strokeWidth={2.5} />
      </button>

      {open && (
        <div className="fixed inset-x-3 bottom-[110px] sm:inset-auto sm:right-6 sm:bottom-[104px] sm:w-[360px] z-40 bg-white rounded-[20px] shadow-2xl border-2 border-[#f4e4c6] overflow-hidden" data-testid="chat-bubble-panel">
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-[#eef9fb] to-[#fff5ec]">
            <div>
              <div className="font-accent font-bold text-lg">Have a question?</div>
              <div className="text-xs text-[#5a6b76]">We reply quickly!</div>
            </div>
            <button onClick={() => { setOpen(false); }} className="p-1 hover:bg-white rounded-full" data-testid="chat-bubble-close"><X className="w-5 h-5" /></button>
          </div>
          {sent ? (
            <div className="p-6 text-center">
              <div className="text-3xl">🌊</div>
              <div className="font-accent text-xl font-bold mt-2">Thanks!</div>
              <p className="text-sm text-[#5a6b76] mt-1">We'll reply to <b>{email}</b> as soon as we can.</p>
              <button onClick={() => { setSent(false); setName(""); setEmail(""); setMessage(""); setOpen(false); }} className="btn-ghost mt-3 text-sm">Close</button>
            </div>
          ) : (
            <form onSubmit={send} className="p-4 space-y-2" data-testid="chat-bubble-form">
              <input required placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 rounded-full border-2 border-[#f4e4c6] focus:outline-none focus:border-[#7fcfc7] text-sm" data-testid="chat-name" />
              <input required type="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 rounded-full border-2 border-[#f4e4c6] focus:outline-none focus:border-[#7fcfc7] text-sm" data-testid="chat-email" />
              <textarea required rows={3} placeholder="Your question or message" value={message} onChange={(e) => setMessage(e.target.value)} className="w-full px-3 py-2 rounded-2xl border-2 border-[#f4e4c6] focus:outline-none focus:border-[#7fcfc7] text-sm" data-testid="chat-message" />
              <button disabled={busy} className="btn-primary w-full justify-center text-sm" data-testid="chat-send"><Send className="w-4 h-4" />{busy ? "Sending..." : "Send"}</button>
            </form>
          )}
        </div>
      )}
    </>
  );
}

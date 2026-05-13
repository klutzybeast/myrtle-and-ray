import { useState } from "react";
import { api } from "../lib/api";
import { toast } from "sonner";
import { X } from "lucide-react";

export default function EmailCaptureModal({ open, onClose, downloadSlug, downloadTitle, onSuccess }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [audience, setAudience] = useState("Parent");
  const [subscribe, setSubscribe] = useState(true);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/download-capture", {
        name, email, audience, subscribe,
        download_slug: downloadSlug, download_title: downloadTitle,
      });
      toast.success("Sent! Your download is starting...");
      onSuccess?.();
      onClose?.();
    } catch (err) {
      toast.error("Something went wrong. Please try again.");
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" data-testid="email-capture-modal" onClick={onClose}>
      <div className="bg-white rounded-[28px] max-w-md w-full p-6 relative shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100" aria-label="Close" data-testid="email-capture-close">
          <X className="w-5 h-5" />
        </button>
        <h3 className="font-accent text-2xl font-bold mb-1">Drop your name and email</h3>
        <p className="text-[#4a5568] mb-4">...and we'll send the wave your way!</p>
        <form onSubmit={submit} className="space-y-3" data-testid="email-capture-form">
          <input required placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-3 rounded-full border-2 border-[#f4e4c6] focus:outline-none focus:border-[#7fcfc7]" data-testid="email-capture-name" />
          <input required type="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-full border-2 border-[#f4e4c6] focus:outline-none focus:border-[#7fcfc7]" data-testid="email-capture-email" />
          <select value={audience} onChange={(e) => setAudience(e.target.value)} className="w-full px-4 py-3 rounded-full border-2 border-[#f4e4c6] focus:outline-none focus:border-[#7fcfc7] bg-white" data-testid="email-capture-audience">
            <option>Parent</option>
            <option>Teacher</option>
            <option>Camp Director</option>
            <option>Other</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-[#4a5568] px-1">
            <input type="checkbox" checked={subscribe} onChange={(e) => setSubscribe(e.target.checked)} data-testid="email-capture-subscribe" />
            Subscribe me to the Myrtle and Ray mailing list.
          </label>
          <button disabled={busy} className="btn-primary w-full justify-center" data-testid="email-capture-submit">
            {busy ? "Sending..." : "Get It Free"}
          </button>
          <button type="button" onClick={onClose} className="block mx-auto text-sm text-[#6b7280] underline" data-testid="email-capture-maybe-later">Maybe later</button>
        </form>
      </div>
    </div>
  );
}

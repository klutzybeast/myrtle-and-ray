import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { toast } from "sonner";
import { X } from "lucide-react";
import { hasStoredVisitor, setStoredVisitor } from "../lib/visitor";

const DISMISS_KEY = "mr_popup_dismissed_v1";
const DISMISS_MAX_AGE_DAYS = 30; // re-ask after a month, not forever

function isDismissed() {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(DISMISS_KEY) : null;
    if (raw) {
      const ts = parseInt(raw, 10);
      if (!isNaN(ts) && Date.now() - ts < DISMISS_MAX_AGE_DAYS * 86400 * 1000) return true;
    }
    if (typeof document !== "undefined") {
      const m = document.cookie.match(new RegExp("(?:^|; )" + DISMISS_KEY + "=1"));
      if (m) return true;
    }
  } catch {}
  return false;
}

function markDismissed() {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    if (typeof document !== "undefined") {
      const secure = window.location.protocol === "https:" ? "; secure" : "";
      document.cookie = `${DISMISS_KEY}=1; max-age=${DISMISS_MAX_AGE_DAYS * 86400}; path=/; samesite=lax${secure}`;
    }
  } catch {}
}

export default function PopupSignup() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isDismissed()) return;
    // Skip entirely if we already know this visitor (they captured an email before).
    if (hasStoredVisitor()) return;
    // Don't pop while user is on /activities (a game modal is likely in flight)
    if (window.location.pathname.startsWith("/activities")) return;
    // Don't pop on /checkout — interrupting a buying user costs sales
    if (window.location.pathname.startsWith("/checkout")) return;
    // Don't pop on /pen-pals — kids are mid-letter
    if (window.location.pathname.startsWith("/pen-pals")) return;
    const t = setTimeout(() => setOpen(true), 8000);
    return () => clearTimeout(t);
  }, []);

  const dismiss = () => {
    setOpen(false);
    markDismissed();
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/mailing-list", { email, source: "popup" });
      setStoredVisitor({ email });
      toast.success("Thanks! See you in the inbox.");
      dismiss();
    } catch { toast.error("Try again in a moment."); }
    finally { setBusy(false); }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" data-testid="popup-signup" onClick={dismiss}>
      <div className="bg-white rounded-[28px] max-w-md w-full p-6 relative shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <button onClick={dismiss} className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100" aria-label="Close" data-testid="popup-close"><X className="w-5 h-5" /></button>
        <div className="text-3xl mb-2">🌊</div>
        <h3 className="font-accent text-2xl font-bold mb-1">Ride the wave with us</h3>
        <p className="text-[#4a5568] mb-4">Get free downloads, sneak peeks, and gentle first-day tips.</p>
        <form onSubmit={submit} className="space-y-3">
          <input required type="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-full border-2 border-[#f4e4c6] focus:outline-none focus:border-[#7fcfc7]" data-testid="popup-email" />
          <button disabled={busy} className="btn-primary w-full justify-center" data-testid="popup-submit">{busy ? "..." : "Catch the Wave"}</button>
        </form>
      </div>
    </div>
  );
}

/* Cookie consent — small, friendly, GDPR/UK-aware.
   Stores choice in a 1-year cookie + localStorage so it persists on iOS Safari. */
import { useEffect, useState } from "react";
import { Cookie, X, ShieldCheck } from "lucide-react";

const KEY = "mr_cookie_consent";
const MAX_AGE = 60 * 60 * 24 * 365; // 1 year

function readCookie(name) {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : null;
}

function writeCookie(name, value) {
  if (typeof document === "undefined") return;
  const secure = typeof window !== "undefined" && window.location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${MAX_AGE}; path=/; samesite=lax${secure}`;
}

function getConsent() {
  try {
    return readCookie(KEY) || (typeof window !== "undefined" && window.localStorage.getItem(KEY)) || null;
  } catch { return null; }
}

function setConsent(value) {
  try {
    writeCookie(KEY, value);
    if (typeof window !== "undefined") window.localStorage.setItem(KEY, value);
  } catch {}
  // Wire PostHog accordingly (loaded in index.html with opt_out_capturing_by_default).
  try {
    if (typeof window === "undefined") return;
    const ph = window.posthog;
    if (!ph) return;
    if (value === "accepted") {
      ph.opt_in_capturing && ph.opt_in_capturing();
      ph.startSessionRecording && ph.startSessionRecording();
    } else {
      ph.opt_out_capturing && ph.opt_out_capturing();
      ph.stopSessionRecording && ph.stopSessionRecording();
    }
  } catch {}
}

// Expose a tiny re-open hook so a footer link can re-open the chooser.
export function reopenCookieSettings() {
  try {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(KEY);
      document.cookie = `${KEY}=; max-age=0; path=/`;
      window.dispatchEvent(new CustomEvent("mr:open-cookie-banner"));
    }
  } catch {}
}

export default function CookieBanner() {
  const [open, setOpen] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  // Necessary cookies are always on; visitor only toggles analytics.
  const [analyticsOn, setAnalyticsOn] = useState(true);

  useEffect(() => {
    // Wait a tick so the banner doesn't fight the popup-signup on first paint.
    const t = setTimeout(() => {
      if (!getConsent()) setOpen(true);
    }, 1200);
    const reopen = () => { setOpen(true); setCustomizing(false); };
    window.addEventListener("mr:open-cookie-banner", reopen);
    return () => {
      clearTimeout(t);
      window.removeEventListener("mr:open-cookie-banner", reopen);
    };
  }, []);

  if (!open) return null;

  const accept = () => { setConsent("accepted"); setOpen(false); };
  const reject = () => {
    setConsent("rejected");
    setOpen(false);
    // Per owner request: visitors who decline are redirected to the
    // sister camp site. (Note: pure "cookie walls" are discouraged
    // under GDPR; consider switching to a soft prompt if EU traffic.)
    if (typeof window !== "undefined") {
      try { window.location.href = "https://rollingriver.com"; } catch {}
    }
  };
  const saveCustom = () => {
    const choice = analyticsOn ? "accepted" : "rejected";
    setConsent(choice);
    setOpen(false);
    if (choice === "rejected" && typeof window !== "undefined") {
      try { window.location.href = "https://rollingriver.com"; } catch {}
    }
  };

  return (
    <div
      className="fixed inset-x-2 bottom-2 z-[60] md:left-auto md:right-4 md:bottom-4 md:w-[460px]"
      data-testid="cookie-banner"
      role="dialog"
      aria-labelledby="cookie-banner-title"
    >
      <div className="bg-white rounded-3xl shadow-2xl border-2 border-[#f4e4c6] overflow-hidden">
        <div className="p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#eef9fb] grid place-items-center flex-shrink-0">
              <Cookie className="w-5 h-5 text-[#5a8a6f]" />
            </div>
            <div className="flex-1 min-w-0">
              <div id="cookie-banner-title" className="font-accent text-lg font-bold text-[#2e3a3a]">
                We use cookies
              </div>
              <p className="text-sm text-[#4a5568] mt-1 leading-snug">
                A few keep the site working (logins, downloads). Optional ones help us
                see which pages you love so we can make more of them.
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close for now"
              className="p-1 -mr-1 -mt-1 rounded-full hover:bg-gray-100 text-[#6b7280]"
              data-testid="cookie-banner-dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {!customizing ? (
            <div className="mt-4 flex flex-col-reverse sm:flex-row gap-2">
              <button
                onClick={() => setCustomizing(true)}
                className="btn-ghost text-sm justify-center"
                data-testid="cookie-banner-customize"
              >
                Customize
              </button>
              <button
                onClick={reject}
                className="btn-secondary text-sm justify-center sm:flex-1"
                data-testid="cookie-banner-reject"
              >
                Reject all
              </button>
              <button
                onClick={accept}
                className="btn-primary text-sm justify-center sm:flex-1"
                data-testid="cookie-banner-accept"
              >
                Accept all
              </button>
            </div>
          ) : (
            <div className="mt-4 space-y-3" data-testid="cookie-banner-customize-panel">
              <div className="flex items-start justify-between gap-3 p-3 rounded-2xl bg-[#fffbf3] border border-[#f4e4c6]">
                <div>
                  <div className="font-bold text-sm text-[#2e3a3a] flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-[#5a8a6f]" /> Strictly necessary
                  </div>
                  <p className="text-xs text-[#6b7280] mt-1">
                    Logins, cart, and the download memory so you aren't re-asked for your email.
                  </p>
                </div>
                <span className="text-xs font-bold text-[#5a8a6f] bg-[#eef9fb] rounded-full px-2 py-0.5 flex-shrink-0">Always on</span>
              </div>
              <label className="flex items-start justify-between gap-3 p-3 rounded-2xl bg-[#fffbf3] border border-[#f4e4c6] cursor-pointer">
                <div>
                  <div className="font-bold text-sm text-[#2e3a3a]">Analytics</div>
                  <p className="text-xs text-[#6b7280] mt-1">
                    Anonymous page views via PostHog so we know which printables are loved most.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={analyticsOn}
                  onChange={(e) => setAnalyticsOn(e.target.checked)}
                  className="w-5 h-5 mt-0.5 accent-[#7fcfc7] flex-shrink-0"
                  data-testid="cookie-banner-analytics-toggle"
                />
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setCustomizing(false)}
                  className="btn-ghost text-sm justify-center"
                >
                  Back
                </button>
                <button
                  onClick={saveCustom}
                  className="btn-primary text-sm justify-center flex-1"
                  data-testid="cookie-banner-save"
                >
                  Save choices
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

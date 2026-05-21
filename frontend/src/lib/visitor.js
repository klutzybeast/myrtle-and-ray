// Tiny helper around localStorage + cookies so we only ask a visitor for
// their email + name once. iOS Safari aggressively clears localStorage
// (ITP, private mode, low storage); cookies with explicit max-age survive
// across those resets. We mirror to both for durability.
const KEY = "mr_visitor_v1";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

function readCookie(name) {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name, value) {
  if (typeof document === "undefined") return;
  const secure = typeof window !== "undefined" && window.location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${COOKIE_MAX_AGE}; path=/; samesite=lax${secure}`;
}

function eraseCookie(name) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; max-age=0; path=/`;
}

export function getStoredVisitor() {
  try {
    // Try localStorage first (fast path)
    const lsRaw = typeof window !== "undefined" ? window.localStorage.getItem(KEY) : null;
    if (lsRaw) {
      const v = JSON.parse(lsRaw);
      if (v && v.email) return v;
    }
    // Fallback to cookie (durable on iOS Safari after localStorage purge)
    const cookieRaw = readCookie(KEY);
    if (cookieRaw) {
      const v = JSON.parse(cookieRaw);
      if (v && v.email) {
        // Restore to localStorage so subsequent reads are fast
        try { window.localStorage.setItem(KEY, cookieRaw); } catch {}
        return v;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function hasStoredVisitor() {
  const v = getStoredVisitor();
  return !!(v && v.email);
}

export function setStoredVisitor({ name, email, audience }) {
  try {
    const payload = {
      name: name || "",
      email: (email || "").toLowerCase().trim(),
      audience: audience || "",
      saved_at: new Date().toISOString(),
    };
    const json = JSON.stringify(payload);
    if (typeof window !== "undefined") {
      try { window.localStorage.setItem(KEY, json); } catch {}
    }
    writeCookie(KEY, json);
    return payload;
  } catch {
    return null;
  }
}

export function clearStoredVisitor() {
  try {
    if (typeof window !== "undefined") window.localStorage.removeItem(KEY);
  } catch {}
  eraseCookie(KEY);
}

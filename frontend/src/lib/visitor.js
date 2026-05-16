// Tiny helper around localStorage so we only ask a visitor for their
// email + name once. After their first download-capture submission we
// remember them and skip the gate on every future download.
const KEY = "mr_visitor_v1";

export function getStoredVisitor() {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(KEY) : null;
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (!v || !v.email) return null;
    return v;
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
    if (typeof window !== "undefined") {
      window.localStorage.setItem(KEY, JSON.stringify(payload));
    }
    return payload;
  } catch {
    return null;
  }
}

export function clearStoredVisitor() {
  try {
    if (typeof window !== "undefined") window.localStorage.removeItem(KEY);
  } catch {}
}

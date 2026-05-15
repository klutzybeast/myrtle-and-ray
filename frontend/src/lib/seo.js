// Tiny utilities shared across admin + public pages.

export function slugify(text) {
  return (text || "")
    .toString()
    .toLowerCase()
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

// Words to skip when auto-generating tags
const STOP = new Set(["the", "a", "an", "and", "or", "of", "for", "with", "in", "on", "to", "at", "by", "from", "into", "plush", "stuffie", "stuffy", "toy", "official", "ray", "myrtle"]);

export function autoTags({ name = "", category = "", character_slug = "" }) {
  const tokens = `${name} ${category}`
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOP.has(t));
  const out = new Set();
  if (category) out.add(category.toLowerCase());
  if (character_slug) out.add(character_slug);
  tokens.forEach((t) => out.add(t));
  return Array.from(out).slice(0, 8);
}

export function truncate(text, n = 160) {
  if (!text) return "";
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= n ? clean : clean.slice(0, n - 1).replace(/\s\S*$/, "") + "…";
}

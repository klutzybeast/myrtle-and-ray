// Display-friendly short name for a Sea Star character.
// Examples: "Ms Bluegill" -> "Ms Bluegill", "Ray the Manta Ray" -> "Ray"
//           "Frankie the Flamingo" -> "Frankie", "Dr. Otis" -> "Dr. Otis"
const TITLE_PREFIXES = new Set(["ms", "ms.", "mr", "mr.", "mrs", "mrs.", "dr", "dr.", "miss"]);

export function characterFirstName(full) {
  const parts = (full || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  if (parts.length > 1 && TITLE_PREFIXES.has(parts[0].toLowerCase())) {
    return `${parts[0]} ${parts[1]}`;
  }
  return parts[0];
}

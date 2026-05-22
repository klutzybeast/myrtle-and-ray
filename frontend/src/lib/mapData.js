// Shared map hotspots used by both /story and /map.
// Each hotspot links to a character bio and an activity game.
export const HOTSPOTS = [
  { id: "welcome-sign",   title: "Welcome Sign",       x: 22, y: 78, char: "ms-bluegill", activity: "quiz",            activity_label: "Which Sea Star Are You?", desc: "Ms Bluegill welcomes every camper here on the very first day." },
  { id: "arts-craft",     title: "Arts & Crafts Hut",  x: 44, y: 58, char: "ollie",       activity: "coloring",        activity_label: "Color the Cay",          desc: "Ollie's eight-armed sculpture lab. Bring your imagination." },
  { id: "lunch-tables",   title: "Lunch Tables",       x: 72, y: 55, char: "louie",       activity: "rhyme_time",      activity_label: "Rhyme Time",             desc: "Picnic tables under the striped tent — Louie's drum kit is right behind." },
  { id: "pool",           title: "The Pool",           x: 36, y: 36, char: "dani",        activity: "maze",            activity_label: "Maze with Billy",        desc: "Dani's high-dive home. Triple-flip splashes happen here." },
  { id: "playground",     title: "Playground",         x: 80, y: 30, char: "frankie",     activity: "memory_match",    activity_label: "Memory Match",           desc: "Frankie teaches ballet on the sand near the wooden castle." },
  { id: "soccer-field",   title: "Sports Field",       x: 78, y: 18, char: "sami",        activity: "word_search",     activity_label: "Word Search",            desc: "Sami cheers on every player on both teams." },
  { id: "climbing-palms", title: "Climbing Palms",     x: 56, y: 22, char: "izzy",        activity: "spot_difference", activity_label: "Spot the Difference",    desc: "Izzy knows the secret paths up the tallest palms." },
  { id: "bunkhouses",     title: "Bunkhouses",         x: 16, y: 60, char: "myrtle",      activity: "rhyme_time",      activity_label: "Rhyme Time",             desc: "The colorful cottages where Sea Stars sleep. Myrtle's is the green one." },
  { id: "sand-castle",    title: "Sand Castle Beach",  x: 90, y: 60, char: "casey",       activity: "sticker_beach",   activity_label: "Sticker Beach",          desc: "Casey builds the tallest, sturdiest towers right here." },
];

// Map image is bundled with the deploy under /app/backend/seed_assets/map/
// and copied into /api/uploads/map/ on backend startup, so it ships to
// production without depending on the preview-scoped customer-assets domain.
const API_BASE = process.env.REACT_APP_BACKEND_URL || "";
export const MAP_IMG = `${API_BASE}/api/uploads/map/stingray-cay.jpeg`;

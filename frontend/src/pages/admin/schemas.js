// Schemas describing what fields each system page or activity has, so admin can
// edit them with proper inputs instead of raw JSON.

export const PAGE_SCHEMAS = {
  homepage_hero: {
    title: "Homepage Hero",
    description: "The big headline and CTAs at the top of the homepage.",
    fields: [
      { key: "headline", label: "Headline", type: "text" },
      { key: "subheadline", label: "Subheadline", type: "textarea" },
      { key: "cta_primary", label: "Primary button label (Amazon)", type: "text" },
      { key: "cta_secondary", label: "Secondary button label (Meet the Sea Stars)", type: "text" },
      { key: "background_image", label: "Background image", type: "image" },
      { key: "book_cover", label: "Floating book cover image", type: "image" },
    ],
  },
  about: {
    title: "About page",
    description: "Authors, publisher, and the 'why we wrote this' note.",
    fields: [
      { key: "intro", label: "Intro paragraph", type: "textarea" },
      { key: "why_we_wrote", label: "Why we wrote this book", type: "textarea" },
      { key: "publisher", label: "Publisher line", type: "text" },
      { key: "editor", label: "Editor line", type: "text" },
      {
        key: "authors", label: "Authors", type: "list",
        itemLabel: (i) => i?.name || "Author",
        itemSchema: [
          { key: "name", label: "Name", type: "text" },
          { key: "bio", label: "Bio", type: "textarea" },
          { key: "image", label: "Photo", type: "image" },
        ],
      },
    ],
  },
  for_camps: {
    title: "For Camps page",
    description: "Benefits and bulk-pricing tiers for camp directors.",
    fields: [
      { key: "intro", label: "Intro", type: "textarea" },
      {
        key: "benefits", label: "Benefits", type: "list",
        itemLabel: (i, idx) => i || `Benefit ${idx + 1}`,
        itemSchema: [{ key: "value", label: "Benefit", type: "text" }],
        valueIsString: true, // list of strings, not objects
      },
      {
        key: "tiers", label: "Bulk pricing tiers", type: "list",
        itemLabel: (i) => i?.qty ? `${i.qty}+ copies` : "Tier",
        itemSchema: [
          { key: "qty", label: "Quantity", type: "number" },
          { key: "price_per", label: "Price per book ($)", type: "number" },
        ],
      },
    ],
  },
  read_aloud: {
    title: "Read Aloud page",
    fields: [
      { key: "intro", label: "Intro", type: "textarea" },
      { key: "video_url", label: "Video embed URL (YouTube/Vimeo)", type: "text" },
      { key: "parent_note", label: "A note for grown-ups", type: "textarea" },
    ],
  },
  sand_banner: {
    title: "Homepage testimonial banner",
    fields: [
      { key: "quote", label: "Quote", type: "textarea" },
      { key: "author", label: "Attribution", type: "text" },
    ],
  },
  contact: {
    title: "Contact page",
    fields: [
      { key: "intro", label: "Intro", type: "textarea" },
    ],
  },
  wave_values: {
    title: "Catch the W.A.V.E. cards",
    description: "The four flip cards on the homepage.",
    fields: [
      {
        key: "cards", label: "Cards", type: "list",
        itemLabel: (i) => i?.letter ? `${i.letter} — ${i.title || ""}` : "Card",
        itemSchema: [
          { key: "letter", label: "Letter (W / A / V / E)", type: "text" },
          { key: "title", label: "Title", type: "text" },
          { key: "description", label: "Description", type: "textarea" },
          { key: "color", label: "Color (hex)", type: "color" },
        ],
      },
    ],
  },
};

export const ACTIVITY_SCHEMAS = {
  rhyme_time: {
    title: "Rhyme Time",
    description: "Each level is a pack of fill-in-the-rhyme prompts. The site rotates through levels — kids see a different pack each play.",
    fields: [
      {
        key: "levels", label: "Levels (rotating packs)", type: "list",
        itemLabel: (i, idx) => i?.name || `Level ${idx + 1}`,
        itemSchema: [
          { key: "name", label: "Level name (e.g. 'Set 1')", type: "text" },
          {
            key: "prompts", label: "Prompts", type: "list",
            itemLabel: (i, idx) => `Prompt ${idx + 1}`,
            itemSchema: [
              { key: "line", label: "Rhyme line (use ... where the missing word goes)", type: "textarea" },
              { key: "choices", label: "Choices (comma-separated)", type: "csv" },
              { key: "answer", label: "Correct answer", type: "text" },
            ],
          },
        ],
      },
    ],
  },
  quiz: {
    title: "Which Sea Star Are You?",
    description: "Each level is a pack of quiz questions. Levels rotate so quizzes feel fresh.",
    fields: [
      {
        key: "levels", label: "Levels (rotating packs)", type: "list",
        itemLabel: (i, idx) => i?.name || `Level ${idx + 1}`,
        itemSchema: [
          { key: "name", label: "Level name", type: "text" },
          {
            key: "questions", label: "Questions", type: "list",
            itemLabel: (i, idx) => `Q${idx + 1}: ${(i?.q || "").slice(0, 40)}`,
            itemSchema: [
              { key: "q", label: "Question", type: "text" },
              {
                key: "options", label: "Answer options", type: "list",
                itemLabel: (opt) => opt?.label || "Option",
                itemSchema: [
                  { key: "label", label: "Option text", type: "text" },
                  { key: "char", label: "Maps to character (slug)", type: "text" },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  word_search: {
    title: "Word Search",
    description: "Each level is a themed word pack. The puzzle rotates between themes.",
    fields: [
      {
        key: "levels", label: "Levels (themed packs)", type: "list",
        itemLabel: (i, idx) => i?.name || `Level ${idx + 1}`,
        itemSchema: [
          { key: "name", label: "Theme name (e.g. 'Beach', 'W.A.V.E.')", type: "text" },
          { key: "words", label: "Words (one per line, A–Z only)", type: "lines" },
        ],
      },
    ],
  },
  memory_match: {
    title: "Memory Match",
    description: "Each level controls how many pairs. Difficulty rotates as kids replay.",
    fields: [
      {
        key: "levels", label: "Levels", type: "list",
        itemLabel: (i, idx) => i?.name ? `${i.name} (${i.pairs || 0} pairs)` : `Level ${idx + 1}`,
        itemSchema: [
          { key: "name", label: "Level name", type: "text" },
          { key: "pairs", label: "Number of pairs", type: "number" },
        ],
      },
    ],
  },
  spot_difference: {
    title: "Spot the Difference",
    description: "Each level picks one of the built-in scenes. The scene rotates between plays.",
    fields: [
      {
        key: "levels", label: "Levels", type: "list",
        itemLabel: (i, idx) => i?.name || `Level ${idx + 1}`,
        itemSchema: [
          { key: "name", label: "Level name", type: "text" },
          { key: "scene_key", label: "Built-in scene (beach | camp)", type: "text" },
        ],
      },
    ],
  },
  coloring: {
    title: "Color the Cay",
    description: "Each level is a different SVG line-art scene. Palette is shared.",
    fields: [
      { key: "palette", label: "Color palette (hex codes, comma-separated)", type: "csv" },
      {
        key: "levels", label: "Levels (scenes)", type: "list",
        itemLabel: (i, idx) => i?.name || `Level ${idx + 1}`,
        itemSchema: [
          { key: "name", label: "Scene name", type: "text" },
          { key: "scene_key", label: "Built-in scene (wave | camp)", type: "text" },
        ],
      },
    ],
  },
  maze: {
    title: "Maze with Billy the Beluga",
    description: "Each level controls maze size. Mazes rotate from easy to captain.",
    fields: [
      {
        key: "levels", label: "Levels", type: "list",
        itemLabel: (i, idx) => i?.name ? `${i.name} (${i.width||0}×${i.height||0})` : `Level ${idx + 1}`,
        itemSchema: [
          { key: "name", label: "Level name", type: "text" },
          { key: "width", label: "Width (cells, 5–24)", type: "number" },
          { key: "height", label: "Height (cells, 5–24)", type: "number" },
        ],
      },
    ],
  },
  sticker_beach: {
    title: "Sticker Beach",
    description: "Each level picks a background scene. Scene rotates between plays.",
    fields: [
      {
        key: "levels", label: "Levels (background scenes)", type: "list",
        itemLabel: (i, idx) => i?.name || `Level ${idx + 1}`,
        itemSchema: [
          { key: "name", label: "Scene name", type: "text" },
          { key: "scene_image", label: "Scene image", type: "image" },
        ],
      },
    ],
  },
};

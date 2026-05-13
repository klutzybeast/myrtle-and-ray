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
    description: "Fill-in-the-rhyme prompts.",
    fields: [
      {
        key: "prompts", label: "Prompts", type: "list",
        itemLabel: (i, idx) => i?.line ? `Prompt ${idx + 1}` : `Prompt ${idx + 1}`,
        itemSchema: [
          { key: "line", label: "Rhyme line (use ... where the missing word goes)", type: "textarea" },
          { key: "choices", label: "Choices (comma-separated)", type: "csv" },
          { key: "answer", label: "Correct answer", type: "text" },
        ],
      },
    ],
  },
  quiz: {
    title: "Which Sea Star Are You?",
    description: "Multi-question quiz that maps to a character.",
    fields: [
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
  word_search: {
    title: "Word Search",
    fields: [
      { key: "words", label: "Words (one per line)", type: "lines" },
    ],
  },
  memory_match: {
    title: "Memory Match",
    fields: [
      { key: "difficulties", label: "Difficulty card-counts (comma-separated, e.g. 6,10,13)", type: "csv-num" },
    ],
  },
  spot_difference: {
    title: "Spot the Difference",
    fields: [
      {
        key: "scenes", label: "Scenes", type: "list",
        itemLabel: (i, idx) => i?.name || `Scene ${idx + 1}`,
        itemSchema: [
          { key: "name", label: "Scene name", type: "text" },
          { key: "image_a", label: "Image A", type: "image" },
          { key: "image_b", label: "Image B (with differences)", type: "image" },
        ],
      },
    ],
  },
  coloring: {
    title: "Color the Cay",
    fields: [
      { key: "palette", label: "Color palette (hex codes, comma-separated)", type: "csv" },
    ],
  },
  maze: {
    title: "Maze with Billy the Beluga",
    fields: [
      { key: "width", label: "Maze width (cells)", type: "number" },
      { key: "height", label: "Maze height (cells)", type: "number" },
    ],
  },
  sticker_beach: {
    title: "Sticker Beach",
    fields: [
      { key: "scene_image", label: "Beach scene background", type: "image" },
    ],
  },
};

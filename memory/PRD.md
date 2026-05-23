# PRD — Myrtle and Ray and the First Day of Camp

## Original problem
Build a fully interactive children's book marketing + merchandise site for
"Myrtle and Ray and the First Day of Camp" (a rhyming picture book by
Marissa Allaben & Alison Rothenberg, published by KingApe Media, edited by
Brian Stein). Brand: "Catch the W.A.V.E. of Excitement" (Welcome curiosity,
Act with kindness, Value teamwork, Encourage others). Audience: parents,
grandparents, teachers, camp directors of kids ages 3–8.

13 Sea Stars (characters): Ray, Myrtle, Ms Bluegill, Ollie, Sally, Jessie,
Casey, Dani, Sami, Izzy, Louie, Billy, Frankie.

## Architecture
- Backend: FastAPI + Motor (MongoDB), JWT (httpOnly cookie + Bearer
  fallback), bcrypt, Resend (queues when key missing), Pillow + pypdf
  for media metadata.
- Frontend: React 19 + React Router 7 + Tailwind + shadcn/ui + sonner.
- Static uploads served at `/uploads` via FastAPI StaticFiles.

## Production deploy rules (NON-NEGOTIABLE — owner directive)
1. **Every data change MUST go through `/app/backend/seed.py`** so it ships
   on deploy. No one-off `db.collection.update_one` scripts that only run
   in preview. Production has its own MongoDB — preview-only mutations
   are invisible to the live site.
2. **Pre-generated assets** (audio MP3s, generated images) that would
   otherwise cost paid API calls must be committed under
   `/app/backend/seed_assets/<feature>/` and imported by the seed into
   local uploads + persistent Object Storage on startup.
3. **The seed must be idempotent** — running on every backend startup
   should be a no-op when state is current, and backfill missing fields
   on existing docs (e.g. add voice_id to characters that lack one).
4. When a new piece of content is added in admin that the owner wants on
   prod, ask once: *"do you also want this hard-coded into the seed so a
   reseed/rebuild keeps it?"* and then bake it in.

## Core requirements (static)
- Public site reads everything from DB so admin edits go live without code.
- Sticky top header + sticky bottom action bar (Amazon + Shop CTAs).
- 13 Sea Star bios use exact wording from the brief and preserve original
  filenames (incl. trailing spaces).
- All email destinations default to community@rollingriver.com and are
  individually editable.
- Reply-to always community@rollingriver.com.
- Email-gate on downloads is global with per-download override.
- Bulk-uploadable media library.
- Admin login: community@rollingriver.com / Camp1993!

## User personas
- Parent buying a gift / downloading a coloring page.
- Teacher grabbing a classroom lesson.
- Camp Director requesting a wholesale quote.
- Owner/admin (Marissa/Alison) managing every piece of content from /admin.

## What's been implemented (2026-02-13)
- Backend: auth (JWT cookie + Bearer), full CRUD for products, downloads,
  download categories, characters, pages, settings, submissions, mailing
  list, media, activity content; public endpoints for catalog, downloads,
  pages, activities, site settings; submission + capture forms; email
  queueing (Resend-ready). Startup seeds 13 characters, 7 download
  categories, W.A.V.E. cards, 13 placeholder products, 17 placeholder
  downloads, 8 activity content rows, default settings, admin user.
- Frontend: Home with hero/sea-stars band/W.A.V.E. flip cards/shop-the-crew
  /downloads band/sand banner/message-in-a-bottle; Story page (13 flip
  character cards + Stingray Cay map with hotspots); Activities tile
  grid with badge collection (game logic deferred); Read Aloud; Shop +
  Shop Detail with variants/wishlist/share; Downloads (filters by
  category/audience/character/W.A.V.E./search) + Detail with email-gate
  modal; For Camps with bulk-tier pricing + wholesale form; About;
  Contact; sticky bottom bar; footer with mailing list signup; 30-second
  popup signup (one-time per visitor).
- Admin: login, dashboard counters, full CRUD for products/characters/
  downloads/download-categories/pages/settings/submissions/mailing-list,
  email outbox with Retry, drag-and-drop media library, activity
  content editor.
- Backend tested: 38/38 pytest passing (see /app/test_reports/iteration_1.json).

## What's been implemented (2026-02-14)
- Floating Chat Bubble on all public pages — posts to `/api/chat`,
  emails community@rollingriver.com with reply_to set to the visitor.
- Email Campaigns module (Constant-Contact-style block builder):
  Heading / Paragraph / Image / Button / Divider / Spacer / Quote /
  Raw HTML; drag-to-reorder; live preview iframe; color/width
  controls; recipient picker with tag + audience filter; test-send;
  batch send via Resend. Admin sidebar entry `Campaigns`.
- Admin login + mailing-list signup admin-notification emails removed
  (visitor welcome email still sent).
- Backend tested: 16/16 new-feature pytest passing
  (see /app/test_reports/iteration_2.json).

## What's been implemented (2026-02-14, pass 2)
- Hero badge replaced: now reads "Catch the W.A.V.E. of Excitement"
  (was "A rhyming picture book · Ages 3–8").
- Removed all "rhyming picture book" wording site-wide (Footer copy,
  index.html meta description, seed.py about_book.intro, and live
  about_book DB content) — now reads "A book…".
- Removed "Shop my stuffie" CTA from each Sea Star character card on
  /story (Hear my voice + Color me remain).
- Admin panel mobile UX: new top bar with hamburger + drawer at <1024px.
  All 14 nav items work, drawer auto-closes on nav, X button and
  backdrop tap also close. Desktop sidebar unchanged.
- Frontend tested: all 4 changes verified (see iteration_3.json).

## What's been implemented (2026-02-14, pass 3)
- All 8 Activity games are now fully playable at `/activities`:
  - Memory Match — flip-and-match using character portraits, 3 difficulty levels (6/10/13 pairs)
  - Quiz "Which Sea Star Are You?" — multi-question with character-mapped result
  - Rhyme Time — fill-in-the-rhyme with right/wrong feedback + score
  - Word Search — 12×12 drag-to-find grid, words from admin
  - Maze with Billy — recursive backtracking maze (configurable size), arrow keys + mobile arrow buttons
  - Color the Cay — 2 SVG scenes, palette + custom color picker, save as SVG
  - Sticker Beach — tap-to-place, drag-to-move, double-click-to-remove emoji stickers
  - Spot the Difference — built-in beach scene with 5 differences, click-to-find with tolerance circle
- Each game awards a Wave badge on completion via localStorage `mr_badges`.
  Earning all 8 unlocks the "Captain of the Cay" crown chip.
- Frontend tested: 7/8 games verified by testing_agent + Maze reset race fixed
  (see iteration_4.json).
- Fixed: PopupSignup no longer auto-opens on /activities (was overlapping
  game modals). Now waits 12s on other pages.

## What's been implemented (2026-02-14, pass 4)
- **Rotating levels** for every game: admin edits a `levels[]` array per
  activity (Maze sizes Easy/Medium/Hard/Captain, Word Search themed packs
  Beach/W.A.V.E./Camp crew, etc). Public game shows a level picker +
  "Next →" cycle. Current level persists in localStorage `mr_level_<key>`.
  Idempotent backend migration adds defaults to existing rows.
- **Dedicated `/wave-badges` page**: 8 badge tiles (earned vs grayscale),
  progress bar, "Captain of the Cay" banner when all 8 earned, linked
  from Activities page.
- **Audio system**: synthesized ocean loop via Web Audio (no external
  files), tap-pop on game tile click, "Hear my voice" buttons on Sea
  Star cards in /story now play character `audio_url` when admin
  uploads one (disabled fallback otherwise). New admin setting
  `ambient_audio_url` lets admin override the synthesized loop with
  a real MP3.
- Tested: 28/28 backend pytest (iteration_5.json); all level rotation +
  badges page + audio toggle verified end-to-end.

## What's been implemented (2026-02-14, pass 5)
- **Map** now lives on a dedicated `/map` page and is linked from the
  Header nav (between Story and Activities).
- Each of the 9 map hotspots opens a character card with bio, a
  "Play <activity>" CTA, and a link to the bio page. CTA opens the
  game directly on `/activities?game=<key>` and auto-launches the
  game modal (query param is stripped on open so back-button doesn't
  loop).
- Hotspot data moved to shared `/app/frontend/src/lib/mapData.js` —
  reused by both `/map` and the map section still on `/story`.

## What's been implemented (2026-05-16, pass 7 – persistent media storage + admin polish)
- **Integrated Emergent Object Storage** for all admin uploads (MP3s,
  images, PDFs, zips, SVGs). Files now survive production redeploys.
- New `backend/storage.py` wraps the Emergent Object Storage API with
  init/put/get + automatic session-key refresh on 403.
- `POST /api/admin/media/upload` now: (1) writes to local disk for fast
  reads + metadata extraction (PDF page count, image dimensions),
  (2) pushes bytes to persistent storage, (3) marks `persisted: true`
  in the `media` doc. If persistent storage is configured but fails,
  upload is rejected with 502 (no silent data loss).
- `/api/uploads/{filename}` switched from a static mount to a dynamic
  GET/HEAD handler that tries local disk first then falls back to
  persistent storage. Backward-compatible — every existing URL format
  continues to work after files are re-uploaded.
- Frontend `lib/audio.jsx` now resolves relative + stale-domain URLs
  defensively (`resolveUrl()`) so audio plays regardless of how the
  URL is stored.
- Required env var: `EMERGENT_LLM_KEY` (already set in preview).
- **Bulk PDF Upload** on `/admin/downloads`: new "Bulk upload" button
  opens a modal with a dropzone + default category/audience selectors.
  Drop in many PDFs → one Download item per file is auto-created
  (title from filename, slug auto-generated, file attached, published,
  NEW badge). Per-row status indicators + retry for failed rows.
- **Variants editor** in the Product editor (`/admin/products` →
  Edit): add/remove variant rows inline with label, SKU, Buy URL,
  and per-variant price. Empty rows are filtered out on save. Works
  with the existing ShopDetail.jsx variant picker (already wired).
- **Lightbox + pinch-zoom** (`/components/Lightbox.jsx`): reusable
  full-screen viewer wired into Shop product gallery, Download cover,
  Custom Page hero, Story character portraits (all 13 cycle through
  prev/next), and Story map. Pinch-zoom + double-tap zoom on mobile,
  mouse wheel + drag-to-pan on desktop, ESC/arrow keyboard nav, full
  control bar (zoom in/out/reset/close).
- **Sitemap.xml** at `/api/sitemap.xml` — dynamic XML sitemap with
  static routes + every published product / download / custom page
  pulled from MongoDB. Includes `<changefreq>` + `<priority>`.
- **robots.txt** at `/robots.txt` (static, also fallback at
  `/api/robots.txt`) with `Sitemap:` directive pointing to the dynamic
  sitemap. Cloudflare-managed signals append automatically.
- **Structured data (JSON-LD)** via new `<JsonLd>` component:
  - Home → Organization + WebSite + Book (the children's book itself,
    authors, publisher, audience age range, language)
  - ShopDetail → Product schema with offers (price, currency,
    availability mapped from inventory_status to schema.org values)
  - DownloadDetail → CreativeWork with audience + free access flag

## What's been implemented (2026-05-15, pass 6 – SEO + Analytics)
- **SEO infrastructure verified**: Removed duplicate static og:*/twitter:*
  meta tags from `public/index.html`. `<SEO>` component injects unique
  per-page `<title>`, `<meta description>`, `og:image`, `og:title`,
  `og:description`, `og:type`, `og:url`, `twitter:card`, `twitter:image`,
  and canonical link across Home, Story, Shop, ShopDetail, Activities,
  Downloads, DownloadDetail, ForCamps, About, Contact, WaveBadges, Map,
  and Custom Pages. Verified live via DOM inspection — no duplicate OG
  tags.
- **Download Analytics page** at `/admin/analytics`:
  - Total file clicks + email captures (all-time / today / week / month).
  - Audience breakdown (Parents / Teachers / Camp Directors / Kids /
    Grandparents) with horizontal bars.
  - Top Downloads (by `total_downloads` counter) with cover images.
  - Captures-by-download list with last-capture timestamp.
  - Recent Captures feed (latest 15 with email + audience + slug + date).
  - Backed by new GET `/api/admin/analytics/downloads` endpoint.
  - Linked from admin sidebar with BarChart3 icon.
- **Mailing-list tag enhancements**:
  - Every download-capture submission appends `download:<slug>` tag to
    the subscriber (already in `/api/download-capture`).
  - Admin Mailing List page now renders tags as pills + adds a tag
    filter chip row so the owner can segment by download in one click.
  - CSV export respects the current tag filter.

## Prioritized backlog
**P1 (next pass)**
- Build the 8 activity games (Memory Match, Spot the Difference, Coloring
  canvas, Word Search, Quiz w/ result mapping, Rhyme Time, Maze, Sticker
  Beach drag-drop). — DONE in pass 4.
- Bulk PDF folder upload UI (server already accepts).
- Wave-badge tracking + dedicated "My Wave Badges" page. — DONE.
- Audio ambient loop + UI tap pop sounds. — DONE.
- Real animations (parallax, sparkles, bubbles).
- Variants editor UI in product editor (currently JSON via API only).
- Forced password change on first login screen (backend already supports it).
- Sitemap.xml, robots.txt, structured data (Product, CreativeWork).

**P2**
- Lightbox + pinch-zoom for sample-pages carousel. — DONE.
- "Hear my voice" audio per character. — DONE (ElevenLabs v3, 13 voices).
- Spot-the-Difference scene assets.
- Cross-product cart / multi-Printify order helper.
- Rich-text WYSIWYG (currently JSON for pages / plain textarea for products).
- Auto-saving star toggle on products dashboard (P3 polish).
- Campus-tour glow for earned badges on the Map (P3 polish).

**P3 (delight)**
- Wave Pal Pen Pals — kids type a letter, a character replies in their voice.
- Daily Streak Tracker — unlock secret content after X consecutive visits.
- Camp Counselor Leaderboard — private feed for camp directors.

## Next tasks
1. User to upload page PNGs (in batches of 5) via Admin → Read-Aloud Book —
   matching each page number. Audio will auto-rotate based on saved speaker.
2. Optional polish: replace placeholder text view with PNGs once uploaded.
3. Plug in real `RESEND_API_KEY` and click Retry on any queued emails.

## Read-Aloud Book (2026-02-21 — NEW)
- 20-page interactive storybook reader at `/read-aloud`.
- Each page narrated by an assigned Sea Star (Myrtle, Ray, Ms Bluegill,
  Sally, Ollie) via ElevenLabs `eleven_v3`. All 20 MP3s cached to Emergent
  storage with content-hash keys; PATCH on text/speaker invalidates the
  cached audio_url so a regenerate is forced.
- Public payload strips `voice_id` and `cache_key` for safety.
- Admin Manager at `/admin/read-aloud`:
  - Per-row text editor (autosaves on blur), speaker dropdown (13 voices),
    PNG upload (single or bulk-5-at-a-time with "Start at page N" picker),
    individual or bulk audio generation.
  - Shows "X/20 pages have audio" status header.
- Reader UI: speaker badge, big play/pause, auto-turn-pages toggle, prev/
  next + 20 page-dot jumps, keyboard nav (← → SPACE), progress bar.
- Speaker distribution: Myrtle×7, Ray×5, Ms.Bluegill×6, Sally×1, Ollie×1.
- Verified by 21/21 backend pytest cases + frontend e2e
  (`/app/test_reports/iteration_7.json`,
  `/app/backend/tests/test_readaloud_and_regression.py`).

## What's been implemented (2026-02-22 — ShipStation V2 Live Rates)
- **Replaced the hardcoded $8 USPS flat-rate** shipping at checkout with
  live multi-carrier rates from ShipStation V2.
- New backend router `/app/backend/shipstation_router.py`:
  - `GET  /api/checkout/shipping-rates/health` — config + connected
    carrier introspection (currently USPS, UPS, FedEx One Balance).
  - `POST /api/checkout/shipping-rates` — given cart items + destination,
    returns array of selectable rates (cheapest first, de-duped by
    carrier/service, Media Mail + international USPS filtered out for
    domestic shipments). Auto-scales package weight by item quantity
    (default 12 oz / 9×6×3 in per stuffie).
- `square_router.py`:
  - `CheckoutRequest` now accepts `shipping_cents`, `shipping_service`,
    `shipping_carrier`, `shipping_rate_id` (all optional, back-compat).
  - `_calc_totals(subtotal, override_shipping_cents=None)` honors the
    override on both `/checkout/quote-cart` and `/checkout/square` so
    the **Square charge, persisted order doc, and confirmation email
    all use the actually-selected ShipStation rate**.
- `Checkout.jsx` (full rewrite):
  - Fetches live rates on a 400 ms debounce once the destination
    address is complete; cheapest auto-selected.
  - Radio-list of rates with carrier, service, ETA, and price chips
    ("Cheapest" / "Fastest" from ShipStation `rate_attributes`).
  - Recomputes the order summary in real time when the user picks a
    different rate; pays exactly the selected amount via Square.
  - Forwards `shipping_cents`/`service`/`carrier`/`rate_id` to
    `/checkout/square`.
- `PopupSignup.jsx`: also suppressed on `/checkout` (was already
  suppressed on `/activities`).
- Env vars (all overridable, defaults baked for prod):
  `SHIPSTATION_API_KEY`, `SHIP_FROM_NAME/PHONE/LINE1/LINE2/CITY/STATE/POSTAL/COUNTRY`,
  `STUFFIES_PKG_WEIGHT_OZ/LEN_IN/WID_IN/HGT_IN`.
- Verified by 12/12 pytest + Playwright e2e
  (`/app/test_reports/iteration_9.json`,
  `/app/backend/tests/test_shipstation_checkout.py`).


## What's been implemented (2026-02-22 — Discount Code System)
- **Full discount engine** at `/app/backend/discount_router.py`:
  - 4 types: `percent`, `fixed`, `free_shipping`, `bogo`
  - Per-code rules: starts_at / expires_at / max_total_uses /
    max_per_customer / min_subtotal_cents / allowed_product_slugs /
    allowed_categories / bogo_product_slug / active toggle
  - Endpoints:
    - Public: `POST /api/checkout/validate-discount` with user-friendly
      400 messages for every fail mode (invalid, expired, fully
      redeemed, already used by this email, spend more, doesn't apply
      to cart)
    - Admin (require_admin): full CRUD at `/api/admin/discounts` +
      `GET /api/admin/discounts/{id}/redemptions`
  - Atomic idempotent redemption tracking via `discount_redemptions`
    collection — only increments `usage_count` once per
    `(code, order_id)`.
- **Square checkout** (`square_router.py`): `CheckoutRequest` now accepts
  `discount_code`. Server re-validates at charge time (never trusts
  client amount), recalculates totals via `_calc_totals(subtotal,
  override_shipping, discount_cents, free_shipping)`, persists
  `discount_code / discount_type / discount_cents` on the order doc,
  and records the redemption on successful payment. Confirmation email
  shows the discount line.
- **Admin UI** at `/admin/discounts` (`AdminDiscounts.jsx`): list view
  + create/edit modal exposing every rule, copy-code, copy-share-link
  (`/shop?code=XYZ`), per-row active toggle, delete.
- **Checkout UI** (`Checkout.jsx`): "Discount code" section with input
  + Apply / Remove; summary row "Discount (CODE) −$X.XX"; real-time
  total recompute when a code is added/removed/invalidated.
- **URL auto-apply**: `/shop?code=XYZ` stashes the code in
  `sessionStorage.mr_discount_code`; `/checkout` reads it once cart
  hydrates and auto-applies. `/checkout?code=XYZ` direct also works.
- **New `extractErrMsg()` helper** in `lib/api.js` — safely coerces
  Pydantic 422 array-shaped errors to readable strings, used in all
  Checkout.jsx catch handlers. Fixes a previously-latent "Objects are
  not valid as a React child" crash that could blank the page on any
  422 response.
- Tested: 45/45 pytest passing (33 new discount tests + 12 ShipStation
  regression) + Playwright e2e for the full Checkout discount flow.
  Report: `/app/test_reports/iteration_11.json`.

## What's been implemented (2026-02-22 — Wave Pal Pen Pals + Campaign×Discount integration)
### Wave Pal Pen Pals (`/pen-pals`)
- Kid-facing letter-writer with 13 character pickers, compose form, and
  a "Sea Star Inbox" history.
- Backend `/app/backend/penpals_router.py`:
  - `POST /api/pen-pals/letter` — sanitizes PII (emails, phone numbers,
    URLs → bracketed placeholders), blocks unkind words with a
    kid-friendly error, enforces a 5/day/visitor rate limit, generates
    a 4-couplet rhyming reply via Gemini Flash
    (`gemini-3-flash-preview` via `emergentintegrations.LlmChat`),
    optionally synthesizes the reply in the character's ElevenLabs
    voice, and caches both text + audio by SHA-256 of
    `(character_slug, sanitized_letter)` so repeat letters are free.
  - `GET /api/pen-pals/settings` (public lean payload) and
    `GET /api/pen-pals/history/{visitor_id}`.
- Admin `/admin/pen-pals` (`AdminPenPals.jsx`): settings panel
  (enable/disable, daily cap, max chars, audio on/off) + letter table
  with character filter + search + soft-delete (kept in DB for safety
  review).
- LLM fallback: if `EMERGENT_LLM_KEY` is missing OR the call fails, the
  router returns a canned safe rhyming reply so the UX never crashes.
- Verified by 14/14 pytest in `/app/backend/tests/test_penpals.py` +
  Playwright e2e.

### Campaign × Discount integration
- `/admin/campaigns/{id}` editor: new "Promo" section in the right
  block-add panel lists every active discount code. Clicking one
  appends a 4-block CTA group to the email — heading
  ("20% off with code SAVE20"), promo paragraph, button
  (`href = ${SITE_URL || origin}/shop?code=SAVE20`), spacer.
  Auto-applies at checkout via the existing URL-stash sessionStorage
  flow.

### Other tweaks shipped this pass
- `PopupSignup` also suppressed on `/pen-pals`.
- Read-Aloud test expectations updated to the 21-page seed (was 20).

## What's been implemented (2026-02-22 — AI Coloring Pages + hero fix)
### AI Coloring Pages (`/coloring`)
- Kid-facing page that generates a **black-and-white line-art coloring
  page** from a text prompt + optional Sea Star character.
- Backend `/app/backend/coloring_router.py`:
  - `POST /api/coloring/generate` — sanitizes the prompt (reuses PII +
    banned-word helpers from `penpals_router`), blocks weapon/violence
    subjects with a friendly message, rate-limits 5/day/visitor,
    generates a single PNG via Gemini Nano Banana
    (`gemini-3.1-flash-image-preview` via
    `emergentintegrations.LlmChat` with `modalities=['image','text']`).
  - SHA-256 content-hash caching by `(character_slug,
    sanitized_prompt)` — second kid asking the same thing pays nothing.
  - PNG persisted at `/app/backend/uploads/coloring/<hash>.png` and
    pushed to Emergent Object Storage.
  - System prompt enforces pure black outlines, white background, no
    shading, no text, kid-safe single subject.
- Admin `/admin/coloring`: settings panel (enable/disable, daily cap,
  max chars, share-publicly) + grid of pages with prompt + character
  + soft-delete.
- Public extras: prompt-idea chips, character chip row, download +
  print, "My coloring pages" localStorage history.
- Verified: 17/17 pytest (cache-seeded — LLM never called from CI) +
  Playwright e2e green for public AND admin flows.

### Homepage hero regression fix
- A leftover `TEST_marker_10a84b` from an older testing-agent run was
  showing in the hero (the test wrote the marker but didn't restore).
- Restored the canonical hero copy on preview **and patched seed.py**
  so on every backend startup any seeded page containing
  `TEST_marker_` is reset back to its canonical PAGES default —
  prod is now defended against future test-agent leaks.

### Other tweaks
- PopupSignup suppressed on `/coloring`.
- Coloring nav link added in public header + admin sidebar.

## What's been implemented (2026-02-22 — Sea Star Studio combo)
### `/sea-star-studio` — one letter → rhyme + voice + coloring page
- Kid picks a Sea Star, writes a short letter, hits "Make my keepsake".
  ~40s later they get back a single panel containing:
  - 4 rhyming couplets in the character's voice (text)
  - The same reply as ElevenLabs audio (cached)
  - A coloring-book PNG depicting the scene the rhyme talks about
  - A **Print my keepsake** button that opens a letter-sized printable
    HTML page combining the rhyme + the coloring image
- Backend `/app/backend/seastar_studio_router.py`:
  - ONE Gemini Flash call returns a structured `RHYME: ... SCENE: ...`
    payload parsed into `(reply_text, scene_prompt)`. Falls back to a
    safe canned rhyme + generic scene on LLM failure or misformat.
  - Reuses safety helpers from `penpals_router` (`sanitize_letter`,
    `contains_banned`, `_today_key`) AND `coloring_router`
    (`_is_blocked`, coloring system prompt, `COLORING_DIR`).
  - Reuses the pen-pals MP3 cache directory + coloring PNG cache
    directory — keyed by SHA-256 of
    `(character_slug, sanitized_letter)`, so cache hits cost $0 and
    return in <3s across visitors.
  - Rate limit: 3 keepsakes/day/visitor — separate from pen-pals and
    coloring quotas so kids can use all three.
- Admin `/admin/sea-star-studio`: list with letter + rhyme + scene
  caption + coloring image; soft-delete; search + character filter;
  settings (enabled, daily cap, audio toggle).
- Public extras: 13-card character picker, name + letter form, full
  keepsake view, write-another, localStorage history (max 20).
- Verified: 17/17 pytest (cache-seeded — zero paid API calls in CI) +
  full Playwright e2e for both public AND admin flows. 96/96
  regression suite still passing.

### Other tweaks
- `PopupSignup` also suppressed on `/sea-star-studio`.
- "Studio" link added to public header + admin sidebar.

## What's been implemented (2026-02-23 — Story Quest)
### `/story-quest` — interactive replay teaching W.A.V.E.
- 12 seeded scenes guide kids through Stingray Cay. Each scene presents
  3 choices, each tagged with one W.A.V.E. principle (Welcome curiosity /
  Act with kindness / Value teamwork / Encourage others). Choices show a
  character reaction, then Continue. After all 12 scenes a Finale screen
  reveals the kid's matched Sea Star based on highest-scoring principle,
  awards the **Story Quest Champion** Wave Badge (badge #9 → unlocks
  Captain of the Cay), shows the W.A.V.E. fingerprint, and offers
  Share / Play again / See my badges.
- Backend `/app/backend/story_quest_router.py`:
  - Public: `GET /story-quest/scenes`, `GET /story-quest/character-mappings`,
    `POST /story-quest/track-completion`.
  - Admin: full CRUD on scenes + `POST /admin/story-quest/reorder` +
    `GET/PUT /admin/story-quest/character-mappings` + `GET /admin/story-quest/analytics`
    (totals, today, character distribution, W.A.V.E. averages, recent 10).
  - Anonymous completion logging (IP hashed sha256[:16], no PII).
- Seed `/app/backend/seed.py` (`_seed_story_quest`): inserts any missing
  scene by `scene_number` and writes default W.A.V.E.→character map
  (welcome_curiosity→ms-bluegill, act_with_kindness→myrtle,
   value_teamwork→ray, encourage_others→ollie). Idempotent.
- Admin `/admin/story-quest`: list with reorder arrows, edit modal
  (title / narrative / bg image / audio / choices), W.A.V.E.→Sea Star
  mapping selectors, analytics panel.
- Public extras: progress bar with a11y `role='progressbar'`,
  resume-where-you-left-off (localStorage `mr_quest_progress`),
  optional ElevenLabs narration per scene.
- Wired: `App.js` routes (`/story-quest` + admin), Header nav link,
  AdminLayout sidebar entry, `/story` page CTA banner.
- `PopupSignup` suppressed on `/story-quest` so kids aren't interrupted.
- Verified: 10/10 pytest on /app/backend/tests/test_story_quest.py +
  full Playwright walkthrough (splash → 12 scenes → finale → badge
  unlocked → /wave-badges shows earned). Backend 100%, frontend 100%
  after popup-suppression fix.

### Backlog (P3)
- Auto-saving star toggle on Admin Products + map glow for earned badges.
- Daily Streak Tracker (visit N days → unlock secret content).
- Camp Counselor Leaderboard (private feed for camps).
- Hardening (from code review): clamp `wave_scores` per-key (0–12) in
  `/track-completion`; convert reorder to a `bulk_write`; shared
  constants module for `WAVE_KEYS`; lift `to_list(50)` cap on public
  scenes once admins create &gt;50.

## What's been implemented (2026-02-23 — Story Quest narration)
### Per-scene narrator voices baked into the deploy
- Each of the 12 Story Quest scenes is now narrated by a Sea Star whose
  perspective fits the moment (Ms Bluegill opens / closes camp + the
  reveal, Ray captains the crew + the big wave, Casey runs the tide
  pool, Sally narrates her shy storytime, Louie owns lunchtime, Myrtle
  carries the kindness beats and the W.A.V.E. promise reflection).
- New `STORY_QUEST_NARRATORS` map (scene_number → character slug) in
  `seed.py`. `_seed_story_quest` now assigns `narrator_slug` on each
  scene + resolves the ElevenLabs cache key for `(voice_id, narrative)`
  and writes the bundled MP3 from `/app/backend/seed_assets/story_quest/`
  into `/uploads/voice/<hash>.mp3` + Object Storage + `voice_cache`.
  Same hash → existing `/api/uploads/voice/...` route streams the MP3
  with the same `Cache-Control: immutable` headers as the rest of the
  voice library. Backfills existing scenes on every restart.
- One-time generator: `/app/backend/scripts/generate_story_quest_audio.py`
  calls ElevenLabs once per scene with `eleven_turbo_v2_5` (0.45 /
  0.85 / 0.35) and writes 12 MP3s (~1.6 MB total) to `seed_assets/`.
  Re-run is a no-op (skips existing). Total chars synthesized: 1451.
- Public UI (`StoryQuest.jsx`): each scene shows a "🎙 Narrated by
  <name>" line with the Sea Star's avatar. Unmute toggle lights up
  because every scene now has audio. Audio element resets src per
  scene so the right voice plays every time.
- Admin (`AdminStoryQuest.jsx`): scene editor now has a Narrator
  selector populated from `/characters` (disabled for voiceless
  characters). Scene list shows a 🎙 narrator chip per row.
- Backend (`story_quest_router.py`): `SceneBody` accepts and persists
  `narrator_slug`; create/patch flows already write through, public
  GET returns it.
- Regression: `test_story_quest.py` now has 11 tests (added
  `test_every_scene_has_narrator_and_playable_audio` — HEAD-verifies
  all 12 MP3s stream `audio/mpeg`). All passing.


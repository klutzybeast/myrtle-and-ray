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

## What's been implemented (2026-02-23 — Story Quest gesture auto-play)
### Narration plays itself from scene 1 onward
- Splash now offers two CTAs:
  - `data-testid="quest-start"` → **"🔊 Start with narration"**
  - `data-testid="quest-start-silent"` → **"🔇 Quiet mode"**
- Clicking either is captured as a real user gesture. "Start with
  narration" sets `muted=false` and a `useEffect([idx, stage, muted])`
  explicitly calls `audioRef.current.play()` (with `.catch(()=>{})`
  fallback) so each new scene plays the matched Sea Star's voice
  automatically — no manual play button needed between scenes.
- The audio element is keyed by `current.id` so React remounts it
  cleanly when the narrator (and src) changes between scenes.
- Speaker button in the progress bar still toggles muting at any time;
  resuming a saved quest defaults to quiet mode (no autoplay until the
  kid touches the unmute button to provide a gesture).
- Verified: 11/11 backend pytest still green. Scene 1 audio element
  mounts with the Ms Bluegill MP3 src on click of "Start with
  narration"; subsequent scenes auto-play their respective narrator
  voices on Continue.

  all 12 MP3s stream `audio/mpeg`). All passing.

## What's been implemented (2026-02-23 — Wave Nudge)
### Narration finishes → the matching choice glows
- New behavior teaches the W.A.V.E. framework without telling the kid
  which button to press:
  1. While the narrator is speaking, the 3 choice buttons are dimmed
     to 40% opacity and a small italic line shows
     "Listening to <Narrator>… your choices will glow when it's your turn."
  2. The `<audio onEnded>` event sets `narrationDone=true`, which
     fades the choices up to full opacity (`animate-choices-rise`).
  3. The choice whose `wave_principle` matches the narrator's
     `wave_value` (e.g. Ms Bluegill = W → Welcome Curiosity) gets a
     subtle teal `wave-nudge` pulse ring (every 2.4s, `box-shadow`
     halo + 2px lift) — a soft nudge, not a command. Quiet mode and
     scenes without audio mark choices "open" immediately so the
     glow is always available.
- Implementation: 2 new keyframes (`wave-nudge`, `choices-rise`) in
  `index.css`. `StoryQuest.jsx` tracks `narrationDone` state, resets
  it on scene change, derives `choicesOpen` from
  `(narrationDone || muted || !audio_url)`, computes
  `narratorPrinciple` from the narrator character's W/A/V/E letter,
  and applies the pulse class only to that choice.
- Each button now exposes `data-narrator-pick="true|false"` for
  testing & analytics.
- Verified via Playwright: Quiet mode → choices open + W choice

## What's been implemented (2026-02-23 — Top W.A.V.E. moments recap)
### Finale shows "you really listened to <Narrator>"
- Every choice the kid makes is now recorded as a `pick` with full
  metadata: `scene_id`, `scene_number`, `scene_title`, `narrator_slug`,
  `narrator_name`, `wave_principle`, and `matched_narrator` (bool —
  true when the chosen principle matches the narrator's W.A.V.E. value).
- Picks are persisted in `localStorage` alongside scores/idx/stage so
  the recap survives a refresh.
- Finale screen has a new section **"Your top W.A.V.E. moments"** (top
  3 cards) — narrator-matched picks first, sorted by scene order;
  unmatched picks fill any remaining slots. Each card shows the scene
  title, narrator avatar + name, W.A.V.E. principle pill, and a
  "you listened ✓" callout when matched.
- Above the cards, when the kid hit ≥2 matches with the same narrator,
  a personal callout reads "You **really listened** to <Name> — you
  matched their W.A.V.E. value <count>×." This turns the same data we
  already collect into a personal moment without any extra LLM call.
- Implementation is local-only: no backend changes needed — the
  existing `track-completion` endpoint still records scores;
  matched_narrator can be computed from the same data if a future
  admin analytic wants it.
- Verified Playwright run: completed all 12 scenes picking the
  narrator-match button each time → finale shows 3 matched moments
  (Ms Bluegill / Louie / Ray) + "really listened to Ms Bluegill 4×"
  callout + Story Quest Champion badge toast. 11/11 backend pytest
  still green.

  pulses; Narration mode → choices dim + hint shown; firing the
  audio `ended` event flips choices to open + W choice glows. 11/11
  Story Quest backend pytest still green.



## What's been implemented (2026-02-23 — Personalized share card)
### "Save share card" → real 1200×630 PNG ready for socials
- New library `/app/frontend/src/lib/storyQuestShareCard.js` renders the
  card entirely client-side on a `<canvas>` — no server round-trip,
  zero API cost. Composition: ocean gradient background with wave +
  sparkle accents · brand strip ("CATCH THE W.A.V.E. OF EXCITEMENT") ·
  "My Story Quest result" headline · matched Sea Star avatar (cover-
  fit) inside a 4-color gradient ring · "I'm a… <Name>" + role ·
  "I really listened to <Narrator> · Nx match" callout (when ≥2
  matches) · W.A.V.E. fingerprint bars with letter bullets and counts
  · footer "Myrtle and Ray — Find your Sea Star at <host>/story-quest".
- Character images load with `crossOrigin="anonymous"` and the renderer
  fails gracefully (no avatar but everything else still draws) if CORS
  blocks the image.
- Finale Share/Download flow:
  - `data-testid="quest-share"` — uses Web Share API. If the device
    supports file-sharing (`navigator.canShare({files})`), shares text
    + the PNG. Otherwise falls back to text-only share, then to a
    desktop PNG download + clipboard copy.
  - `data-testid="quest-download-card"` — explicit "Save share card"
    button that always downloads the PNG so parents have the asset.
- Buttons rearranged into a 4-up grid: Share my result · Save share
  card · Play again · See my badges.
- Verified via Playwright: full quest → finale → click "Save share
  card" → real 718 KB PNG (valid header, 1200×630) downloaded.
  Gemini visual analysis of the rendered card confirmed all sections
  present, no overlapping text, avatar centered in gradient ring,
  fingerprint bars correctly scaled to scores. 11/11 backend pytest
  still green.


## What's been implemented (2026-02-23 — Personal name)
### "Tessa is like Ms Bluegill" — name capture + phrasing
- Splash now has a "What's your name? (optional)" pill input above the
  Start CTAs (`data-testid="quest-name-input"`, max 24 chars). The name
  is persisted to `localStorage[NAME_KEY]` so a return visit pre-fills
  it. Leaving it blank is fine — copy gracefully falls back to "You're"
  / "I'm".
- Finale headline now reads **"Tessa is like Ms Bluegill!"** (or
  "You're like Ms Bluegill!" if no name). `data-testid="quest-finale-headline"`
  added for testability.
- Share text payload updated to **"Tessa is like Ms Bluegill 🌟 on
  Myrtle and Ray's Story Quest!"** (no-name version: "I'm like Ms
  Bluegill ...").
- Share card PNG: right-column header is now **"Tessa is like…"**
  above the big character name (no-name version: "I'm like…").
  Renderer accepts a new `playerName` prop and trims/limits it.
- Phrasing intentionally avoids "is a Ms Bluegill" (which sounds like
  a category) — Sea Stars are unique characters, so "like" is the
  natural comparison.
- Verified: Playwright walked through quest as "Tessa" → finale
  headline = "Tessa is like Ms Bluegill!"; downloaded share card PNG
  confirmed by Gemini visual analysis to show "Tessa is like…" above
  "Ms Bluegill" with avatar + callout + fingerprint + footer all
  intact. 11/11 backend pytest still green.


## What's been implemented (2026-02-23 — Personalized voice line)
### "Way to go, Tessa!" in the matched Sea Star's voice
- New backend endpoint **`POST /api/story-quest/finale-voice`** in
  `story_quest_router.py`:
  - Body: `{ matched_slug, player_name }` (name optional)
  - Sanitizer keeps only letters/spaces/hyphens/apostrophes, max 24
    chars; non-letter garbage → no name baked into the line.
  - Composes: *"Way to go, <Name>! You really listened to my friends
    and to me today. You're a true Sea Star — and the cay shines a
    little brighter because of you."* (no-name variant: "Wow, what
    a quest! …").
  - Reuses voice_router's `_cache_key` + `_synthesize` + `_storage`
    helpers and the `voice_cache` mongo collection. **First call
    synthesizes via ElevenLabs and persists local + Object Storage +
    cache row; every subsequent call (same name + matched Sea Star)
    is a ~125ms cache hit at $0**. Returns `{ audio_url, text }`.
- Finale UI: as soon as the matched character resolves, POSTs the
  request, displays a "**HEAR IT FROM <NAME>**" block inside the
  matched-card with the audio element, transcript, and Volume2 icon.
  Auto-plays on mount (the scene-continue click that landed the kid
  on the finale counts as a user gesture, unblocking autoplay).
- Tested:
  - 3 new pytests: with-name, sanitize-garbage-name, unknown-slug ⇒
    404. 14/14 backend pytest pass.
  - Playwright E2E: completed quest as "Tessa" → finale rendered
    `quest-finale-voice` testid, audio src = `/api/uploads/voice/...mp3`,
    10.4s duration, transcript correctly says
    *"Way to go, Tessa! You really listened to my friends and to me
    today…"*. Wave badge toast still fires.


## What's been implemented (2026-02-23 — Email a postcard)
### "Send Tessa a postcard" → printable PDF in the parent's inbox
- New backend endpoint **`POST /api/story-quest/postcard`** in
  `story_quest_router.py`:
  - Body: `{ email, matched_slug, player_name, share_card_png_base64,
    join_newsletter }`.
  - Validates email shape, looks up matched character, sanitizes name.
  - Decodes the share-card PNG the kid generated client-side and
    builds a **one-page letter-size PDF** with `reportlab`:
    branded header strip · the share-card image full-width · "Dear
    <Name>," greeting · personalized voice line as body · "Love,
    <Character>" italic+bold signature · "Print me out and pin me on
    the fridge!" footer with site URL.
  - Sends via Resend (existing `queue_email` extended to support
    attachments) with the PDF attached as `story-quest-postcard-tessa.pdf`.
  - If `join_newsletter` is true, upserts the email into
    `mailing_list` with `source: "story_quest_postcard"` (idempotent —
    existing subscribers are not overwritten).
  - Writes an audit row to `story_quest_postcards` (email, slug, name,
    consent flag, email_status, IP hash, created_at).
- Dependency: `reportlab==4.5.1` added to `requirements.txt`.
- `email_service.queue_email` extended with an optional `attachments`
  parameter (Resend-shape list of `{filename, content_base64}`).
  Backward-compatible; existing callers unchanged.
- Frontend `StoryQuest.jsx`:
  - Finale button grid expanded to 5 columns. New **"Email a postcard"**
    CTA (Mail icon, peach gradient) opens a modal.
  - `<PostcardModal>` collects parent email + newsletter consent
    (default opt-in). On submit: regenerates the share-card PNG via
    the existing `buildShareBlob()` (reused to keep one source of
    truth for the image), base64-encodes it, POSTs to the new
    endpoint, then toasts "Postcard from Ms Bluegill is on its way to
    parent@example.com!" and closes.
  - Friendly error toasts from the backend's `HTTPException.detail`.
- Tests: 3 new pytests (happy path with mailing-list + audit + outbox
  attachment verification, bad email → 400, unknown character → 404).
  **17/17 backend pytest pass**.
- Live verified: Playwright walked through quest as "Tessa" → opened
  modal → typed email → clicked Send → modal closed, success toast
  shown. Backend confirmed: Resend returned `status="sent"`, audit
  row written, mailing list opted-in. Gemini visual analysis of the
  produced PDF confirmed all 6 required sections present without
  overlap.


## What's been implemented (2026-02-23 — Pronunciation + Multi-Quest + Sing-Along)
### "Cay" pronunciation fix (across all ElevenLabs paths)
- Created `/app/backend/tts_pronunciation.py` with `phoneticize_for_tts()`.
  "Cay" / "cay" / "Cays" → "Key" / "key" / "Keys" only in text sent to
  ElevenLabs. On-screen and printed copy keeps the proper spelling.
- Wired into 3 callers: `seed.py::_seed_story_quest` (scene narration),
  `scripts/generate_story_quest_audio.py` (bake step), and
  `story_quest_router.finale_voice` (personalized line).
- Re-baked scenes 1 and 12 (the only narrations containing "Cay") —
  just 268 chars synthesized, ~$0 incremental ElevenLabs cost.

### Multi-Story-Quest (1 → 10 quests in a gallery)
- New `story_quests` Mongo collection (`{id, slug, title, blurb,
  hero_image_url, theme_color, character_focus, position, status,
  active}`). Scenes get a `quest_id` FK; existing scenes auto-backfill
  to `first-day-of-camp` on next seed.
- Catalog seeded in `seed.py::STORY_QUESTS_CATALOG`:
  1. First Day of Camp (READY — 12 scenes)
  2. The Lost Sea Glass Treasure (coming soon)
  3. Storm at Stingray Cay (coming soon)
  4. The First Camp Talent Show (coming soon)
  5. Mystery of the Tide Pool (coming soon)
  6. Race to the Lighthouse (coming soon)
  7. Captain for a Day (coming soon)
  8. Friendship Fix-It (coming soon)
  9. Surprise Birthday at Camp (coming soon)
  10. Beach Cleanup Heroes (coming soon)
  Status is preserved across redeploys so admins can flip to "ready"
  once they author scenes via the existing AdminStoryQuest editor.
- New public endpoints: `GET /story-quest/quests` (gallery),
  `GET /story-quest/quests/{slug}` (single), and the existing
  `GET /story-quest/scenes` now accepts `?quest_slug=` or `?quest_id=`.
- Routes: `/story-quest` → `<QuestGallery />` (10-card grid with
  "Coming soon" badges on the 9 unfinished ones).
  `/story-quest/:slug` → `<QuestRunner slug={slug} />` (same flow as
  before, but scoped). "← All quests" link in the splash header.
- Header nav unchanged (still points to gallery).

### Sing-Along (new feature) + 10 song catalog + 1 pilot generated
- New `/app/backend/sing_along_router.py` with public list/detail +
  admin CRUD/reorder.
- New `sing_along_songs` collection with 10 seeded stubs (W.A.V.E.
  anthems, Sea Star theme songs, camp song). Each row includes:
  title, theme, character_focus, lyrics, music_prompt (the natural-
  language prompt sent to ElevenLabs Music), duration_seconds, audio_url.
- New `/app/backend/scripts/generate_sing_along_audio.py`: calls
  `client.music.compose()` (verified working — generated
  "Catch the W.A.V.E." pilot, 938 KB MP3, streams correctly via
  `/api/uploads/sing_along/catch-the-wave.mp3`). Idempotent: re-runs
  skip already-baked songs. Pass slugs as args to generate a subset.
- New frontend page `/sing-along` (`SingAlong.jsx`): card grid +
  sticky "Now Playing" panel with scrolling lyrics. "Play & sing"
  → "Pause" toggle. Coming-soon songs show a Lock badge.
- Header nav: new "Sing-Along" link added between Story Quest and
  Shop.
- Tested: 17/17 Story Quest pytest pass. Gallery + per-quest splash
  + sing-along play screenshots all confirm working end-to-end.


## What's been implemented (2026-02-23 — Beach theme complete)
### All 10 Story Quests ready + all 10 sing-alongs generated
- **Wrote scenes for the 9 remaining quests** (8 scenes each — intro
  + 6 W.A.V.E. choice scenes + finale) in
  `seed.py::ADDITIONAL_STORY_QUESTS_SCENES`:
  1. First Day of Camp · 12 scenes (was ready)
  2. The Lost Sea Glass Treasure · 8 scenes (Ray + crew detective)
  3. Storm at Stingray Cay · 8 scenes (Ms Bluegill weathers it)
  4. The First Camp Talent Show · 8 scenes (Sally + Louie spotlight)
  5. Mystery of the Tide Pool · 8 scenes (Casey's curiosity arc)
  6. Race to the Lighthouse · 8 scenes (Ray reconsiders winning)
  7. Captain for a Day · 8 scenes (you steer the cay)
  8. Friendship Fix-It · 8 scenes (Frankie + Billy lunch fight)
  9. Surprise Birthday at Camp · 8 scenes (secret party for Casey)
  10. Beach Cleanup Heroes · 8 scenes (turtle-saving teamwork)
- Each scene's W.A.V.E. tagging is balanced so every quest has at
  least one choice per principle. Narrators rotate per scene to give
  variety (see `QUEST_NARRATORS_BY_SLUG`). Quiet mode works
  immediately on the new quests — narration audio can be baked
  later with `python scripts/generate_story_quest_audio.py`.
- All 10 quests flipped to `status: ready` by the seeder once their
  scenes are persisted. Admin can still flip them back to
  "coming-soon" without losing the scene data.
- 84 total scenes seeded; total quest-card surface area now ~10x.

### Sing-Along — all 10 songs generated via ElevenLabs Music
- Ran `scripts/generate_sing_along_audio.py` end-to-end. **All 10
  songs synthesized successfully**, baked to
  `/app/backend/seed_assets/sing_along/<slug>.mp3` (6.9 MB total),
  and each row in `sing_along_songs` patched with the public
  `audio_url`.
- Per-song durations: 60s anthem ("Catch the W.A.V.E.") + 45s for
  most + 40s for cheer/welcome songs + 50s finale ("The W.A.V.E.
  Promise"). Average ~700 KB each.
- Gallery shows 10 playable cards with no Lock badges; clicking
  Play → sticky "Now Playing" panel with scrolling lyrics + native
  controls. 11 backend pytest still green.

### Asset list (committed for production deploy)
- `/app/backend/seed_assets/sing_along/*.mp3` (10 files, 6.9 MB)
- Existing `seed_assets/story_quest/*.mp3` for narration of quest 1
- Both seed paths import on backend startup; production is fully
  self-contained — zero ElevenLabs cost going forward.


## What's been implemented (2026-02-23 — Karaoke sing-along + Printify keys)
### Real karaoke (line-by-line highlighting)
- `SingAlong.jsx` rewritten:
  - **Player is now a full-screen sheet** (was a tiny corner modal) —
    works on mobile (375px), tablet (768px), and desktop. Header band
    matches the song's character color, big play/skip/skip controls,
    native audio controls, ESC + click-outside to close.
  - **Karaoke line highlighting**: lyrics parsed into timed lines.
    Active line is rendered 2x bigger + bold + in the character's
    color; past lines fade to grey at 50%; upcoming lines are
    visible but greyed. Auto-scrolls the active line into center on
    each step. `aria-live="polite"` for accessibility.
  - LRC support: if a song row has `lyrics_lrc` (`[mm:ss.xx]Line` format),
    parser uses those timestamps. Otherwise it equally spaces the
    plain lyrics across the audio duration with a small intro/outro
    pad (~12% / 10%).
  - Skip-back / skip-forward jump between songs without closing the
    player — turns the page into an actual playlist experience.
- `CookieBanner` + `PopupSignup` both suppressed on `/sing-along` and
  `/story-quest` so they never block the karaoke experience.

### All 10 sing-along songs regenerated (sung-first, fast)
- Rewrote every lyric to be **shorter, repetitive, and chant-style**
  (e.g. "Catch the wave, catch the wave! C-A-T-C-H the wave!").
  Each lyric repeats its hook 2-3 times so kids learn it on first play.
- Rewrote every `music_prompt` with explicit directives:
  `FULLY SUNG ALL THE WAY THROUGH — no instrumental gaps.`,
  exact BPM (118-144 BPM for all except the closing anthem at 96 BPM),
  `Lead: a single playful boy voice... + a kids' group shouting...`,
  `Every lyric line is sung once and the chorus repeats twice.`
- Tempos: Catch the W.A.V.E. 128 · Camp Song 120 · Myrtle 110 · Ray 140 ·
  Welcome 118 · Casey 132 · Louie 124 · Sally 100 · Ollie 144 · Promise 96.
- Regenerated all 10 MP3s via the existing script. Old MP3s wiped.

### Printify API key wired
- Saved `PRINTIFY_API_KEY` + `PRINTIFY_SHOP_ID=27540836` (Etsy shop
  "My Etsy Store") to `/app/backend/.env`. Verified token works via
  `/v1/shops.json`. Awaiting product/design/pricing decisions from
  user before building the admin Printify UI + product creators.

### Mobile/Tablet/PC responsive audit
- Finale button grid: was `lg:grid-cols-5` (cramped) → now
  `grid-cols-1 sm:grid-cols-2` with the "See my badges" CTA spanning
  full width on the second row.
- All new Story Quest gallery + sing-along grid components use
  `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`.
- Player sheet uses `max-h-[calc(100dvh - 24px)]` so it never
  overflows on small viewports — lyrics get a flex-1 overflow-y-auto
  area with the controls pinned to the bottom.

### Fixed
- Removed a duplicate scene_number=11 in First Day of Camp that
  test_scenes_returns_12 was failing on. 17/17 backend pytest pass.


## What's been implemented (2026-02-23 — Karaoke sync via forced alignment)
### "highlight moves faster than song" → fixed
- Root cause: equal-spacing the lyrics across the audio duration
  doesn't match when the model adds an intro (Sally's Quiet Song
  started vocals at 11.02s; the equal-space heuristic was assuming
  ~4s pad).
- New script `/app/backend/scripts/align_sing_along_lyrics.py`:
  - Loads each baked MP3 from `seed_assets/sing_along/`
  - Calls **ElevenLabs Forced Alignment** (`client.forced_alignment.create`)
    with the lyrics
  - Walks the returned word-level timestamps and snaps each lyric
    line to the timestamp of its first matching word (fuzzy 3-char
    fallback if exact match fails)
  - Writes the LRC string (`[mm:ss.xx]Line`) to
    `sing_along_songs.lyrics_lrc`
- Ran across all 10 songs. Real intro times now baked into the DB —
  examples: catch-the-wave 0.10s, ms-bluegill's welcome 4.12s,
  sally's quiet song 11.02s, the-wave-promise 1.98s.
- `SingAlong.jsx` was already wired to prefer `lyrics_lrc` when
  present, so the fix takes effect immediately with zero frontend
  changes. Verified at multiple timestamps — line highlight now lags
  through the intro and changes when the vocal actually does.
- Auto-alignment now hooked into `generate_sing_along_audio.py` so
  any future re-bake (e.g. after a prompt tweak) immediately runs
  alignment and persists the LRC. Idempotent.

### Cleanup
- Test residue from reorder test corrupted `first-day-of-camp` scene

## What's been implemented (2026-02-23 — Theme song on finale)
### Matched Sea Star's theme song plays at quest finale
- Extracted the karaoke player to a reusable component at
  `/app/frontend/src/components/SongPlayer.jsx` (exports default
  `SongPlayer` + named `parseLyricsToTimedLines`, `characterColor`).
  Accepts an optional `subtitle` prop (rendered in the header band).
- `SingAlong.jsx` refactored to consume the shared component (no
  behavior change, ~150 fewer lines).
- `StoryQuest.jsx` Finale now:
  1. Fetches `/sing-along/songs` once the matched character resolves
  2. Picks the song where `character_focus === primaryMatchedSlug`
     (falls back to the "all" anthem if the character has no theme
     song yet)
  3. Renders **"🎵 Sing &lt;Name&gt;'s theme song"** CTA inside the
     matched-character card (data-testid="quest-theme-song-cta"),
     styled with a teal→green gradient to feel distinct from share/postcard
  4. Click → opens the full karaoke player with the subtitle "&lt;Name&gt;'s
     theme song" — same LRC-synced highlighting as `/sing-along`
- Smoke verified: complete quest as Tessa → Ms Bluegill match → CTA
  reads "Sing Ms Bluegill's theme song" → player opens with
  "MS BLUEGILL'S THEME SONG" header, "Stingray, Stingray, Stingray
  Cay!" lit up, audio at 0:01/0:39. 17/17 backend pytest passing.

  numbering (14 rows, duplicated 9/11/12). Wiped and re-seeded
  cleanly. 17/17 backend pytest passing again.



## What's been implemented (2026-02-24 — +10 songs + Admin Sing-Along + uploaders)
### 10 NEW upbeat ElevenLabs Music songs (total = 20)
- Brand-new sing-alongs: Splash Splash Splash, Stomp Clap Cay, I Am a Sea
  Star, Sandcastle Stomp, High Five the Sky, Shake the Shells, Race the
  Tide, Dance the Cay, Sea Star Power, Campfire Clap-Along.
- All 20 songs verified: `audio_url` populated, `lyrics_lrc` populated
  (forced-alignment via ElevenLabs).
- MP3s saved under both `/app/backend/seed_assets/sing_along/` (for prod
  seed) and `/app/backend/uploads/sing_along/` (preview).

### Admin Sing-Along page (new)
- `/app/frontend/src/pages/admin/AdminSingAlong.jsx` — full CRUD list with
  drag-handle reorder (arrow up/down), active-toggle dot, slug+duration
  display, Aligned badge, re-align button, edit modal (incl. cover
  ImageUploader, lyrics, music_prompt, LRC), delete confirm.
- "Generate from prompt" modal — title + slug + theme + character_focus
  + duration + cover uploader + 3 quick-pick style presets (Upbeat kids
  pop / Beachy acoustic / Marching parade) + lyrics textarea. Submits to
  the new endpoint and inserts a fully-aligned song.
- Sidebar nav: added `Sing-Along` (Music2 icon) to `AdminLayout.jsx`.
- Route: `/admin/sing-along` added to `App.js`.

### Admin Story Quest — cover uploaders
- AdminStoryQuest now lists all 10 quests with an `ImageUploader` for
  each `hero_image_url` (used on the public quest gallery card).
- Scene editor: `background_image_url` text input replaced with the
  same `ImageUploader` (uploads through `/admin/media/upload`).

### Backend
- `sing_along_router.py`:
  - `POST /api/admin/sing-along/generate` — composes audio via
    ElevenLabs Music, saves MP3 to uploads + seed_assets + Object
    Storage, runs forced-alignment to build LRC, inserts the song.
  - `POST /api/admin/sing-along/songs/{id}/regenerate-alignment` —
    re-runs forced alignment on an existing song's MP3.
- `story_quest_router.py`:
  - `GET /api/admin/story-quest/quests` — list with scene counts.
  - `PATCH /api/admin/story-quest/quests/{id}` — update title/blurb/
    `hero_image_url`/theme_color/character_focus/position/status/active.

### Testing
- /app/backend/tests/test_sing_along_admin.py — 8/8 pytest passing
  (public list, admin list/patch/create/delete, regen-alignment status,
  story-quest quests list + patch).
- Frontend smoke: admin login → /admin/sing-along renders 20 rows with
  "Aligned" badges + Generate-from-prompt modal opens with all fields,
  preset chips populate prompt, edit modal shows cover uploader.
- /admin/story-quest "Quest covers" section renders 10 ImageUploaders,
  scene editor uses ImageUploader for background image.
- Public /sing-along renders all 20 cards; karaoke highlighting works
  on the new songs (verified Splash Splash Splash).

### Pending
- Printify Etsy storefront UI + product endpoints — awaiting product
  list from owner.
- Family room dance-party CTA / social-proof string on Finale (P2).
- Admin auto-saving star toggle, campus-tour glow map (P3).
- Daily Streak Tracker, Camp Counselor Leaderboard (P3).
- Refactor StoryQuest.jsx (~1000 lines) into Splash/Recap/Postcard
  sub-components (P3).


## What's been implemented (2026-02-24 — AI cover art with the actual Sea Stars)
### Generate cover art (Nano Banana, character-anchored)
- New `/app/backend/cover_art_service.py` — wraps Gemini Nano Banana
  (gemini-3.1-flash-image-preview) with character portraits passed as
  reference images via `UserMessage.file_contents=[ImageContent(b64)]`,
  so generated covers ALWAYS feature the actual Sea Stars — not
  generic beach art. Strong "no text in image" system prompt.
- Saves PNG to `/app/backend/uploads/covers/{sing_along|story_quest}/<slug>-<hash>.png`
  with a unique hash suffix so browser cache picks up the regenerated
  image. Also pushed to persistent Object Storage.

### New endpoints
- `POST /api/admin/sing-along/songs/{id}/generate-cover` — composes
  cover from song's character_focus + theme; patches `cover_image_url`.
- `POST /api/admin/story-quest/quests/{id}/generate-cover` — same for
  quest hero images using `character_focus + blurb`.

### Admin UI
- `AdminSingAlong.jsx` — orange image icon on every song row.
- `AdminStoryQuest.jsx` — "Generate cover art" pill under each quest
  uploader.
- Owner can still delete (X) and re-upload a custom cover anytime.

### Bug fix
- `sing_along_router.admin_patch` was using `body.model_dump()` which
  included Pydantic defaults; PATCH `{theme:"x"}` clobbered slug, title,
  audio_url, lyrics_lrc to empty strings. Fixed to
  `model_dump(exclude_unset=True)`. Restored two affected seed songs
  (`catch-the-wave`, `stingray-key-camp-song`) and re-ran forced
  alignment.

### Verified
- Cover art smoke test: Myrtle's Kindness Song → green sea turtle in
  adventurer's vest on a sunny beach (picture-book watercolor).
- Lost Sea Glass Treasure quest → blue/white manta ray (Ray) on beach
  with treasure chest, no text.
- All 8/8 sing-along admin tests passing.
- 20 sing-along songs intact: 100% audio_url + lyrics_lrc.

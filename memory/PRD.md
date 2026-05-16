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

## What's been implemented (2026-05-16, pass 7 – persistent media storage)
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
- Lightbox + pinch-zoom for sample-pages carousel.
- "Hear my voice" audio per character.
- Spot-the-Difference scene assets.
- Cross-product cart / multi-Printify order helper.
- Rich-text WYSIWYG (currently JSON for pages / plain textarea for products).
- Auto-saving star toggle on products dashboard (P3 polish).
- Campus-tour glow for earned badges on the Map (P3 polish).

## Next tasks
1. Bulk PDF folder upload UI for printables.
2. Variants editor UI in product editor.
3. Sitemap.xml + robots.txt + structured data.
4. Replace placeholder character portraits when user uploads real JPEGs.
5. Plug in real `RESEND_API_KEY` and click Retry on any queued emails.

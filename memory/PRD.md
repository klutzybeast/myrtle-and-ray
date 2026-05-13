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

## Prioritized backlog
**P1 (next pass)**
- Build the 8 activity games (Memory Match, Spot the Difference, Coloring
  canvas, Word Search, Quiz w/ result mapping, Rhyme Time, Maze, Sticker
  Beach drag-drop).
- Bulk PDF folder upload UI (server already accepts).
- Per-download analytics (totals, week/month, audience breakdown).
- Wave-badge tracking + dedicated "My Wave Badges" page.
- Audio ambient loop + UI tap pop sounds.
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

## Next tasks
1. Build P1 activity games and badge tracking.
2. Add per-download analytics dashboard widgets.
3. Replace placeholder character portraits when user uploads the real
   JPEGs (use Admin → Media + Admin → Characters).
4. Plug in real `RESEND_API_KEY` and click Retry on any queued emails.

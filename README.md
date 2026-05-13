# Myrtle and Ray and the First Day of Camp — Marketing & Merchandise Site

A full-stack site for the rhyming picture book "Myrtle and Ray and the First Day of Camp."
Public storefront, downloads library, eight (placeholder) activities, and a full admin backend.

## Stack

- **Backend:** FastAPI + MongoDB (Motor) + JWT auth (bcrypt) + Resend (optional)
- **Frontend:** React + React Router + Tailwind + shadcn/ui + sonner toasts

## Quick start

Services run under supervisor. After cloning:

```
sudo supervisorctl restart backend frontend
```

Backend will run on :8001 (proxied through `/api`).
Frontend uses `REACT_APP_BACKEND_URL` from `/app/frontend/.env`.

## Admin

- URL: `/admin/login`
- **Email:** `community@rollingriver.com`
- **Password:** `Camp1993!`

To change credentials, edit `/app/backend/.env` (`ADMIN_EMAIL`, `ADMIN_PASSWORD`) and restart backend — the seed will update the hash on next start, OR sign in and use the change-password endpoint.

## Email routing (defaults)

All outgoing emails default to `community@rollingriver.com`. Edit each individually in **Admin → Site & Email Settings**. Reply-to is always `community@rollingriver.com` so any reply lands in the community inbox.

If `RESEND_API_KEY` is empty in `/app/backend/.env`, emails are queued to MongoDB (`email_outbox` collection) with `status=pending` and surfaced in **Admin → Email Outbox**. Add the key, restart backend, and click **Retry** on any pending email to send.

```
RESEND_API_KEY=re_xxxxxxxxxxxxx
RESEND_FROM_EMAIL=hello@myrtleandray.com   # must be on a domain you have verified in Resend
RESEND_REPLY_TO=community@rollingriver.com
```

## Where to swap in real assets

| Asset | Where |
| --- | --- |
| Character portraits (the 13 JPEGs) | **Admin → Characters → Edit → Image URL.** Upload via **Admin → Media Library** first, then paste the copied URL. Filenames from the brief (with trailing spaces) are stored as `original_filename` for reference. |
| Book cover / hero image | **Admin → Pages → `homepage_hero` → JSON content** (`background_image`, `book_cover`). |
| Sample pages / Read-Aloud video | **Admin → Pages → `read_aloud` → `video_url`** (paste a YouTube/Vimeo embed URL). |
| Real Printify product URLs | **Admin → Products → Edit → Printify Buy Now URL**. Variant-level URLs available too. |
| Real product photos | **Admin → Products → Edit → Primary image / Images**. |
| Author photos | **Admin → Pages → `about` → `authors[].image`**. |

## Bulk PDF upload

**Admin → Media Library** supports drag-and-drop of any number of PDFs/images/ZIPs. Each upload gets:
- a public URL
- auto-detected page count (PDFs)
- auto-detected dimensions (images)

To attach uploaded PDFs to a Download, open **Admin → Downloads → Edit** and paste the URL into the **Files** JSON list.

## Stingray Cay character roster (seeded)

13 characters seeded with exact bios from the brief and `original_filename` preserved so the admin can match uploads later. Placeholder portraits are used until you upload the real JPEGs.

## What's deferred to a future pass (P1)

The 8 activities currently show a friendly "coming soon" modal that lets visitors claim a Wave Badge. The actual game logic (Memory Match, Spot the Difference, Coloring canvas, Word Search, Quiz, Rhyme Time, Maze, Sticker Beach) is on the P1 list. All content for those activities is already editable in **Admin → Activities**.

## Important env vars

`/app/backend/.env`:
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=myrtle_and_ray
JWT_SECRET=<random 64 chars>
ADMIN_EMAIL=community@rollingriver.com
ADMIN_PASSWORD=Camp1993!
RESEND_API_KEY=
RESEND_FROM_EMAIL=hello@myrtleandray.com
RESEND_REPLY_TO=community@rollingriver.com
UPLOAD_DIR=/app/backend/uploads
MAX_UPLOAD_MB=25
```

`/app/frontend/.env`:
```
REACT_APP_BACKEND_URL=https://<your-preview-host>
```

## Credits

- Book: *Myrtle and Ray and the First Day of Camp*
- Authors: Marissa Allaben & Alison Rothenberg
- Editor: Brian Stein
- Publisher: KingApe Media

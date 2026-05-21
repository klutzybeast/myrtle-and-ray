"""Public API endpoints (no auth)."""
from __future__ import annotations
import os
import uuid
from datetime import datetime, timezone
from typing import Optional, List
from xml.sax.saxutils import escape as _xml_escape

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel, EmailStr

from email_service import queue_email


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class ContactBody(BaseModel):
    name: str
    email: EmailStr
    subject: str = ""
    message: str = ""


class WholesaleBody(BaseModel):
    name: str
    camp_name: str = ""
    email: EmailStr
    phone: str = ""
    quantity: str = ""
    order_date: str = ""
    message: str = ""


class SignupBody(BaseModel):
    email: EmailStr
    name: str = ""
    source: str = "signup"
    audience: str = ""
    tags: List[str] = []


class DownloadCaptureBody(BaseModel):
    name: str
    email: EmailStr
    audience: str = ""
    download_slug: str
    download_title: str = ""
    subscribe: bool = True


class ChatBody(BaseModel):
    name: str = ""
    email: EmailStr
    message: str
    page: str = ""


def _parse_urls(urls_field, fallback_single):
    """Accept list, multi-line string, or comma-separated string. Returns list[str]."""
    if isinstance(urls_field, list):
        out = [u.strip() for u in urls_field if isinstance(u, str) and u.strip()]
    elif isinstance(urls_field, str) and urls_field.strip():
        out = [u.strip() for u in urls_field.replace(",", "\n").splitlines() if u.strip()]
    else:
        out = []
    if not out and isinstance(fallback_single, str) and fallback_single.strip():
        out = [fallback_single.strip()]
    return out


def make_public_router(db):
    router = APIRouter(tags=["public"])

    def _site_origin() -> str:
        # Prefer explicit env var; fall back to PUBLIC_SITE_URL or empty.
        return (os.environ.get("PUBLIC_SITE_URL") or "https://myrtleandray.com").rstrip("/")

    @router.get("/sitemap.xml")
    @router.head("/sitemap.xml")
    async def sitemap_xml():
        origin = _site_origin()
        urls: list[tuple[str, str, str]] = []  # (loc, changefreq, priority)
        static = [
            ("/", "weekly", "1.0"),
            ("/story", "weekly", "0.9"),
            ("/map", "weekly", "0.7"),
            ("/activities", "weekly", "0.8"),
            ("/wave-badges", "monthly", "0.5"),
            ("/read-aloud", "monthly", "0.6"),
            ("/shop", "weekly", "0.9"),
            ("/downloads", "weekly", "0.9"),
            ("/for-camps", "monthly", "0.8"),
            ("/about", "monthly", "0.5"),
            ("/contact", "monthly", "0.4"),
        ]
        for path, freq, pri in static:
            urls.append((f"{origin}{path}", freq, pri))

        async for p in db.products.find({"published": True}, {"_id": 0, "slug": 1, "updated_at": 1}):
            urls.append((f"{origin}/shop/{p['slug']}", "weekly", "0.8"))
        async for d in db.downloads.find({"published": True}, {"_id": 0, "slug": 1, "updated_at": 1}):
            urls.append((f"{origin}/downloads/{d['slug']}", "monthly", "0.7"))
        async for c in db.custom_pages.find({"published": True}, {"_id": 0, "slug": 1, "updated_at": 1}):
            urls.append((f"{origin}/p/{c['slug']}", "monthly", "0.6"))

        body = ['<?xml version="1.0" encoding="UTF-8"?>',
                '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
        for loc, freq, pri in urls:
            body.append("  <url>")
            body.append(f"    <loc>{_xml_escape(loc)}</loc>")
            body.append(f"    <changefreq>{freq}</changefreq>")
            body.append(f"    <priority>{pri}</priority>")
            body.append("  </url>")
        body.append("</urlset>")
        return Response(content="\n".join(body), media_type="application/xml")

    @router.get("/robots.txt")
    async def robots_txt():
        origin = _site_origin()
        body = (
            "User-agent: *\n"
            "Allow: /\n"
            "Allow: /api/sitemap.xml\n"
            "Allow: /api/uploads/\n"
            "Disallow: /admin\n"
            "Disallow: /api/admin\n"
            "Disallow: /api/auth\n"
            f"\nSitemap: {origin}/api/sitemap.xml\n"
        )
        return Response(content=body, media_type="text/plain")

    @router.get("/site")
    async def site_settings():
        s = await db.settings.find_one({"_id": "settings"}, {"_id": 0}) or {}
        public = {
            "site_name": s.get("site_name", "Myrtle and Ray"),
            "tagline": s.get("tagline", "Catch the W.A.V.E. of Excitement"),
            "logo_url": s.get("logo_url", ""),
            "favicon_url": s.get("favicon_url", ""),
            "amazon_book_url": s.get("amazon_book_url", ""),
            "printify_popup_url": s.get("printify_popup_url", ""),
            "press_email": s.get("press_email", ""),
            "primary_contact_email": s.get("primary_contact_email", ""),
            "facebook_url": s.get("facebook_url", ""),
            "instagram_url": s.get("instagram_url", ""),
            "tiktok_url": s.get("tiktok_url", ""),
            "youtube_url": s.get("youtube_url", ""),
            "pinterest_url": s.get("pinterest_url", ""),
            "twitter_url": s.get("twitter_url", ""),
            "threads_url": s.get("threads_url", ""),
            "linkedin_url": s.get("linkedin_url", ""),
            "custom_socials": s.get("custom_socials", []),
            "footer_text": s.get("footer_text", ""),
            "google_analytics_id": s.get("google_analytics_id", ""),
            "meta_pixel_id": s.get("meta_pixel_id", ""),
            "email_gate_enabled": s.get("email_gate_enabled", True),
            "ambient_audio_url": s.get("ambient_audio_url", ""),
            "ambient_audio_urls": _parse_urls(s.get("ambient_audio_urls"), s.get("ambient_audio_url")),
            "og_image_default": s.get("og_image_default", ""),
            "seo_title_default": s.get("seo_title_default", ""),
            "meta_description_default": s.get("meta_description_default", ""),
        }
        return public

    @router.get("/characters")
    async def list_characters():
        return await db.characters.find({}, {"_id": 0}).sort("order", 1).to_list(200)

    @router.get("/characters/{slug}")
    async def get_character(slug: str):
        ch = await db.characters.find_one({"slug": slug}, {"_id": 0})
        if not ch:
            raise HTTPException(status_code=404, detail="Character not found")
        return ch

    @router.get("/media/download/{media_id}")
    async def download_media(media_id: str):
        import os
        import storage as _storage
        m = await db.media.find_one({"id": media_id}, {"_id": 0})
        if not m:
            raise HTTPException(status_code=404, detail="Not found")
        upload_dir = os.environ.get("UPLOAD_DIR", "/app/backend/uploads")
        url = m.get("url", "")
        filename_on_disk = url.rsplit("/", 1)[-1]
        full_path = os.path.join(upload_dir, filename_on_disk)
        download_name = m.get("filename") or filename_on_disk
        mime = m.get("mime") or "application/octet-stream"

        # Fall back to persistent storage if the local copy was wiped by a redeploy.
        if not os.path.exists(full_path):
            fetched = _storage.get_object(filename_on_disk)
            if fetched is None:
                raise HTTPException(status_code=404, detail="File missing")
            data, ct = fetched
            try:
                tmp_path = f"{full_path}.{os.getpid()}.part"
                os.makedirs(os.path.dirname(full_path) or upload_dir, exist_ok=True)
                with open(tmp_path, "wb") as fh:
                    fh.write(data)
                os.replace(tmp_path, full_path)
            except Exception:
                # Last-resort: stream from memory with the download filename
                from fastapi.responses import Response
                return Response(
                    content=data,
                    media_type=mime or ct or "application/octet-stream",
                    headers={"Content-Disposition": f'attachment; filename="{download_name}"'},
                )

        return FileResponse(
            full_path,
            filename=download_name,
            media_type=mime,
            content_disposition_type="attachment",
        )

    @router.get("/pages/{key}")
    async def get_page(key: str):
        p = await db.pages.find_one({"key": key}, {"_id": 0})
        if not p:
            raise HTTPException(status_code=404, detail="Page not found")
        return p

    @router.get("/pages")
    async def list_pages():
        return await db.pages.find({}, {"_id": 0}).to_list(200)

    @router.get("/custom-pages")
    async def list_custom_pages():
        return await db.custom_pages.find({"published": True}, {"_id": 0}).sort("created_at", -1).to_list(200)

    @router.get("/custom-pages/{slug}")
    async def get_custom_page(slug: str):
        p = await db.custom_pages.find_one({"slug": slug, "published": True}, {"_id": 0})
        if not p:
            raise HTTPException(status_code=404, detail="Page not found")
        return p

    @router.get("/products")
    async def list_products(
        category: Optional[str] = None,
        character: Optional[str] = None,
        featured: Optional[bool] = None,
        sort: str = "featured",
        q: Optional[str] = None,
    ):
        query: dict = {"published": True}
        if category and category.lower() != "all":
            query["category"] = category
        if character:
            query["character_slug"] = character
        if featured is not None:
            query["featured"] = featured
        if q:
            query["$or"] = [
                {"name": {"$regex": q, "$options": "i"}},
                {"short_description": {"$regex": q, "$options": "i"}},
                {"tags": {"$regex": q, "$options": "i"}},
            ]
        cursor = db.products.find(query, {"_id": 0})
        if sort == "price_asc":
            cursor = cursor.sort("price", 1)
        elif sort == "price_desc":
            cursor = cursor.sort("price", -1)
        elif sort == "newest":
            cursor = cursor.sort("created_at", -1)
        else:
            cursor = cursor.sort([("featured", -1), ("created_at", -1)])
        return await cursor.to_list(500)

    @router.get("/products/{slug}")
    async def get_product(slug: str):
        p = await db.products.find_one({"slug": slug, "published": True}, {"_id": 0})
        if not p:
            raise HTTPException(status_code=404, detail="Product not found")
        related = await db.products.find(
            {
                "$and": [
                    {"slug": {"$ne": slug}},
                    {"published": True},
                    {"$or": [{"category": p.get("category")}, {"character_slug": p.get("character_slug")}]},
                ]
            },
            {"_id": 0},
        ).limit(6).to_list(6)
        return {"product": p, "related": related}

    @router.get("/download-categories")
    async def list_download_categories():
        # Forgiving filter: only hide categories explicitly marked visible:false.
        # Legacy docs without the field will still appear.
        return await db.download_categories.find({"visible": {"$ne": False}}, {"_id": 0}).sort("order", 1).to_list(200)

    @router.get("/downloads")
    async def list_downloads(
        category: Optional[str] = None,
        character: Optional[str] = None,
        audience: Optional[str] = None,
        wave: Optional[str] = None,
        featured: Optional[bool] = None,
        sort: str = "newest",
        q: Optional[str] = None,
    ):
        query: dict = {"published": True}
        if category and category.lower() != "all":
            query["category_slugs"] = category
        if character:
            query["character_slug"] = character
        if audience and audience.lower() != "all":
            query["audiences"] = audience
        if wave:
            query["wave_values"] = wave
        if featured is not None:
            query["featured"] = featured
        if q:
            query["$or"] = [
                {"title": {"$regex": q, "$options": "i"}},
                {"short_description": {"$regex": q, "$options": "i"}},
                {"tags": {"$regex": q, "$options": "i"}},
            ]
        cursor = db.downloads.find(query, {"_id": 0})
        if sort == "most_downloaded":
            cursor = cursor.sort("total_downloads", -1)
        elif sort == "alphabetical":
            cursor = cursor.sort("title", 1)
        else:
            cursor = cursor.sort("created_at", -1)
        return await cursor.to_list(500)

    @router.get("/downloads/{slug}")
    async def get_download(slug: str):
        d = await db.downloads.find_one({"slug": slug, "published": True}, {"_id": 0})
        if not d:
            raise HTTPException(status_code=404, detail="Download not found")
        related = await db.downloads.find(
            {
                "$and": [
                    {"slug": {"$ne": slug}},
                    {"published": True},
                    {"$or": [
                        {"category_slugs": {"$in": d.get("category_slugs", [])}},
                        {"character_slug": d.get("character_slug")},
                    ]},
                ]
            },
            {"_id": 0},
        ).limit(6).to_list(6)
        return {"download": d, "related": related}

    @router.post("/downloads/{slug}/track")
    async def track_download(slug: str):
        await db.downloads.update_one({"slug": slug}, {"$inc": {"total_downloads": 1}})
        return {"ok": True}

    @router.get("/activities/{key}")
    async def get_activity(key: str):
        a = await db.activity_content.find_one({"key": key}, {"_id": 0})
        if not a:
            raise HTTPException(status_code=404, detail="Activity not found")
        return a

    @router.get("/activities")
    async def list_activities():
        return await db.activity_content.find({}, {"_id": 0}).to_list(50)

    @router.post("/contact")
    async def contact(body: ContactBody):
        doc = {
            "id": str(uuid.uuid4()),
            "type": "contact",
            "name": body.name,
            "email": str(body.email).lower(),
            "subject": body.subject,
            "message": body.message,
            "read": False,
            "created_at": _now(),
        }
        await db.submissions.insert_one(dict(doc))
        settings = await db.settings.find_one({"_id": "settings"}, {"_id": 0}) or {}
        await queue_email(
            db,
            to=settings.get("contact_form_email", "community@rollingriver.com"),
            subject=f"Contact form: {body.subject or 'New message'}",
            html=f"<p><b>From:</b> {body.name} &lt;{body.email}&gt;</p><p><b>Subject:</b> {body.subject}</p><p>{body.message}</p>",
            purpose="contact",
        )
        return {"ok": True}

    @router.post("/wholesale")
    async def wholesale(body: WholesaleBody):
        doc = {
            "id": str(uuid.uuid4()),
            "type": "wholesale",
            "name": body.name,
            "camp_name": body.camp_name,
            "email": str(body.email).lower(),
            "phone": body.phone,
            "quantity": body.quantity,
            "order_date": body.order_date,
            "message": body.message,
            "read": False,
            "created_at": _now(),
        }
        await db.submissions.insert_one(dict(doc))
        settings = await db.settings.find_one({"_id": "settings"}, {"_id": 0}) or {}
        await queue_email(
            db,
            to=settings.get("wholesale_email", "community@rollingriver.com"),
            subject=f"Wholesale inquiry from {body.camp_name or body.name}",
            html=f"<p><b>Camp:</b> {body.camp_name}</p><p><b>Contact:</b> {body.name} &lt;{body.email}&gt;</p><p><b>Phone:</b> {body.phone}</p><p><b>Quantity:</b> {body.quantity}</p><p><b>Needed by:</b> {body.order_date}</p><p>{body.message}</p>",
            purpose="wholesale",
        )
        return {"ok": True}

    @router.post("/mailing-list")
    async def mailing_list_signup(body: SignupBody):
        email = str(body.email).lower()
        existing = await db.mailing_list.find_one({"email": email})
        if existing:
            await db.mailing_list.update_one(
                {"email": email},
                {"$addToSet": {"tags": {"$each": body.tags}}, "$set": {"name": body.name or existing.get("name", "")}},
            )
        else:
            await db.mailing_list.insert_one({
                "id": str(uuid.uuid4()),
                "email": email,
                "name": body.name,
                "source": body.source,
                "audience": body.audience,
                "tags": body.tags,
                "created_at": _now(),
            })
            await queue_email(
                db,
                to=email,
                subject="Welcome to the wave!",
                html=f"<p>Hi {body.name or 'friend'},</p><p>Thanks for joining the Myrtle and Ray mailing list. We'll send the wave your way with new downloads, sneak peeks, and gentle encouragements.</p><p>- Marissa, Alison, and the Sea Stars</p>",
                purpose="mailing_list_welcome",
            )
        return {"ok": True}

    @router.post("/download-capture")
    async def download_capture(body: DownloadCaptureBody):
        email = str(body.email).lower()
        doc = {
            "id": str(uuid.uuid4()),
            "type": "download_capture",
            "name": body.name,
            "email": email,
            "audience": body.audience,
            "download_slug": body.download_slug,
            "download_title": body.download_title,
            "subscribe_to_list": body.subscribe,
            "read": False,
            "created_at": _now(),
        }
        await db.submissions.insert_one(dict(doc))
        if body.subscribe:
            existing = await db.mailing_list.find_one({"email": email})
            tag = f"download:{body.download_slug}"
            if existing:
                await db.mailing_list.update_one({"email": email}, {"$addToSet": {"tags": tag}})
            else:
                await db.mailing_list.insert_one({
                    "id": str(uuid.uuid4()),
                    "email": email,
                    "name": body.name,
                    "source": "download_capture",
                    "audience": body.audience,
                    "tags": [tag],
                    "created_at": _now(),
                })
        # No admin notification on download captures (intentional — keeps inbox light)
        return {"ok": True}

    @router.post("/chat")
    async def chat_message(body: ChatBody):
        email = str(body.email).lower()
        doc = {
            "id": str(uuid.uuid4()),
            "type": "chat",
            "name": body.name,
            "email": email,
            "subject": "Chat bubble question",
            "message": body.message,
            "page": body.page,
            "read": False,
            "created_at": _now(),
        }
        await db.submissions.insert_one(dict(doc))
        settings = await db.settings.find_one({"_id": "settings"}, {"_id": 0}) or {}
        # Reply-to set to the visitor so admin can hit reply and respond directly
        await queue_email(
            db,
            to=settings.get("contact_form_email", "community@rollingriver.com"),
            subject=f"New chat from {body.name or email}",
            html=f"<p><b>From:</b> {body.name or '(no name)'} &lt;{email}&gt;</p><p><b>Page:</b> {body.page or '/'}</p><p>{body.message}</p><p style='color:#888;font-size:12px'>Hit reply to respond directly to the visitor.</p>",
            purpose="chat",
            reply_to=email,
        )
        return {"ok": True}

    return router

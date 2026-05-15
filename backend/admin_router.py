"""Admin API endpoints (require admin auth)."""
from __future__ import annotations
import os
import uuid
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from slugify import slugify


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "/app/backend/uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ----- All body schemas at module level so FastAPI/Pydantic v2 can resolve them -----
class CharacterBody(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    species: Optional[str] = None
    role: Optional[str] = None
    bio: Optional[str] = None
    image_url: Optional[str] = None
    wave_value: Optional[str] = None
    fun_fact: Optional[str] = None
    linked_product_slug: Optional[str] = None
    audio_url: Optional[str] = None
    order: Optional[int] = None


class ProductBody(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    category: Optional[str] = None
    character_slug: Optional[str] = None
    short_description: Optional[str] = None
    long_description: Optional[str] = None
    price: Optional[float] = None
    compare_at_price: Optional[float] = None
    images: Optional[List[str]] = None
    primary_image: Optional[str] = None
    printify_url: Optional[str] = None
    variants: Optional[List[dict]] = None
    inventory_status: Optional[str] = None
    featured: Optional[bool] = None
    tags: Optional[List[str]] = None
    seo_title: Optional[str] = None
    meta_description: Optional[str] = None
    og_image: Optional[str] = None
    published: Optional[bool] = None


class BulkProductBody(BaseModel):
    slugs: List[str]
    action: str
    value: Optional[str] = None


class DlCatBody(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    icon: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    order: Optional[int] = None
    visible: Optional[bool] = None


class DownloadBody(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    category_slugs: Optional[List[str]] = None
    character_slug: Optional[str] = None
    cover_image: Optional[str] = None
    short_description: Optional[str] = None
    long_description: Optional[str] = None
    age_range: Optional[str] = None
    audiences: Optional[List[str]] = None
    wave_values: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    files: Optional[List[dict]] = None
    email_gate_override: Optional[bool] = None
    featured: Optional[bool] = None
    is_new: Optional[bool] = None
    order: Optional[int] = None
    published: Optional[bool] = None
    seo_title: Optional[str] = None
    meta_description: Optional[str] = None


class BulkDownloadBody(BaseModel):
    slugs: List[str]
    action: str
    value: Optional[str] = None


class CampaignBody(BaseModel):
    name: Optional[str] = None
    subject: Optional[str] = None
    preview_text: Optional[str] = None
    from_email: Optional[str] = None
    reply_to: Optional[str] = None
    background_color: Optional[str] = None
    content_background: Optional[str] = None
    text_color: Optional[str] = None
    accent_color: Optional[str] = None
    content_width: Optional[int] = None
    blocks: Optional[List[dict]] = None


class CampaignSendBody(BaseModel):
    recipient_emails: List[str] = []
    recipient_filter: Optional[dict] = None  # {tags, source, audience}


class CampaignTestBody(BaseModel):
    to: str


class CustomPageBody(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    blocks: Optional[List[dict]] = None
    seo_title: Optional[str] = None
    meta_description: Optional[str] = None
    hero_image: Optional[str] = None
    published: Optional[bool] = None
    show_in_footer: Optional[bool] = None


class PageBody(BaseModel):
    title: Optional[str] = None
    content: Optional[dict] = None


class MailingBody(BaseModel):
    email: str
    name: str = ""
    tags: List[str] = []


class ActivityBody(BaseModel):
    title: Optional[str] = None
    data: Optional[dict] = None


def make_admin_router(db, require_admin):
    router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])

    @router.get("/dashboard")
    async def dashboard():
        start_month = (datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)).isoformat()
        return {
            "total_products": await db.products.count_documents({}),
            "total_downloads": await db.downloads.count_documents({}),
            "page_views_month": 0,
            "recent_contacts": await db.submissions.count_documents({"type": "contact"}),
            "recent_wholesale": await db.submissions.count_documents({"type": "wholesale"}),
            "recent_mailing": await db.mailing_list.count_documents({}),
            "recent_captures": await db.submissions.count_documents({"type": "download_capture"}),
            "pending_emails": await db.email_outbox.count_documents({"status": "pending"}),
            "failed_emails": await db.email_outbox.count_documents({"status": "failed"}),
            "since": start_month,
        }

    @router.get("/analytics/downloads")
    async def analytics_downloads():
        from datetime import timedelta
        now = datetime.now(timezone.utc)
        start_week = (now - timedelta(days=7)).isoformat()
        start_month = (now - timedelta(days=30)).isoformat()
        start_today = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()

        # Total file-click downloads (sum of per-item total_downloads counters)
        total_pipeline = [{"$group": {"_id": None, "total": {"$sum": "$total_downloads"}}}]
        total_agg = await db.downloads.aggregate(total_pipeline).to_list(1)
        total_file_clicks = (total_agg[0]["total"] if total_agg else 0) or 0

        # Email captures
        captures_total = await db.submissions.count_documents({"type": "download_capture"})
        captures_week = await db.submissions.count_documents({"type": "download_capture", "created_at": {"$gte": start_week}})
        captures_month = await db.submissions.count_documents({"type": "download_capture", "created_at": {"$gte": start_month}})
        captures_today = await db.submissions.count_documents({"type": "download_capture", "created_at": {"$gte": start_today}})

        # Audience breakdown
        audience_pipeline = [
            {"$match": {"type": "download_capture"}},
            {"$group": {"_id": {"$ifNull": ["$audience", "Unspecified"]}, "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
        ]
        audience_raw = await db.submissions.aggregate(audience_pipeline).to_list(20)
        audience_breakdown = [
            {"audience": (a["_id"] or "Unspecified"), "count": a["count"]}
            for a in audience_raw
        ]

        # Top downloads (by total_downloads counter)
        top_downloads = await db.downloads.find(
            {}, {"_id": 0, "slug": 1, "title": 1, "total_downloads": 1, "cover_image": 1}
        ).sort("total_downloads", -1).limit(8).to_list(8)

        # Captures-per-download breakdown
        per_dl_pipeline = [
            {"$match": {"type": "download_capture"}},
            {"$group": {"_id": "$download_slug", "captures": {"$sum": 1}, "last_at": {"$max": "$created_at"}, "title": {"$last": "$download_title"}}},
            {"$sort": {"captures": -1}},
            {"$limit": 8},
        ]
        per_dl_raw = await db.submissions.aggregate(per_dl_pipeline).to_list(8)
        captures_by_download = [
            {"slug": d["_id"] or "", "title": d.get("title") or d["_id"] or "", "captures": d["captures"], "last_at": d.get("last_at", "")}
            for d in per_dl_raw if d["_id"]
        ]

        # Recent captures (latest 15)
        recent_raw = await db.submissions.find(
            {"type": "download_capture"},
            {"_id": 0, "name": 1, "email": 1, "audience": 1, "download_slug": 1, "download_title": 1, "created_at": 1},
        ).sort("created_at", -1).limit(15).to_list(15)

        return {
            "total_file_clicks": total_file_clicks,
            "captures_total": captures_total,
            "captures_today": captures_today,
            "captures_week": captures_week,
            "captures_month": captures_month,
            "audience_breakdown": audience_breakdown,
            "top_downloads": top_downloads,
            "captures_by_download": captures_by_download,
            "recent_captures": recent_raw,
        }

    # ---------------- Characters ----------------
    @router.get("/characters")
    async def admin_list_characters():
        return await db.characters.find({}, {"_id": 0}).sort("order", 1).to_list(200)

    @router.put("/characters/{slug}")
    async def admin_update_character(slug: str, body: CharacterBody):
        update = {k: v for k, v in body.model_dump().items() if v is not None}
        if not update:
            raise HTTPException(status_code=400, detail="Nothing to update")
        update["updated_at"] = _now()
        result = await db.characters.update_one({"slug": slug}, {"$set": update})
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Not found")
        return await db.characters.find_one({"slug": slug}, {"_id": 0})

    @router.post("/characters")
    async def admin_create_character(body: CharacterBody):
        if not body.name:
            raise HTTPException(status_code=400, detail="Name required")
        slug = body.slug or slugify(body.name)
        if await db.characters.find_one({"slug": slug}):
            raise HTTPException(status_code=400, detail="Slug exists")
        doc = body.model_dump()
        doc.update({"id": slug, "slug": slug, "is_core": False, "order": 999, "created_at": _now(), "updated_at": _now()})
        await db.characters.insert_one(dict(doc))
        doc.pop("_id", None)
        return doc

    @router.delete("/characters/{slug}")
    async def admin_delete_character(slug: str):
        ch = await db.characters.find_one({"slug": slug})
        if not ch:
            raise HTTPException(status_code=404, detail="Not found")
        if ch.get("is_core"):
            raise HTTPException(status_code=400, detail="Cannot delete core character")
        await db.characters.delete_one({"slug": slug})
        return {"ok": True}

    # ---------------- Products ----------------
    @router.get("/products")
    async def admin_list_products(q: Optional[str] = None, category: Optional[str] = None):
        query: dict = {}
        if q:
            query["$or"] = [{"name": {"$regex": q, "$options": "i"}}, {"slug": {"$regex": q, "$options": "i"}}]
        if category and category != "All":
            query["category"] = category
        return await db.products.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)

    @router.post("/products")
    async def admin_create_product(body: ProductBody):
        if not body.name:
            raise HTTPException(status_code=400, detail="Name required")
        slug = body.slug or slugify(body.name)
        if await db.products.find_one({"slug": slug}):
            raise HTTPException(status_code=400, detail="Slug exists")
        doc = {k: v for k, v in body.model_dump().items() if v is not None}
        doc.update({"id": slug, "slug": slug, "created_at": _now(), "updated_at": _now()})
        doc.setdefault("category", "Stuffies")
        doc.setdefault("inventory_status", "In Stock")
        doc.setdefault("published", True)
        await db.products.insert_one(dict(doc))
        doc.pop("_id", None)
        return doc

    @router.put("/products/{slug}")
    async def admin_update_product(slug: str, body: ProductBody):
        update = {k: v for k, v in body.model_dump().items() if v is not None}
        update["updated_at"] = _now()
        result = await db.products.update_one({"slug": slug}, {"$set": update})
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Not found")
        return await db.products.find_one({"slug": slug}, {"_id": 0})

    @router.delete("/products/{slug}")
    async def admin_delete_product(slug: str):
        result = await db.products.delete_one({"slug": slug})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Not found")
        return {"ok": True}

    @router.post("/products/bulk")
    async def admin_bulk_products(body: BulkProductBody):
        q = {"slug": {"$in": body.slugs}}
        if body.action == "feature":
            await db.products.update_many(q, {"$set": {"featured": True}})
        elif body.action == "unfeature":
            await db.products.update_many(q, {"$set": {"featured": False}})
        elif body.action == "publish":
            await db.products.update_many(q, {"$set": {"published": True}})
        elif body.action == "unpublish":
            await db.products.update_many(q, {"$set": {"published": False}})
        elif body.action == "category" and body.value:
            await db.products.update_many(q, {"$set": {"category": body.value}})
        elif body.action == "delete":
            await db.products.delete_many(q)
        else:
            raise HTTPException(status_code=400, detail="Unknown action")
        return {"ok": True}

    # ---------------- Download categories ----------------
    @router.get("/download-categories")
    async def admin_list_dl_cats():
        return await db.download_categories.find({}, {"_id": 0}).sort("order", 1).to_list(200)

    @router.post("/download-categories")
    async def admin_create_dl_cat(body: DlCatBody):
        if not body.name:
            raise HTTPException(status_code=400, detail="Name required")
        slug = body.slug or slugify(body.name)
        if await db.download_categories.find_one({"slug": slug}):
            raise HTTPException(status_code=400, detail="Slug exists")
        doc = {k: v for k, v in body.model_dump().items() if v is not None}
        doc.update({"id": slug, "slug": slug, "visible": doc.get("visible", True), "created_at": _now()})
        await db.download_categories.insert_one(dict(doc))
        doc.pop("_id", None)
        return doc

    @router.put("/download-categories/{slug}")
    async def admin_update_dl_cat(slug: str, body: DlCatBody):
        update = {k: v for k, v in body.model_dump().items() if v is not None}
        result = await db.download_categories.update_one({"slug": slug}, {"$set": update})
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Not found")
        return await db.download_categories.find_one({"slug": slug}, {"_id": 0})

    @router.delete("/download-categories/{slug}")
    async def admin_delete_dl_cat(slug: str):
        result = await db.download_categories.delete_one({"slug": slug})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Not found")
        return {"ok": True}

    # ---------------- Downloads ----------------
    @router.get("/downloads")
    async def admin_list_downloads(q: Optional[str] = None):
        query: dict = {}
        if q:
            query["$or"] = [{"title": {"$regex": q, "$options": "i"}}, {"slug": {"$regex": q, "$options": "i"}}]
        return await db.downloads.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)

    @router.post("/downloads")
    async def admin_create_download(body: DownloadBody):
        if not body.title:
            raise HTTPException(status_code=400, detail="Title required")
        slug = body.slug or slugify(body.title)
        if await db.downloads.find_one({"slug": slug}):
            raise HTTPException(status_code=400, detail="Slug exists")
        doc = {k: v for k, v in body.model_dump().items() if v is not None}
        doc.update({"id": slug, "slug": slug, "total_downloads": 0, "created_at": _now(), "updated_at": _now()})
        doc.setdefault("published", True)
        doc.setdefault("is_new", True)
        await db.downloads.insert_one(dict(doc))
        doc.pop("_id", None)
        return doc

    @router.put("/downloads/{slug}")
    async def admin_update_download(slug: str, body: DownloadBody):
        update = {k: v for k, v in body.model_dump().items() if v is not None}
        update["updated_at"] = _now()
        result = await db.downloads.update_one({"slug": slug}, {"$set": update})
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Not found")
        return await db.downloads.find_one({"slug": slug}, {"_id": 0})

    @router.delete("/downloads/{slug}")
    async def admin_delete_download(slug: str):
        result = await db.downloads.delete_one({"slug": slug})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Not found")
        return {"ok": True}

    @router.post("/downloads/bulk")
    async def admin_bulk_downloads(body: BulkDownloadBody):
        q = {"slug": {"$in": body.slugs}}
        if body.action == "feature":
            await db.downloads.update_many(q, {"$set": {"featured": True}})
        elif body.action == "unfeature":
            await db.downloads.update_many(q, {"$set": {"featured": False}})
        elif body.action == "publish":
            await db.downloads.update_many(q, {"$set": {"published": True}})
        elif body.action == "unpublish":
            await db.downloads.update_many(q, {"$set": {"published": False}})
        elif body.action == "delete":
            await db.downloads.delete_many(q)
        else:
            raise HTTPException(status_code=400, detail="Unknown action")
        return {"ok": True}

    # ---------------- Email Campaigns ----------------
    @router.get("/campaigns")
    async def admin_list_campaigns():
        return await db.campaigns.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)

    @router.get("/campaigns/{cid}")
    async def admin_get_campaign(cid: str):
        c = await db.campaigns.find_one({"id": cid}, {"_id": 0})
        if not c:
            raise HTTPException(status_code=404, detail="Not found")
        return c

    @router.post("/campaigns")
    async def admin_create_campaign(body: CampaignBody):
        if not body.name:
            raise HTTPException(status_code=400, detail="Name required")
        cid = uuid.uuid4().hex
        doc = {k: v for k, v in body.model_dump().items() if v is not None}
        doc.update({"id": cid, "status": "draft", "total_sent": 0, "created_at": _now(), "updated_at": _now()})
        await db.campaigns.insert_one(dict(doc))
        doc.pop("_id", None)
        return doc

    @router.put("/campaigns/{cid}")
    async def admin_update_campaign(cid: str, body: CampaignBody):
        update = {k: v for k, v in body.model_dump().items() if v is not None}
        update["updated_at"] = _now()
        r = await db.campaigns.update_one({"id": cid}, {"$set": update})
        if r.matched_count == 0:
            raise HTTPException(status_code=404, detail="Not found")
        return await db.campaigns.find_one({"id": cid}, {"_id": 0})

    @router.delete("/campaigns/{cid}")
    async def admin_delete_campaign(cid: str):
        r = await db.campaigns.delete_one({"id": cid})
        if r.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Not found")
        return {"ok": True}

    @router.get("/campaigns/{cid}/preview")
    async def admin_preview_campaign(cid: str):
        c = await db.campaigns.find_one({"id": cid}, {"_id": 0})
        if not c:
            raise HTTPException(status_code=404, detail="Not found")
        from email_renderer import render_campaign_html
        settings = await db.settings.find_one({"_id": "settings"}, {"_id": 0}) or {}
        c.setdefault("site_name", settings.get("site_name", "Myrtle and Ray"))
        return {"html": render_campaign_html(c)}

    @router.post("/campaigns/{cid}/test")
    async def admin_test_send_campaign(cid: str, body: CampaignTestBody):
        c = await db.campaigns.find_one({"id": cid}, {"_id": 0})
        if not c:
            raise HTTPException(status_code=404, detail="Not found")
        from email_renderer import render_campaign_html
        from email_service import queue_email
        settings = await db.settings.find_one({"_id": "settings"}, {"_id": 0}) or {}
        c.setdefault("site_name", settings.get("site_name", "Myrtle and Ray"))
        html = render_campaign_html(c)
        await queue_email(
            db,
            to=body.to,
            subject=f"[TEST] {c.get('subject') or c.get('name', 'Campaign')}",
            html=html,
            purpose="campaign_test",
            from_email=c.get("from_email") or None,
            reply_to=c.get("reply_to") or None,
        )
        return {"ok": True}

    @router.post("/campaigns/{cid}/send")
    async def admin_send_campaign(cid: str, body: CampaignSendBody):
        c = await db.campaigns.find_one({"id": cid}, {"_id": 0})
        if not c:
            raise HTTPException(status_code=404, detail="Not found")
        from email_renderer import render_campaign_html
        from email_service import queue_email
        settings = await db.settings.find_one({"_id": "settings"}, {"_id": 0}) or {}
        c.setdefault("site_name", settings.get("site_name", "Myrtle and Ray"))

        # Resolve recipient list
        recipients = set()
        for e in (body.recipient_emails or []):
            if e:
                recipients.add(e.lower().strip())
        if body.recipient_filter:
            q = {}
            tags = body.recipient_filter.get("tags") or []
            if tags:
                q["tags"] = {"$in": tags}
            source = body.recipient_filter.get("source")
            if source:
                q["source"] = source
            audience = body.recipient_filter.get("audience")
            if audience:
                q["audience"] = audience
            async for sub in db.mailing_list.find(q, {"_id": 0, "email": 1}):
                recipients.add(sub["email"])
        if not recipients:
            raise HTTPException(status_code=400, detail="No recipients selected")

        html = render_campaign_html(c)
        subject = c.get("subject") or c.get("name") or "A note from Myrtle and Ray"
        sent = 0; failed = 0
        for email in recipients:
            try:
                await queue_email(
                    db,
                    to=email,
                    subject=subject,
                    html=html,
                    purpose=f"campaign:{cid}",
                    from_email=c.get("from_email") or None,
                    reply_to=c.get("reply_to") or None,
                )
                sent += 1
            except Exception:
                failed += 1
        await db.campaigns.update_one(
            {"id": cid},
            {"$set": {"status": "sent", "last_sent_at": _now(), "total_sent": (c.get("total_sent") or 0) + sent, "updated_at": _now()}},
        )
        return {"ok": True, "sent": sent, "failed": failed, "total_recipients": len(recipients)}

    # ---------------- Custom Pages (block builder) ----------------
    @router.get("/custom-pages")
    async def admin_list_custom_pages():
        return await db.custom_pages.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)

    @router.get("/custom-pages/{slug}")
    async def admin_get_custom_page(slug: str):
        p = await db.custom_pages.find_one({"slug": slug}, {"_id": 0})
        if not p:
            raise HTTPException(status_code=404, detail="Not found")
        return p

    @router.post("/custom-pages")
    async def admin_create_custom_page(body: CustomPageBody):
        if not body.title:
            raise HTTPException(status_code=400, detail="Title required")
        slug = body.slug or slugify(body.title)
        if await db.custom_pages.find_one({"slug": slug}):
            raise HTTPException(status_code=400, detail="Slug exists")
        doc = {k: v for k, v in body.model_dump().items() if v is not None}
        doc.update({"id": slug, "slug": slug, "blocks": doc.get("blocks", []), "created_at": _now(), "updated_at": _now()})
        doc.setdefault("published", True)
        await db.custom_pages.insert_one(dict(doc))
        doc.pop("_id", None)
        return doc

    @router.put("/custom-pages/{slug}")
    async def admin_update_custom_page(slug: str, body: CustomPageBody):
        update = {k: v for k, v in body.model_dump().items() if v is not None}
        update["updated_at"] = _now()
        result = await db.custom_pages.update_one({"slug": slug}, {"$set": update})
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Not found")
        return await db.custom_pages.find_one({"slug": slug}, {"_id": 0})

    @router.delete("/custom-pages/{slug}")
    async def admin_delete_custom_page(slug: str):
        result = await db.custom_pages.delete_one({"slug": slug})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Not found")
        return {"ok": True}

    # ---------------- Pages ----------------
    @router.get("/pages")
    async def admin_list_pages():
        return await db.pages.find({}, {"_id": 0}).to_list(200)

    @router.put("/pages/{key}")
    async def admin_update_page(key: str, body: PageBody):
        update = {k: v for k, v in body.model_dump().items() if v is not None}
        update["updated_at"] = _now()
        await db.pages.update_one({"key": key}, {"$set": update}, upsert=True)
        return await db.pages.find_one({"key": key}, {"_id": 0})

    # ---------------- Settings ----------------
    @router.get("/settings")
    async def admin_get_settings():
        return await db.settings.find_one({"_id": "settings"}, {"_id": 0}) or {}

    @router.put("/settings")
    async def admin_update_settings(body: dict):
        body["updated_at"] = _now()
        await db.settings.update_one({"_id": "settings"}, {"$set": body}, upsert=True)
        return await db.settings.find_one({"_id": "settings"}, {"_id": 0})

    # ---------------- Submissions ----------------
    @router.get("/submissions")
    async def admin_list_submissions(type: Optional[str] = None):
        query = {}
        if type:
            query["type"] = type
        return await db.submissions.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)

    @router.put("/submissions/{sub_id}/read")
    async def admin_mark_read(sub_id: str, read: bool = True):
        await db.submissions.update_one({"id": sub_id}, {"$set": {"read": read}})
        return {"ok": True}

    @router.delete("/submissions/{sub_id}")
    async def admin_delete_submission(sub_id: str):
        await db.submissions.delete_one({"id": sub_id})
        return {"ok": True}

    # ---------------- Mailing list ----------------
    @router.get("/mailing-list")
    async def admin_list_mailing():
        return await db.mailing_list.find({}, {"_id": 0}).sort("created_at", -1).to_list(5000)

    @router.post("/mailing-list")
    async def admin_add_mailing(body: MailingBody):
        email = body.email.lower().strip()
        if await db.mailing_list.find_one({"email": email}):
            raise HTTPException(status_code=400, detail="Already subscribed")
        doc = {"id": str(uuid.uuid4()), "email": email, "name": body.name, "source": "admin", "audience": "", "tags": body.tags, "created_at": _now()}
        await db.mailing_list.insert_one(dict(doc))
        doc.pop("_id", None)
        return doc

    @router.delete("/mailing-list/{sub_id}")
    async def admin_remove_mailing(sub_id: str):
        await db.mailing_list.delete_one({"id": sub_id})
        return {"ok": True}

    # ---------------- Email outbox ----------------
    @router.get("/email-outbox")
    async def admin_list_outbox(status: Optional[str] = None):
        q = {}
        if status:
            q["status"] = status
        return await db.email_outbox.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)

    @router.post("/email-outbox/{email_id}/retry")
    async def admin_retry_email(email_id: str):
        item = await db.email_outbox.find_one({"id": email_id}, {"_id": 0})
        if not item:
            raise HTTPException(status_code=404, detail="Not found")
        api_key = os.environ.get("RESEND_API_KEY", "").strip()
        if not api_key:
            raise HTTPException(status_code=400, detail="RESEND_API_KEY not set")
        try:
            import resend  # type: ignore
            resend.api_key = api_key
            resend.Emails.send({
                "from": item.get("from_email") or os.environ.get("RESEND_FROM_EMAIL", ""),
                "to": [item["to"]],
                "subject": item["subject"],
                "html": item.get("html", ""),
                "reply_to": item.get("reply_to") or os.environ.get("RESEND_REPLY_TO", ""),
            })
            await db.email_outbox.update_one({"id": email_id}, {"$set": {"status": "sent", "sent_at": _now(), "error": ""}})
            return {"ok": True, "status": "sent"}
        except Exception as exc:  # noqa: BLE001
            await db.email_outbox.update_one({"id": email_id}, {"$set": {"status": "failed", "error": str(exc)}})
            raise HTTPException(status_code=500, detail=str(exc))

    @router.delete("/email-outbox/{email_id}")
    async def admin_delete_email(email_id: str):
        await db.email_outbox.delete_one({"id": email_id})
        return {"ok": True}

    @router.post("/email-outbox/clear-sent")
    async def admin_clear_sent_emails():
        result = await db.email_outbox.delete_many({"status": "sent"})
        return {"ok": True, "deleted": result.deleted_count}

    # ---------------- Media ----------------
    @router.get("/media")
    async def admin_list_media():
        return await db.media.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)

    @router.post("/media/upload")
    async def admin_upload_media(file: UploadFile = File(...), tags: str = Form("")):
        ext = (file.filename or "upload").split(".")[-1].lower()
        allowed = {"jpg", "jpeg", "png", "webp", "pdf", "zip", "gif", "svg", "mp3", "ogg", "wav", "m4a", "aac"}
        if ext not in allowed:
            raise HTTPException(status_code=400, detail=f"File type {ext} not allowed")
        max_mb = int(os.environ.get("MAX_UPLOAD_MB", "50"))
        contents = await file.read()
        size_kb = len(contents) // 1024
        if size_kb > max_mb * 1024:
            raise HTTPException(status_code=413, detail=f"File too large (max {max_mb}MB)")
        uid = uuid.uuid4().hex
        safe_name = f"{uid}.{ext}"
        path = os.path.join(UPLOAD_DIR, safe_name)
        with open(path, "wb") as fh:
            fh.write(contents)
        page_count = 0
        width = height = 0
        if ext == "pdf":
            try:
                from pypdf import PdfReader
                reader = PdfReader(path)
                page_count = len(reader.pages)
            except Exception:
                pass
        if ext in {"jpg", "jpeg", "png", "webp", "gif"}:
            try:
                from PIL import Image
                with Image.open(path) as img:
                    width, height = img.size
            except Exception:
                pass
        url = f"/api/uploads/{safe_name}"
        doc = {
            "id": uid, "url": url, "filename": file.filename or safe_name,
            "mime": file.content_type or "", "size_kb": size_kb, "width": width, "height": height,
            "page_count": page_count, "tags": [t.strip() for t in tags.split(",") if t.strip()],
            "created_at": _now(),
        }
        await db.media.insert_one(dict(doc))
        doc.pop("_id", None)
        return doc

    @router.delete("/media/{media_id}")
    async def admin_delete_media(media_id: str):
        m = await db.media.find_one({"id": media_id})
        if not m:
            raise HTTPException(status_code=404, detail="Not found")
        path = m.get("url", "").lstrip("/")
        full = os.path.join("/app/backend", path)
        try:
            if os.path.exists(full):
                os.remove(full)
        except Exception:
            pass
        await db.media.delete_one({"id": media_id})
        return {"ok": True}

    # ---------------- Activity content ----------------
    @router.get("/activity-content")
    async def admin_list_activity():
        return await db.activity_content.find({}, {"_id": 0}).to_list(50)

    @router.put("/activity-content/{key}")
    async def admin_update_activity(key: str, body: ActivityBody):
        update = {k: v for k, v in body.model_dump().items() if v is not None}
        update["updated_at"] = _now()
        await db.activity_content.update_one({"key": key}, {"$set": update}, upsert=True)
        return await db.activity_content.find_one({"key": key}, {"_id": 0})

    return router

"""Printify integration router.

Read-only sync of products from the connected Printify shop into MongoDB
collection `printify_products`. Public endpoint serves cached products to
the Shop page. Admin endpoints handle sync + per-product overrides
(featured, hidden, etsy_url).
"""
from __future__ import annotations

import json
import logging
import os
import time
from typing import Any, List, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

log = logging.getLogger("printify")

PRINTIFY_BASE = "https://api.printify.com/v1"
DEFAULT_POPUP_URL = "https://myrtleandray.printify.me/"
PUBLIC_CACHE_TTL = 300  # 5 minutes


class PrintifyProductPublic(BaseModel):
    id: str
    title: str
    description: str = ""
    image_url: Optional[str] = None
    images: List[str] = Field(default_factory=list)
    min_price: float = 0.0  # in dollars
    max_price: float = 0.0
    currency: str = "USD"
    tags: List[str] = Field(default_factory=list)
    buy_url: str = ""
    featured: bool = False


class PrintifyAdminUpdate(BaseModel):
    featured: Optional[bool] = None
    hidden: Optional[bool] = None
    etsy_url: Optional[str] = None


class _Cache:
    def __init__(self) -> None:
        self.value: Optional[List[dict]] = None
        self.expires_at: float = 0.0

    def get(self) -> Optional[List[dict]]:
        if self.value is not None and time.time() < self.expires_at:
            return self.value
        return None

    def set(self, value: List[dict], ttl: int) -> None:
        self.value = value
        self.expires_at = time.time() + ttl

    def invalidate(self) -> None:
        self.expires_at = 0.0
        self.value = None


_public_cache = _Cache()


async def _fetch_printify_page(client: httpx.AsyncClient, shop_id: str, page: int, api_key: str) -> dict:
    headers = {
        "Authorization": f"Bearer {api_key}",
        "User-Agent": "MyrtleAndRayStorefront/1.0",
    }
    url = f"{PRINTIFY_BASE}/shops/{shop_id}/products.json?page={page}&limit=50"
    resp = await client.get(url, headers=headers, timeout=20.0)
    resp.raise_for_status()
    return resp.json()


async def _fetch_all_printify_products(shop_id: str, api_key: str) -> List[dict]:
    """Walks Printify paginated /products.json until exhausted (up to 10 pages)."""
    all_items: List[dict] = []
    async with httpx.AsyncClient() as client:
        for page in range(1, 11):
            try:
                data = await _fetch_printify_page(client, shop_id, page, api_key)
            except httpx.HTTPStatusError as e:
                log.error("printify fetch page %s failed: %s", page, e)
                raise
            items = data.get("data") or data.get("products") or []
            if not items:
                break
            all_items.extend(items)
            last_page = data.get("last_page")
            if last_page is not None and page >= int(last_page):
                break
    return all_items


def _normalize_product(raw: dict) -> dict:
    """Reduce Printify's verbose product object to the fields we store."""
    pid = str(raw.get("id") or "")
    images_full = raw.get("images") or []
    img_urls: List[str] = []
    primary_image: Optional[str] = None
    for img in images_full:
        url = img.get("src") if isinstance(img, dict) else None
        if not url:
            continue
        img_urls.append(url)
        if primary_image is None and (img.get("is_default") or img.get("is_selected_for_publishing")):
            primary_image = url
    if primary_image is None and img_urls:
        primary_image = img_urls[0]

    # Variants — pick the cheapest enabled to display as min_price
    variants = raw.get("variants") or []
    enabled_variants = [v for v in variants if v.get("is_enabled")]
    if not enabled_variants:
        enabled_variants = variants
    prices = []
    for v in enabled_variants:
        p = v.get("price")
        try:
            prices.append(int(p))
        except (TypeError, ValueError):
            continue
    min_price = (min(prices) / 100.0) if prices else 0.0
    max_price = (max(prices) / 100.0) if prices else 0.0

    tags = raw.get("tags") or []
    if not isinstance(tags, list):
        tags = []

    return {
        "id": pid,
        "title": raw.get("title") or "Untitled",
        "description": (raw.get("description") or "").strip(),
        "image_url": primary_image,
        "images": img_urls[:6],
        "min_price": min_price,
        "max_price": max_price,
        "currency": "USD",
        "tags": [str(t) for t in tags],
    }


def make_printify_router(db, require_admin):
    router = APIRouter(prefix="/printify", tags=["printify"])

    def _settings():
        api_key = os.environ.get("PRINTIFY_API_KEY")
        shop_id = os.environ.get("PRINTIFY_SHOP_ID")
        if not api_key or not shop_id:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Printify is not configured (missing PRINTIFY_API_KEY or PRINTIFY_SHOP_ID).",
            )
        return api_key, shop_id

    async def _list_synced_products() -> List[dict]:
        cur = db.printify_products.find({"hidden": {"$ne": True}}, {"_id": 0}).sort(
            [("featured", -1), ("title", 1)]
        )
        return await cur.to_list(length=500)

    @router.get("/products", response_model=List[PrintifyProductPublic])
    async def public_products():
        """Public list — served from MongoDB cache populated by /sync.

        Falls back to an empty list if no products are synced yet so the
        Shop page doesn't 500.
        """
        cached = _public_cache.get()
        if cached is None:
            cached = await _list_synced_products()
            _public_cache.set(cached, PUBLIC_CACHE_TTL)

        out: List[PrintifyProductPublic] = []
        for p in cached:
            etsy = (p.get("etsy_url") or "").strip()
            buy_url = etsy if etsy else (p.get("popup_url") or DEFAULT_POPUP_URL)
            out.append(
                PrintifyProductPublic(
                    id=p["id"],
                    title=p.get("title") or "",
                    description=p.get("description") or "",
                    image_url=p.get("image_url"),
                    images=p.get("images") or [],
                    min_price=float(p.get("min_price") or 0),
                    max_price=float(p.get("max_price") or 0),
                    currency=p.get("currency") or "USD",
                    tags=p.get("tags") or [],
                    buy_url=buy_url,
                    featured=bool(p.get("featured")),
                )
            )
        return out

    @router.post("/sync", dependencies=[Depends(require_admin)])
    async def sync_from_printify():
        """Admin: pull every product from Printify and upsert into Mongo.

        Preserves per-product admin overrides (featured/hidden/etsy_url).
        """
        api_key, shop_id = _settings()
        try:
            raw = await _fetch_all_printify_products(shop_id, api_key)
        except httpx.HTTPStatusError as e:
            log.error("printify HTTP %s: %s", e.response.status_code, e.response.text[:500])
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Printify API error {e.response.status_code}",
            ) from e
        except httpx.HTTPError as e:
            log.error("printify network error: %s", e)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Could not reach Printify",
            ) from e

        synced_ids: List[str] = []
        for p in raw:
            norm = _normalize_product(p)
            if not norm["id"]:
                continue
            synced_ids.append(norm["id"])
            await db.printify_products.update_one(
                {"id": norm["id"]},
                {
                    "$set": {**norm, "synced_at": int(time.time())},
                    "$setOnInsert": {
                        "featured": False,
                        "hidden": False,
                        "etsy_url": "",
                        "popup_url": DEFAULT_POPUP_URL,
                    },
                },
                upsert=True,
            )
        # Mark products no longer on Printify as hidden (don't delete; keep
        # admin overrides in case they reappear).
        if synced_ids:
            await db.printify_products.update_many(
                {"id": {"$nin": synced_ids}},
                {"$set": {"hidden": True, "unlisted_at": int(time.time())}},
            )
        _public_cache.invalidate()
        return {"ok": True, "synced": len(synced_ids), "shop_id": shop_id}

    @router.get("/admin/products", dependencies=[Depends(require_admin)])
    async def admin_list_products():
        cur = db.printify_products.find({}, {"_id": 0}).sort([("featured", -1), ("title", 1)])
        return await cur.to_list(length=1000)

    @router.patch("/admin/products/{product_id}", dependencies=[Depends(require_admin)])
    async def admin_update_product(product_id: str, body: PrintifyAdminUpdate):
        patch: dict = {}
        if body.featured is not None:
            patch["featured"] = bool(body.featured)
        if body.hidden is not None:
            patch["hidden"] = bool(body.hidden)
        if body.etsy_url is not None:
            patch["etsy_url"] = body.etsy_url.strip()
        if not patch:
            return {"ok": True, "updated": False}
        res = await db.printify_products.update_one({"id": product_id}, {"$set": patch})
        if res.matched_count == 0:
            raise HTTPException(status_code=404, detail="Product not found")
        _public_cache.invalidate()
        return {"ok": True, "updated": True}

    return router

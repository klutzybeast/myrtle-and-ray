"""Etsy Open API v3 — read-only sync of active listings from a single shop.

OAuth 2.0 Authorization Code + PKCE flow (run once at setup by the shop
owner). Tokens are stored in MongoDB collection `etsy_oauth` and the
access token auto-refreshes when expired. Listings are cached in
`etsy_listings` and served by GET /api/etsy/listings.
"""
from __future__ import annotations

import base64
import hashlib
import logging
import os
import secrets
import time
from typing import Any, List, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

log = logging.getLogger("etsy")

ETSY_API_BASE = "https://api.etsy.com/v3"
ETSY_OAUTH_AUTHORIZE = "https://www.etsy.com/oauth/connect"
ETSY_OAUTH_TOKEN = "https://api.etsy.com/v3/public/oauth/token"

LIST_CACHE_TTL = 600  # 10 minutes on the public listing list


class EtsyListingPublic(BaseModel):
    listing_id: int
    title: str
    description: str = ""
    price: float = 0.0
    currency: str = "USD"
    image_url: Optional[str] = None
    images: List[str] = []
    listing_url: str = ""


def _now() -> int:
    return int(time.time())


def _pkce_pair() -> tuple[str, str]:
    """Return (code_verifier, code_challenge_S256)."""
    verifier = base64.urlsafe_b64encode(secrets.token_bytes(48)).decode("ascii").rstrip("=")
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    challenge = base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")
    return verifier, challenge


def _settings() -> tuple[str, str, str]:
    keystring = os.environ.get("ETSY_KEYSTRING", "").strip()
    secret = os.environ.get("ETSY_SHARED_SECRET", "").strip()
    callback = os.environ.get("ETSY_CALLBACK_URL", "").strip()
    if not keystring or not secret or not callback:
        raise HTTPException(
            status_code=503,
            detail="Etsy is not configured (need ETSY_KEYSTRING, ETSY_SHARED_SECRET, ETSY_CALLBACK_URL).",
        )
    return keystring, secret, callback


async def _load_token_doc(db) -> Optional[dict]:
    return await db.etsy_oauth.find_one({"_singleton": True}, {"_id": 0})


async def _save_token_doc(db, doc: dict) -> None:
    doc["_singleton"] = True
    doc["updated_at"] = _now()
    await db.etsy_oauth.update_one({"_singleton": True}, {"$set": doc}, upsert=True)


async def _refresh_access_token(db, keystring: str, refresh_token: str) -> dict:
    """Exchange a refresh token for a fresh access token. Persists the new token pair."""
    payload = {
        "grant_type": "refresh_token",
        "client_id": keystring,
        "refresh_token": refresh_token,
    }
    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.post(ETSY_OAUTH_TOKEN, data=payload)
        if resp.status_code != 200:
            log.error("Etsy token refresh failed %s: %s", resp.status_code, resp.text[:300])
            raise HTTPException(status_code=502, detail=f"Etsy token refresh failed ({resp.status_code})")
        data = resp.json()
    expires_in = int(data.get("expires_in") or 3600)
    new_doc = {
        "access_token": data["access_token"],
        "refresh_token": data.get("refresh_token") or refresh_token,
        "expires_at": _now() + max(60, expires_in - 60),
        "scope": data.get("scope") or "",
    }
    await _save_token_doc(db, new_doc)
    return new_doc


async def _get_valid_token(db) -> dict:
    keystring, _secret, _cb = _settings()
    doc = await _load_token_doc(db)
    if not doc or not doc.get("access_token") or not doc.get("refresh_token"):
        raise HTTPException(
            status_code=401,
            detail="Etsy is not connected yet — open /admin/etsy and click Connect.",
        )
    if _now() >= int(doc.get("expires_at") or 0):
        doc = await _refresh_access_token(db, keystring, doc["refresh_token"])
    return doc


def _bearer(token_doc: dict) -> str:
    """Etsy wants: 'Bearer <user_id>.<access_token>'."""
    user_id = token_doc.get("user_id")
    access = token_doc["access_token"]
    if user_id:
        return f"Bearer {user_id}.{access}"
    return f"Bearer {access}"


def _xapikey(keystring: str, secret: str) -> str:
    return f"{keystring}:{secret}"


def _normalize_listing(raw: dict) -> dict:
    listing_id = int(raw.get("listing_id") or raw.get("listingId") or 0)
    price_info = raw.get("price") or {}
    if isinstance(price_info, dict):
        amount = price_info.get("amount")
        divisor = price_info.get("divisor") or 100
        try:
            price = float(amount) / float(divisor) if amount is not None else 0.0
        except (TypeError, ValueError):
            price = 0.0
        currency = price_info.get("currency_code") or "USD"
    else:
        try:
            price = float(price_info)
        except (TypeError, ValueError):
            price = 0.0
        currency = raw.get("currency_code") or "USD"

    images_raw = raw.get("images") or []
    images_sorted = sorted(images_raw, key=lambda i: int(i.get("rank") or 999))
    image_urls = []
    for im in images_sorted:
        url = im.get("url_fullxfull") or im.get("url_570xN") or im.get("url")
        if url:
            image_urls.append(url)
    primary = image_urls[0] if image_urls else None

    return {
        "listing_id": listing_id,
        "title": (raw.get("title") or "").strip(),
        "description": (raw.get("description") or "").strip(),
        "price": price,
        "currency": currency,
        "image_url": primary,
        "images": image_urls[:6],
        "listing_url": raw.get("url") or "",
    }


class _Cache:
    def __init__(self) -> None:
        self.value: Optional[List[dict]] = None
        self.expires_at: float = 0.0

    def get(self) -> Optional[List[dict]]:
        if self.value is not None and time.time() < self.expires_at:
            return self.value
        return None

    def set(self, value: List[dict]) -> None:
        self.value = value
        self.expires_at = time.time() + LIST_CACHE_TTL

    def invalidate(self) -> None:
        self.value = None
        self.expires_at = 0.0


_public_cache = _Cache()


def make_etsy_router(db, require_admin):
    router = APIRouter(prefix="/etsy", tags=["etsy"])

    @router.get("/status")
    async def etsy_status():
        """Public — tells the Admin UI whether Etsy is connected yet."""
        try:
            keystring = os.environ.get("ETSY_KEYSTRING", "").strip()
            secret = os.environ.get("ETSY_SHARED_SECRET", "").strip()
            callback = os.environ.get("ETSY_CALLBACK_URL", "").strip()
            keys_present = bool(keystring and secret and callback)
        except Exception:
            keys_present = False
        doc = await _load_token_doc(db)
        connected = bool(doc and doc.get("access_token") and doc.get("refresh_token"))
        return {
            "configured": keys_present,
            "connected": connected,
            "shop_id": (doc or {}).get("shop_id"),
            "shop_name": (doc or {}).get("shop_name"),
            "user_id": (doc or {}).get("user_id"),
            "expires_at": (doc or {}).get("expires_at"),
            "last_sync_at": (doc or {}).get("last_sync_at"),
            "callback_url": os.environ.get("ETSY_CALLBACK_URL", ""),
        }

    @router.post("/connect", dependencies=[Depends(require_admin)])
    async def etsy_connect():
        """Admin starts the OAuth flow. Returns the authorize URL to open in a new tab."""
        keystring, _secret, callback = _settings()
        verifier, challenge = _pkce_pair()
        state = secrets.token_urlsafe(24)
        # Stash verifier+state so the callback can match them.
        await db.etsy_oauth_pending.insert_one({
            "state": state,
            "code_verifier": verifier,
            "created_at": _now(),
        })
        # Clean up old pending entries (>10 min)
        await db.etsy_oauth_pending.delete_many({"created_at": {"$lt": _now() - 600}})
        from urllib.parse import urlencode
        params = {
            "response_type": "code",
            "client_id": keystring,
            "redirect_uri": callback,
            "scope": "listings_r shops_r",
            "state": state,
            "code_challenge": challenge,
            "code_challenge_method": "S256",
        }
        return {"authorize_url": f"{ETSY_OAUTH_AUTHORIZE}?{urlencode(params)}"}

    @router.get("/oauth/callback")
    async def etsy_oauth_callback(code: Optional[str] = Query(None), state: Optional[str] = Query(None), error: Optional[str] = Query(None)):
        """Etsy redirects here after the shop owner clicks Allow."""
        admin_redirect_base = os.environ.get("FRONTEND_BASE_URL") or os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
        # Frontend base = backend host minus the /api — for the preview/prod
        # ingress they share the same host, so REACT_APP_BACKEND_URL works.
        if error:
            return RedirectResponse(f"{admin_redirect_base}/admin/etsy?etsy_error={error}", status_code=302)
        if not code or not state:
            return RedirectResponse(f"{admin_redirect_base}/admin/etsy?etsy_error=missing_code", status_code=302)

        pending = await db.etsy_oauth_pending.find_one({"state": state})
        if not pending:
            return RedirectResponse(f"{admin_redirect_base}/admin/etsy?etsy_error=invalid_state", status_code=302)
        await db.etsy_oauth_pending.delete_one({"state": state})

        keystring, _secret, callback = _settings()
        token_payload = {
            "grant_type": "authorization_code",
            "client_id": keystring,
            "redirect_uri": callback,
            "code": code,
            "code_verifier": pending["code_verifier"],
        }
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(ETSY_OAUTH_TOKEN, data=token_payload)
            if resp.status_code != 200:
                log.error("Etsy code-exchange failed %s: %s", resp.status_code, resp.text[:400])
                return RedirectResponse(
                    f"{admin_redirect_base}/admin/etsy?etsy_error=exchange_failed_{resp.status_code}",
                    status_code=302,
                )
            tok = resp.json()

        # Etsy returns access_token as "<user_id>.<token_blob>" — split so
        # we can include user_id in the Authorization header on later
        # requests as Etsy requires.
        access_full = tok.get("access_token") or ""
        user_id = None
        access_token = access_full
        if "." in access_full:
            user_id_part, _, _ = access_full.partition(".")
            try:
                user_id = int(user_id_part)
                access_token = access_full  # keep full string; Etsy expects the full token in Authorization
            except ValueError:
                user_id = None

        expires_in = int(tok.get("expires_in") or 3600)
        doc = {
            "access_token": access_token,
            "refresh_token": tok.get("refresh_token") or "",
            "expires_at": _now() + max(60, expires_in - 60),
            "scope": tok.get("scope") or "",
            "user_id": user_id,
        }
        await _save_token_doc(db, doc)

        # Resolve the shop owned by this user.
        try:
            shop = await _fetch_user_shop(keystring, _secret, access_token, user_id)
            if shop:
                await _save_token_doc(db, {**doc, "shop_id": shop["shop_id"], "shop_name": shop.get("shop_name")})
        except Exception as e:
            log.warning("could not auto-detect shop after OAuth: %s", e)

        return RedirectResponse(f"{admin_redirect_base}/admin/etsy?etsy_connected=1", status_code=302)

    async def _fetch_user_shop(keystring: str, secret: str, access_token: str, user_id: Optional[int]) -> Optional[dict]:
        if not user_id:
            return None
        headers = {
            "x-api-key": _xapikey(keystring, secret),
            "Authorization": f"Bearer {access_token}",
        }
        url = f"{ETSY_API_BASE}/application/users/{user_id}/shops"
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.get(url, headers=headers)
            if r.status_code != 200:
                log.warning("get user shop failed %s: %s", r.status_code, r.text[:200])
                return None
            data = r.json()
            # Single-shop response is the shop object itself (not paginated)
            if isinstance(data, dict) and data.get("shop_id"):
                return {"shop_id": int(data["shop_id"]), "shop_name": data.get("shop_name") or ""}
            return None

    @router.post("/sync", dependencies=[Depends(require_admin)])
    async def etsy_sync():
        keystring, secret, _cb = _settings()
        tok = await _get_valid_token(db)
        shop_id = tok.get("shop_id")
        if not shop_id:
            raise HTTPException(status_code=400, detail="Shop not detected. Disconnect and reconnect to fix.")

        headers = {
            "x-api-key": _xapikey(keystring, secret),
            "Authorization": _bearer(tok),
        }

        all_listings: List[dict] = []
        offset = 0
        limit = 100
        async with httpx.AsyncClient(timeout=30.0) as client:
            while True:
                url = f"{ETSY_API_BASE}/application/shops/{shop_id}/listings/active?limit={limit}&offset={offset}&includes=Images"
                r = await client.get(url, headers=headers)
                if r.status_code == 401:
                    # token expired despite our window — refresh once and retry
                    tok = await _refresh_access_token(db, keystring, tok["refresh_token"])
                    tok["shop_id"] = shop_id
                    headers["Authorization"] = _bearer(tok)
                    r = await client.get(url, headers=headers)
                if r.status_code != 200:
                    log.error("etsy listings fetch %s: %s", r.status_code, r.text[:400])
                    raise HTTPException(status_code=502, detail=f"Etsy listings fetch failed ({r.status_code})")
                data = r.json()
                results = data.get("results") or []
                if not results:
                    break
                all_listings.extend(results)
                if len(results) < limit:
                    break
                offset += limit
                if offset >= int(data.get("count") or 0):
                    break

        synced_ids: List[int] = []
        for raw in all_listings:
            norm = _normalize_listing(raw)
            if not norm["listing_id"]:
                continue
            synced_ids.append(norm["listing_id"])
            await db.etsy_listings.update_one(
                {"listing_id": norm["listing_id"]},
                {"$set": {**norm, "synced_at": _now()}},
                upsert=True,
            )
        # Mark removed listings as hidden (do NOT delete — keep history)
        if synced_ids:
            await db.etsy_listings.update_many(
                {"listing_id": {"$nin": synced_ids}},
                {"$set": {"unlisted": True, "unlisted_at": _now()}},
            )
            await db.etsy_listings.update_many(
                {"listing_id": {"$in": synced_ids}},
                {"$set": {"unlisted": False}},
            )

        await _save_token_doc(db, {**tok, "last_sync_at": _now()})
        _public_cache.invalidate()
        return {"ok": True, "synced": len(synced_ids), "shop_id": shop_id}

    @router.post("/disconnect", dependencies=[Depends(require_admin)])
    async def etsy_disconnect():
        await db.etsy_oauth.delete_many({})
        await db.etsy_oauth_pending.delete_many({})
        _public_cache.invalidate()
        return {"ok": True}

    @router.get("/listings", response_model=List[EtsyListingPublic])
    async def public_listings():
        cached = _public_cache.get()
        if cached is None:
            cursor = db.etsy_listings.find(
                {"unlisted": {"$ne": True}}, {"_id": 0}
            ).sort([("synced_at", -1)])
            cached = await cursor.to_list(length=200)
            _public_cache.set(cached)
        return [EtsyListingPublic(**p) for p in cached]

    return router

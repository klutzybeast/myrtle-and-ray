"""Discount code system — applies to Stuffies cart checkout only.

Supported types:
  • percent       — N% off subtotal
  • fixed         — fixed $ amount off subtotal (cents)
  • free_shipping — zeroes out the selected ShipStation rate
  • bogo          — buy-one-get-one on a specific product slug
                    (the second unit of `bogo_product_slug` becomes free,
                    requires qty>=2 of that slug in cart)

Per-code constraints (all optional):
  • starts_at / expires_at      ISO datetimes
  • max_total_uses              global redemption cap
  • max_per_customer            cap per buyer email
  • min_subtotal_cents          minimum cart subtotal to qualify
  • allowed_product_slugs[]     restrict to specific products
  • allowed_categories[]        restrict to specific product categories
  • active                      bool master toggle

Endpoints:
  Public:
    • POST /api/checkout/validate-discount  body: { code, items, subtotal_cents,
        shipping_cents, email? } → returns computed discount_cents + applied_to
        breakdown OR 400 with a user-friendly reason.

  Admin (require_admin):
    • GET    /api/admin/discounts             list (latest first)
    • POST   /api/admin/discounts             create
    • GET    /api/admin/discounts/{id}        single
    • PATCH  /api/admin/discounts/{id}        update
    • DELETE /api/admin/discounts/{id}        delete
    • GET    /api/admin/discounts/{id}/redemptions  list usage history
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import List, Optional, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, EmailStr


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_dt(v) -> Optional[datetime]:
    if not v:
        return None
    if isinstance(v, datetime):
        return v if v.tzinfo else v.replace(tzinfo=timezone.utc)
    try:
        s = str(v).replace("Z", "+00:00")
        dt = datetime.fromisoformat(s)
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except Exception:  # noqa: BLE001
        return None


DiscountType = Literal["percent", "fixed", "free_shipping", "bogo"]


class DiscountBody(BaseModel):
    code: Optional[str] = None  # case-insensitive; stored uppercase
    description: Optional[str] = ""
    type: Optional[DiscountType] = None
    value: Optional[float] = 0  # percent: 0-100; fixed: dollars; ignored for free_shipping/bogo
    active: Optional[bool] = True
    starts_at: Optional[str] = ""
    expires_at: Optional[str] = ""
    max_total_uses: Optional[int] = 0  # 0 = unlimited
    max_per_customer: Optional[int] = 0  # 0 = unlimited
    min_subtotal_cents: Optional[int] = 0
    allowed_product_slugs: Optional[List[str]] = None
    allowed_categories: Optional[List[str]] = None
    bogo_product_slug: Optional[str] = ""


class ValidateBody(BaseModel):
    code: str
    items: List[dict] = Field(default_factory=list)  # [{product_slug, variant_sku, quantity, unit_price_cents}]
    subtotal_cents: int = 0
    shipping_cents: int = 0
    email: Optional[EmailStr] = None


# ---------- core discount engine (pure, easy to test) ----------

def _evaluate_discount(disc: dict, cart_items: List[dict], subtotal_cents: int, shipping_cents: int) -> dict:
    """Pure calculator: returns
       { discount_cents, free_shipping, applied_lines: [...], notes: "..." }
       Raises HTTPException(400) with a buyer-facing message if the code doesn't qualify."""
    typ = disc.get("type")
    val = float(disc.get("value") or 0)

    # --- Filter cart by allowed products / categories (server-side products lookup
    # already enforced "stuffies only" upstream — here we just respect the
    # admin's per-code restriction list).
    allowed_slugs = set(disc.get("allowed_product_slugs") or [])
    allowed_cats = set((c or "").lower() for c in (disc.get("allowed_categories") or []))

    def line_eligible(line: dict) -> bool:
        if allowed_slugs and line.get("product_slug") not in allowed_slugs:
            return False
        if allowed_cats and (line.get("category") or "").lower() not in allowed_cats:
            return False
        return True

    eligible_lines = [ln for ln in cart_items if line_eligible(ln)]
    eligible_subtotal = sum(int(ln.get("unit_price_cents", 0)) * int(ln.get("quantity", 0)) for ln in eligible_lines)

    if (allowed_slugs or allowed_cats) and eligible_subtotal <= 0:
        raise HTTPException(status_code=400, detail="This code doesn't apply to anything in your cart.")

    min_sub = int(disc.get("min_subtotal_cents") or 0)
    if min_sub > 0 and subtotal_cents < min_sub:
        gap = (min_sub - subtotal_cents) / 100
        raise HTTPException(status_code=400, detail=f"Spend ${gap:.2f} more to use this code.")

    if typ == "percent":
        pct = max(0.0, min(100.0, val))
        # If restricted, apply only to eligible subtotal; otherwise full subtotal
        base = eligible_subtotal if (allowed_slugs or allowed_cats) else subtotal_cents
        amt = int(round(base * (pct / 100.0)))
        amt = min(amt, base)
        return {"discount_cents": amt, "free_shipping": False, "applied_to": "subtotal", "notes": f"{pct:g}% off"}

    if typ == "fixed":
        amt_cents = int(round(val * 100))
        base = eligible_subtotal if (allowed_slugs or allowed_cats) else subtotal_cents
        amt = min(amt_cents, base)
        if amt <= 0:
            raise HTTPException(status_code=400, detail="This code can't be applied to your cart total.")
        return {"discount_cents": amt, "free_shipping": False, "applied_to": "subtotal", "notes": f"${val:.2f} off"}

    if typ == "free_shipping":
        return {"discount_cents": int(shipping_cents or 0), "free_shipping": True, "applied_to": "shipping", "notes": "Free shipping"}

    if typ == "bogo":
        slug = (disc.get("bogo_product_slug") or "").strip()
        if not slug:
            raise HTTPException(status_code=400, detail="This BOGO code isn't fully configured.")
        target = next((ln for ln in cart_items if ln.get("product_slug") == slug), None)
        if not target or int(target.get("quantity", 0)) < 2:
            raise HTTPException(status_code=400, detail="Add a second of the qualifying item to use this code.")
        unit = int(target.get("unit_price_cents", 0))
        qty = int(target.get("quantity", 0))
        # One free per matching pair → floor(qty/2) free units
        pairs = qty // 2
        amt = unit * pairs
        return {"discount_cents": amt, "free_shipping": False, "applied_to": "subtotal", "notes": f"BOGO ({pairs} free)"}

    raise HTTPException(status_code=400, detail="Unknown discount type.")


async def _validate_code_active(db, disc: dict, email: Optional[str]) -> None:
    """Time-window, usage-cap, and per-customer checks. Mutating reads only."""
    if not disc.get("active", True):
        raise HTTPException(status_code=400, detail="This code is no longer active.")
    now = datetime.now(timezone.utc)
    starts = _parse_dt(disc.get("starts_at"))
    if starts and now < starts:
        raise HTTPException(status_code=400, detail="This code isn't active yet.")
    expires = _parse_dt(disc.get("expires_at"))
    if expires and now > expires:
        raise HTTPException(status_code=400, detail="This code has expired.")
    max_total = int(disc.get("max_total_uses") or 0)
    if max_total > 0 and int(disc.get("usage_count") or 0) >= max_total:
        raise HTTPException(status_code=400, detail="This code has been fully redeemed.")
    if email:
        max_per = int(disc.get("max_per_customer") or 0)
        if max_per > 0:
            used = await db.discount_redemptions.count_documents({"code": disc.get("code"), "email": str(email).lower()})
            if used >= max_per:
                raise HTTPException(status_code=400, detail="You've already used this code.")


async def find_active_discount(db, code: str) -> dict:
    """Lookup a code by name and run active/time checks (no usage increment).
    Returns the discount doc (without _id) or raises 400/404."""
    if not code or not code.strip():
        raise HTTPException(status_code=400, detail="Enter a code.")
    code_up = code.strip().upper()
    disc = await db.discounts.find_one({"code": code_up}, {"_id": 0})
    if not disc:
        raise HTTPException(status_code=400, detail="Invalid code.")
    return disc


# ---------- routers ----------

def make_public_discount_router(db):
    """Public route mounted under /api — for the checkout UI."""
    router = APIRouter(tags=["discounts"])

    @router.post("/checkout/validate-discount")
    async def validate(body: ValidateBody):
        disc = await find_active_discount(db, body.code)
        await _validate_code_active(db, disc, str(body.email) if body.email else None)

        # Augment cart items with `category` so allowed_categories rules work.
        cart_items = []
        for it in body.items or []:
            slug = (it or {}).get("product_slug")
            cat = ""
            if slug:
                p = await db.products.find_one({"slug": slug}, {"_id": 0, "category": 1})
                if p:
                    cat = p.get("category", "")
            cart_items.append({
                "product_slug": slug or "",
                "variant_sku": (it or {}).get("variant_sku", ""),
                "quantity": int((it or {}).get("quantity", 0)),
                "unit_price_cents": int((it or {}).get("unit_price_cents", 0)),
                "category": cat,
            })

        result = _evaluate_discount(disc, cart_items, int(body.subtotal_cents or 0), int(body.shipping_cents or 0))
        return {
            "ok": True,
            "code": disc.get("code"),
            "description": disc.get("description") or "",
            "type": disc.get("type"),
            "discount_cents": int(result["discount_cents"]),
            "free_shipping": bool(result["free_shipping"]),
            "applied_to": result["applied_to"],
            "notes": result["notes"],
        }

    return router


def make_admin_discount_router(db, require_admin):
    """Admin CRUD for discounts. Mounted under /api/admin via dependency."""
    router = APIRouter(prefix="/discounts", tags=["admin-discounts"], dependencies=[Depends(require_admin)])

    def _norm_payload(body: DiscountBody, existing: Optional[dict] = None) -> dict:
        data = body.model_dump(exclude_unset=False)
        # Uppercase + strip the code
        if data.get("code") is not None:
            data["code"] = (data["code"] or "").strip().upper()
        # Defaults for new docs
        if existing is None:
            for k, v in {
                "active": True,
                "description": "",
                "value": 0,
                "starts_at": "",
                "expires_at": "",
                "max_total_uses": 0,
                "max_per_customer": 0,
                "min_subtotal_cents": 0,
                "allowed_product_slugs": [],
                "allowed_categories": [],
                "bogo_product_slug": "",
            }.items():
                if data.get(k) is None:
                    data[k] = v
        else:
            # Drop None on update so we PATCH only what was sent.
            data = {k: v for k, v in data.items() if v is not None}
        return data

    @router.get("")
    async def list_discounts():
        cur = db.discounts.find({}, {"_id": 0}).sort("created_at", -1)
        return await cur.to_list(500)

    @router.post("")
    async def create_discount(body: DiscountBody):
        data = _norm_payload(body)
        if not data.get("code"):
            raise HTTPException(status_code=400, detail="Code is required.")
        if data.get("type") not in ("percent", "fixed", "free_shipping", "bogo"):
            raise HTTPException(status_code=400, detail="Type must be percent, fixed, free_shipping, or bogo.")
        if data["type"] == "percent" and not (0 < float(data.get("value") or 0) <= 100):
            raise HTTPException(status_code=400, detail="Percent value must be between 0 and 100.")
        if data["type"] == "fixed" and float(data.get("value") or 0) <= 0:
            raise HTTPException(status_code=400, detail="Fixed amount must be greater than 0.")
        if data["type"] == "bogo" and not (data.get("bogo_product_slug") or "").strip():
            raise HTTPException(status_code=400, detail="BOGO codes require a target product slug.")

        existing = await db.discounts.find_one({"code": data["code"]}, {"_id": 0, "code": 1})
        if existing:
            raise HTTPException(status_code=409, detail=f"Code '{data['code']}' already exists.")

        doc = {
            "id": str(uuid.uuid4()),
            "usage_count": 0,
            "created_at": _now_iso(),
            "updated_at": _now_iso(),
            **data,
        }
        await db.discounts.insert_one(dict(doc))
        return {k: v for k, v in doc.items() if k != "_id"}

    @router.get("/{disc_id}")
    async def get_discount(disc_id: str):
        d = await db.discounts.find_one({"id": disc_id}, {"_id": 0})
        if not d:
            raise HTTPException(status_code=404, detail="Discount not found.")
        return d

    @router.patch("/{disc_id}")
    async def update_discount(disc_id: str, body: DiscountBody):
        existing = await db.discounts.find_one({"id": disc_id}, {"_id": 0})
        if not existing:
            raise HTTPException(status_code=404, detail="Discount not found.")
        patch = _norm_payload(body, existing=existing)
        # Don't allow changing code to one that conflicts.
        if "code" in patch and patch["code"] and patch["code"] != existing["code"]:
            conflict = await db.discounts.find_one({"code": patch["code"], "id": {"$ne": disc_id}}, {"_id": 0, "code": 1})
            if conflict:
                raise HTTPException(status_code=409, detail=f"Code '{patch['code']}' already exists.")
        patch["updated_at"] = _now_iso()
        await db.discounts.update_one({"id": disc_id}, {"$set": patch})
        return await db.discounts.find_one({"id": disc_id}, {"_id": 0})

    @router.delete("/{disc_id}")
    async def delete_discount(disc_id: str):
        res = await db.discounts.delete_one({"id": disc_id})
        if res.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Discount not found.")
        return {"ok": True}

    @router.get("/{disc_id}/redemptions")
    async def list_redemptions(disc_id: str, limit: int = 200):
        d = await db.discounts.find_one({"id": disc_id}, {"_id": 0, "code": 1})
        if not d:
            raise HTTPException(status_code=404, detail="Discount not found.")
        cur = db.discount_redemptions.find({"code": d["code"]}, {"_id": 0}).sort("at", -1).limit(limit)
        return await cur.to_list(limit)

    return router


# ---------- helper used by square_router after a successful payment ----------
async def record_redemption(db, code: str, email: str, order_id: str, order_number: str, amount_cents: int) -> None:
    """Idempotent per order: only inserts a redemption row + increments usage
    once for any given (code, order_id) pair. Safe to call multiple times."""
    if not code:
        return
    code_up = code.strip().upper()
    existing = await db.discount_redemptions.find_one({"code": code_up, "order_id": order_id}, {"_id": 0, "code": 1})
    if existing:
        return
    await db.discount_redemptions.insert_one({
        "id": str(uuid.uuid4()),
        "code": code_up,
        "email": (email or "").lower(),
        "order_id": order_id,
        "order_number": order_number,
        "amount_cents": int(amount_cents),
        "at": _now_iso(),
    })
    await db.discounts.update_one(
        {"code": code_up},
        {"$inc": {"usage_count": 1}, "$set": {"last_used_at": _now_iso()}},
    )

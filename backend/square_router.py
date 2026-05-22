"""Square Payments integration — production checkout for Stuffies category only.

Wires up:
  • POST /api/checkout/square            — create payment + order
  • POST /api/webhooks/square            — webhook receiver (HMAC verified)
  • GET  /api/admin/orders               — list orders
  • POST /api/admin/orders/{id}/fulfill  — mark fulfilled
  • POST /api/admin/orders/{id}/refund   — refund (full or partial)
"""
from __future__ import annotations

import hmac
import hashlib
import base64
import json
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any, List, Optional

from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel, EmailStr, Field
from square import Square

logger = logging.getLogger("square")

SHIP_CENTS = int(os.environ.get("STUFFIES_SHIPPING_CENTS", "800") or 800)
TAX_RATE = float(os.environ.get("STUFFIES_TAX_RATE", "0.08875") or 0.08875)
LOCATION_ID = os.environ.get("SQUARE_LOCATION_ID", "")
ACCESS_TOKEN = os.environ.get("SQUARE_ACCESS_TOKEN", "")
APPLICATION_ID = os.environ.get("SQUARE_APPLICATION_ID", "")
WEBHOOK_KEY = os.environ.get("SQUARE_WEBHOOK_SIGNATURE_KEY", "")
WEBHOOK_URL = os.environ.get("SQUARE_WEBHOOK_NOTIFICATION_URL", "")
ORDER_FROM = os.environ.get("ORDER_FROM_EMAIL", "orders@example.com")
ORDER_BRAND = os.environ.get("ORDER_FROM_NAME", "Myrtle and Ray")


def _client() -> Square:
    if not ACCESS_TOKEN:
        raise HTTPException(status_code=503, detail="Square not configured")
    return Square(token=ACCESS_TOKEN)


class CartItem(BaseModel):
    product_slug: str
    variant_sku: Optional[str] = ""
    quantity: int = Field(ge=1, le=10)


class ShippingAddress(BaseModel):
    line1: str
    line2: Optional[str] = ""
    city: str
    state: str
    postal_code: str
    country: str = "US"


class CheckoutRequest(BaseModel):
    items: List[CartItem]
    email: EmailStr
    full_name: str
    shipping_address: ShippingAddress
    source_id: str
    verification_token: Optional[str] = None
    idempotency_key: Optional[str] = None
    shipping_cents: Optional[int] = None
    shipping_service: Optional[str] = ""
    shipping_carrier: Optional[str] = ""
    shipping_rate_id: Optional[str] = ""


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _resolve_line_items(db, items: List[CartItem]):
    """Lookup products, enforce Stuffies-only + stock, compute totals."""
    lines = []
    subtotal = 0
    for item in items:
        p = await db.products.find_one({"slug": item.product_slug}, {"_id": 0})
        if not p:
            raise HTTPException(status_code=400, detail=f"Unknown product: {item.product_slug}")
        if (p.get("category") or "").lower() != "stuffies":
            raise HTTPException(status_code=400, detail="Only Stuffies can be purchased via this checkout.")
        if p.get("inventory_status") != "In Stock":
            raise HTTPException(status_code=400, detail=f"{p.get('name','Item')} is not in stock.")

        variant = None
        unit_price = p.get("price") or 0
        if item.variant_sku and p.get("variants"):
            variant = next((v for v in p["variants"] if v.get("sku") == item.variant_sku), None)
            if variant and variant.get("price") is not None:
                unit_price = variant["price"]

        unit_cents = int(round(float(unit_price) * 100))
        qty = int(item.quantity)
        line_total_cents = unit_cents * qty
        subtotal += line_total_cents
        lines.append({
            "product_slug": item.product_slug,
            "product_name": p.get("name", ""),
            "variant_sku": item.variant_sku or "",
            "variant_label": (variant or {}).get("label", ""),
            "quantity": qty,
            "unit_price_cents": unit_cents,
            "line_total_cents": line_total_cents,
            "image": p.get("primary_image", ""),
        })
    return lines, subtotal


def _calc_totals(subtotal_cents: int, override_shipping_cents: Optional[int] = None):
    tax_cents = int(round(subtotal_cents * TAX_RATE))
    if override_shipping_cents is not None and override_shipping_cents >= 0:
        shipping_cents = int(override_shipping_cents) if subtotal_cents > 0 else 0
    else:
        shipping_cents = SHIP_CENTS if subtotal_cents > 0 else 0
    total_cents = subtotal_cents + tax_cents + shipping_cents
    return tax_cents, shipping_cents, total_cents


def _safe_payment(payment: Any) -> dict:
    """Convert Square Payment SDK object to a plain dict — safely."""
    if payment is None:
        return {}
    if isinstance(payment, dict):
        return payment
    for attr in ("model_dump", "dict", "to_dict"):
        if hasattr(payment, attr):
            try:
                return getattr(payment, attr)()
            except Exception:  # noqa: BLE001
                continue
    try:
        return json.loads(json.dumps(payment, default=lambda o: getattr(o, "__dict__", str(o))))
    except Exception:  # noqa: BLE001
        return {"id": getattr(payment, "id", ""), "status": getattr(payment, "status", "")}


def make_public_square_router(db, queue_email_fn):
    """Public (checkout) and webhook routes."""
    router = APIRouter(tags=["square"])

    @router.get("/checkout/quote")
    async def quote(slug: str, variant_sku: str = "", qty: int = 1):
        """Lightweight totals preview for a single line — used by cart UI."""
        try:
            lines, subtotal = await _resolve_line_items(db, [CartItem(product_slug=slug, variant_sku=variant_sku, quantity=qty)])
        except HTTPException as exc:
            raise exc
        tax_cents, shipping_cents, total_cents = _calc_totals(subtotal)
        return {
            "subtotal_cents": subtotal,
            "tax_cents": tax_cents,
            "shipping_cents": shipping_cents,
            "total_cents": total_cents,
            "tax_rate": TAX_RATE,
            "lines": lines,
        }

    @router.post("/checkout/quote-cart")
    async def quote_cart(payload: dict):
        items_in = payload.get("items") or []
        items = [CartItem(**i) for i in items_in]
        lines, subtotal = await _resolve_line_items(db, items)
        override_ship = payload.get("shipping_cents")
        tax_cents, shipping_cents, total_cents = _calc_totals(subtotal, override_ship)
        return {
            "subtotal_cents": subtotal,
            "tax_cents": tax_cents,
            "shipping_cents": shipping_cents,
            "total_cents": total_cents,
            "tax_rate": TAX_RATE,
            "lines": lines,
        }

    @router.post("/checkout/square")
    async def checkout_square(payload: CheckoutRequest):
        if not payload.items:
            raise HTTPException(status_code=400, detail="Cart is empty.")
        if not LOCATION_ID:
            raise HTTPException(status_code=503, detail="Square location not configured.")

        lines, subtotal = await _resolve_line_items(db, payload.items)
        tax_cents, shipping_cents, total_cents = _calc_totals(subtotal, payload.shipping_cents)

        order_number = f"MR-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:4].upper()}"
        order_id = uuid.uuid4().hex

        order_doc = {
            "id": order_id,
            "order_number": order_number,
            "created_at": _now(),
            "status": "pending_payment",
            "items": lines,
            "subtotal_cents": subtotal,
            "tax_cents": tax_cents,
            "shipping_cents": shipping_cents,
            "total_cents": total_cents,
            "currency": "USD",
            "email": str(payload.email),
            "full_name": payload.full_name,
            "shipping_address": payload.shipping_address.model_dump(),
            "shipping_service": payload.shipping_service or "",
            "shipping_carrier": payload.shipping_carrier or "",
            "shipping_rate_id": payload.shipping_rate_id or "",
            "square_location_id": LOCATION_ID,
        }
        await db.orders.insert_one(dict(order_doc))

        idempotency_key = payload.idempotency_key or str(uuid.uuid4())
        sq_shipping = {
            "address_line_1": payload.shipping_address.line1,
            "address_line_2": payload.shipping_address.line2 or "",
            "locality": payload.shipping_address.city,
            "administrative_district_level_1": payload.shipping_address.state,
            "postal_code": payload.shipping_address.postal_code,
            "country": payload.shipping_address.country,
        }
        payment_args = dict(
            source_id=payload.source_id,
            idempotency_key=idempotency_key,
            amount_money={"amount": total_cents, "currency": "USD"},
            autocomplete=True,
            location_id=LOCATION_ID,
            buyer_email_address=str(payload.email),
            shipping_address=sq_shipping,
            note=f"{ORDER_BRAND} — {order_number}",
            reference_id=order_number,
        )
        if payload.verification_token:
            payment_args["verification_token"] = payload.verification_token

        client = _client()
        try:
            resp = client.payments.create(**payment_args)
            payment = _safe_payment(getattr(resp, "payment", None) or resp)
        except Exception as exc:  # noqa: BLE001
            logger.exception("Square payment failed for %s", order_number)
            err_msg = str(exc)
            await db.orders.update_one({"id": order_id}, {"$set": {"status": "payment_failed", "square_error": err_msg[:500]}})
            raise HTTPException(status_code=400, detail="Payment was declined. Please try a different card.") from exc

        payment_id = payment.get("id", "")
        payment_status = payment.get("status", "")
        receipt_url = payment.get("receipt_url", "")
        new_status = "paid" if payment_status == "COMPLETED" else ("payment_processing" if payment_status in ("APPROVED", "PENDING") else "payment_failed")

        await db.orders.update_one({"id": order_id}, {"$set": {
            "status": new_status,
            "square_payment_id": payment_id,
            "square_payment_status": payment_status,
            "square_receipt_url": receipt_url,
            "square_idempotency_key": idempotency_key,
        }})

        # Queue confirmation email
        if new_status == "paid":
            try:
                items_html = "".join(
                    f"<li>{ln['quantity']} × {ln['product_name']}"
                    + (f" ({ln['variant_label']})" if ln['variant_label'] else "")
                    + f" — ${ln['line_total_cents']/100:.2f}</li>"
                    for ln in lines
                )
                ship = payload.shipping_address
                html = f"""
                <div style="font-family:system-ui,sans-serif;max-width:560px;margin:auto;color:#3a4a55">
                  <h1 style="color:#5a8a6f">Thank you, {payload.full_name}!</h1>
                  <p>Your order <b>{order_number}</b> is confirmed.</p>
                  <ul>{items_html}</ul>
                  <p>
                    Subtotal: ${subtotal/100:.2f}<br/>
                    Tax: ${tax_cents/100:.2f}<br/>
                    Shipping: ${shipping_cents/100:.2f}<br/>
                    <b>Total: ${total_cents/100:.2f}</b>
                  </p>
                  <p>Ship to:<br/>
                    {ship.line1}{(', ' + ship.line2) if ship.line2 else ''}<br/>
                    {ship.city}, {ship.state} {ship.postal_code}<br/>
                    {ship.country}
                  </p>
                  <p>We'll send a shipping confirmation once your Stuffies are on their way.</p>
                  {f'<p><a href="{receipt_url}">View Square receipt</a></p>' if receipt_url else ''}
                  <p style="color:#7f8b94;font-size:12px">— {ORDER_BRAND}</p>
                </div>"""
                await queue_email_fn(
                    db,
                    to=str(payload.email),
                    subject=f"Your {ORDER_BRAND} order {order_number}",
                    html=html,
                    purpose="order_confirmation",
                    from_email=ORDER_FROM,
                )
            except Exception as exc:  # noqa: BLE001
                logger.warning("Confirmation email queue failed: %s", exc)

        return {
            "order_id": order_id,
            "order_number": order_number,
            "status": new_status,
            "payment_id": payment_id,
            "payment_status": payment_status,
            "receipt_url": receipt_url,
            "total_cents": total_cents,
        }

    @router.post("/webhooks/square")
    async def square_webhook(request: Request):
        raw = await request.body()
        sig_header = request.headers.get("x-square-hmacsha256-signature", "")
        if WEBHOOK_KEY and WEBHOOK_URL:
            try:
                msg = (WEBHOOK_URL + raw.decode("utf-8")).encode("utf-8")
                expected = base64.b64encode(
                    hmac.new(WEBHOOK_KEY.encode("utf-8"), msg, hashlib.sha256).digest()
                ).decode("utf-8")
                if not hmac.compare_digest(expected, sig_header):
                    raise HTTPException(status_code=403, detail="Invalid signature")
            except HTTPException:
                raise
            except Exception as exc:  # noqa: BLE001
                logger.warning("Webhook signature compute failed: %s", exc)
                raise HTTPException(status_code=400, detail="Bad webhook")

        try:
            event = json.loads(raw)
        except Exception:  # noqa: BLE001
            raise HTTPException(status_code=400, detail="Bad JSON")

        evt_id = event.get("event_id") or ""
        evt_type = event.get("type") or ""
        # Idempotency — dedupe by event_id
        if evt_id:
            seen = await db.square_events.find_one({"event_id": evt_id}, {"_id": 0, "event_id": 1})
            if seen:
                return {"ok": True, "dedup": True}
            await db.square_events.insert_one({"event_id": evt_id, "type": evt_type, "received_at": _now()})

        data = (event.get("data") or {}).get("object") or {}
        if evt_type == "payment.updated":
            p = data.get("payment") or {}
            pid = p.get("id")
            if pid:
                await db.orders.update_one({"square_payment_id": pid}, {"$set": {
                    "square_payment_status": p.get("status", ""),
                    "status": "paid" if p.get("status") == "COMPLETED" else "payment_processing",
                }})
        elif evt_type in ("refund.created", "refund.updated"):
            r = data.get("refund") or {}
            pid = r.get("payment_id")
            if pid:
                await db.orders.update_one({"square_payment_id": pid}, {"$set": {
                    "refund_status": r.get("status", ""),
                    "refund_id": r.get("id", ""),
                    "refund_amount_cents": (r.get("amount_money") or {}).get("amount", 0),
                }})
        return {"ok": True}

    return router


def make_admin_orders_router(db):
    """Admin-protected order management routes (mounted under /admin)."""
    router = APIRouter(tags=["admin-orders"])

    @router.get("/orders")
    async def list_orders(limit: int = 100):
        cur = db.orders.find({}, {"_id": 0}).sort("created_at", -1).limit(limit)
        return await cur.to_list(limit)

    @router.post("/orders/{order_id}/fulfill")
    async def fulfill_order(order_id: str):
        res = await db.orders.update_one({"id": order_id}, {"$set": {"status": "fulfilled", "fulfilled_at": _now()}})
        if res.matched_count == 0:
            raise HTTPException(status_code=404, detail="Order not found")
        return {"ok": True}

    @router.post("/orders/{order_id}/refund")
    async def refund_order(order_id: str, body: dict = None):
        order = await db.orders.find_one({"id": order_id}, {"_id": 0})
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        pid = order.get("square_payment_id")
        if not pid:
            raise HTTPException(status_code=400, detail="No Square payment to refund.")
        amount = (body or {}).get("amount_cents") if body else None
        amount = int(amount) if amount else int(order.get("total_cents", 0))
        client = _client()
        try:
            resp = client.refunds.refund_payment(
                idempotency_key=str(uuid.uuid4()),
                amount_money={"amount": amount, "currency": order.get("currency", "USD")},
                payment_id=pid,
            )
            refund = _safe_payment(getattr(resp, "refund", None) or resp)
        except Exception as exc:  # noqa: BLE001
            logger.exception("Refund failed")
            raise HTTPException(status_code=400, detail=f"Refund failed: {str(exc)[:200]}") from exc
        await db.orders.update_one({"id": order_id}, {"$set": {
            "refund_id": refund.get("id", ""),
            "refund_status": refund.get("status", ""),
            "refund_amount_cents": amount,
            "status": "refunded" if amount >= int(order.get("total_cents", 0)) else "partial_refund",
        }})
        return {"ok": True, "refund_id": refund.get("id", ""), "status": refund.get("status", "")}

    return router

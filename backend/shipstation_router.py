"""ShipStation V2 integration — live multi-carrier shipping rates at checkout.

Exposes:
  • POST /api/checkout/shipping-rates — given a cart + destination address,
    returns an array of live, selectable carrier rates (cheapest first)
    pulled from the merchant's connected ShipStation carriers.

The frontend Checkout.jsx calls this once the buyer has filled out a
valid shipping address, displays the returned rates as a radio group,
and forwards the chosen `service_code` + `shipping_cents` to
/api/checkout/square. No data is persisted from this endpoint — it is
a stateless rate calculator.
"""
from __future__ import annotations

import logging
import os
from typing import List, Optional

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger("shipstation")

SHIPSTATION_BASE = "https://api.shipstation.com/v2"
SHIPSTATION_API_KEY = os.environ.get("SHIPSTATION_API_KEY", "")

# Ship From (the merchant's warehouse / home base).
SHIP_FROM_NAME = os.environ.get("SHIP_FROM_NAME", "Myrtle and Ray")
SHIP_FROM_PHONE = os.environ.get("SHIP_FROM_PHONE", "555-555-5555")
SHIP_FROM_LINE1 = os.environ.get("SHIP_FROM_LINE1", "477 Ocean Avenue")
SHIP_FROM_LINE2 = os.environ.get("SHIP_FROM_LINE2", "")
SHIP_FROM_CITY = os.environ.get("SHIP_FROM_CITY", "East Rockaway")
SHIP_FROM_STATE = os.environ.get("SHIP_FROM_STATE", "NY")
SHIP_FROM_POSTAL = os.environ.get("SHIP_FROM_POSTAL", "11518")
SHIP_FROM_COUNTRY = os.environ.get("SHIP_FROM_COUNTRY", "US")

# Default per-item package dimensions (small box, ~12oz plush stuffie).
PKG_WEIGHT_OZ = float(os.environ.get("STUFFIES_PKG_WEIGHT_OZ", "12") or 12)
PKG_LEN_IN = float(os.environ.get("STUFFIES_PKG_LEN_IN", "9") or 9)
PKG_WID_IN = float(os.environ.get("STUFFIES_PKG_WID_IN", "6") or 6)
PKG_HGT_IN = float(os.environ.get("STUFFIES_PKG_HGT_IN", "3") or 3)


class RateAddress(BaseModel):
    line1: str
    line2: Optional[str] = ""
    city: str
    state: str
    postal_code: str
    country: str = "US"


class RateItem(BaseModel):
    quantity: int = Field(ge=1, le=20)


class RateRequest(BaseModel):
    items: List[RateItem]
    shipping_address: RateAddress
    full_name: Optional[str] = ""
    phone: Optional[str] = ""


def _ship_from_block() -> dict:
    return {
        "name": SHIP_FROM_NAME,
        "phone": SHIP_FROM_PHONE,
        "address_line1": SHIP_FROM_LINE1,
        "address_line2": SHIP_FROM_LINE2,
        "city_locality": SHIP_FROM_CITY,
        "state_province": SHIP_FROM_STATE,
        "postal_code": SHIP_FROM_POSTAL,
        "country_code": SHIP_FROM_COUNTRY,
        "address_residential_indicator": "yes",
    }


async def _list_carrier_ids(http: httpx.AsyncClient) -> List[str]:
    """Pull all connected carrier IDs (so rates returned cover every
    carrier the merchant has set up in ShipStation)."""
    r = await http.get(f"{SHIPSTATION_BASE}/carriers")
    if r.status_code != 200:
        logger.warning("ShipStation /carriers returned %s: %s", r.status_code, r.text[:200])
        return []
    data = r.json() or {}
    return [c.get("carrier_id") for c in (data.get("carriers") or []) if c.get("carrier_id")]


def _aggregate_package(total_qty: int) -> dict:
    """One package per stuffie keeps weight/dimensions correct as quantity
    increases.  ShipStation supports multi-package shipments — but USPS
    services don't, so we scale the weight on a single box instead and
    bump dims slightly when quantity > 1."""
    qty = max(int(total_qty), 1)
    weight_oz = PKG_WEIGHT_OZ * qty
    # Stack into a single box: keep L×W, grow height with qty.
    height = PKG_HGT_IN * qty if qty <= 4 else PKG_HGT_IN * 4
    return {
        "weight": {"value": round(weight_oz, 2), "unit": "ounce"},
        "dimensions": {"unit": "inch", "length": PKG_LEN_IN, "width": PKG_WID_IN, "height": round(height, 2)},
    }


def make_shipstation_router():
    router = APIRouter(tags=["shipstation"])

    @router.get("/checkout/shipping-rates/health")
    async def health():
        """Quick check that the ShipStation key is configured + valid."""
        if not SHIPSTATION_API_KEY:
            return {"configured": False, "reason": "SHIPSTATION_API_KEY env var missing"}
        try:
            async with httpx.AsyncClient(timeout=10.0, headers={"API-Key": SHIPSTATION_API_KEY}) as http:
                r = await http.get(f"{SHIPSTATION_BASE}/carriers")
                if r.status_code != 200:
                    return {"configured": True, "valid": False, "status": r.status_code, "body": r.text[:200]}
                data = r.json() or {}
                carriers = data.get("carriers") or []
                return {
                    "configured": True,
                    "valid": True,
                    "carrier_count": len(carriers),
                    "carriers": [{"id": c.get("carrier_id"), "name": c.get("friendly_name"), "code": c.get("carrier_code")} for c in carriers],
                    "ship_from": {
                        "name": SHIP_FROM_NAME,
                        "city": SHIP_FROM_CITY,
                        "state": SHIP_FROM_STATE,
                        "postal_code": SHIP_FROM_POSTAL,
                    },
                }
        except Exception as exc:  # noqa: BLE001
            return {"configured": True, "valid": False, "error": str(exc)[:200]}

    @router.post("/checkout/shipping-rates")
    async def get_rates(payload: RateRequest):
        if not SHIPSTATION_API_KEY:
            raise HTTPException(status_code=503, detail="Shipping rates are not configured.")
        addr = payload.shipping_address
        if not (addr.line1 and addr.city and addr.state and addr.postal_code):
            raise HTTPException(status_code=400, detail="Complete shipping address required.")

        total_qty = sum(int(i.quantity) for i in payload.items) or 1
        package = _aggregate_package(total_qty)

        ship_to = {
            "name": (payload.full_name or "Buyer").strip() or "Buyer",
            "phone": payload.phone or "555-555-5555",
            "address_line1": addr.line1,
            "address_line2": addr.line2 or "",
            "city_locality": addr.city,
            "state_province": addr.state,
            "postal_code": addr.postal_code,
            "country_code": (addr.country or "US").upper(),
            "address_residential_indicator": "yes",
        }

        headers = {"API-Key": SHIPSTATION_API_KEY, "Content-Type": "application/json"}
        try:
            async with httpx.AsyncClient(timeout=20.0, headers=headers) as http:
                carrier_ids = await _list_carrier_ids(http)
                if not carrier_ids:
                    raise HTTPException(status_code=503, detail="No connected ShipStation carriers found.")

                body = {
                    "rate_options": {"carrier_ids": carrier_ids},
                    "shipment": {
                        "ship_from": _ship_from_block(),
                        "ship_to": ship_to,
                        "packages": [package],
                    },
                }
                r = await http.post(f"{SHIPSTATION_BASE}/rates", json=body)
                if r.status_code != 200:
                    logger.warning("ShipStation /rates failed (%s): %s", r.status_code, r.text[:400])
                    # Surface a clean error — most common is invalid destination
                    detail = "Could not fetch shipping rates for this address."
                    try:
                        errs = (r.json() or {}).get("errors") or []
                        if errs and errs[0].get("message"):
                            detail = errs[0]["message"]
                    except Exception:  # noqa: BLE001
                        pass
                    raise HTTPException(status_code=400, detail=detail)

                data = r.json() or {}
        except HTTPException:
            raise
        except Exception as exc:  # noqa: BLE001
            logger.exception("ShipStation rate fetch crashed")
            raise HTTPException(status_code=502, detail=f"Shipping calculator error: {str(exc)[:200]}") from exc

        rate_resp = data.get("rate_response") or {}
        raw_rates = rate_resp.get("rates") or []
        invalid = rate_resp.get("invalid_rates") or []

        cleaned = []
        # Carrier/service allow-list — restrict to USPS (minus exclusions) +
        # UPS Ground + UPS 2nd Day Air only. Easy to edit per business needs.
        EXCLUDED_USPS_SERVICES = {
            "usps_media_mail",  # books/media only — not eligible for plush
            "usps_priority_mail_international",
            "usps_priority_mail_express_international",
            "usps_first_class_mail_international",
        }
        ALLOWED_UPS_SERVICES = {
            "ups_ground",
            "ups_2nd_day_air",
            "ups_2nd_day_air_am",  # variant some accounts return
        }
        EXCLUDED_GLOBAL = {
            "globalpost_economy", "globalpost_priority", "gp_plus",
        }

        def _service_allowed(carrier_code: str, service_code: str) -> bool:
            c = (carrier_code or "").lower()
            s = (service_code or "").lower()
            if s in EXCLUDED_GLOBAL:
                return False
            if c == "usps":
                # Allow all USPS for US domestic; exclude media + international.
                if (addr.country or "US").upper() == "US" and s in EXCLUDED_USPS_SERVICES:
                    return False
                return True
            if c == "ups":
                return s in ALLOWED_UPS_SERVICES
            # FedEx + every other carrier explicitly excluded.
            return False

        for rt in raw_rates:
            amt = (rt.get("shipping_amount") or {}).get("amount")
            if amt is None:
                continue
            svc = rt.get("service_code") or ""
            carrier_code = rt.get("carrier_code") or ""
            if not _service_allowed(carrier_code, svc):
                continue
            cents = int(round(float(amt) * 100))
            cleaned.append({
                "rate_id": rt.get("rate_id"),
                "service_code": rt.get("service_code") or "",
                "service_type": rt.get("service_type") or rt.get("service_code") or "Shipping",
                "carrier_code": rt.get("carrier_code") or "",
                "carrier_name": rt.get("carrier_friendly_name") or rt.get("carrier_code") or "",
                "shipping_cents": cents,
                "delivery_days": rt.get("delivery_days"),
                "estimated_delivery_date": rt.get("estimated_delivery_date") or "",
                "rate_attributes": rt.get("rate_attributes") or [],
                "package_type": rt.get("package_type") or "",
                "trackable": bool(rt.get("trackable")),
            })

        # Sort: cheapest first, fallback to delivery_days then carrier.
        cleaned.sort(key=lambda r: (r["shipping_cents"], r.get("delivery_days") or 99))

        # De-dup by (carrier_code, service_code) — keep the cheapest.
        seen = set()
        deduped = []
        for r in cleaned:
            key = (r["carrier_code"], r["service_code"])
            if key in seen:
                continue
            seen.add(key)
            deduped.append(r)

        if not deduped:
            # Likely an invalid destination — surface the first ShipStation hint.
            hint = ""
            for inv in invalid:
                msgs = inv.get("error_messages") or []
                if msgs:
                    hint = msgs[0]
                    break
            raise HTTPException(status_code=400, detail=hint or "No shipping options available for this address.")

        return {"rates": deduped, "package": package, "total_quantity": total_qty}

    return router

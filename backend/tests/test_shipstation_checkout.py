"""ShipStation V2 + Square checkout shipping-rates integration tests."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback read frontend/.env
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
    except Exception:
        pass

API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def stuffie_slug():
    r = requests.get(f"{API}/products", params={"category": "Stuffies"}, timeout=15)
    assert r.status_code == 200, r.text
    products = r.json()
    in_stock = [p for p in products if p.get("inventory_status") == "In Stock"]
    assert in_stock, "No in-stock Stuffies for testing"
    return in_stock[0]["slug"]


# --- ShipStation health ---
class TestShipStationHealth:
    def test_health(self):
        r = requests.get(f"{API}/checkout/shipping-rates/health", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("configured") is True
        assert data.get("valid") is True
        assert data.get("carrier_count", 0) >= 1
        carriers = data.get("carriers") or []
        codes = [(c.get("code") or "").lower() for c in carriers]
        # at least one of usps / ups / fedex
        assert any(any(k in code for k in ("usps", "stamps", "ups", "fedex")) for code in codes), codes
        sf = data.get("ship_from") or {}
        assert sf.get("postal_code") == "11518"
        assert sf.get("state") == "NY"


# --- Live rates ---
class TestShippingRates:
    def test_domestic_us_rates(self):
        body = {
            "items": [{"quantity": 1}],
            "shipping_address": {
                "line1": "1600 Pennsylvania Ave NW",
                "city": "Washington",
                "state": "DC",
                "postal_code": "20500",
                "country": "US",
            },
            "full_name": "Test Buyer",
        }
        r = requests.post(f"{API}/checkout/shipping-rates", json=body, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        rates = data.get("rates") or []
        assert len(rates) >= 1
        # cheapest first
        cents = [rt["shipping_cents"] for rt in rates]
        assert cents == sorted(cents)
        first = rates[0]
        for k in ("rate_id", "service_code", "service_type", "carrier_code", "carrier_name", "shipping_cents"):
            assert k in first
        # Media Mail excluded
        codes = [rt["service_code"] for rt in rates]
        assert "usps_media_mail" not in codes
        # Package weight = 12 oz for qty 1
        assert data.get("package", {}).get("weight", {}).get("value") == 12.0

    def test_multi_quantity_scales_weight(self):
        body = {
            "items": [{"quantity": 3}],
            "shipping_address": {
                "line1": "1600 Pennsylvania Ave NW",
                "city": "Washington",
                "state": "DC",
                "postal_code": "20500",
                "country": "US",
            },
        }
        r = requests.post(f"{API}/checkout/shipping-rates", json=body, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("package", {}).get("weight", {}).get("value") == 36.0
        assert data.get("total_quantity") == 3

    def test_invalid_zip_returns_400(self):
        body = {
            "items": [{"quantity": 1}],
            "shipping_address": {
                "line1": "Nowhere St",
                "city": "Nowhere",
                "state": "ZZ",
                "postal_code": "00000",
                "country": "US",
            },
        }
        r = requests.post(f"{API}/checkout/shipping-rates", json=body, timeout=30)
        assert r.status_code == 400, f"expected 400 got {r.status_code}: {r.text}"
        assert "detail" in r.json()

    def test_missing_city_returns_400_or_422(self):
        body = {
            "items": [{"quantity": 1}],
            "shipping_address": {
                "line1": "1600 Pennsylvania Ave NW",
                "city": "",
                "state": "DC",
                "postal_code": "20500",
                "country": "US",
            },
        }
        r = requests.post(f"{API}/checkout/shipping-rates", json=body, timeout=20)
        # Empty string passes pydantic but fails our validation -> 400
        assert r.status_code in (400, 422), r.text

    def test_missing_postal_returns_422(self):
        body = {
            "items": [{"quantity": 1}],
            "shipping_address": {
                "line1": "1600 Pennsylvania Ave NW",
                "city": "Washington",
                "state": "DC",
                "country": "US",
            },
        }
        r = requests.post(f"{API}/checkout/shipping-rates", json=body, timeout=20)
        assert r.status_code in (400, 422), r.text


# --- quote-cart override ---
class TestQuoteCart:
    def test_quote_cart_uses_override_shipping(self, stuffie_slug):
        body = {
            "items": [{"product_slug": stuffie_slug, "quantity": 1}],
            "shipping_cents": 661,
        }
        r = requests.post(f"{API}/checkout/quote-cart", json=body, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["shipping_cents"] == 661
        expected_total = d["subtotal_cents"] + d["tax_cents"] + d["shipping_cents"]
        assert d["total_cents"] == expected_total

    def test_quote_cart_falls_back_to_legacy_800(self, stuffie_slug):
        body = {"items": [{"product_slug": stuffie_slug, "quantity": 1}]}
        r = requests.post(f"{API}/checkout/quote-cart", json=body, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["shipping_cents"] == 800
        assert d["subtotal_cents"] > 0


# --- Square checkout schema acceptance ---
class TestSquareCheckoutSchema:
    def test_checkout_accepts_shipping_fields_and_rejects_bad_source(self, stuffie_slug):
        body = {
            "items": [{"product_slug": stuffie_slug, "quantity": 1}],
            "email": "test@example.com",
            "full_name": "Test Buyer",
            "shipping_address": {
                "line1": "1600 Pennsylvania Ave NW",
                "city": "Washington", "state": "DC",
                "postal_code": "20500", "country": "US",
            },
            "source_id": "cnon:card-nonce-fake",
            "shipping_cents": 661,
            "shipping_service": "UPS Ground Saver",
            "shipping_carrier": "UPS",
            "shipping_rate_id": "se-test-rate-id",
        }
        r = requests.post(f"{API}/checkout/square", json=body, timeout=30)
        # Should NOT be 500 / schema-422 — should be 400 (payment declined) or similar.
        assert r.status_code in (400, 503), f"expected 400/503 got {r.status_code}: {r.text[:300]}"
        # Validate not a Pydantic validation error (422)
        assert r.status_code != 422, "Schema rejected new shipping fields"

    def test_legacy_checkout_without_shipping_cents_still_accepted(self, stuffie_slug):
        body = {
            "items": [{"product_slug": stuffie_slug, "quantity": 1}],
            "email": "test@example.com",
            "full_name": "Test Buyer",
            "shipping_address": {
                "line1": "1600 Pennsylvania Ave NW",
                "city": "Washington", "state": "DC",
                "postal_code": "20500", "country": "US",
            },
            "source_id": "cnon:card-nonce-fake",
        }
        r = requests.post(f"{API}/checkout/square", json=body, timeout=30)
        assert r.status_code in (400, 503), f"expected 400/503 got {r.status_code}: {r.text[:300]}"
        assert r.status_code != 422

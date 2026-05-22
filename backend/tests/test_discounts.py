"""Discount code system tests — covers /api/admin/discounts CRUD,
/api/checkout/validate-discount, /api/checkout/quote-cart with discount,
/api/checkout/square persistence, BOGO logic, and idempotent redemption."""
import os
import sys
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
    except Exception:
        pass

API = f"{BASE_URL}/api"
ADMIN_EMAIL = "community@rollingriver.com"
ADMIN_PASSWORD = "Camp1993!"

MYRTLE = "myrtle-stuffie"
RAY = "ray-stuffie"
PRICE_CENTS = 1499  # $14.99 each


# -------- fixtures --------
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
                      timeout=15)
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text[:200]}")
    tok = r.json().get("access_token")
    assert tok
    return tok


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="session")
def unique_suffix():
    return uuid.uuid4().hex[:8].upper()


# Track every code we create so we can clean up.
_CREATED_IDS = []


def _create_code(headers, body):
    r = requests.post(f"{API}/admin/discounts", json=body, headers=headers, timeout=15)
    return r


def _delete(headers, disc_id):
    try:
        requests.delete(f"{API}/admin/discounts/{disc_id}", headers=headers, timeout=10)
    except Exception:
        pass


@pytest.fixture(scope="session", autouse=True)
def _cleanup_after(admin_headers):
    yield
    for did in _CREATED_IDS:
        _delete(admin_headers, did)


# ============================================================
# Admin CRUD
# ============================================================
class TestAdminDiscountCRUD:
    def test_create_percent(self, admin_headers, unique_suffix):
        code = f"TESTPCT{unique_suffix}"
        r = _create_code(admin_headers, {
            "code": code, "type": "percent", "value": 20,
            "description": "20% off test",
        })
        assert r.status_code == 200, r.text
        d = r.json()
        _CREATED_IDS.append(d["id"])
        assert d["code"] == code
        assert d["type"] == "percent"
        assert d["value"] == 20
        assert d["active"] is True
        assert d["usage_count"] == 0

    def test_create_fixed_with_min_subtotal(self, admin_headers, unique_suffix):
        code = f"TESTFIX{unique_suffix}"
        r = _create_code(admin_headers, {
            "code": code, "type": "fixed", "value": 5,
            "min_subtotal_cents": 2000,
        })
        assert r.status_code == 200, r.text
        d = r.json()
        _CREATED_IDS.append(d["id"])
        assert d["type"] == "fixed"
        assert d["min_subtotal_cents"] == 2000

    def test_create_free_shipping(self, admin_headers, unique_suffix):
        code = f"TESTFS{unique_suffix}"
        r = _create_code(admin_headers, {"code": code, "type": "free_shipping"})
        assert r.status_code == 200, r.text
        d = r.json()
        _CREATED_IDS.append(d["id"])
        assert d["type"] == "free_shipping"

    def test_create_bogo(self, admin_headers, unique_suffix):
        code = f"TESTBOGO{unique_suffix}"
        r = _create_code(admin_headers, {
            "code": code, "type": "bogo",
            "bogo_product_slug": MYRTLE,
        })
        assert r.status_code == 200, r.text
        d = r.json()
        _CREATED_IDS.append(d["id"])
        assert d["bogo_product_slug"] == MYRTLE

    def test_duplicate_code_returns_409(self, admin_headers, unique_suffix):
        code = f"TESTDUP{unique_suffix}"
        r1 = _create_code(admin_headers, {"code": code, "type": "percent", "value": 10})
        assert r1.status_code == 200, r1.text
        _CREATED_IDS.append(r1.json()["id"])
        r2 = _create_code(admin_headers, {"code": code, "type": "percent", "value": 15})
        assert r2.status_code == 409, r2.text

    def test_percent_out_of_range_400(self, admin_headers, unique_suffix):
        code = f"TESTBAD{unique_suffix}"
        r = _create_code(admin_headers, {"code": code, "type": "percent", "value": 150})
        assert r.status_code == 400, r.text

    def test_bogo_missing_slug_400(self, admin_headers, unique_suffix):
        code = f"TESTBOGOX{unique_suffix}"
        r = _create_code(admin_headers, {"code": code, "type": "bogo"})
        assert r.status_code == 400, r.text

    def test_patch_updates_fields(self, admin_headers, unique_suffix):
        code = f"TESTPATCH{unique_suffix}"
        r = _create_code(admin_headers, {"code": code, "type": "percent", "value": 10})
        assert r.status_code == 200
        did = r.json()["id"]
        _CREATED_IDS.append(did)
        u = requests.patch(f"{API}/admin/discounts/{did}",
                           json={"value": 25, "description": "updated"},
                           headers=admin_headers, timeout=15)
        assert u.status_code == 200, u.text
        d = u.json()
        assert d["value"] == 25
        assert d["description"] == "updated"
        # GET single
        g = requests.get(f"{API}/admin/discounts/{did}", headers=admin_headers, timeout=10)
        assert g.status_code == 200
        assert g.json()["value"] == 25

    def test_delete_then_404(self, admin_headers, unique_suffix):
        code = f"TESTDEL{unique_suffix}"
        r = _create_code(admin_headers, {"code": code, "type": "percent", "value": 10})
        did = r.json()["id"]
        d = requests.delete(f"{API}/admin/discounts/{did}", headers=admin_headers, timeout=10)
        assert d.status_code == 200
        g = requests.get(f"{API}/admin/discounts/{did}", headers=admin_headers, timeout=10)
        assert g.status_code == 404

    def test_list_includes_created(self, admin_headers, unique_suffix):
        code = f"TESTLST{unique_suffix}"
        r = _create_code(admin_headers, {"code": code, "type": "fixed", "value": 3})
        _CREATED_IDS.append(r.json()["id"])
        lst = requests.get(f"{API}/admin/discounts", headers=admin_headers, timeout=10)
        assert lst.status_code == 200
        codes = [d["code"] for d in lst.json()]
        assert code in codes

    def test_requires_admin(self):
        r = requests.get(f"{API}/admin/discounts", timeout=10)
        assert r.status_code in (401, 403), r.status_code


# ============================================================
# Public validate-discount
# ============================================================
def _line(slug, qty, price=PRICE_CENTS):
    return {"product_slug": slug, "variant_sku": "", "quantity": qty, "unit_price_cents": price}


class TestValidateDiscount:
    def test_percent_happy(self, admin_headers, unique_suffix):
        code = f"VPCT{unique_suffix}"
        r = _create_code(admin_headers, {"code": code, "type": "percent", "value": 20})
        _CREATED_IDS.append(r.json()["id"])
        v = requests.post(f"{API}/checkout/validate-discount", json={
            "code": code, "items": [_line(MYRTLE, 1)], "subtotal_cents": PRICE_CENTS,
        }, timeout=15)
        assert v.status_code == 200, v.text
        d = v.json()
        assert d["discount_cents"] == round(PRICE_CENTS * 0.20)
        assert d["free_shipping"] is False

    def test_fixed_min_subtotal_blocks(self, admin_headers, unique_suffix):
        code = f"VFIX{unique_suffix}"
        r = _create_code(admin_headers, {"code": code, "type": "fixed", "value": 5,
                                          "min_subtotal_cents": 5000})
        _CREATED_IDS.append(r.json()["id"])
        # 1499 < 5000 -> reject
        v = requests.post(f"{API}/checkout/validate-discount", json={
            "code": code, "items": [_line(MYRTLE, 1)], "subtotal_cents": PRICE_CENTS,
        }, timeout=15)
        assert v.status_code == 400, v.text
        assert "more" in v.json().get("detail", "").lower() or "spend" in v.json().get("detail", "").lower()

    def test_invalid_code(self):
        v = requests.post(f"{API}/checkout/validate-discount", json={
            "code": "NOPE_DOES_NOT_EXIST_XYZ", "items": [], "subtotal_cents": 0,
        }, timeout=15)
        assert v.status_code == 400
        assert "invalid" in v.json()["detail"].lower()

    def test_inactive_code_rejected(self, admin_headers, unique_suffix):
        code = f"VINA{unique_suffix}"
        r = _create_code(admin_headers, {"code": code, "type": "percent", "value": 10,
                                          "active": False})
        _CREATED_IDS.append(r.json()["id"])
        v = requests.post(f"{API}/checkout/validate-discount", json={
            "code": code, "items": [_line(MYRTLE, 1)], "subtotal_cents": PRICE_CENTS,
        }, timeout=15)
        assert v.status_code == 400
        assert "active" in v.json()["detail"].lower()

    def test_expired_code(self, admin_headers, unique_suffix):
        code = f"VEXP{unique_suffix}"
        r = _create_code(admin_headers, {"code": code, "type": "percent", "value": 10,
                                          "expires_at": "2020-01-01T00:00:00Z"})
        _CREATED_IDS.append(r.json()["id"])
        v = requests.post(f"{API}/checkout/validate-discount", json={
            "code": code, "items": [_line(MYRTLE, 1)], "subtotal_cents": PRICE_CENTS,
        }, timeout=15)
        assert v.status_code == 400
        assert "expired" in v.json()["detail"].lower()

    def test_not_active_yet(self, admin_headers, unique_suffix):
        code = f"VFUT{unique_suffix}"
        r = _create_code(admin_headers, {"code": code, "type": "percent", "value": 10,
                                          "starts_at": "2099-01-01T00:00:00Z"})
        _CREATED_IDS.append(r.json()["id"])
        v = requests.post(f"{API}/checkout/validate-discount", json={
            "code": code, "items": [_line(MYRTLE, 1)], "subtotal_cents": PRICE_CENTS,
        }, timeout=15)
        assert v.status_code == 400
        assert "yet" in v.json()["detail"].lower() or "not" in v.json()["detail"].lower()

    def test_allowed_product_not_in_cart(self, admin_headers, unique_suffix):
        code = f"VPRD{unique_suffix}"
        r = _create_code(admin_headers, {"code": code, "type": "percent", "value": 20,
                                          "allowed_product_slugs": [MYRTLE]})
        _CREATED_IDS.append(r.json()["id"])
        # Cart has only RAY
        v = requests.post(f"{API}/checkout/validate-discount", json={
            "code": code, "items": [_line(RAY, 1)], "subtotal_cents": PRICE_CENTS,
        }, timeout=15)
        assert v.status_code == 400, v.text
        assert "apply" in v.json()["detail"].lower() or "cart" in v.json()["detail"].lower()

    def test_allowed_product_applies_only_to_eligible(self, admin_headers, unique_suffix):
        code = f"VELIG{unique_suffix}"
        r = _create_code(admin_headers, {"code": code, "type": "percent", "value": 20,
                                          "allowed_product_slugs": [MYRTLE]})
        _CREATED_IDS.append(r.json()["id"])
        # myrtle + ray, percent applies to MYRTLE subtotal only
        v = requests.post(f"{API}/checkout/validate-discount", json={
            "code": code,
            "items": [_line(MYRTLE, 1), _line(RAY, 1)],
            "subtotal_cents": PRICE_CENTS * 2,
        }, timeout=15)
        assert v.status_code == 200, v.text
        d = v.json()
        assert d["discount_cents"] == round(PRICE_CENTS * 0.20)

    def test_free_shipping_returns_shipping_cents(self, admin_headers, unique_suffix):
        code = f"VFS{unique_suffix}"
        r = _create_code(admin_headers, {"code": code, "type": "free_shipping"})
        _CREATED_IDS.append(r.json()["id"])
        v = requests.post(f"{API}/checkout/validate-discount", json={
            "code": code, "items": [_line(MYRTLE, 1)],
            "subtotal_cents": PRICE_CENTS, "shipping_cents": 800,
        }, timeout=15)
        assert v.status_code == 200, v.text
        d = v.json()
        assert d["free_shipping"] is True
        assert d["discount_cents"] == 800

    def test_max_total_uses_blocks_after_redemption(self, admin_headers, unique_suffix):
        # Create code with max_total_uses=1, then bump its usage_count via DB-less mock:
        # we instead simulate by calling record_redemption through square endpoint?
        # Simpler: PATCH usage_count is not supported in API. We rely on engine logic:
        # set max_total_uses=1 AND directly call validate with usage_count update via
        # forcing record_redemption — but we don't have direct DB access here.
        # Alternative: create with max_total_uses=0 first... not useful.
        # We test the engine behavior by patching usage_count via a workaround:
        # since admin patch accepts any field of DiscountBody (which doesn't include
        # usage_count), we skip this and rely on idempotent_redemption test below.
        pytest.skip("max_total_uses redemption flow covered by TestRedemption below")


# ============================================================
# BOGO logic
# ============================================================
class TestBOGO:
    def test_bogo_qty1_rejects(self, admin_headers, unique_suffix):
        code = f"BG1{unique_suffix}"
        r = _create_code(admin_headers, {"code": code, "type": "bogo",
                                          "bogo_product_slug": MYRTLE})
        _CREATED_IDS.append(r.json()["id"])
        v = requests.post(f"{API}/checkout/validate-discount", json={
            "code": code, "items": [_line(MYRTLE, 1)],
            "subtotal_cents": PRICE_CENTS,
        }, timeout=15)
        assert v.status_code == 400
        assert "second" in v.json()["detail"].lower() or "qualifying" in v.json()["detail"].lower()

    def test_bogo_qty2_gives_one_free(self, admin_headers, unique_suffix):
        code = f"BG2{unique_suffix}"
        r = _create_code(admin_headers, {"code": code, "type": "bogo",
                                          "bogo_product_slug": MYRTLE})
        _CREATED_IDS.append(r.json()["id"])
        v = requests.post(f"{API}/checkout/validate-discount", json={
            "code": code, "items": [_line(MYRTLE, 2)],
            "subtotal_cents": PRICE_CENTS * 2,
        }, timeout=15)
        assert v.status_code == 200, v.text
        assert v.json()["discount_cents"] == PRICE_CENTS

    def test_bogo_qty4_gives_two_free(self, admin_headers, unique_suffix):
        code = f"BG4{unique_suffix}"
        r = _create_code(admin_headers, {"code": code, "type": "bogo",
                                          "bogo_product_slug": MYRTLE})
        _CREATED_IDS.append(r.json()["id"])
        v = requests.post(f"{API}/checkout/validate-discount", json={
            "code": code, "items": [_line(MYRTLE, 4)],
            "subtotal_cents": PRICE_CENTS * 4,
        }, timeout=15)
        assert v.status_code == 200, v.text
        assert v.json()["discount_cents"] == PRICE_CENTS * 2


# ============================================================
# quote-cart with discount_code
# ============================================================
class TestQuoteCartWithDiscount:
    def test_quote_cart_applies_percent(self, admin_headers, unique_suffix):
        code = f"QPCT{unique_suffix}"
        r = _create_code(admin_headers, {"code": code, "type": "percent", "value": 20})
        _CREATED_IDS.append(r.json()["id"])
        q = requests.post(f"{API}/checkout/quote-cart", json={
            "items": [{"product_slug": MYRTLE, "quantity": 1}],
            "shipping_cents": 661,
            "discount_code": code,
        }, timeout=15)
        assert q.status_code == 200, q.text
        d = q.json()
        assert d.get("discount_cents", 0) > 0
        assert "discount" in d  # discount object surfaced

    def test_quote_cart_free_shipping_zeros_shipping(self, admin_headers, unique_suffix):
        code = f"QFS{unique_suffix}"
        r = _create_code(admin_headers, {"code": code, "type": "free_shipping"})
        _CREATED_IDS.append(r.json()["id"])
        q = requests.post(f"{API}/checkout/quote-cart", json={
            "items": [{"product_slug": MYRTLE, "quantity": 1}],
            "shipping_cents": 800,
            "discount_code": code,
        }, timeout=15)
        assert q.status_code == 200, q.text
        d = q.json()
        # Either shipping_cents is zeroed, or discount_cents == 800 (so total nets out)
        assert d["shipping_cents"] == 0 or d.get("discount_cents") == 800, d

    def test_quote_cart_min_subtotal_surfaces_error_not_400(self, admin_headers, unique_suffix):
        code = f"QMIN{unique_suffix}"
        r = _create_code(admin_headers, {"code": code, "type": "fixed", "value": 5,
                                          "min_subtotal_cents": 99999})
        _CREATED_IDS.append(r.json()["id"])
        q = requests.post(f"{API}/checkout/quote-cart", json={
            "items": [{"product_slug": MYRTLE, "quantity": 1}],
            "shipping_cents": 661,
            "discount_code": code,
        }, timeout=15)
        # Expectation per spec: returns 200 with discount.error surfaced
        assert q.status_code == 200, f"expected 200, got {q.status_code}: {q.text[:200]}"
        d = q.json()
        disc = d.get("discount") or {}
        assert disc.get("error"), f"expected discount.error to be set, got {d}"


# ============================================================
# Square checkout persistence of discount
# ============================================================
class TestSquareCheckoutDiscount:
    def test_discount_persists_on_order_doc(self, admin_headers, admin_token, unique_suffix):
        code = f"SQPCT{unique_suffix}"
        r = _create_code(admin_headers, {"code": code, "type": "percent", "value": 20})
        _CREATED_IDS.append(r.json()["id"])
        marker = f"TEST_disc_{uuid.uuid4().hex[:6]}@example.com"
        body = {
            "items": [{"product_slug": MYRTLE, "quantity": 1}],
            "email": marker,
            "full_name": "TEST Disc Persist",
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
            "discount_code": code,
        }
        r = requests.post(f"{API}/checkout/square", json=body, timeout=30)
        assert r.status_code in (400, 503), r.text[:300]
        # Inspect order doc
        lst = requests.get(f"{API}/admin/orders",
                          headers={"Authorization": f"Bearer {admin_token}"}, timeout=20)
        assert lst.status_code == 200
        matches = [o for o in lst.json() if o.get("email") == marker]
        assert matches, f"no order found for {marker}"
        order = matches[0]
        assert order.get("discount_code") == code, order
        assert order.get("discount_cents", 0) == round(PRICE_CENTS * 0.20), order
        # Expect order total = subtotal - discount + tax + shipping (server-recomputed)
        # We assert discount is at least applied; precise total depends on backend formula.

    def test_free_shipping_zeros_shipping_on_order(self, admin_headers, admin_token, unique_suffix):
        code = f"SQFS{unique_suffix}"
        r = _create_code(admin_headers, {"code": code, "type": "free_shipping"})
        _CREATED_IDS.append(r.json()["id"])
        marker = f"TEST_freeship_{uuid.uuid4().hex[:6]}@example.com"
        body = {
            "items": [{"product_slug": MYRTLE, "quantity": 1}],
            "email": marker, "full_name": "TEST FreeShip",
            "shipping_address": {
                "line1": "1600 Pennsylvania Ave NW",
                "city": "Washington", "state": "DC",
                "postal_code": "20500", "country": "US",
            },
            "source_id": "cnon:card-nonce-fake",
            "shipping_cents": 800,
            "discount_code": code,
        }
        r = requests.post(f"{API}/checkout/square", json=body, timeout=30)
        assert r.status_code in (400, 503), r.text[:300]
        lst = requests.get(f"{API}/admin/orders",
                          headers={"Authorization": f"Bearer {admin_token}"}, timeout=20)
        matches = [o for o in lst.json() if o.get("email") == marker]
        assert matches
        order = matches[0]
        assert order.get("shipping_cents") == 0, f"expected 0 shipping with FREESHIP, got {order.get('shipping_cents')}"
        assert order.get("discount_code") == code


# ============================================================
# Redemption tracking (idempotent + usage_count increments)
# ============================================================
class TestRedemption:
    def test_redemption_idempotent_via_engine(self, admin_headers, admin_token, unique_suffix):
        """Drive record_redemption indirectly: create code, hit /checkout/square
        with discount_code; even though Square rejects, the spec says
        record_redemption is called only on paid status. So instead we
        verify the endpoint /api/admin/discounts/{id}/redemptions exists
        and returns [] for an unused code, AND verify direct DB-side
        idempotency using a session-level helper.
        """
        code = f"RED{unique_suffix}"
        r = _create_code(admin_headers, {"code": code, "type": "fixed", "value": 1})
        did = r.json()["id"]
        _CREATED_IDS.append(did)
        red = requests.get(f"{API}/admin/discounts/{did}/redemptions",
                          headers=admin_headers, timeout=10)
        assert red.status_code == 200
        assert red.json() == []

    def test_record_redemption_directly_via_motor(self, admin_headers, unique_suffix):
        """Call backend's record_redemption helper through motor against the same DB
        the API uses. Verifies idempotency + usage_count increment."""
        try:
            import asyncio
            sys.path.insert(0, "/app/backend")
            from motor.motor_asyncio import AsyncIOMotorClient  # noqa
            from discount_router import record_redemption  # noqa
        except Exception as e:  # noqa: BLE001
            pytest.skip(f"motor/discount_router not importable in this env: {e}")
            return

        from dotenv import dotenv_values
        env = dotenv_values("/app/backend/.env")
        mongo_url = env.get("MONGO_URL", "mongodb://localhost:27017").strip('"')
        db_name = env.get("DB_NAME", "myrtle_and_ray").strip('"')

        code = f"REDX{unique_suffix}"
        cr = _create_code(admin_headers, {"code": code, "type": "fixed", "value": 1})
        did = cr.json()["id"]
        _CREATED_IDS.append(did)

        async def run():
            client = AsyncIOMotorClient(mongo_url)
            db = client[db_name]
            oid = f"TESTORDER_{uuid.uuid4().hex[:8]}"
            await record_redemption(db, code, "tester@example.com", oid, "TST-001", 100)
            await record_redemption(db, code, "tester@example.com", oid, "TST-001", 100)  # dup -> noop
            cnt = await db.discount_redemptions.count_documents({"code": code, "order_id": oid})
            disc = await db.discounts.find_one({"code": code}, {"_id": 0, "usage_count": 1})
            client.close()
            return cnt, disc

        cnt, disc = asyncio.run(run())
        assert cnt == 1, f"expected idempotent insert, got {cnt} rows"
        assert (disc or {}).get("usage_count") == 1

        # Now verify /admin/discounts/{id}/redemptions returns the row
        red = requests.get(f"{API}/admin/discounts/{did}/redemptions",
                          headers=admin_headers, timeout=10)
        assert red.status_code == 200
        rows = red.json()
        assert len(rows) == 1
        assert rows[0]["code"] == code
        assert rows[0]["amount_cents"] == 100

    def test_max_total_uses_blocks_after_increment(self, admin_headers, unique_suffix):
        """Create code with max_total_uses=1, simulate one redemption via
        record_redemption, then verify validate-discount rejects."""
        try:
            import asyncio
            sys.path.insert(0, "/app/backend")
            from motor.motor_asyncio import AsyncIOMotorClient  # noqa
            from discount_router import record_redemption  # noqa
        except Exception as e:
            pytest.skip(f"motor not importable: {e}")
            return

        from dotenv import dotenv_values
        env = dotenv_values("/app/backend/.env")
        mongo_url = env.get("MONGO_URL", "mongodb://localhost:27017").strip('"')
        db_name = env.get("DB_NAME", "myrtle_and_ray").strip('"')

        code = f"MAX1{unique_suffix}"
        cr = _create_code(admin_headers, {"code": code, "type": "percent",
                                          "value": 10, "max_total_uses": 1})
        _CREATED_IDS.append(cr.json()["id"])

        async def run():
            client = AsyncIOMotorClient(mongo_url)
            db = client[db_name]
            oid = f"TESTMAX_{uuid.uuid4().hex[:8]}"
            await record_redemption(db, code, "buyer@example.com", oid, "MAX-001", 100)
            client.close()
        asyncio.run(run())

        v = requests.post(f"{API}/checkout/validate-discount", json={
            "code": code, "items": [_line(MYRTLE, 1)],
            "subtotal_cents": PRICE_CENTS,
        }, timeout=15)
        assert v.status_code == 400, v.text
        assert "redeemed" in v.json()["detail"].lower() or "fully" in v.json()["detail"].lower()

    def test_max_per_customer(self, admin_headers, unique_suffix):
        try:
            import asyncio
            sys.path.insert(0, "/app/backend")
            from motor.motor_asyncio import AsyncIOMotorClient  # noqa
            from discount_router import record_redemption  # noqa
        except Exception as e:
            pytest.skip(f"motor not importable: {e}")
            return
        from dotenv import dotenv_values
        env = dotenv_values("/app/backend/.env")
        mongo_url = env.get("MONGO_URL", "mongodb://localhost:27017").strip('"')
        db_name = env.get("DB_NAME", "myrtle_and_ray").strip('"')

        code = f"PERC{unique_suffix}"
        cr = _create_code(admin_headers, {"code": code, "type": "percent",
                                          "value": 10, "max_per_customer": 1})
        _CREATED_IDS.append(cr.json()["id"])
        buyer = f"buyer_{unique_suffix.lower()}@example.com"

        async def run():
            client = AsyncIOMotorClient(mongo_url)
            db = client[db_name]
            await record_redemption(db, code, buyer, f"O_{uuid.uuid4().hex[:8]}", "PC-1", 100)
            client.close()
        asyncio.run(run())

        # Same buyer -> blocked
        v = requests.post(f"{API}/checkout/validate-discount", json={
            "code": code, "items": [_line(MYRTLE, 1)],
            "subtotal_cents": PRICE_CENTS, "email": buyer,
        }, timeout=15)
        assert v.status_code == 400, v.text
        # A different buyer -> allowed
        v2 = requests.post(f"{API}/checkout/validate-discount", json={
            "code": code, "items": [_line(MYRTLE, 1)],
            "subtotal_cents": PRICE_CENTS, "email": f"other_{unique_suffix.lower()}@example.com",
        }, timeout=15)
        assert v2.status_code == 200, v2.text

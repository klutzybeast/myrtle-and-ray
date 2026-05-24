"""Printify integration tests — admin sync + public listing + smart buy URL."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://wave-of-excitement.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "community@rollingriver.com"
ADMIN_PASSWORD = "Camp1993!"
POPUP_URL = "https://myrtleandray.printify.me/"


@pytest.fixture(scope="module")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_token(api_client):
    r = api_client.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text}")
    token = r.json().get("access_token") or r.json().get("token")
    if not token:
        pytest.skip("No token in login response")
    return token


@pytest.fixture(scope="module")
def admin_client(api_client, admin_token):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {admin_token}"})
    return s


# === Auth gating ===
class TestPrintifyAuthGating:
    def test_sync_requires_auth(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/printify/sync")
        assert r.status_code in (401, 403), f"unauth sync got {r.status_code}"

    def test_admin_list_requires_auth(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/printify/admin/products")
        assert r.status_code in (401, 403)

    def test_admin_patch_requires_auth(self, api_client):
        r = api_client.patch(f"{BASE_URL}/api/printify/admin/products/anyid", json={"featured": True})
        assert r.status_code in (401, 403)


# === Public listing shape ===
class TestPrintifyPublic:
    def test_public_products_returns_list(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/printify/products")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)

    def test_public_products_shape(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/printify/products")
        data = r.json()
        if not data:
            pytest.skip("No products synced yet — skipping shape test")
        p = data[0]
        for k in ("id", "title", "image_url", "images", "min_price", "max_price", "currency", "tags", "buy_url", "featured"):
            assert k in p, f"missing key {k}"
        assert isinstance(p["images"], list)
        assert isinstance(p["tags"], list)
        assert isinstance(p["min_price"], (int, float))
        assert p["buy_url"], "buy_url must not be empty"


# === Sync ===
class TestPrintifySync:
    def test_sync_runs(self, admin_client):
        r = admin_client.post(f"{BASE_URL}/api/printify/sync", timeout=60)
        assert r.status_code == 200, f"sync failed: {r.status_code} {r.text[:400]}"
        data = r.json()
        assert data.get("ok") is True
        assert "synced" in data
        assert "shop_id" in data
        assert data["synced"] >= 1, f"expected >=1 products synced, got {data['synced']}"

    def test_admin_list_after_sync(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/printify/admin/products")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        # admin should include hidden + etsy_url keys
        sample = data[0]
        assert "id" in sample
        assert "hidden" in sample
        assert "etsy_url" in sample


# === Admin overrides ===
class TestPrintifyAdminOverrides:
    @pytest.fixture(scope="class")
    def first_product_id(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/printify/admin/products")
        if r.status_code != 200 or not r.json():
            pytest.skip("No products available")
        return r.json()[0]["id"]

    def test_feature_toggle(self, admin_client, first_product_id, api_client):
        r = admin_client.patch(
            f"{BASE_URL}/api/printify/admin/products/{first_product_id}",
            json={"featured": True},
        )
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True
        # verify on public endpoint
        pub = api_client.get(f"{BASE_URL}/api/printify/products").json()
        target = next((x for x in pub if x["id"] == first_product_id), None)
        assert target is not None, "product missing from public list after featuring"
        assert target["featured"] is True

    def test_etsy_url_override_changes_buy_url(self, admin_client, first_product_id, api_client):
        etsy = "https://etsy.com/listing/TEST_999999"
        r = admin_client.patch(
            f"{BASE_URL}/api/printify/admin/products/{first_product_id}",
            json={"etsy_url": etsy},
        )
        assert r.status_code == 200
        pub = api_client.get(f"{BASE_URL}/api/printify/products").json()
        target = next((x for x in pub if x["id"] == first_product_id), None)
        assert target is not None
        assert target["buy_url"] == etsy, f"expected etsy override, got {target['buy_url']}"

    def test_clear_etsy_falls_back_to_popup(self, admin_client, first_product_id, api_client):
        r = admin_client.patch(
            f"{BASE_URL}/api/printify/admin/products/{first_product_id}",
            json={"etsy_url": ""},
        )
        assert r.status_code == 200
        pub = api_client.get(f"{BASE_URL}/api/printify/products").json()
        target = next((x for x in pub if x["id"] == first_product_id), None)
        assert target is not None
        assert target["buy_url"] == POPUP_URL

    def test_hide_removes_from_public(self, admin_client, first_product_id, api_client):
        r = admin_client.patch(
            f"{BASE_URL}/api/printify/admin/products/{first_product_id}",
            json={"hidden": True},
        )
        assert r.status_code == 200
        pub = api_client.get(f"{BASE_URL}/api/printify/products").json()
        assert all(x["id"] != first_product_id for x in pub), "hidden product still on public list"
        # but still visible in admin
        admin_list = admin_client.get(f"{BASE_URL}/api/printify/admin/products").json()
        assert any(x["id"] == first_product_id for x in admin_list)

    def test_unhide_restores(self, admin_client, first_product_id, api_client):
        r = admin_client.patch(
            f"{BASE_URL}/api/printify/admin/products/{first_product_id}",
            json={"hidden": False},
        )
        assert r.status_code == 200
        pub = api_client.get(f"{BASE_URL}/api/printify/products").json()
        assert any(x["id"] == first_product_id for x in pub)

    def test_patch_unknown_product_404(self, admin_client):
        r = admin_client.patch(
            f"{BASE_URL}/api/printify/admin/products/nonexistent_id_xyz",
            json={"featured": True},
        )
        assert r.status_code == 404


# === Re-sync preserves admin overrides ===
class TestPrintifyResyncPreservesOverrides:
    def test_resync_preserves_featured(self, admin_client, api_client):
        admin_list = admin_client.get(f"{BASE_URL}/api/printify/admin/products").json()
        if not admin_list:
            pytest.skip("no products")
        pid = admin_list[0]["id"]
        # set featured + etsy
        admin_client.patch(
            f"{BASE_URL}/api/printify/admin/products/{pid}",
            json={"featured": True, "etsy_url": "https://etsy.com/listing/TEST_PERSIST"},
        )
        # re-sync
        r = admin_client.post(f"{BASE_URL}/api/printify/sync", timeout=60)
        assert r.status_code == 200
        # verify still featured + etsy still set
        after = admin_client.get(f"{BASE_URL}/api/printify/admin/products").json()
        target = next((x for x in after if x["id"] == pid), None)
        assert target is not None
        assert target.get("featured") is True, "featured override lost after re-sync"
        assert target.get("etsy_url") == "https://etsy.com/listing/TEST_PERSIST", "etsy_url lost after re-sync"
        # cleanup
        admin_client.patch(
            f"{BASE_URL}/api/printify/admin/products/{pid}",
            json={"featured": False, "etsy_url": ""},
        )

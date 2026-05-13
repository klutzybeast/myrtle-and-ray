"""Backend API tests for Myrtle and Ray site.

Covers: health, public endpoints, public submissions, auth, admin CRUD,
settings, submissions, mailing list, email outbox, media uploads.
"""
from __future__ import annotations
import io
import os
import uuid
import struct
import zlib
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://wave-of-excitement.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "community@rollingriver.com"
ADMIN_PASSWORD = "Camp1993!"


# ------------------------------- fixtures -------------------------------
@pytest.fixture(scope="session")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def access_token(client):
    r = client.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text}")
    data = r.json()
    assert "access_token" in data
    assert data["role"] == "admin"
    return data["access_token"]


@pytest.fixture(scope="session")
def admin_client(client, access_token):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {access_token}"})
    return s


def _make_png_bytes() -> bytes:
    """Return a minimal 1x1 PNG."""
    sig = b"\x89PNG\r\n\x1a\n"
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    ihdr = chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0))
    raw = b"\x00\xff\x00\x00"  # filter byte + RGB pixel
    idat = chunk(b"IDAT", zlib.compress(raw))
    iend = chunk(b"IEND", b"")
    return sig + ihdr + idat + iend


# ------------------------------- health ---------------------------------
class TestHealth:
    def test_health(self, client):
        r = client.get(f"{API}/")
        assert r.status_code == 200
        data = r.json()
        assert data.get("ok") is True
        assert data.get("service") == "myrtle-and-ray"


# ------------------------------- public ---------------------------------
class TestPublic:
    def test_site_settings(self, client):
        r = client.get(f"{API}/site")
        assert r.status_code == 200
        data = r.json()
        assert "site_name" in data
        # Admin-only fields must not leak
        for forbidden in ("admin_login_alert_enabled", "admin_login_alert_email", "password_reset_email"):
            assert forbidden not in data, f"Admin-only field leaked: {forbidden}"

    def test_characters_list(self, client):
        r = client.get(f"{API}/characters")
        assert r.status_code == 200
        chars = r.json()
        assert isinstance(chars, list)
        assert len(chars) == 13, f"Expected 13 characters, got {len(chars)}"
        for c in chars:
            assert "_id" not in c
            assert c.get("image_url") is not None
            assert c.get("bio") is not None
            assert "slug" in c

    def test_character_myrtle(self, client):
        r = client.get(f"{API}/characters/myrtle")
        assert r.status_code == 200
        c = r.json()
        assert "myrtle" in c.get("name", "").lower() or "turtle" in c.get("name", "").lower()
        assert "_id" not in c

    def test_products_list(self, client):
        r = client.get(f"{API}/products")
        assert r.status_code == 200
        prods = r.json()
        assert isinstance(prods, list)
        assert len(prods) == 13, f"Expected 13 products, got {len(prods)}"
        for p in prods:
            assert "_id" not in p
            assert "slug" in p

    def test_products_featured_filter(self, client):
        r = client.get(f"{API}/products?featured=true")
        assert r.status_code == 200
        prods = r.json()
        assert isinstance(prods, list)
        for p in prods:
            assert p.get("featured") is True

    def test_product_detail(self, client):
        r = client.get(f"{API}/products/myrtle-stuffie")
        assert r.status_code == 200
        data = r.json()
        assert "product" in data
        assert "related" in data
        assert data["product"]["slug"] == "myrtle-stuffie"
        assert "_id" not in data["product"]

    def test_download_categories(self, client):
        r = client.get(f"{API}/download-categories")
        assert r.status_code == 200
        cats = r.json()
        assert len(cats) == 7, f"Expected 7 visible categories, got {len(cats)}"
        for c in cats:
            assert c.get("visible") is True

    def test_downloads_list(self, client):
        r = client.get(f"{API}/downloads")
        assert r.status_code == 200
        dls = r.json()
        assert len(dls) >= 17, f"Expected >= 17 downloads, got {len(dls)}"

    def test_downloads_by_category(self, client):
        r = client.get(f"{API}/downloads?category=coloring-pages")
        assert r.status_code == 200
        dls = r.json()
        assert len(dls) > 0
        for d in dls:
            assert "coloring-pages" in d.get("category_slugs", [])

    def test_downloads_by_audience(self, client):
        r = client.get(f"{API}/downloads?audience=Teachers")
        assert r.status_code == 200
        dls = r.json()
        assert len(dls) > 0
        for d in dls:
            assert "Teachers" in d.get("audiences", [])

    def test_download_detail(self, client):
        r = client.get(f"{API}/downloads/color-myrtle")
        assert r.status_code == 200
        data = r.json()
        assert "download" in data and "related" in data
        assert data["download"]["slug"] == "color-myrtle"

    def test_download_track_increment(self, client):
        before = client.get(f"{API}/downloads/color-myrtle").json()["download"].get("total_downloads", 0)
        r = client.post(f"{API}/downloads/color-myrtle/track")
        assert r.status_code == 200
        after = client.get(f"{API}/downloads/color-myrtle").json()["download"].get("total_downloads", 0)
        assert after == before + 1

    def test_page_homepage_hero(self, client):
        r = client.get(f"{API}/pages/homepage_hero")
        assert r.status_code == 200
        p = r.json()
        assert p.get("key") == "homepage_hero"
        assert isinstance(p.get("content"), dict)

    def test_page_wave_values(self, client):
        r = client.get(f"{API}/pages/wave_values")
        assert r.status_code == 200
        p = r.json()
        content = p.get("content", {})
        # Expect 4 cards in some structure
        cards = content.get("cards") or content.get("wave_cards") or []
        assert len(cards) == 4, f"Expected 4 W.A.V.E. cards, got {len(cards)}"

    def test_activities_list(self, client):
        r = client.get(f"{API}/activities")
        assert r.status_code == 200
        acts = r.json()
        assert len(acts) == 8, f"Expected 8 activities, got {len(acts)}"


# ------------------------------- public submissions ---------------------
class TestPublicSubmissions:
    def test_contact(self, client, admin_client):
        unique_subject = f"TEST_contact_{uuid.uuid4().hex[:8]}"
        r = client.post(f"{API}/contact", json={
            "name": "TEST User", "email": "test+contact@example.com",
            "subject": unique_subject, "message": "Hello"
        })
        assert r.status_code == 200
        # Verify queued email exists
        outbox = admin_client.get(f"{API}/admin/email-outbox?status=pending").json()
        assert any(unique_subject in e.get("subject", "") for e in outbox), "Contact email not queued"
        # Verify submission persisted
        subs = admin_client.get(f"{API}/admin/submissions?type=contact").json()
        assert any(s.get("subject") == unique_subject for s in subs)

    def test_wholesale(self, client, admin_client):
        camp_name = f"TEST_camp_{uuid.uuid4().hex[:8]}"
        r = client.post(f"{API}/wholesale", json={
            "name": "TEST Buyer", "camp_name": camp_name,
            "email": "test+wholesale@example.com", "phone": "555",
            "quantity": "50", "order_date": "2026-06-01", "message": "Need stuffies"
        })
        assert r.status_code == 200
        subs = admin_client.get(f"{API}/admin/submissions?type=wholesale").json()
        assert any(s.get("camp_name") == camp_name for s in subs)

    def test_mailing_list_dedupe(self, client, admin_client):
        email = f"test+ml_{uuid.uuid4().hex[:8]}@example.com"
        r1 = client.post(f"{API}/mailing-list", json={"email": email, "name": "TEST", "tags": ["a"]})
        assert r1.status_code == 200
        r2 = client.post(f"{API}/mailing-list", json={"email": email, "name": "TEST", "tags": ["b"]})
        assert r2.status_code == 200
        ml = admin_client.get(f"{API}/admin/mailing-list").json()
        matches = [m for m in ml if m.get("email") == email]
        assert len(matches) == 1, f"Expected dedupe, got {len(matches)}"
        assert set(["a", "b"]).issubset(set(matches[0].get("tags", [])))

    def test_download_capture(self, client, admin_client):
        email = f"test+dc_{uuid.uuid4().hex[:8]}@example.com"
        r = client.post(f"{API}/download-capture", json={
            "name": "TEST Down", "email": email, "audience": "Parents",
            "download_slug": "color-myrtle", "download_title": "Color Myrtle", "subscribe": True
        })
        assert r.status_code == 200
        ml = admin_client.get(f"{API}/admin/mailing-list").json()
        match = [m for m in ml if m.get("email") == email]
        assert len(match) == 1
        assert "download:color-myrtle" in match[0].get("tags", [])


# ------------------------------- auth -----------------------------------
class TestAuth:
    def test_login_wrong_password(self, client):
        r = client.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "WRONG"})
        assert r.status_code == 401

    def test_login_success_sets_cookies(self, client):
        s = requests.Session()
        r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        data = r.json()
        assert "access_token" in data
        assert data["email"] == ADMIN_EMAIL
        # Cookie should be set
        cookie_names = {c.name for c in s.cookies}
        assert "access_token" in cookie_names
        assert "refresh_token" in cookie_names

    def test_me_with_bearer(self, admin_client):
        r = admin_client.get(f"{API}/auth/me")
        assert r.status_code == 200
        u = r.json()
        assert u["email"] == ADMIN_EMAIL
        assert u["role"] == "admin"
        assert "password_hash" not in u
        assert "_id" not in u

    def test_admin_dashboard_unauthorized(self, client):
        r = requests.get(f"{API}/admin/dashboard")
        assert r.status_code in (401, 403)

    def test_admin_dashboard_authorized(self, admin_client):
        r = admin_client.get(f"{API}/admin/dashboard")
        assert r.status_code == 200
        data = r.json()
        for k in ("total_products", "total_downloads", "pending_emails"):
            assert k in data


# ------------------------------- admin products -------------------------
class TestAdminProducts:
    def test_list_all_includes_unpublished(self, admin_client):
        r = admin_client.get(f"{API}/admin/products")
        assert r.status_code == 200
        assert len(r.json()) >= 13

    def test_create_update_delete_product(self, admin_client):
        name = f"TEST Product {uuid.uuid4().hex[:6]}"
        r = admin_client.post(f"{API}/admin/products", json={"name": name, "price": 9.99, "category": "Stuffies"})
        assert r.status_code == 200, r.text
        prod = r.json()
        slug = prod["slug"]
        assert slug  # auto-generated
        # GET verify
        r2 = admin_client.get(f"{API}/admin/products")
        assert any(p["slug"] == slug for p in r2.json())
        # PUT update
        r3 = admin_client.put(f"{API}/admin/products/{slug}", json={"price": 19.99, "featured": False})
        assert r3.status_code == 200
        assert r3.json()["price"] == 19.99
        # bulk feature
        r4 = admin_client.post(f"{API}/admin/products/bulk", json={"slugs": [slug], "action": "feature"})
        assert r4.status_code == 200
        # Verify featured
        p_after = admin_client.get(f"{API}/admin/products").json()
        assert any(p["slug"] == slug and p.get("featured") is True for p in p_after)
        # DELETE
        r5 = admin_client.delete(f"{API}/admin/products/{slug}")
        assert r5.status_code == 200
        # Verify deletion
        r6 = admin_client.delete(f"{API}/admin/products/{slug}")
        assert r6.status_code == 404


# ------------------------------- admin characters -----------------------
class TestAdminCharacters:
    def test_list_admin(self, admin_client):
        r = admin_client.get(f"{API}/admin/characters")
        assert r.status_code == 200
        assert len(r.json()) == 13

    def test_update_myrtle_bio(self, admin_client):
        new_bio = f"TEST bio {uuid.uuid4().hex[:6]}"
        r = admin_client.put(f"{API}/admin/characters/myrtle", json={"bio": new_bio})
        assert r.status_code == 200
        assert r.json()["bio"] == new_bio
        # GET verifies persistence
        r2 = requests.get(f"{API}/characters/myrtle")
        assert r2.json()["bio"] == new_bio

    def test_cannot_delete_core_character(self, admin_client):
        r = admin_client.delete(f"{API}/admin/characters/myrtle")
        assert r.status_code == 400


# ------------------------------- admin downloads ------------------------
class TestAdminDownloads:
    def test_download_crud(self, admin_client):
        title = f"TEST Download {uuid.uuid4().hex[:6]}"
        r = admin_client.post(f"{API}/admin/downloads", json={"title": title, "category_slugs": ["coloring-pages"]})
        assert r.status_code == 200, r.text
        slug = r.json()["slug"]
        # PUT update
        r2 = admin_client.put(f"{API}/admin/downloads/{slug}", json={"featured": True})
        assert r2.status_code == 200
        assert r2.json()["featured"] is True
        # bulk unfeature
        r3 = admin_client.post(f"{API}/admin/downloads/bulk", json={"slugs": [slug], "action": "unfeature"})
        assert r3.status_code == 200
        # DELETE
        r4 = admin_client.delete(f"{API}/admin/downloads/{slug}")
        assert r4.status_code == 200


# ------------------------------- admin dl categories --------------------
class TestAdminDownloadCategories:
    def test_cat_crud(self, admin_client):
        name = f"TEST Cat {uuid.uuid4().hex[:6]}"
        r = admin_client.post(f"{API}/admin/download-categories", json={"name": name})
        assert r.status_code == 200
        slug = r.json()["slug"]
        r2 = admin_client.put(f"{API}/admin/download-categories/{slug}", json={"description": "TEST"})
        assert r2.status_code == 200
        r3 = admin_client.delete(f"{API}/admin/download-categories/{slug}")
        assert r3.status_code == 200


# ------------------------------- admin pages ----------------------------
class TestAdminPages:
    def test_update_homepage_hero(self, admin_client):
        marker = f"TEST_marker_{uuid.uuid4().hex[:6]}"
        r = admin_client.put(f"{API}/admin/pages/homepage_hero", json={
            "content": {"headline": marker}
        })
        assert r.status_code == 200
        # Verify persistence via public route
        r2 = requests.get(f"{API}/pages/homepage_hero")
        assert r2.status_code == 200
        assert r2.json()["content"].get("headline") == marker


# ------------------------------- admin settings -------------------------
class TestAdminSettings:
    def test_default_emails(self, admin_client):
        r = admin_client.get(f"{API}/admin/settings")
        assert r.status_code == 200
        s = r.json()
        for k in ("contact_form_email", "wholesale_email", "press_email",
                  "mailing_list_reply_to", "download_capture_email",
                  "password_reset_email", "admin_login_alert_email", "primary_contact_email"):
            assert s.get(k) == "community@rollingriver.com", f"{k} = {s.get(k)}"

    def test_update_settings(self, admin_client):
        new_tagline = f"TEST tagline {uuid.uuid4().hex[:6]}"
        r = admin_client.put(f"{API}/admin/settings", json={"tagline": new_tagline})
        assert r.status_code == 200
        assert r.json()["tagline"] == new_tagline
        # restore
        admin_client.put(f"{API}/admin/settings", json={"tagline": "Catch the W.A.V.E. of Excitement"})


# ------------------------------- mailing list admin ---------------------
class TestAdminMailingList:
    def test_add_list_delete(self, admin_client):
        email = f"test+adml_{uuid.uuid4().hex[:6]}@example.com"
        r = admin_client.post(f"{API}/admin/mailing-list", json={"email": email, "name": "TEST"})
        assert r.status_code == 200
        sub_id = r.json()["id"]
        ml = admin_client.get(f"{API}/admin/mailing-list").json()
        assert any(m["email"] == email for m in ml)
        r2 = admin_client.delete(f"{API}/admin/mailing-list/{sub_id}")
        assert r2.status_code == 200


# ------------------------------- email outbox ---------------------------
class TestEmailOutbox:
    def test_outbox_queues_when_no_key(self, admin_client, client):
        # Trigger a contact and look for pending status
        unique = f"TEST_outbox_{uuid.uuid4().hex[:8]}"
        client.post(f"{API}/contact", json={"name": "x", "email": "y@example.com", "subject": unique, "message": "z"})
        outbox = admin_client.get(f"{API}/admin/email-outbox").json()
        matched = [e for e in outbox if unique in e.get("subject", "")]
        assert matched
        assert matched[0]["status"] == "pending"
        assert "_id" not in matched[0]


# ------------------------------- media ----------------------------------
class TestAdminMedia:
    def test_upload_list_delete_png(self, admin_client, access_token):
        png = _make_png_bytes()
        # Use a session WITHOUT default Content-Type so requests builds multipart correctly
        s = requests.Session()
        s.headers.update({"Authorization": f"Bearer {access_token}"})
        files = {"file": ("test.png", io.BytesIO(png), "image/png")}
        r = s.post(f"{API}/admin/media/upload", files=files, data={"tags": "TEST"})
        assert r.status_code == 200, r.text
        item = r.json()
        media_id = item["id"]
        assert item["url"].startswith("/uploads/")
        assert "_id" not in item
        # GET list
        lst = admin_client.get(f"{API}/admin/media").json()
        assert any(m["id"] == media_id for m in lst)
        # Verify file accessible
        rfile = requests.get(f"{BASE_URL}{item['url']}")
        assert rfile.status_code == 200
        # DELETE
        rd = admin_client.delete(f"{API}/admin/media/{media_id}")
        assert rd.status_code == 200

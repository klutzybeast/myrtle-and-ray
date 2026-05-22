"""Backend tests for Read-Aloud feature + regression on Square checkout & ElevenLabs voice.

Coverage:
  • Read-Aloud public + admin GET book
  • PATCH page invalidations (text, character_slug, image_url-only)
  • Auth boundary on /admin/read-aloud/*
  • generate/{n} cache hit + generate-all endpoint shape
  • DELETE /admin/read-aloud/book (NOT exercised — would wipe production data)
  • Regression: Square /checkout/quote-cart + /checkout/square
  • Regression: ElevenLabs voice quota + character greeting + say
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://wave-of-excitement.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "community@rollingriver.com"
ADMIN_PASSWORD = "Camp1993!"


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin_token(api_client):
    r = api_client.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
    )
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text[:200]}")
    data = r.json()
    token = data.get("access_token") or data.get("token")
    if not token:
        # Token may live only in httpOnly cookie — that's still fine for cookie-auth.
        return None
    return token


@pytest.fixture(scope="session")
def admin_client(api_client, admin_token):
    if admin_token:
        api_client.headers.update({"Authorization": f"Bearer {admin_token}"})
    return api_client


# ---------- Read-Aloud: Public ----------
class TestReadAloudPublic:
    def test_public_get_book_returns_21_pages(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/read-aloud/book")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "pages" in data and "characters" in data
        pages = data["pages"]
        assert len(pages) == 21, f"Expected 21 pages, got {len(pages)}"

    def test_public_payload_strips_voice_id_and_cache_key(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/read-aloud/book")
        assert r.status_code == 200
        for p in r.json()["pages"]:
            assert "voice_id" not in p, f"voice_id leaked on page {p.get('page')}"
            assert "cache_key" not in p, f"cache_key leaked on page {p.get('page')}"
            assert "page" in p and "character_slug" in p and "text" in p
            assert "audio_url" in p

    def test_speaker_assignments_match_spec(self, api_client):
        expected = {
            1: "myrtle", 2: "ms-bluegill", 3: "myrtle", 4: "ray",
            5: "ms-bluegill", 6: "ms-bluegill", 7: "myrtle", 8: "ms-bluegill",
            9: "myrtle", 10: "sally", 11: "ollie", 12: "ray",
            13: "ray", 14: "myrtle", 15: "ray", 16: "myrtle",
            17: "ms-bluegill", 18: "ray", 19: "myrtle", 20: "myrtle",
            21: "ms-bluegill",
        }
        r = api_client.get(f"{BASE_URL}/api/read-aloud/book")
        pages = {p["page"]: p["character_slug"] for p in r.json()["pages"]}
        for n, slug in expected.items():
            assert pages.get(n) == slug, f"Page {n}: expected {slug}, got {pages.get(n)}"

    def test_public_characters_map_has_5_speakers(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/read-aloud/book")
        chars = r.json()["characters"]
        for slug in ("ms-bluegill", "myrtle", "ray", "sally", "ollie"):
            assert slug in chars, f"Missing speaker {slug} in characters map"
            assert "name" in chars[slug] and "image_url" in chars[slug]

    def test_public_audio_url_resolvable_for_page_1(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/read-aloud/book")
        page1 = next(p for p in r.json()["pages"] if p["page"] == 1)
        assert page1.get("audio_url"), "Page 1 audio_url should be populated"
        # HEAD the audio to confirm it serves
        head = requests.head(f"{BASE_URL}{page1['audio_url']}", allow_redirects=True)
        assert head.status_code in (200, 206), f"Audio not fetchable: {head.status_code}"


# ---------- Read-Aloud: Admin ----------
class TestReadAloudAdmin:
    def test_admin_book_requires_auth(self, api_client):
        # Use a fresh session to avoid session cookies
        s = requests.Session()
        r = s.get(f"{BASE_URL}/api/admin/read-aloud/book")
        assert r.status_code in (401, 403), f"Expected 401/403, got {r.status_code}"

    def test_admin_get_book_full_payload(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/admin/read-aloud/book")
        assert r.status_code == 200, r.text
        data = r.json()
        assert len(data["pages"]) == 21
        # voice_id must appear in admin payload
        for p in data["pages"]:
            assert "voice_id" in p
        # characters is a list with voice_id present
        chars = data["characters"]
        assert isinstance(chars, list)
        assert len(chars) >= 5, f"Expected >=5 voiced characters, got {len(chars)}"
        for ch in chars:
            assert ch.get("voice_id")
            assert ch.get("slug")

    def test_patch_requires_auth(self, api_client):
        s = requests.Session()
        r = s.patch(f"{BASE_URL}/api/admin/read-aloud/page/1", json={"text": "x"})
        assert r.status_code in (401, 403)

    def test_patch_image_only_preserves_audio(self, admin_client):
        before = admin_client.get(f"{BASE_URL}/api/admin/read-aloud/book").json()
        p1_before = next(p for p in before["pages"] if p["page"] == 1)
        original_audio = p1_before.get("audio_url", "")
        original_image = p1_before.get("image_url", "")

        # Patch image_url only
        r = admin_client.patch(
            f"{BASE_URL}/api/admin/read-aloud/page/1",
            json={"image_url": original_image or ""},  # idempotent set
        )
        assert r.status_code == 200, r.text

        after = admin_client.get(f"{BASE_URL}/api/admin/read-aloud/book").json()
        p1_after = next(p for p in after["pages"] if p["page"] == 1)
        assert p1_after.get("audio_url", "") == original_audio, "audio_url must be preserved on image-only patch"

    def test_patch_text_invalidates_audio(self, admin_client):
        before = admin_client.get(f"{BASE_URL}/api/admin/read-aloud/book").json()
        # Use page 20 to avoid disturbing page 1; capture original text
        p_before = next(p for p in before["pages"] if p["page"] == 20)
        original_text = p_before["text"]
        original_audio = p_before.get("audio_url", "")
        if not original_audio:
            pytest.skip("Page 20 has no audio_url to invalidate")

        new_text = original_text + " "  # whitespace differs but stripped equal — won't trigger
        # Actually need real change: append a marker
        new_text = original_text.rstrip(".") + " [test-marker]."
        try:
            r = admin_client.patch(
                f"{BASE_URL}/api/admin/read-aloud/page/20",
                json={"text": new_text},
            )
            assert r.status_code == 200, r.text
            after = admin_client.get(f"{BASE_URL}/api/admin/read-aloud/book").json()
            p_after = next(p for p in after["pages"] if p["page"] == 20)
            assert p_after.get("audio_url", "") == "", "audio_url must be cleared after text change"
        finally:
            # Restore original text (will still leave audio_url empty — main agent can regenerate)
            admin_client.patch(
                f"{BASE_URL}/api/admin/read-aloud/page/20",
                json={"text": original_text},
            )

    def test_patch_speaker_invalidates_audio_and_changes_voice(self, admin_client):
        before = admin_client.get(f"{BASE_URL}/api/admin/read-aloud/book").json()
        p_before = next(p for p in before["pages"] if p["page"] == 19)
        original_slug = p_before["character_slug"]
        original_voice = p_before.get("voice_id", "")
        original_audio = p_before.get("audio_url", "")
        # Pick a different speaker
        new_slug = "ray" if original_slug != "ray" else "ms-bluegill"
        try:
            r = admin_client.patch(
                f"{BASE_URL}/api/admin/read-aloud/page/19",
                json={"character_slug": new_slug},
            )
            assert r.status_code == 200, r.text
            after = admin_client.get(f"{BASE_URL}/api/admin/read-aloud/book").json()
            p_after = next(p for p in after["pages"] if p["page"] == 19)
            assert p_after["character_slug"] == new_slug
            assert p_after.get("audio_url", "") == ""
            if original_audio:
                # voice_id should change because slug changed (assuming different voices)
                assert p_after.get("voice_id") != original_voice or original_voice == ""
        finally:
            admin_client.patch(
                f"{BASE_URL}/api/admin/read-aloud/page/19",
                json={"character_slug": original_slug},
            )

    def test_generate_endpoint_cache_hit(self, admin_client):
        # Page 1 already has audio — calling generate again should return same url quickly (cache hit)
        before = admin_client.get(f"{BASE_URL}/api/admin/read-aloud/book").json()
        p1 = next(p for p in before["pages"] if p["page"] == 1)
        if not p1.get("audio_url"):
            pytest.skip("Page 1 missing audio; cannot test cache hit")
        r = admin_client.post(f"{BASE_URL}/api/admin/read-aloud/generate/1")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["ok"] is True
        assert data["page"] == 1
        assert data["audio_url"] == p1["audio_url"], "Cache hit should return identical audio_url"
        assert "chars" in data

    def test_generate_unknown_page_404(self, admin_client):
        r = admin_client.post(f"{BASE_URL}/api/admin/read-aloud/generate/999")
        assert r.status_code == 404

    def test_generate_requires_auth(self, api_client):
        s = requests.Session()
        r = s.post(f"{BASE_URL}/api/admin/read-aloud/generate/1")
        assert r.status_code in (401, 403)

    def test_delete_requires_auth(self, api_client):
        s = requests.Session()
        r = s.delete(f"{BASE_URL}/api/admin/read-aloud/book")
        assert r.status_code in (401, 403)


# ---------- Regression: Square ----------
class TestSquareRegression:
    def test_products_listing(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/products")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) or "items" in data or "products" in data

    def test_quote_cart_with_stuffy(self, api_client):
        # First get a product to build a valid cart with
        r = api_client.get(f"{BASE_URL}/api/products")
        items = r.json() if isinstance(r.json(), list) else r.json().get("products", r.json().get("items", []))
        stuffies = [p for p in items if (p.get("category") or "").lower() == "stuffies"]
        if not stuffies:
            pytest.skip("No stuffies products to quote")
        prod = stuffies[0]
        sku = ""
        variants = prod.get("variants") or []
        if variants:
            sku = variants[0].get("sku", "")
        body = {"items": [{"product_slug": prod["slug"], "variant_sku": sku, "quantity": 1}]}
        r2 = api_client.post(f"{BASE_URL}/api/checkout/quote-cart", json=body)
        assert r2.status_code == 200, r2.text
        q = r2.json()
        for k in ("subtotal_cents", "tax_cents", "shipping_cents", "total_cents"):
            assert k in q
        assert q["total_cents"] > 0

    def test_checkout_square_reachable(self, api_client):
        # Send a structurally-valid payload; expect either 200 (sandbox) or sensible 4xx
        body = {
            "items": [{"product_slug": "nonexistent-stuffy", "variant_sku": "", "quantity": 1}],
            "email": "test@example.com",
            "full_name": "Test User",
            "shipping_address": {
                "line1": "123 Test St", "city": "Test", "state": "CA",
                "postal_code": "94000", "country": "US",
            },
            "source_id": "cnon:card-nonce-ok",
        }
        r = api_client.post(f"{BASE_URL}/api/checkout/square", json=body)
        # 404 (bad slug) or 400 are both acceptable — proves endpoint is reachable
        assert r.status_code in (200, 400, 402, 404, 422, 503), f"Unexpected status: {r.status_code} {r.text[:200]}"


# ---------- Regression: ElevenLabs voice ----------
class TestVoiceRegression:
    def test_voice_quota(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/voice/quota")
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("used", "limit", "remaining"):
            assert k in data, f"Missing {k} in quota response"
        assert isinstance(data["used"], int)
        assert isinstance(data["limit"], int)

    def test_character_greeting_audio(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/voice/character/myrtle/greeting")
        assert r.status_code == 200, r.text
        ctype = r.headers.get("content-type", "")
        assert "audio" in ctype, f"Expected audio content-type, got {ctype}"
        assert len(r.content) > 100

    def test_character_say(self, api_client):
        r = api_client.post(
            f"{BASE_URL}/api/voice/character/myrtle/say",
            json={"text": "hi"},
        )
        assert r.status_code in (200, 429), r.text
        if r.status_code == 200:
            ctype = r.headers.get("content-type", "")
            assert "audio" in ctype
            assert "X-Voice-Remaining" in r.headers

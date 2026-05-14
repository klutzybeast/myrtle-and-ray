"""Tests for the new features: chat bubble, campaigns module,
and verification that admin notification emails (admin_login_alert,
mailing_list_notify) are NOT emitted anymore.
"""
from __future__ import annotations
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://wave-of-excitement.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "community@rollingriver.com"
ADMIN_PASSWORD = "Camp1993!"


# --------------------------- fixtures ----------------------------------
@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_client(client):
    r = client.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text}")
    token = r.json()["access_token"]
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {token}"})
    return s


# --------------------------- chat endpoint -----------------------------
class TestChatEndpoint:
    """POST /api/chat creates submission type=chat and queues a chat email"""

    def test_chat_submission_creates_outbox_with_reply_to(self, client, admin_client):
        unique = f"TEST_chat_{uuid.uuid4().hex[:8]}"
        visitor_email = f"visitor_{unique}@example.com"
        r = client.post(f"{API}/chat", json={
            "name": "TEST Visitor",
            "email": visitor_email,
            "message": f"hello {unique}",
            "page": "/products",
        })
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

        # Verify submission persisted with type=chat
        subs = admin_client.get(f"{API}/admin/submissions?type=chat").json()
        match = [s for s in subs if unique in (s.get("message") or "")]
        assert match, "Chat submission not persisted"
        assert match[0]["email"] == visitor_email.lower()
        assert match[0].get("page") == "/products"
        assert "_id" not in match[0]

        # Verify queued email exists with purpose='chat' and reply_to=visitor
        outbox = admin_client.get(f"{API}/admin/email-outbox").json()
        chat_emails = [e for e in outbox if e.get("purpose") == "chat" and visitor_email.lower() == (e.get("reply_to") or "").lower()]
        assert chat_emails, "Chat email not queued with proper reply_to"
        # Forwarded to admin / community inbox
        assert "rollingriver.com" in chat_emails[0]["to"] or chat_emails[0]["to"] == "community@rollingriver.com"

    def test_chat_requires_valid_email(self, client):
        r = client.post(f"{API}/chat", json={"name": "x", "email": "not-an-email", "message": "hi"})
        assert r.status_code in (400, 422)


# --------------------------- no admin notifications --------------------
class TestNoAdminNotifications:
    """Admin login should not generate an admin_login_alert email anymore,
    and /api/mailing-list signup should not generate a mailing_list_notify."""

    def test_login_does_not_emit_admin_login_alert(self, client, admin_client):
        # Count existing alert rows
        before = admin_client.get(f"{API}/admin/email-outbox").json()
        before_count = sum(1 for e in before if e.get("purpose") == "admin_login_alert")

        # Trigger a fresh login
        r = client.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200

        after = admin_client.get(f"{API}/admin/email-outbox").json()
        after_count = sum(1 for e in after if e.get("purpose") == "admin_login_alert")
        assert after_count == before_count, "admin_login_alert email should NOT be emitted"

    def test_mailing_list_signup_emits_only_welcome(self, client, admin_client):
        email = f"test+nonotify_{uuid.uuid4().hex[:6]}@example.com"
        before = admin_client.get(f"{API}/admin/email-outbox").json()
        before_notify = sum(1 for e in before if e.get("purpose") == "mailing_list_notify")

        r = client.post(f"{API}/mailing-list", json={"email": email, "name": "TEST"})
        assert r.status_code == 200

        after = admin_client.get(f"{API}/admin/email-outbox").json()
        after_notify = sum(1 for e in after if e.get("purpose") == "mailing_list_notify")
        assert after_notify == before_notify, "mailing_list_notify should not be emitted"

        welcome = [e for e in after if e.get("purpose") == "mailing_list_welcome" and e.get("to") == email]
        assert welcome, "mailing_list_welcome should be queued for the visitor"


# --------------------------- campaigns ---------------------------------
class TestCampaignsAuth:
    def test_list_requires_auth(self):
        r = requests.get(f"{API}/admin/campaigns")
        assert r.status_code in (401, 403)

    def test_create_requires_auth(self):
        r = requests.post(f"{API}/admin/campaigns", json={"name": "x"})
        assert r.status_code in (401, 403)


class TestCampaignsCRUD:
    @pytest.fixture(scope="class")
    def campaign_id(self, admin_client):
        name = f"TEST_Campaign_{uuid.uuid4().hex[:6]}"
        blocks = [
            {"type": "heading", "data": {"text": "Hello from Myrtle", "level": 2}},
            {"type": "paragraph", "data": {"text": "Welcome to the wave."}},
            {"type": "image", "data": {"src": "https://example.com/i.png", "alt": "x"}},
            {"type": "button", "data": {"label": "Shop", "href": "https://example.com"}},
            {"type": "divider", "data": {}},
            {"type": "spacer", "data": {"height": 16}},
            # Em-dash author quote — regression for previous SyntaxError
            {"type": "quote", "data": {"text": "Be kind — always.", "author": "Myrtle — the Turtle"}},
            {"type": "html", "data": {"html": "<p>raw html block</p>"}},
        ]
        r = admin_client.post(f"{API}/admin/campaigns", json={
            "name": name,
            "subject": "TEST subject",
            "preview_text": "preview",
            "blocks": blocks,
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["name"] == name
        assert data["status"] == "draft"
        assert data["total_sent"] == 0
        assert "id" in data
        assert "_id" not in data
        yield data["id"]
        # Teardown
        admin_client.delete(f"{API}/admin/campaigns/{data['id']}")

    def test_list_includes_created(self, admin_client, campaign_id):
        r = admin_client.get(f"{API}/admin/campaigns")
        assert r.status_code == 200
        assert any(c["id"] == campaign_id for c in r.json())

    def test_get_single(self, admin_client, campaign_id):
        r = admin_client.get(f"{API}/admin/campaigns/{campaign_id}")
        assert r.status_code == 200
        assert r.json()["id"] == campaign_id
        assert "_id" not in r.json()

    def test_update_persists(self, admin_client, campaign_id):
        r = admin_client.put(f"{API}/admin/campaigns/{campaign_id}", json={"subject": "Updated subj"})
        assert r.status_code == 200
        assert r.json()["subject"] == "Updated subj"
        r2 = admin_client.get(f"{API}/admin/campaigns/{campaign_id}")
        assert r2.json()["subject"] == "Updated subj"

    def test_preview_renders_all_block_types(self, admin_client, campaign_id):
        """The preview endpoint must render all block types without SyntaxError
        and HTML must include rendered markers for each block."""
        r = admin_client.get(f"{API}/admin/campaigns/{campaign_id}/preview")
        assert r.status_code == 200, r.text
        html = r.json().get("html", "")
        assert isinstance(html, str) and len(html) > 50
        # Block markers
        assert "Hello from Myrtle" in html         # heading
        assert "Welcome to the wave." in html      # paragraph
        assert "example.com/i.png" in html         # image
        assert "Shop" in html                      # button
        # Quote — em-dash regression check
        assert "Be kind" in html
        assert "Myrtle" in html and "the Turtle" in html
        # Raw HTML block
        assert "raw html block" in html

    def test_send_test_queues_email_with_test_prefix(self, admin_client, campaign_id):
        to_addr = f"test+camptest_{uuid.uuid4().hex[:6]}@example.com"
        r = admin_client.post(f"{API}/admin/campaigns/{campaign_id}/test", json={"to": to_addr})
        assert r.status_code == 200, r.text
        outbox = admin_client.get(f"{API}/admin/email-outbox").json()
        match = [e for e in outbox if e.get("to") == to_addr and e.get("purpose") == "campaign_test"]
        assert match, "Test email not queued"
        assert match[0]["subject"].startswith("[TEST]")

    def test_send_without_recipients_returns_400(self, admin_client, campaign_id):
        r = admin_client.post(f"{API}/admin/campaigns/{campaign_id}/send", json={"recipient_emails": []})
        assert r.status_code == 400

    def test_send_to_recipient_emails(self, admin_client, campaign_id):
        recipients = [
            f"test+r1_{uuid.uuid4().hex[:6]}@example.com",
            f"test+r2_{uuid.uuid4().hex[:6]}@example.com",
        ]
        r = admin_client.post(f"{API}/admin/campaigns/{campaign_id}/send",
                              json={"recipient_emails": recipients})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["sent"] == 2
        assert data["total_recipients"] == 2

        # Campaign should be marked status=sent and total_sent>=2
        c = admin_client.get(f"{API}/admin/campaigns/{campaign_id}").json()
        assert c["status"] == "sent"
        assert c["total_sent"] >= 2

        # Outbox should contain rows for each recipient
        outbox = admin_client.get(f"{API}/admin/email-outbox").json()
        for em in recipients:
            assert any(e.get("to") == em and (e.get("purpose") or "").startswith(f"campaign:{campaign_id}") for e in outbox)

    def test_send_via_recipient_filter_tags(self, admin_client, campaign_id):
        # Seed a mailing-list subscriber with a unique tag, then send by tag filter
        tag = f"TEST_tag_{uuid.uuid4().hex[:6]}"
        email = f"test+tag_{uuid.uuid4().hex[:6]}@example.com"
        r1 = admin_client.post(f"{API}/admin/mailing-list", json={"email": email, "name": "TEST", "tags": [tag]})
        assert r1.status_code == 200
        sub_id = r1.json()["id"]
        try:
            r = admin_client.post(f"{API}/admin/campaigns/{campaign_id}/send",
                                  json={"recipient_filter": {"tags": [tag]}})
            assert r.status_code == 200, r.text
            assert r.json()["total_recipients"] == 1
            outbox = admin_client.get(f"{API}/admin/email-outbox").json()
            assert any(e.get("to") == email and (e.get("purpose") or "").startswith(f"campaign:{campaign_id}") for e in outbox)
        finally:
            admin_client.delete(f"{API}/admin/mailing-list/{sub_id}")

    def test_get_unknown_404(self, admin_client):
        r = admin_client.get(f"{API}/admin/campaigns/does-not-exist")
        assert r.status_code == 404


class TestCampaignDelete:
    def test_create_and_delete(self, admin_client):
        r = admin_client.post(f"{API}/admin/campaigns", json={"name": f"TEST_del_{uuid.uuid4().hex[:6]}"})
        assert r.status_code == 200
        cid = r.json()["id"]
        d = admin_client.delete(f"{API}/admin/campaigns/{cid}")
        assert d.status_code == 200
        # second delete → 404
        d2 = admin_client.delete(f"{API}/admin/campaigns/{cid}")
        assert d2.status_code == 404

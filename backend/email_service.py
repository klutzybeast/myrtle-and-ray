"""Email queue + Resend send abstraction."""
from __future__ import annotations
import os
from datetime import datetime, timezone
from typing import Optional
import uuid


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def queue_email(
    db,
    *,
    to: str,
    subject: str,
    html: str = "",
    text: str = "",
    purpose: str = "",
    from_email: Optional[str] = None,
    reply_to: Optional[str] = None,
) -> dict:
    """Queue an email. If RESEND_API_KEY is set, attempt to send immediately.
    Always persists to email_outbox for visibility."""
    settings_doc = await db.settings.find_one({"_id": "settings"}, {"_id": 0}) or {}
    from_addr = from_email or settings_doc.get("outgoing_from_email") or os.environ.get("RESEND_FROM_EMAIL", "hello@myrtleandray.com")
    reply_addr = reply_to or settings_doc.get("mailing_list_reply_to") or os.environ.get("RESEND_REPLY_TO", "community@rollingriver.com")

    doc = {
        "id": str(uuid.uuid4()),
        "to": to,
        "from_email": from_addr,
        "reply_to": reply_addr,
        "subject": subject,
        "html": html or f"<p>{text}</p>",
        "text": text or "",
        "purpose": purpose,
        "status": "pending",
        "error": "",
        "created_at": _now(),
        "sent_at": "",
    }

    api_key = os.environ.get("RESEND_API_KEY", "").strip()
    if api_key:
        try:
            import resend  # type: ignore
            resend.api_key = api_key
            params = {
                "from": from_addr,
                "to": [to],
                "subject": subject,
                "html": doc["html"],
                "reply_to": reply_addr,
            }
            resp = resend.Emails.send(params)
            doc["status"] = "sent"
            doc["sent_at"] = _now()
            doc["provider_id"] = resp.get("id", "") if isinstance(resp, dict) else ""
        except Exception as exc:  # noqa: BLE001
            doc["status"] = "failed"
            doc["error"] = str(exc)

    await db.email_outbox.insert_one(doc)
    doc.pop("_id", None)
    return doc

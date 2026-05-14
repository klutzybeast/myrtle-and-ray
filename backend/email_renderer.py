"""Render an email campaign's block list into inline-styled HTML."""
from __future__ import annotations
from html import escape


def render_campaign_html(campaign: dict) -> str:
    bg = campaign.get("background_color") or "#fffbf3"
    content_bg = campaign.get("content_background") or "#ffffff"
    width = int(campaign.get("content_width") or 600)
    text_color = campaign.get("text_color") or "#3a4a55"
    accent = campaign.get("accent_color") or "#f0a988"

    blocks_html = "".join(render_block(b, text_color, accent) for b in (campaign.get("blocks") or []))

    site_name = campaign.get("site_name") or "Myrtle and Ray"
    footer = campaign.get("footer_text") or f"You're receiving this because you joined the {site_name} mailing list."
    unsubscribe = campaign.get("unsubscribe_url") or ""
    if unsubscribe:
        footer += f' · <a href="{escape(unsubscribe)}" style="color:#5a6b76;">Unsubscribe</a>'

    return f"""\
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{escape(campaign.get('subject') or site_name)}</title>
</head>
<body style="margin:0;padding:0;background:{bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:{text_color};">
<center style="width:100%;background:{bg};">
  <div style="display:none;font-size:1px;color:{bg};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">{escape(campaign.get('preview_text') or '')}</div>
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:{bg};">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="{width}" style="max-width:{width}px;width:100%;background:{content_bg};border-radius:18px;overflow:hidden;box-shadow:0 8px 28px rgba(58,74,85,0.06);">
          <tr><td style="padding:24px 28px;">{blocks_html}</td></tr>
        </table>
        <p style="margin:18px 0 0 0;color:#5a6b76;font-size:12px;line-height:1.5;max-width:{width}px;">{footer}</p>
      </td>
    </tr>
  </table>
</center>
</body>
</html>
"""


def _align(a: str) -> str:
    return "center" if a == "center" else "right" if a == "right" else "left"


def render_block(block: dict, default_color: str, accent: str) -> str:
    d = block.get("data") or {}
    bg = d.get("background_color") or ""
    text_color = d.get("text_color") or default_color
    pad = d.get("padding", 12)
    wrap_open = f'<div style="background:{bg};padding:{pad}px;border-radius:12px;margin:0 0 12px 0;">' if bg else f'<div style="padding:{pad}px 0;">'
    wrap_close = "</div>"

    t = block.get("type")
    if t == "heading":
        level = d.get("level", 2)
        size = {1: "30px", 2: "24px", 3: "20px"}.get(level, 24)
        return f'{wrap_open}<h{level} style="margin:0;font-family:Georgia,serif;font-weight:700;font-size:{size};color:{text_color};text-align:{_align(d.get("align","left"))};line-height:1.25;">{escape(d.get("text",""))}</h{level}>{wrap_close}'
    if t == "paragraph":
        text = (d.get("text") or "").replace("\r\n", "\n")
        paras = [escape(p).replace("\n", "<br>") for p in text.split("\n\n") if p.strip()]
        body = "".join(f'<p style="margin:0 0 10px 0;font-size:16px;line-height:1.6;color:{text_color};text-align:{_align(d.get("align","left"))};">{p}</p>' for p in paras)
        return f"{wrap_open}{body}{wrap_close}"
    if t == "image":
        src = escape(d.get("src") or "")
        alt = escape(d.get("alt") or "")
        cap = d.get("caption")
        if not src:
            return ""
        img = f'<img src="{src}" alt="{alt}" style="display:block;width:100%;max-width:100%;height:auto;border-radius:8px;border:0;" />'
        cap_html = f'<p style="margin:6px 0 0 0;font-size:12px;color:#5a6b76;text-align:center;">{escape(cap)}</p>' if cap else ""
        return f"{wrap_open}{img}{cap_html}{wrap_close}"
    if t == "button":
        label = escape(d.get("label") or "Click")
        href = escape(d.get("href") or "#")
        btn_bg = d.get("button_color") or accent
        btn_text = d.get("button_text_color") or "#ffffff"
        align = _align(d.get("align", "center"))
        return f'{wrap_open}<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr><td align="{align}"><a href="{href}" style="display:inline-block;padding:12px 28px;background:{btn_bg};color:{btn_text};text-decoration:none;border-radius:9999px;font-weight:700;font-size:15px;">{label}</a></td></tr></table>{wrap_close}'
    if t == "divider":
        color = d.get("color") or "#f4e4c6"
        return f'<hr style="border:0;border-top:2px solid {color};margin:18px 0;" />'
    if t == "spacer":
        h = int(d.get("height") or 24)
        return f'<div style="height:{h}px;line-height:{h}px;">&nbsp;</div>'
    if t == "quote":
        return f'{wrap_open}<blockquote style="margin:0;padding:0 0 0 14px;border-left:4px solid {accent};font-style:italic;color:{text_color};font-size:16px;line-height:1.5;">{escape(d.get("text",""))}{(' — ' + escape(d.get("author",""))) if d.get("author") else ""}</blockquote>{wrap_close}'
    if t == "html":
        return d.get("html") or ""
    return ""

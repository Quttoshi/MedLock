"""Branded email layout shared by all MedLock emails: an HTML version plus a plain-text
fallback for mail clients that do not display HTML."""
from html import escape
from typing import Optional

BRAND_COLOR = "#1d4ed8"
FOOTER = (
    "This is an automated message from MedLock, a secure medical records platform. "
    "Please do not reply to this email. MedLock will never ask for your password."
)


def render_email(
    name: Optional[str],
    heading: str,
    paragraphs: list[str],
    button_text: Optional[str] = None,
    button_url: Optional[str] = None,
    note: Optional[str] = None,
) -> tuple[str, str]:
    """Return (plain_text, html) for an email. All text is escaped for the HTML version."""
    greeting = f"Dear {name}," if name else "Hello,"

    text_lines = [greeting, "", *_join_paragraphs(paragraphs)]
    if button_text and button_url:
        text_lines += ["", f"{button_text}: {button_url}"]
    if note:
        text_lines += ["", note]
    text_lines += ["", "Kind regards,", "The MedLock Team", "", "—", FOOTER]
    text = "\n".join(text_lines)

    body_html = "".join(
        f'<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">{escape(p)}</p>'
        for p in paragraphs
    )
    button_html = ""
    if button_text and button_url:
        button_html = (
            '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;"><tr>'
            f'<td style="border-radius:8px;background:{BRAND_COLOR};">'
            f'<a href="{escape(button_url, quote=True)}" '
            'style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:600;'
            f'color:#ffffff;text-decoration:none;border-radius:8px;">{escape(button_text)}</a>'
            "</td></tr></table>"
        )
    note_html = (
        f'<p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:#64748b;">{escape(note)}</p>' if note else ""
    )

    html = f"""<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Segoe UI,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr><td style="background:{BRAND_COLOR};padding:20px 32px;">
          <span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:0.3px;">MedLock</span>
          <span style="font-size:13px;color:#dbeafe;margin-left:8px;">Secure Medical Records</span>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 20px;font-size:20px;color:#0f172a;">{escape(heading)}</h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">{escape(greeting)}</p>
          {body_html}
          {button_html}
          {note_html}
          <p style="margin:24px 0 0;font-size:15px;line-height:1.6;color:#334155;">Kind regards,<br>The MedLock Team</p>
        </td></tr>
        <tr><td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;">
          <p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;">{escape(FOOTER)}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""
    return text, html


def _join_paragraphs(paragraphs: list[str]) -> list[str]:
    lines: list[str] = []
    for index, paragraph in enumerate(paragraphs):
        if index:
            lines.append("")
        lines.append(paragraph)
    return lines

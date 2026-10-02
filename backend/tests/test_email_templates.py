from email import message_from_bytes
from types import SimpleNamespace
from unittest.mock import MagicMock

from app.config import settings
from app.services import imaging_service, notification_service
from app.services.email_templates import render_email


class TestRenderEmail:
    def test_text_and_html_contain_the_content(self):
        text, html = render_email("Ayesha Khan", "Your study is ready", ["Body line."], "View", "https://x.test/a")
        for part in ("Dear Ayesha Khan,", "Body line.", "The MedLock Team"):
            assert part in text and part in html
        assert "View: https://x.test/a" in text
        assert 'href="https://x.test/a"' in html

    def test_user_text_is_escaped_in_html(self):
        _, html = render_email("<script>x</script>", "Heading", ["a <b>bold</b> claim"])
        assert "<script>" not in html and "&lt;script&gt;" in html
        assert "<b>bold</b>" not in html

    def test_greeting_without_a_name(self):
        text, _ = render_email(None, "Heading", ["Body."])
        assert text.startswith("Hello,")


class TestNotificationEmail:
    def test_subject_heading_and_role_link(self):
        user = SimpleNamespace(full_name="Dr. Ahmed", role="doctor")
        subject, text, html = notification_service._notification_email(user, "access_approved", "Access granted.")
        assert subject == "MedLock – Your access request was approved"
        assert f"{settings.FRONTEND_URL}/doctor/patients" in text  # the notification's own page
        assert "Access granted." in html

    def test_unknown_type_still_gets_a_readable_title(self):
        user = SimpleNamespace(full_name=None, role="patient")
        subject, _, _ = notification_service._notification_email(user, "something_new", "msg")
        assert subject == "MedLock – Something new"

    def test_send_email_includes_plain_and_html_versions(self, monkeypatch):
        monkeypatch.setattr(settings, "MAIL_SERVER", "smtp.example.com")
        monkeypatch.setattr(settings, "MAIL_FROM", "medlock@example.com")
        smtp = MagicMock()
        monkeypatch.setattr(notification_service.smtplib, "SMTP", MagicMock(return_value=smtp))
        notification_service.send_email("a@b.com", "Subject", "plain body", "<p>html body</p>")
        sent = message_from_bytes(smtp.send_message.call_args.args[0].as_bytes())
        types = [part.get_content_type() for part in sent.walk()]
        assert "text/plain" in types and "text/html" in types


class TestImagingWording:
    def _study(self, modality, count):
        return SimpleNamespace(modality=modality, instance_count=count)

    def test_modality_codes_become_plain_names(self):
        assert imaging_service.study_label(self._study("DX", 1)) == "X-ray"
        assert imaging_service.study_label(self._study("MR", 1)) == "MRI scan"
        assert imaging_service.study_label(self._study("SR, CT", 1)) == "CT scan"
        assert imaging_service.study_label(self._study(None, 1)) == "imaging study"

    def test_image_count_is_pluralised_correctly(self):
        report = SimpleNamespace(original_filename="chest.dcm")
        assert imaging_service._study_summary(report, self._study("DX", 1)).endswith("(1 image)")
        assert imaging_service._study_summary(report, self._study("CT", 250)).endswith("(250 images)")


class TestNotificationLinks:
    def _create(self, role, kind, link=None):
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = SimpleNamespace(
            id="u1", role=role, email=None, full_name="X", email_verified_at=None,
        )
        notification_service.create_notification(db, "u1", kind, "msg", link)
        return db.add.call_args.args[0]

    def test_type_specific_default_link(self):
        assert self._create("patient", "access_request").link == "/patient/access-requests"
        assert self._create("doctor", "affiliation_approved").link == "/doctor/affiliation"
        assert self._create("admin", "medical_center_registered").link == "/admin/medical-centers"

    def test_unknown_type_falls_back_to_role_page(self):
        assert self._create("medical_center", "access_request").link == "/mc/notifications"

    def test_explicit_link_wins(self):
        assert self._create("patient", "report_uploaded", "/patient/reports/123").link == "/patient/reports/123"

    def test_email_button_uses_the_same_link(self):
        user = SimpleNamespace(full_name="P", role="patient")
        _, text, _ = notification_service._notification_email(user, "report_uploaded", "m", "/patient/reports/9")
        assert f"{settings.FRONTEND_URL}/patient/reports/9" in text

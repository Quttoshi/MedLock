import pytest
from app.services.report_service import ALLOWED_CONTENT_TYPES, MAX_FILE_SIZE


class TestMaxFileSize:
    def test_is_10_mb(self):
        assert MAX_FILE_SIZE == 10 * 1024 * 1024

    def test_is_integer(self):
        assert isinstance(MAX_FILE_SIZE, int)

    def test_exact_byte_value(self):
        assert MAX_FILE_SIZE == 10_485_760


class TestAllowedContentTypes:
    def test_pdf_allowed(self):
        assert "application/pdf" in ALLOWED_CONTENT_TYPES

    def test_jpeg_allowed(self):
        assert "image/jpeg" in ALLOWED_CONTENT_TYPES

    def test_png_allowed(self):
        assert "image/png" in ALLOWED_CONTENT_TYPES

    def test_docx_allowed(self):
        assert "application/vnd.openxmlformats-officedocument.wordprocessingml.document" in ALLOWED_CONTENT_TYPES

    def test_doc_allowed(self):
        assert "application/msword" in ALLOWED_CONTENT_TYPES

    def test_plain_text_not_allowed(self):
        assert "text/plain" not in ALLOWED_CONTENT_TYPES

    def test_octet_stream_not_allowed(self):
        assert "application/octet-stream" not in ALLOWED_CONTENT_TYPES

    def test_gif_not_allowed(self):
        assert "image/gif" not in ALLOWED_CONTENT_TYPES

    def test_mp4_not_allowed(self):
        assert "video/mp4" not in ALLOWED_CONTENT_TYPES

    def test_is_set_or_collection(self):
        assert hasattr(ALLOWED_CONTENT_TYPES, "__contains__")

    def test_at_least_five_types(self):
        assert len(ALLOWED_CONTENT_TYPES) >= 5

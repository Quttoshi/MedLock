from supabase import create_client

from app.config import settings

BUCKET_NAME = "medical-reports"

_client = None


def get_supabase():
    global _client
    if _client is None:
        _client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
    return _client


def upload_file(file_bytes: bytes, storage_path: str, content_type: str = "application/octet-stream") -> str:
    client = get_supabase()
    client.storage.from_(BUCKET_NAME).upload(
        path=storage_path,
        file=file_bytes,
        file_options={"content-type": content_type, "upsert": "false"},
    )
    return storage_path


def get_signed_url(storage_path: str, expires_in: int = 3600) -> str:
    client = get_supabase()
    result = client.storage.from_(BUCKET_NAME).create_signed_url(storage_path, expires_in)
    return result["signedURL"]


def delete_file(storage_path: str) -> None:
    client = get_supabase()
    client.storage.from_(BUCKET_NAME).remove([storage_path])

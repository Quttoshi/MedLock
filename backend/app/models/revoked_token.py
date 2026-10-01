from sqlalchemy import Column, DateTime, String

from app.database import Base


class RevokedToken(Base):
    """JWTs invalidated by logout, kept until they would have expired anyway."""
    __tablename__ = "revoked_tokens"

    jti = Column(String, primary_key=True)
    expires_at = Column(DateTime, nullable=False, index=True)

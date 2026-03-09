from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str

    # Supabase Storage
    SUPABASE_URL: str
    SUPABASE_SERVICE_KEY: str

    # JWT
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 1440

    # Encryption
    AES_SECRET_KEY: str

    # Ethereum Sepolia (optional until Phase 6)
    WEB3_PROVIDER_URL: str = ""
    ETHEREUM_PRIVATE_KEY: str = ""
    ETHEREUM_CONTRACT_ADDRESS: str = ""

    # Email (optional until email verification phase)
    MAIL_USERNAME: str = ""
    MAIL_PASSWORD: str = ""
    MAIL_FROM: str = ""
    MAIL_SERVER: str = ""
    MAIL_PORT: int = 587

    class Config:
        env_file = ".env"


settings = Settings()

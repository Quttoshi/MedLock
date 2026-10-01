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

    # Ethereum (Sepolia by default; logging is skipped when these are empty)
    WEB3_PROVIDER_URL: str = ""
    ETHEREUM_PRIVATE_KEY: str = ""
    ETHEREUM_CONTRACT_ADDRESS: str = ""
    ETHEREUM_CHAIN_ID: int = 11155111
    ETHEREUM_NETWORK: str = "sepolia"
    ETHERSCAN_BASE_URL: str = "https://sepolia.etherscan.io"
    BLOCKCHAIN_MAX_ATTEMPTS: int = 3
    # Upper bound on the fee per gas we are willing to pay, in gwei.
    BLOCKCHAIN_MAX_FEE_GWEI: float = 50.0

    # Periodic jobs: blockchain retries/confirmations and revoked-token cleanup
    BACKGROUND_JOBS_ENABLED: bool = True
    BACKGROUND_JOBS_INTERVAL_SECONDS: int = 60

    # OCR (Windows only — empty on Linux)
    TESSERACT_CMD: str = "tesseract"
    POPPLER_PATH: str = ""

    # Admin registration secret
    ADMIN_SECRET: str = "change-me-in-production"

    # Email (optional until email verification phase)
    MAIL_USERNAME: str = ""
    MAIL_PASSWORD: str = ""
    MAIL_FROM: str = ""
    MAIL_SERVER: str = ""
    MAIL_PORT: int = 587

    # Email verification: new accounts must confirm their address before logging in.
    # Set to false in development to allow test accounts with fake addresses.
    EMAIL_VERIFICATION_REQUIRED: bool = True
    EMAIL_VERIFICATION_EXPIRE_HOURS: int = 24
    # Minimum wait between resend requests for the same address.
    EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS: int = 60
    # Base URL of the web app, used to build the link in the confirmation email.
    FRONTEND_URL: str = "http://localhost:5173"

    class Config:
        env_file = ".env"


settings = Settings()

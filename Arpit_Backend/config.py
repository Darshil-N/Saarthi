from pydantic_settings import BaseSettings
from functools import lru_cache
from pathlib import Path

# Resolve .env relative to THIS file, not the working directory
_ENV_FILE = Path(__file__).parent / ".env"


class Settings(BaseSettings):
    SUPABASE_URL: str
    SUPABASE_SERVICE_KEY: str
    SUPABASE_ANON_KEY: str = ""
    GEMINI_API_KEY: str
    JWT_SECRET: str
    ENVIRONMENT: str = "development"
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Matching thresholds
    SIMILARITY_EXACT: float = 0.95
    SIMILARITY_NEAR: float = 0.75

    class Config:
        env_file = str(_ENV_FILE)
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

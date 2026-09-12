from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    SUPABASE_URL: str
    SUPABASE_SERVICE_KEY: str
    SUPABASE_ANON_KEY: str = ""
    GEMINI_API_KEY: str
    JWT_SECRET: str
    ENVIRONMENT: str = "development"

    # Matching thresholds
    SIMILARITY_EXACT: float = 0.95
    SIMILARITY_NEAR: float = 0.75

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

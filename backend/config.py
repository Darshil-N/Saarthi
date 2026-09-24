from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve .env relative to THIS file, not the working directory
_ENV_FILE = Path(__file__).parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(_ENV_FILE), extra="ignore")

    # --- Supabase / Gemini credentials ---
    SUPABASE_URL: str
    SUPABASE_SERVICE_KEY: str
    SUPABASE_ANON_KEY: str = ""
    GEMINI_API_KEY: str

    # --- Runtime ---
    ENVIRONMENT: str = "development"
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"
    LOG_LEVEL: str = "INFO"

    # --- Authentication ---
    # How long a verified access token (and its profile lookup) is trusted before
    # Supabase Auth is asked again. Role or deactivation changes take effect after this.
    AUTH_CACHE_TTL_SECONDS: int = 30

    # --- Business calendar ---
    # "Today" on the dashboards is the operator's local day. India has no DST.
    BUSINESS_UTC_OFFSET_MINUTES: int = 330

    # --- AI models ---
    GEMINI_MODEL_OCR: str = "gemini-flash-lite-latest"
    GEMINI_MODEL_MATCHING: str = "gemini-flash-lite-latest"
    GEMINI_MODEL_CNMC: str = "gemini-flash-lite-latest"
    GEMINI_EMBEDDING_MODEL: str = "models/gemini-embedding-001"
    EMBEDDING_DIMENSIONS: int = 768

    # --- Matching thresholds ---
    SIMILARITY_EXACT: float = 0.95
    SIMILARITY_NEAR: float = 0.75
    MATCH_CANDIDATE_THRESHOLD: float = 0.70
    MATCH_CANDIDATE_COUNT: int = 5

    # --- Matching concurrency (plan step 3.2.1) ---
    # How many bill lines are matched against the catalog at once during OCR review. Each line
    # makes 1-3 Gemini calls (embedding, comparison verdict, maybe CNMC generation), so this is a
    # deliberate middle ground: 1 (the old behaviour) is safest against free-tier rate limits but
    # painfully slow for a multi-line bill; fully unbounded risks 429s on a big bill. Raise this
    # if quota allows and it's still too slow; lower it if bills start failing with 429s.
    MATCHING_CONCURRENCY: int = 3

    # --- Uploads ---
    MAX_UPLOAD_BYTES: int = 10 * 1024 * 1024  # matches the bill-images bucket limit
    SIGNED_URL_TTL_SECONDS: int = 3600


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_API_KEY = "your-secret-api-key-here"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        # The .env may be shared with other services; ignore keys we don't own.
        extra="ignore",
    )

    ML_SERVICE_HOST: str = "0.0.0.0"
    ML_SERVICE_PORT: int = 8000
    MODEL_PATH: str = "./models"
    LOG_LEVEL: str = "INFO"
    # Comma-separated list, e.g. "http://localhost:3000,http://localhost:3001".
    # (A List[str] field would force JSON syntax in .env files.)
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:3001"
    API_KEY: str = DEFAULT_API_KEY

    # Weighted-formula fallback (used when no trained ranker is loaded). Sum = 1.0.
    SKILL_WEIGHT: float = 0.30
    QUALIFICATION_WEIGHT: float = 0.20
    LOCATION_WEIGHT: float = 0.12
    SECTOR_WEIGHT: float = 0.12
    FIELD_WEIGHT: float = 0.10
    CERTIFICATION_WEIGHT: float = 0.05
    LANGUAGE_WEIGHT: float = 0.03
    DIVERSITY_WEIGHT: float = 0.08

    MAX_MATCHES_PER_STUDENT: int = 10
    MIN_MATCH_SCORE: float = 0.5

    HARD_FILTER_ENABLED: bool = True
    CGPA_HARD_MARGIN: float = 0.0
    ALLOW_QUALIFICATION_ABOVE: bool = True

    CANDIDATE_POOL_SIZE: int = 100
    RANKER_MODEL_FILENAME: str = "ranker.pkl"
    RANKER_ENABLED: bool = True

    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"
    EMBEDDING_CACHE_SIZE: int = 5000

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


settings = Settings()

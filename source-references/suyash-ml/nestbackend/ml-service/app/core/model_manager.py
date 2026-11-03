import hashlib
from collections import OrderedDict
from pathlib import Path
from typing import Iterable, List, Optional

import joblib
import numpy as np
from loguru import logger
from sentence_transformers import SentenceTransformer
from sklearn.preprocessing import StandardScaler

from app.core.config import settings


class _LRUCache:
    def __init__(self, max_size: int):
        self.max_size = max_size
        self._data: "OrderedDict[str, np.ndarray]" = OrderedDict()

    def get(self, key: str) -> Optional[np.ndarray]:
        if key in self._data:
            self._data.move_to_end(key)
            return self._data[key]
        return None

    def put(self, key: str, value: np.ndarray) -> None:
        self._data[key] = value
        self._data.move_to_end(key)
        if len(self._data) > self.max_size:
            self._data.popitem(last=False)

    def __len__(self) -> int:
        return len(self._data)


class ModelManager:
    def __init__(self):
        self.skill_encoder: Optional[SentenceTransformer] = None
        self.scaler: Optional[StandardScaler] = None
        self.ranker = None
        self.ranker_features: List[str] = []
        self.model_path = Path(settings.MODEL_PATH)
        self.model_path.mkdir(parents=True, exist_ok=True)

        self._skill_cache = _LRUCache(settings.EMBEDDING_CACHE_SIZE)
        self._text_cache = _LRUCache(settings.EMBEDDING_CACHE_SIZE)

    async def load_models(self):
        try:
            logger.info("Loading sentence transformer model...")
            self.skill_encoder = SentenceTransformer(settings.EMBEDDING_MODEL)

            scaler_path = self.model_path / "scaler.pkl"
            if scaler_path.exists():
                logger.info("Loading existing scaler...")
                self.scaler = joblib.load(scaler_path)
            else:
                logger.info("Creating new scaler...")
                self.scaler = StandardScaler()

            self._maybe_load_ranker()
            logger.info("All models loaded successfully")
        except Exception as e:
            logger.error(f"Error loading models: {str(e)}")
            raise

    async def cleanup(self):
        logger.info("Cleaning up model resources...")
        self.skill_encoder = None
        self.scaler = None
        self.ranker = None
        self._skill_cache = _LRUCache(settings.EMBEDDING_CACHE_SIZE)
        self._text_cache = _LRUCache(settings.EMBEDDING_CACHE_SIZE)

    def save_scaler(self):
        scaler_path = self.model_path / "scaler.pkl"
        joblib.dump(self.scaler, scaler_path)
        logger.info(f"Scaler saved to {scaler_path}")

    # ------------------------------------------------------------------
    # Embedding helpers with caching
    # ------------------------------------------------------------------
    @staticmethod
    def _hash_skills(skills: Iterable[str]) -> str:
        normalized = sorted(s.strip().lower() for s in skills if s and s.strip())
        return hashlib.md5("|".join(normalized).encode("utf-8")).hexdigest()

    @staticmethod
    def _hash_text(text: str) -> str:
        return hashlib.md5(text.strip().lower().encode("utf-8")).hexdigest()

    def encode_skills(self, skills: List[str]) -> np.ndarray:
        if not self.skill_encoder:
            raise RuntimeError("Skill encoder not loaded")

        if not skills:
            return np.zeros((1, 384))

        key = self._hash_skills(skills)
        cached = self._skill_cache.get(key)
        if cached is not None:
            return cached

        embeddings = self.skill_encoder.encode(skills)
        result = np.mean(embeddings, axis=0).reshape(1, -1)
        self._skill_cache.put(key, result)
        return result

    def encode_text(self, text: str) -> np.ndarray:
        if not self.skill_encoder:
            raise RuntimeError("Skill encoder not loaded")

        if not text or not text.strip():
            return np.zeros((1, 384))

        key = self._hash_text(text)
        cached = self._text_cache.get(key)
        if cached is not None:
            return cached

        embedding = self.skill_encoder.encode([text])
        result = np.asarray(embedding).reshape(1, -1)
        self._text_cache.put(key, result)
        return result

    def cache_stats(self) -> dict:
        return {
            "skill_cache_size": len(self._skill_cache),
            "text_cache_size": len(self._text_cache),
        }

    # ------------------------------------------------------------------
    # Ranker persistence
    # ------------------------------------------------------------------
    def _ranker_path(self) -> Path:
        return self.model_path / settings.RANKER_MODEL_FILENAME

    def _maybe_load_ranker(self):
        path = self._ranker_path()
        if path.exists():
            try:
                payload = joblib.load(path)
                self.ranker = payload.get("model")
                self.ranker_features = payload.get("features", [])
                logger.info(f"Loaded trained ranker from {path}")
            except Exception as e:
                logger.warning(f"Failed to load ranker: {e}")
                self.ranker = None
                self.ranker_features = []
        else:
            logger.info("No trained ranker found; scoring will fall back to weighted formula")

    def save_ranker(self, model, features: List[str]) -> Path:
        path = self._ranker_path()
        joblib.dump({"model": model, "features": features}, path)
        self.ranker = model
        self.ranker_features = features
        logger.info(f"Ranker saved to {path}")
        return path

    def get_skill_encoder(self) -> SentenceTransformer:
        if not self.skill_encoder:
            raise RuntimeError("Skill encoder not loaded")
        return self.skill_encoder

    def get_scaler(self) -> StandardScaler:
        if not self.scaler:
            raise RuntimeError("Scaler not loaded")
        return self.scaler

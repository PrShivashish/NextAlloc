"""Singleton instances shared across routes without importing from app.main.

Prevents circular imports between `app.main` and the route modules.
"""
from app.core.model_manager import ModelManager

model_manager = ModelManager()

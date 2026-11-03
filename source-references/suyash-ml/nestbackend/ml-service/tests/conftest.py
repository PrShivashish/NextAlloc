"""Shared fixtures.

Tests never download the real sentence-transformer. `FakeEncoder` maps text to
a deterministic bag-of-words vector, so texts sharing words get higher cosine
similarity — enough signal to test ranking behaviour offline and fast.
"""
import hashlib
import os

import numpy as np
import pytest

os.environ.setdefault("API_KEY", "test-key")

from app.core.model_manager import ModelManager  # noqa: E402
from app.models.schemas import (  # noqa: E402
    DistrictType,
    InternshipOpportunity,
    QualificationLevel,
    SocialCategory,
    StudentProfile,
)

DIM = 384


class FakeEncoder:
    def encode(self, texts):
        out = np.zeros((len(texts), DIM))
        for row, text in enumerate(texts):
            for token in text.lower().replace(",", " ").replace(".", " ").split():
                idx = int(hashlib.md5(token.encode()).hexdigest(), 16) % DIM
                out[row, idx] += 1.0
        return out


@pytest.fixture
def model_manager(tmp_path, monkeypatch):
    monkeypatch.setattr("app.core.model_manager.settings.MODEL_PATH", str(tmp_path))
    mm = ModelManager()
    mm.skill_encoder = FakeEncoder()
    mm.ranker = None  # exercise the weighted-formula path unless a test trains one
    return mm


def make_student(**overrides) -> StudentProfile:
    data = dict(
        student_id="s1",
        name="Asha",
        skills=["python", "machine learning", "sql"],
        qualification=QualificationLevel.UNDERGRADUATE,
        field_of_study="Computer Science",
        cgpa=8.0,
        location_preference=["Delhi"],
        sector_interests=["Technology"],
        social_category=SocialCategory.GENERAL,
        district_type=DistrictType.URBAN,
        past_internships=1,
        languages=["English", "Hindi"],
        certifications=[],
    )
    data.update(overrides)
    return StudentProfile(**data)


def make_internship(**overrides) -> InternshipOpportunity:
    data = dict(
        internship_id="i1",
        company_name="Acme",
        title="ML Intern",
        description="Build machine learning models in python",
        required_skills=["python", "machine learning"],
        preferred_qualification=QualificationLevel.UNDERGRADUATE,
        sector="Technology",
        location="Delhi",
        duration_months=6,
        capacity=2,
        filled_positions=0,
        min_cgpa=6.0,
    )
    data.update(overrides)
    return InternshipOpportunity(**data)

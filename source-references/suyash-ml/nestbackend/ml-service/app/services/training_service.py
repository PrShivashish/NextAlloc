"""Training service for the internship-matching ranker.

Generates a synthetic labelled dataset (student, internship, features, selected)
using rule-based heuristics + noise, then fits a HistGradientBoostingClassifier.
The trained model is persisted via ModelManager so /rank can use it at inference.
"""

from __future__ import annotations

import random
from dataclasses import dataclass
from typing import Dict, List, Tuple

import numpy as np
from loguru import logger
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import accuracy_score, roc_auc_score
from sklearn.model_selection import train_test_split

from app.core.model_manager import ModelManager
from app.models.schemas import (
    DistrictType,
    InternshipOpportunity,
    QualificationLevel,
    SocialCategory,
    StudentProfile,
)
from app.services.matching_engine import RANKER_FEATURE_ORDER, MatchingEngine

SKILL_POOL = [
    "python", "java", "javascript", "typescript", "react", "node.js",
    "machine learning", "deep learning", "tensorflow", "pytorch",
    "data analysis", "sql", "postgresql", "mongodb", "aws", "docker",
    "kubernetes", "linux", "git", "rest api", "graphql", "html", "css",
    "excel", "tableau", "power bi", "communication", "leadership",
    "project management", "figma", "photoshop",
]

FIELD_POOL = [
    "Computer Science", "Information Technology", "Electronics",
    "Mechanical Engineering", "Civil Engineering", "Business Administration",
    "Economics", "Mathematics", "Physics", "Data Science",
]

SECTOR_POOL = [
    "Technology", "Finance", "Healthcare", "Education", "Manufacturing",
    "Retail", "Consulting", "Government",
]

LOCATION_POOL = [
    "Delhi", "Mumbai", "Bangalore", "Hyderabad", "Chennai",
    "Pune", "Kolkata", "Ahmedabad", "Jaipur", "Remote",
]

LANGUAGE_POOL = ["English", "Hindi", "Tamil", "Telugu", "Bengali", "Marathi"]


@dataclass
class SyntheticSample:
    features: List[float]
    label: int


class TrainingService:
    def __init__(self, model_manager: ModelManager):
        self.model_manager = model_manager
        self.engine = MatchingEngine(model_manager)

    # ------------------------------------------------------------------
    # Synthetic data generation
    # ------------------------------------------------------------------
    @staticmethod
    def _random_student(rng: random.Random, idx: int) -> StudentProfile:
        skills = rng.sample(SKILL_POOL, k=rng.randint(3, 8))
        return StudentProfile(
            student_id=f"stu-{idx}",
            name=f"Student {idx}",
            skills=skills,
            qualification=rng.choice(list(QualificationLevel)),
            field_of_study=rng.choice(FIELD_POOL),
            cgpa=round(rng.uniform(5.0, 10.0), 2),
            location_preference=rng.sample(LOCATION_POOL, k=rng.randint(1, 3)),
            sector_interests=rng.sample(SECTOR_POOL, k=rng.randint(1, 3)),
            social_category=rng.choice(list(SocialCategory)),
            district_type=rng.choice(list(DistrictType)),
            past_internships=rng.randint(0, 3),
            languages=rng.sample(LANGUAGE_POOL, k=rng.randint(1, 3)),
            certifications=rng.sample(SKILL_POOL, k=rng.randint(0, 3)),
        )

    @staticmethod
    def _random_internship(rng: random.Random, idx: int) -> InternshipOpportunity:
        required = rng.sample(SKILL_POOL, k=rng.randint(3, 6))
        preferred = rng.sample(
            [s for s in SKILL_POOL if s not in required],
            k=rng.randint(0, 3),
        )
        capacity = rng.randint(1, 10)
        return InternshipOpportunity(
            internship_id=f"int-{idx}",
            company_name=f"Company {idx}",
            title=f"{rng.choice(SECTOR_POOL)} Intern",
            description=(
                f"Work on {', '.join(required[:3])} projects in a fast-paced team."
            ),
            required_skills=required,
            preferred_qualification=rng.choice(list(QualificationLevel)),
            sector=rng.choice(SECTOR_POOL),
            location=rng.choice(LOCATION_POOL),
            stipend=float(rng.randint(5000, 50000)),
            duration_months=rng.randint(2, 6),
            capacity=capacity,
            filled_positions=rng.randint(0, capacity - 1) if capacity > 1 else 0,
            min_cgpa=round(rng.uniform(5.0, 8.5), 1),
            preferred_fields=rng.sample(FIELD_POOL, k=rng.randint(0, 3)),
            preferred_skills=preferred,
            required_languages=rng.sample(LANGUAGE_POOL, k=rng.randint(0, 2)),
        )

    def _score_pair(
        self, student: StudentProfile, internship: InternshipOpportunity
    ) -> Tuple[List[float], float]:
        """Compute the feature vector and a heuristic 'true' probability."""
        skill, _ = self.engine.calculate_skill_score(student, internship)
        qual, _ = self.engine.calculate_qualification_score(
            student.qualification,
            internship.preferred_qualification,
            student.cgpa,
            internship.min_cgpa,
        )
        loc, _ = self.engine.calculate_location_score(
            student.location_preference, internship.location
        )
        sec, _ = self.engine.calculate_sector_score(
            student.sector_interests, internship.sector
        )
        field, _ = self.engine.calculate_field_score(student, internship)
        cert, _ = self.engine.calculate_certification_score(student, internship)
        lang, _ = self.engine.calculate_language_score(student, internship)
        diversity, _ = self.engine.calculate_diversity_score(student, internship, True)

        capacity_ratio = 0.0
        if internship.capacity > 0:
            capacity_ratio = 1.0 - (internship.filled_positions / internship.capacity)

        features = [
            skill, qual, loc, sec, field, cert, lang, diversity,
            student.cgpa / 10.0,
            min(student.past_internships, 5) / 5.0,
            max(0.0, min(1.0, capacity_ratio)),
        ]

        # Heuristic ground-truth: weighted blend + noise -> logistic
        raw = (
            0.30 * skill + 0.20 * qual + 0.10 * loc + 0.10 * sec
            + 0.10 * field + 0.05 * cert + 0.05 * lang + 0.05 * diversity
            + 0.05 * (student.cgpa / 10.0)
        )
        # Hard filter influence: CGPA gap heavily penalises
        if student.cgpa < internship.min_cgpa:
            raw *= 0.4
        return features, raw

    def generate_dataset(
        self, n_samples: int, seed: int = 42
    ) -> Tuple[np.ndarray, np.ndarray]:
        rng = random.Random(seed)
        np_rng = np.random.default_rng(seed)

        # Pre-generate a pool of students + internships, then sample pairs.
        n_students = max(20, n_samples // 20)
        n_internships = max(20, n_samples // 20)
        students = [self._random_student(rng, i) for i in range(n_students)]
        internships = [self._random_internship(rng, i) for i in range(n_internships)]

        X: List[List[float]] = []
        y: List[int] = []
        for _ in range(n_samples):
            s = rng.choice(students)
            i = rng.choice(internships)
            features, raw = self._score_pair(s, i)
            # noise + logistic threshold
            noise = float(np_rng.normal(0, 0.15))
            prob = 1.0 / (1.0 + np.exp(-8 * (raw + noise - 0.55)))
            label = 1 if np_rng.random() < prob else 0
            X.append(features)
            y.append(label)

        return np.array(X, dtype=float), np.array(y, dtype=int)

    # ------------------------------------------------------------------
    # Training
    # ------------------------------------------------------------------
    def train(self, n_samples: int = 5000, seed: int = 42) -> Dict:
        logger.info(f"Generating synthetic dataset with {n_samples} samples")
        X, y = self.generate_dataset(n_samples, seed=seed)

        # Guard against degenerate label distribution.
        if len(np.unique(y)) < 2:
            logger.warning("Only one class in synthetic labels; flipping some")
            flip = np.random.default_rng(seed).choice(len(y), size=max(1, len(y) // 10), replace=False)
            y[flip] = 1 - y[flip]

        X_train, X_val, y_train, y_val = train_test_split(
            X, y, test_size=0.2, random_state=seed, stratify=y
        )

        model = HistGradientBoostingClassifier(
            max_iter=200,
            max_depth=6,
            learning_rate=0.08,
            random_state=seed,
        )
        model.fit(X_train, y_train)

        train_pred = model.predict(X_train)
        val_pred = model.predict(X_val)
        val_proba = model.predict_proba(X_val)[:, 1]

        train_acc = float(accuracy_score(y_train, train_pred))
        val_acc = float(accuracy_score(y_val, val_pred))
        val_auc = float(roc_auc_score(y_val, val_proba)) if len(np.unique(y_val)) > 1 else 0.0

        path = self.model_manager.save_ranker(model, RANKER_FEATURE_ORDER)

        # HistGradientBoosting doesn't expose feature_importances_ directly on
        # older sklearn versions; fall back to permutation-like fallback.
        importances: Dict[str, float] = {}
        try:
            fi = getattr(model, "feature_importances_", None)
            if fi is not None:
                importances = {
                    name: float(v) for name, v in zip(RANKER_FEATURE_ORDER, fi)
                }
        except Exception:
            pass

        logger.info(
            f"Training complete: train_acc={train_acc:.3f} "
            f"val_acc={val_acc:.3f} val_auc={val_auc:.3f}"
        )
        return {
            "n_samples": int(len(y)),
            "n_features": int(X.shape[1]),
            "train_accuracy": train_acc,
            "val_accuracy": val_acc,
            "val_roc_auc": val_auc,
            "model_path": str(path),
            "feature_importances": importances,
        }

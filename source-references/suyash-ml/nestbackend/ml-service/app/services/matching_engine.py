import numpy as np
from typing import List, Dict, Tuple, Optional
from loguru import logger
from sklearn.metrics.pairwise import cosine_similarity

from app.models.schemas import (
    StudentProfile, InternshipOpportunity, MatchScore,
    QualificationLevel, SocialCategory, DistrictType
)
from app.core.config import settings
from app.core.model_manager import ModelManager


# Feature order used by the trained ranker. Keep stable.
RANKER_FEATURE_ORDER: List[str] = [
    "skill_score",
    "qualification_score",
    "location_score",
    "sector_score",
    "field_score",
    "certification_score",
    "language_score",
    "diversity_score",
    "cgpa_norm",
    "past_internships",
    "capacity_ratio",
]


class MatchingEngine:
    def __init__(self, model_manager: ModelManager):
        self.model_manager = model_manager
        self.qualification_hierarchy = {
            QualificationLevel.DIPLOMA: 1,
            QualificationLevel.UNDERGRADUATE: 2,
            QualificationLevel.POSTGRADUATE: 3,
            QualificationLevel.DOCTORATE: 4,
        }

    # ------------------------------------------------------------------
    # Text-representation helpers (Improvement #22)
    # ------------------------------------------------------------------
    @staticmethod
    def _internship_text(internship: InternshipOpportunity) -> str:
        parts = [
            internship.title,
            internship.description,
            "Required skills: " + ", ".join(internship.required_skills or []),
            "Sector: " + (internship.sector or ""),
        ]
        if internship.preferred_skills:
            parts.append("Preferred skills: " + ", ".join(internship.preferred_skills))
        return ". ".join(p for p in parts if p)

    @staticmethod
    def _student_text(student: StudentProfile) -> str:
        parts = [
            f"Field of study: {student.field_of_study}",
            "Skills: " + ", ".join(student.skills or []),
        ]
        if student.certifications:
            parts.append("Certifications: " + ", ".join(student.certifications))
        if student.sector_interests:
            parts.append("Interests: " + ", ".join(student.sector_interests))
        return ". ".join(parts)

    # ------------------------------------------------------------------
    # Individual signals
    # ------------------------------------------------------------------
    def calculate_skill_score(
        self,
        student: StudentProfile,
        internship: InternshipOpportunity,
    ) -> Tuple[float, str]:
        try:
            student_emb = self.model_manager.encode_text(self._student_text(student))
            internship_emb = self.model_manager.encode_text(self._internship_text(internship))
            similarity = float(cosine_similarity(student_emb, internship_emb)[0][0])

            required = set(s.lower() for s in internship.required_skills)
            preferred = set(s.lower() for s in internship.preferred_skills)
            student_skills = set(s.lower() for s in student.skills)

            req_overlap = len(student_skills & required) / len(required) if required else 0.0
            pref_overlap = len(student_skills & preferred) / len(preferred) if preferred else 0.0

            final = 0.55 * similarity + 0.35 * req_overlap + 0.10 * pref_overlap
            explanation = (
                f"semantic={similarity:.2f}, required_overlap={req_overlap:.2f}, "
                f"preferred_overlap={pref_overlap:.2f}"
            )
            return min(max(final, 0.0), 1.0), explanation
        except Exception as e:
            logger.error(f"Error calculating skill score: {e}")
            return 0.0, "error"

    def calculate_qualification_score(
        self,
        student_qual: QualificationLevel,
        required_qual: QualificationLevel,
        student_cgpa: float,
        min_cgpa: float,
    ) -> Tuple[float, str]:
        student_level = self.qualification_hierarchy[student_qual]
        required_level = self.qualification_hierarchy[required_qual]

        if student_level < required_level:
            qual_score = 0.5 * (student_level / required_level)
        elif student_level == required_level:
            qual_score = 1.0
        else:
            qual_score = 0.9

        if min_cgpa <= 0:
            cgpa_score = min(student_cgpa / 10.0, 1.0)
        elif student_cgpa < min_cgpa:
            cgpa_score = 0.5 * (student_cgpa / min_cgpa)
        else:
            cgpa_score = min(student_cgpa / 10.0, 1.0)

        final = qual_score * 0.6 + cgpa_score * 0.4
        return final, f"qual={qual_score:.2f}, cgpa={cgpa_score:.2f}"

    def calculate_location_score(
        self,
        student_preferences: List[str],
        internship_location: str,
    ) -> Tuple[float, str]:
        loc = (internship_location or "").lower()
        prefs = [p.lower() for p in student_preferences]

        if not loc or not prefs:
            return 0.3, "no data"
        if loc in prefs:
            return 1.0, "exact match"
        if any(p in loc or loc in p for p in prefs):
            return 0.8, "partial match"
        return 0.3, "no match"

    def calculate_sector_score(
        self,
        student_interests: List[str],
        internship_sector: str,
    ) -> Tuple[float, str]:
        sec = (internship_sector or "").lower()
        interests = [i.lower() for i in student_interests]

        if not sec or not interests:
            return 0.3, "no data"
        if sec in interests:
            return 1.0, "exact match"
        if any(i in sec or sec in i for i in interests):
            return 0.7, "partial match"
        return 0.2, "no match"

    # Improvement #23
    def calculate_field_score(
        self,
        student: StudentProfile,
        internship: InternshipOpportunity,
    ) -> Tuple[float, str]:
        preferred = [f.strip() for f in internship.preferred_fields if f and f.strip()]
        field = (student.field_of_study or "").strip()
        if not field:
            return 0.5, "unknown field"

        if preferred:
            preferred_lower = [f.lower() for f in preferred]
            if field.lower() in preferred_lower:
                return 1.0, "exact field match"
            student_emb = self.model_manager.encode_text(field)
            pref_emb = self.model_manager.encode_text(", ".join(preferred))
            sim = float(cosine_similarity(student_emb, pref_emb)[0][0])
            return max(0.2, min(sim, 1.0)), f"field similarity={sim:.2f}"

        # No explicit preferred fields: compare against internship title/sector.
        student_emb = self.model_manager.encode_text(field)
        target_emb = self.model_manager.encode_text(
            f"{internship.title}. {internship.sector}"
        )
        sim = float(cosine_similarity(student_emb, target_emb)[0][0])
        return max(0.3, min(sim, 1.0)), f"field vs role sim={sim:.2f}"

    # Improvement #24
    def calculate_certification_score(
        self,
        student: StudentProfile,
        internship: InternshipOpportunity,
    ) -> Tuple[float, str]:
        certs = set(c.lower() for c in student.certifications)
        if not certs:
            return 0.4, "no certifications"

        targets = set(s.lower() for s in internship.required_skills) | set(
            s.lower() for s in internship.preferred_skills
        )
        if not targets:
            return 0.5, "no targets"

        hits = 0
        for cert in certs:
            for t in targets:
                if cert in t or t in cert:
                    hits += 1
                    break

        score = min(0.4 + 0.15 * hits, 1.0)
        return score, f"cert hits={hits}"

    # Improvement #25
    def calculate_language_score(
        self,
        student: StudentProfile,
        internship: InternshipOpportunity,
    ) -> Tuple[float, str]:
        required = [lang.lower() for lang in internship.required_languages]
        if not required:
            return 0.7, "no language requirement"

        known = set(lang.lower() for lang in student.languages)
        matched = sum(1 for r in required if r in known)
        ratio = matched / len(required)
        # Missing a required language should hurt.
        return ratio, f"languages matched {matched}/{len(required)}"

    def calculate_diversity_score(
        self,
        student: StudentProfile,
        internship: InternshipOpportunity,
        diversity_boost: bool,
    ) -> Tuple[float, str]:
        if not diversity_boost:
            return 0.5, "diversity disabled"

        score = 0.5
        factors = []
        if student.social_category in [SocialCategory.SC, SocialCategory.ST, SocialCategory.OBC]:
            score += 0.2
            factors.append(f"category={student.social_category.value}")
        if student.district_type in [DistrictType.RURAL, DistrictType.ASPIRATIONAL]:
            score += 0.2
            factors.append(f"district={student.district_type.value}")
        if student.past_internships == 0:
            score += 0.1
            factors.append("first-timer")
        return min(score, 1.0), ", ".join(factors) if factors else "none"

    # ------------------------------------------------------------------
    # Hard eligibility filter (Improvement #26)
    # ------------------------------------------------------------------
    def is_eligible(
        self,
        student: StudentProfile,
        internship: InternshipOpportunity,
    ) -> Tuple[bool, str]:
        if not settings.HARD_FILTER_ENABLED:
            return True, ""

        min_cgpa = internship.hard_min_cgpa if internship.hard_min_cgpa is not None else internship.min_cgpa
        if min_cgpa and student.cgpa + settings.CGPA_HARD_MARGIN < min_cgpa:
            return False, f"CGPA {student.cgpa} < required {min_cgpa}"

        hard_qual = internship.hard_min_qualification
        if hard_qual is not None:
            if self.qualification_hierarchy[student.qualification] < self.qualification_hierarchy[hard_qual]:
                return False, f"qualification {student.qualification.value} below {hard_qual.value}"

        if internship.filled_positions >= internship.capacity:
            return False, "no capacity"

        if internship.required_languages:
            known = set(lang.lower() for lang in student.languages)
            missing = [lang for lang in internship.required_languages if lang.lower() not in known]
            if missing:
                return False, f"missing languages: {', '.join(missing)}"

        return True, ""

    # ------------------------------------------------------------------
    # Match score
    # ------------------------------------------------------------------
    def calculate_match_score(
        self,
        student: StudentProfile,
        internship: InternshipOpportunity,
        diversity_boost: bool = True,
        use_ranker: bool = True,
        eligible_flag: Optional[bool] = None,
    ) -> MatchScore:
        skill_score, skill_exp = self.calculate_skill_score(student, internship)
        qual_score, qual_exp = self.calculate_qualification_score(
            student.qualification, internship.preferred_qualification,
            student.cgpa, internship.min_cgpa,
        )
        location_score, loc_exp = self.calculate_location_score(
            student.location_preference, internship.location
        )
        sector_score, sector_exp = self.calculate_sector_score(
            student.sector_interests, internship.sector
        )
        field_score, field_exp = self.calculate_field_score(student, internship)
        cert_score, cert_exp = self.calculate_certification_score(student, internship)
        lang_score, lang_exp = self.calculate_language_score(student, internship)
        diversity_score, div_exp = self.calculate_diversity_score(
            student, internship, diversity_boost
        )

        weighted = (
            skill_score * settings.SKILL_WEIGHT
            + qual_score * settings.QUALIFICATION_WEIGHT
            + location_score * settings.LOCATION_WEIGHT
            + sector_score * settings.SECTOR_WEIGHT
            + field_score * settings.FIELD_WEIGHT
            + cert_score * settings.CERTIFICATION_WEIGHT
            + lang_score * settings.LANGUAGE_WEIGHT
            + diversity_score * settings.DIVERSITY_WEIGHT
        )

        ranker_prob: Optional[float] = None
        if use_ranker and settings.RANKER_ENABLED and self.model_manager.ranker is not None:
            features = self._build_feature_vector(
                student, internship,
                skill_score, qual_score, location_score, sector_score,
                field_score, cert_score, lang_score, diversity_score,
            )
            try:
                ranker_prob = float(self.model_manager.ranker.predict_proba(features)[0][1])
            except Exception as e:
                logger.warning(f"Ranker inference failed: {e}")

        overall = ranker_prob if ranker_prob is not None else weighted

        if eligible_flag is None:
            eligible_flag, _ = self.is_eligible(student, internship)

        return MatchScore(
            student_id=student.student_id,
            internship_id=internship.internship_id,
            overall_score=round(float(overall), 4),
            skill_score=round(skill_score, 4),
            qualification_score=round(qual_score, 4),
            location_score=round(location_score, 4),
            sector_score=round(sector_score, 4),
            diversity_score=round(diversity_score, 4),
            field_score=round(field_score, 4),
            certification_score=round(cert_score, 4),
            language_score=round(lang_score, 4),
            ranker_score=round(ranker_prob, 4) if ranker_prob is not None else None,
            eligible=eligible_flag,
            explanation={
                "skills": skill_exp,
                "qualification": qual_exp,
                "location": loc_exp,
                "sector": sector_exp,
                "field": field_exp,
                "certifications": cert_exp,
                "languages": lang_exp,
                "diversity": div_exp,
                "weighted_score": f"{weighted:.4f}",
                "ranker": f"{ranker_prob:.4f}" if ranker_prob is not None else "n/a",
            },
        )

    # ------------------------------------------------------------------
    # Feature vector for the ranker
    # ------------------------------------------------------------------
    @staticmethod
    def _build_feature_vector(
        student: StudentProfile,
        internship: InternshipOpportunity,
        skill_score: float,
        qual_score: float,
        location_score: float,
        sector_score: float,
        field_score: float,
        cert_score: float,
        lang_score: float,
        diversity_score: float,
    ) -> np.ndarray:
        capacity_ratio = 0.0
        if internship.capacity > 0:
            capacity_ratio = 1.0 - (internship.filled_positions / internship.capacity)
        row = [
            skill_score,
            qual_score,
            location_score,
            sector_score,
            field_score,
            cert_score,
            lang_score,
            diversity_score,
            student.cgpa / 10.0,
            min(student.past_internships, 5) / 5.0,
            max(0.0, min(1.0, capacity_ratio)),
        ]
        return np.array([row], dtype=float)

    # ------------------------------------------------------------------
    # Matching pipelines
    # ------------------------------------------------------------------
    def match_student_to_internships(
        self,
        student: StudentProfile,
        internships: List[InternshipOpportunity],
        max_matches: int = 10,
        min_score: float = 0.5,
        diversity_boost: bool = True,
    ) -> List[MatchScore]:
        return self.rank_student(
            student=student,
            internships=internships,
            max_matches=max_matches,
            min_score=min_score,
            diversity_boost=diversity_boost,
            candidate_pool_size=settings.CANDIDATE_POOL_SIZE,
            apply_hard_filter=settings.HARD_FILTER_ENABLED,
            use_trained_ranker=True,
        )

    def rank_student(
        self,
        student: StudentProfile,
        internships: List[InternshipOpportunity],
        max_matches: int = 10,
        min_score: float = 0.0,
        diversity_boost: bool = True,
        candidate_pool_size: int = 100,
        apply_hard_filter: bool = True,
        use_trained_ranker: bool = True,
    ) -> List[MatchScore]:
        """Two-stage recommendation pipeline (Improvement #32).

        Stage 1: hard eligibility filter.
        Stage 2: cheap semantic pre-ranking (skill similarity) to shrink pool.
        Stage 3: full-feature scoring, optionally with the trained ranker.
        Stage 4: diversity-aware final ordering.
        """
        # --- Stage 1: eligibility ---
        if apply_hard_filter:
            eligible = []
            for i in internships:
                ok, _ = self.is_eligible(student, i)
                if ok:
                    eligible.append(i)
        else:
            eligible = [i for i in internships if i.filled_positions < i.capacity]

        if not eligible:
            logger.warning(f"No eligible internships for student {student.student_id}")
            return []

        # --- Stage 2: cheap semantic pre-ranking ---
        if len(eligible) > candidate_pool_size:
            student_emb = self.model_manager.encode_text(self._student_text(student))
            internship_embs = np.vstack(
                [self.model_manager.encode_text(self._internship_text(i)) for i in eligible]
            )
            sims = cosine_similarity(student_emb, internship_embs)[0]
            top_idx = np.argsort(-sims)[:candidate_pool_size]
            candidates = [eligible[j] for j in top_idx]
        else:
            candidates = eligible

        # --- Stage 3: full scoring ---
        scored: List[MatchScore] = []
        for internship in candidates:
            score = self.calculate_match_score(
                student, internship,
                diversity_boost=diversity_boost,
                use_ranker=use_trained_ranker,
                eligible_flag=True,
            )
            if score.overall_score >= min_score:
                scored.append(score)

        # --- Stage 4: diversity / policy ordering ---
        scored.sort(key=lambda x: x.overall_score, reverse=True)
        if diversity_boost:
            scored = self._diversify(scored, top_k=max_matches)
        return scored[:max_matches]

    @staticmethod
    def _diversify(matches: List[MatchScore], top_k: int) -> List[MatchScore]:
        """Light re-ranking: penalise repeats of the same internship sector/company block.

        We don't know sector at this point, so we boost items with a strong diversity
        signal already baked in, then keep the highest overall. Since match objects
        expose diversity_score, this is a simple linear tie-breaker.
        """
        # Blend overall with diversity as a tiny tie-breaker.
        return sorted(
            matches,
            key=lambda m: (m.overall_score + 0.02 * m.diversity_score),
            reverse=True,
        )

    def batch_match(
        self,
        students: List[StudentProfile],
        internships: List[InternshipOpportunity],
        max_matches_per_student: int = 10,
        min_score: float = 0.5,
        diversity_boost: bool = True,
    ) -> Dict[str, List[MatchScore]]:
        results = {}
        for student in students:
            matches = self.match_student_to_internships(
                student, internships,
                max_matches=max_matches_per_student,
                min_score=min_score,
                diversity_boost=diversity_boost,
            )
            results[student.student_id] = matches
            logger.info(f"Student {student.student_id}: {len(matches)} matches found")
        return results

    def optimize_allocation(
        self,
        students: List[StudentProfile],
        internships: List[InternshipOpportunity],
        diversity_boost: bool = True,
    ) -> Dict[str, str]:
        all_matches = {}
        for student in students:
            matches = self.match_student_to_internships(
                student, internships,
                max_matches=len(internships),
                min_score=0.0,
                diversity_boost=diversity_boost,
            )
            all_matches[student.student_id] = matches

        allocation = {}
        internship_capacity = {
            i.internship_id: i.capacity - i.filled_positions for i in internships
        }
        unallocated_students = set(s.student_id for s in students)

        while unallocated_students:
            best_match = None
            best_score = -1.0
            for student_id in list(unallocated_students):
                if student_id not in all_matches or not all_matches[student_id]:
                    continue
                for match in all_matches[student_id]:
                    if internship_capacity.get(match.internship_id, 0) > 0:
                        if match.overall_score > best_score:
                            best_score = match.overall_score
                            best_match = (student_id, match.internship_id)
                        break
            if best_match is None:
                break
            student_id, internship_id = best_match
            allocation[student_id] = internship_id
            internship_capacity[internship_id] -= 1
            unallocated_students.remove(student_id)

        logger.info(f"Allocated {len(allocation)} out of {len(students)} students")
        return allocation

from app.models.schemas import DistrictType, QualificationLevel, SocialCategory
from app.services.matching_engine import MatchingEngine

from tests.conftest import make_internship, make_student


def test_hard_filter_rejects_low_cgpa(model_manager):
    engine = MatchingEngine(model_manager)
    ok, reason = engine.is_eligible(make_student(cgpa=5.0), make_internship(min_cgpa=7.0))
    assert not ok
    assert "CGPA" in reason


def test_hard_filter_rejects_full_internship(model_manager):
    engine = MatchingEngine(model_manager)
    ok, reason = engine.is_eligible(make_student(), make_internship(capacity=2, filled_positions=2))
    assert not ok
    assert reason == "no capacity"


def test_hard_filter_rejects_missing_required_language(model_manager):
    engine = MatchingEngine(model_manager)
    ok, reason = engine.is_eligible(
        make_student(languages=["English"]), make_internship(required_languages=["Tamil"])
    )
    assert not ok
    assert "Tamil" in reason


def test_rank_puts_better_fit_first(model_manager):
    engine = MatchingEngine(model_manager)
    good = make_internship(internship_id="good")
    poor = make_internship(
        internship_id="poor",
        title="Accounts Intern",
        description="Bookkeeping and ledger reconciliation",
        required_skills=["tally", "accounting"],
        sector="Finance",
        location="Chennai",
    )
    matches = engine.rank_student(make_student(), [poor, good], max_matches=5)
    assert [m.internship_id for m in matches] == ["good", "poor"]
    assert matches[0].overall_score > matches[1].overall_score


def test_rank_excludes_ineligible_and_respects_max_and_min_score(model_manager):
    engine = MatchingEngine(model_manager)
    pool = [make_internship(internship_id=f"i{n}") for n in range(5)]
    pool.append(make_internship(internship_id="full", capacity=1, filled_positions=1))

    matches = engine.rank_student(make_student(), pool, max_matches=3)
    assert len(matches) == 3
    assert "full" not in {m.internship_id for m in matches}

    assert engine.rank_student(make_student(), pool, max_matches=3, min_score=0.999) == []


def test_scores_are_bounded_and_explained(model_manager):
    engine = MatchingEngine(model_manager)
    score = engine.calculate_match_score(make_student(), make_internship())
    for value in (
        score.overall_score,
        score.skill_score,
        score.qualification_score,
        score.location_score,
        score.sector_score,
        score.diversity_score,
    ):
        assert 0.0 <= value <= 1.0
    assert {"skills", "qualification", "location", "weighted_score"} <= score.explanation.keys()
    assert score.ranker_score is None  # no trained ranker loaded in this fixture


def test_diversity_boost_rewards_underrepresented_first_timers(model_manager):
    engine = MatchingEngine(model_manager)
    internship = make_internship()
    base, _ = engine.calculate_diversity_score(make_student(), internship, True)
    boosted, factors = engine.calculate_diversity_score(
        make_student(
            social_category=SocialCategory.SC,
            district_type=DistrictType.ASPIRATIONAL,
            past_internships=0,
        ),
        internship,
        True,
    )
    assert boosted > base
    assert "district=ASPIRATIONAL" in factors
    disabled, _ = engine.calculate_diversity_score(make_student(), internship, False)
    assert disabled == 0.5


def test_qualification_below_requirement_is_penalised(model_manager):
    engine = MatchingEngine(model_manager)
    exact, _ = engine.calculate_qualification_score(
        QualificationLevel.UNDERGRADUATE, QualificationLevel.UNDERGRADUATE, 8.0, 6.0
    )
    below, _ = engine.calculate_qualification_score(
        QualificationLevel.DIPLOMA, QualificationLevel.POSTGRADUATE, 8.0, 6.0
    )
    assert exact > below


def test_optimize_allocation_never_exceeds_capacity(model_manager):
    engine = MatchingEngine(model_manager)
    students = [make_student(student_id=f"s{n}") for n in range(4)]
    internships = [make_internship(internship_id="only", capacity=2)]
    allocation = engine.optimize_allocation(students, internships)
    assert len(allocation) == 2
    assert set(allocation.values()) == {"only"}

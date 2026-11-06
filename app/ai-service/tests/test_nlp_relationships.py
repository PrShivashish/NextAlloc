"""
Phase 4B-1B: Focused tests for relation-aware skill intelligence,
safe alias corrections, and mandatory eligibility invariants.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import nlp


def test_exact_canonical_matching():
    for canon in ["Python", "Java", "SQL", "Machine Learning", "Cloud Computing"]:
        rel = nlp.classify_skill_relation(canon)
        assert rel["relation_type"] == nlp.RELATION_EXACT_CANONICAL
        assert rel["canonical"] == canon
        assert rel["is_mandatory_eligible"] is True
        assert nlp.normalize(canon) == canon


def test_verified_equivalent_aliases():
    """True synonyms and exact abbreviations ONLY."""
    aliases = {
        "cpp": "C++",
        "c plus plus": "C++",
        "ui/ux": "UI/UX Design",
        "ui ux": "UI/UX Design",
        "ui-ux": "UI/UX Design",
        "html/css": "HTML CSS",
        "microsoft excel": "Excel",
        "ms-excel": "Excel",
        "power-bi": "Power BI",
        "full stack": "Web Development",
        "full-stack": "Web Development",
        "fullstack": "Web Development",
        "web dev": "Web Development",
    }
    for alias, expected in aliases.items():
        rel = nlp.classify_skill_relation(alias)
        assert rel["relation_type"] == nlp.RELATION_VERIFIED_ALIAS
        assert rel["canonical"] == expected
        assert rel["is_mandatory_eligible"] is True
        assert nlp.normalize(alias) == expected


def test_corrected_false_equivalence_aliases():
    """Gate A corrections: K8s, CI/CD, Frontend, Backend, Tally must NOT be verified aliases."""
    corrected_cases = [
        ("k8s", "DevOps", "tool abbreviation"),
        ("ci/cd", "DevOps", "engineering practice"),
        ("ci cd", "DevOps", "engineering practice"),
        ("front-end", "Web Development", "sub-discipline"),
        ("back-end", "Web Development", "sub-discipline"),
        ("backend", "Web Development", "sub-discipline"),
        ("tally", "Accounting", "software tool"),
    ]
    for label, domain, role in corrected_cases:
        rel = nlp.classify_skill_relation(label)
        assert rel["relation_type"] == nlp.RELATION_RELATED_CONCEPT, f"{label} must be RELATED_CONCEPT"
        assert rel["canonical"] is None, f"{label} must have canonical=None"
        assert rel["related_domain"] == domain, f"{label} related domain must be {domain}"
        assert rel["is_mandatory_eligible"] is False, f"{label} must not be mandatory eligible"
        # Strict normalization must strictly abstain
        assert nlp.normalize(label) is None, f"strict normalize({label}) must return None"


def test_composite_label_safety():
    """Gate A.6: C/C++ must not silently manufacture a single C++ qualification."""
    for composite in ["c/c++", "c / c++", "C/C++"]:
        rel = nlp.classify_skill_relation(composite)
        assert rel["relation_type"] == nlp.RELATION_COMPOSITE_LABEL
        assert rel["canonical"] is None
        assert rel["is_mandatory_eligible"] is False
        assert nlp.normalize(composite) is None


def test_related_technologies_disallow_hard_equivalence():
    """Safety Invariant: Frameworks/libraries must NOT satisfy mandatory skill qualification."""
    related_cases = [
        ("PyTorch", "Deep Learning"),
        ("TensorFlow", "Deep Learning"),
        ("FastAPI", "Python"),
        ("Django", "Python"),
        ("TypeScript", "JavaScript"),
        ("Next.js", "React"),
        ("Pandas", "Data Analysis"),
        ("NumPy", "Data Analysis"),
        ("Scikit-Learn", "Machine Learning"),
        ("Terraform", "Cloud Computing"),
        ("Ansible", "DevOps"),
    ]
    for tool, expected_domain in related_cases:
        rel = nlp.classify_skill_relation(tool)
        assert rel["relation_type"] == nlp.RELATION_RELATED_CONCEPT
        assert rel["related_domain"] == expected_domain
        assert rel["canonical"] is None, f"{tool} must not be coerced into canonical skill"
        assert rel["is_mandatory_eligible"] is False
        assert nlp.normalize(tool) is None


def test_out_of_scope_sectoral_skills_report_taxonomy_gap():
    """Gate A.7: Gardening, cricket, baking, welding must be identified as taxonomy gaps, not invalid nonsense."""
    sectoral_cases = [
        ("Gardening", "Horticulture & Agriculture"),
        ("Cricket", "Sports & Physical Education"),
        ("Baking", "Food Processing & Culinary"),
        ("Food safety", "Food Processing & Culinary"),
        ("Welding", "Manufacturing & Fabrication"),
        ("CNC machining", "Manufacturing & Operations"),
        ("Carpentry", "Construction & Infrastructure"),
        ("Crop agronomy", "Agriculture & Rural Development"),
        ("Phlebotomy", "Healthcare Clinical"),
    ]
    for skill, expected_sector in sectoral_cases:
        rel = nlp.classify_skill_relation(skill)
        assert rel["relation_type"] == nlp.RELATION_OUT_OF_SCOPE_TAXONOMY
        assert rel["sector"] == expected_sector
        assert rel["taxonomy_gap"] is True
        assert rel["is_mandatory_eligible"] is False
        assert nlp.normalize(skill) is None


def test_unrelated_terms_abstention():
    """Truly non-work activities must be rejected."""
    unrelated = ["Quantum flux", "Pasta cooking", "Guitar playing", "Chess strategy", "Dog walking", "Knitting"]
    for term in unrelated:
        rel = nlp.classify_skill_relation(term)
        assert rel["relation_type"] == nlp.RELATION_UNRELATED_TERM
        assert rel["is_mandatory_eligible"] is False
        assert rel["taxonomy_gap"] is False
        assert nlp.normalize(term) is None


def test_label_cleaning_and_boundary_robustness():
    assert nlp.normalize("  • Python  ") == "Python"
    assert nlp.normalize("\"SQL\"") == "SQL"
    assert nlp.normalize("[Java]") == "Java"
    assert nlp.normalize("UI/UX") == "UI/UX Design"
    assert nlp.normalize("") is None
    assert nlp.normalize(None) is None
    assert nlp.normalize("   ") is None


def test_valid_resume_extraction():
    text = "Experienced in Python, SQL, and UI/UX design. Built models with Docker and cloud on AWS."
    skills, engine = nlp.extract_skills(text)
    canonicals = {s["canonical"] for s in skills}
    assert {"Python", "SQL", "UI/UX Design", "DevOps", "Cloud Computing"} <= canonicals
    assert engine == "taxonomy-lexicon"

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
        ("kubernetes", "DevOps", "container orchestration platform"),
        ("docker", "DevOps", "container runtime tool"),
        ("k8s", "DevOps", "tool abbreviation"),
        ("ci/cd", "DevOps", "engineering practice"),
        ("ci cd", "DevOps", "engineering practice"),
        ("frontend", "Web Development", "sub-discipline"),
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
        ("Spring Boot", "Java"),
        ("Spring", "Java"),
        ("Spring Framework", "Java"),
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
    text = "Experienced in Python, SQL, and UI/UX design. Built DevOps pipelines and cloud on AWS."
    skills, engine = nlp.extract_skills(text)
    canonicals = {s["canonical"] for s in skills}
    assert {"Python", "SQL", "UI/UX Design", "DevOps", "Cloud Computing"} <= canonicals
    assert engine == "taxonomy-lexicon"


def test_resume_extraction_unsafe_coercions_prevented():
    """Gate B & Gate C: Unsafe tool/subdiscipline mentions must NOT manufacture broad canonical qualifications."""
    # 1. Resume mentioning only Kubernetes -> must NOT extract DevOps
    text_k8s = "Senior engineer managing microservices using Kubernetes orchestration and pod scaling."
    skills_k8s, _ = nlp.extract_skills(text_k8s)
    canonicals_k8s = {s["canonical"] for s in skills_k8s}
    assert "DevOps" not in canonicals_k8s, "Kubernetes alone must NOT manufacture DevOps in resume extraction"

    # 2. Resume mentioning only Docker -> must NOT extract DevOps
    text_docker = "Automated container builds using Docker compose and container packaging."
    skills_docker, _ = nlp.extract_skills(text_docker)
    canonicals_docker = {s["canonical"] for s in skills_docker}
    assert "DevOps" not in canonicals_docker, "Docker alone must NOT manufacture DevOps in resume extraction"

    # 3. Resume mentioning only frontend -> must NOT extract Web Development
    text_frontend = "Passionate frontend engineer working on responsive design and mobile layouts."
    skills_frontend, _ = nlp.extract_skills(text_frontend)
    canonicals_frontend = {s["canonical"] for s in skills_frontend}
    assert "Web Development" not in canonicals_frontend, "Frontend alone must NOT manufacture Web Development in resume extraction"

    # 4. Resume explicitly mentioning DevOps -> correctly extracts DevOps
    text_devops = "Senior DevOps practitioner working across infrastructure and release engineering."
    skills_devops, _ = nlp.extract_skills(text_devops)
    canonicals_devops = {s["canonical"] for s in skills_devops}
    assert "DevOps" in canonicals_devops, "Explicit DevOps mention must be recognized"

    # 5. Resume explicitly mentioning Web Development -> correctly extracts Web Development
    text_web = "Full-stack engineer with 3 years of Web Development experience."
    skills_web, _ = nlp.extract_skills(text_web)
    canonicals_web = {s["canonical"] for s in skills_web}
    assert "Web Development" in canonicals_web, "Explicit Web Development mention must be recognized"

    # 6. Resume mentioning both exact skill and related tool -> extracts exact skill only
    text_mixed = "Backend engineer writing Python services packaged with Docker and deployed via Kubernetes."
    skills_mixed, _ = nlp.extract_skills(text_mixed)
    canonicals_mixed = {s["canonical"] for s in skills_mixed}
    assert "Python" in canonicals_mixed, "Exact canonical Python must be extracted"
    assert "DevOps" not in canonicals_mixed, "DevOps must NOT be manufactured from Docker or Kubernetes"


def test_fastapi_endpoints_adversarial_and_legacy_isolation():
    """Security Gate B & C: FastAPI HTTP route invocation with adversarial payloads.

    Verifies that:
    1. /nlp/skills and /nlp/normalize reject unsafe coercions over real HTTP requests.
    2. Injected legacy/version fields ('v0_legacy', 'legacy', query params) can NEVER
       trigger legacy replay over HTTP endpoints.
    3. Malformed payloads are handled securely according to Pydantic schemas.
    """
    from starlette.testclient import TestClient
    import main

    client = TestClient(main.app)

    # 1. Kubernetes-only payload -> skills must be empty
    r1 = client.post("/nlp/skills", json={"text": "Kubernetes orchestration and container management"})
    assert r1.status_code == 200
    assert r1.json()["skills"] == []

    # 2. Docker-only payload -> skills must be empty
    r2 = client.post("/nlp/skills", json={"text": "Docker container packaging and dockerfile authoring"})
    assert r2.status_code == 200
    assert r2.json()["skills"] == []

    # 3. Frontend-only payload -> skills must be empty
    r3 = client.post("/nlp/skills", json={"text": "Frontend styling and responsive web layouts"})
    assert r3.status_code == 200
    assert r3.json()["skills"] == []

    # 4. Explicit DevOps mention -> returns DevOps
    r4 = client.post("/nlp/skills", json={"text": "Senior DevOps engineer with CI/CD background"})
    assert r4.status_code == 200
    extracted_4 = {s["canonical"] for s in r4.json()["skills"]}
    assert "DevOps" in extracted_4

    # 5. Explicit Web Development mention -> returns Web Development
    r5 = client.post("/nlp/skills", json={"text": "Full-stack Web Development experience"})
    assert r5.status_code == 200
    extracted_5 = {s["canonical"] for s in r5.json()["skills"]}
    assert "Web Development" in extracted_5

    # 6. Mixed text: Python with Kubernetes -> Python present, DevOps absent
    r6 = client.post("/nlp/skills", json={"text": "Python microservices deployed on Kubernetes"})
    assert r6.status_code == 200
    extracted_6 = {s["canonical"] for s in r6.json()["skills"]}
    assert "Python" in extracted_6
    assert "DevOps" not in extracted_6

    # 7. Injected legacy version field -> version is ignored, legacy mode CANNOT be activated
    r7 = client.post("/nlp/skills", json={"text": "Kubernetes", "version": "v0_legacy"})
    assert r7.status_code == 200
    assert r7.json()["skills"] == []

    # 8. Injected mode/extra fields attempting legacy activation
    r8 = client.post("/nlp/skills", json={"text": "Docker", "mode": "legacy", "extra": "v0_legacy"})
    assert r8.status_code == 200
    assert r8.json()["skills"] == []

    # 9. Injected query parameter attempting legacy activation
    r9 = client.post("/nlp/skills?version=v0_legacy&mode=legacy", json={"text": "frontend developer"})
    assert r9.status_code == 200
    assert r9.json()["skills"] == []

    # 10. Malformed / edge-case inputs
    # 10a. Empty string
    r10a = client.post("/nlp/skills", json={"text": ""})
    assert r10a.status_code == 200
    assert r10a.json()["skills"] == []

    # 10b. Missing required body or non-dict
    r10b = client.post("/nlp/skills", json={})
    assert r10b.status_code == 200
    assert r10b.json()["skills"] == []

    # 10c. Integer text field (Pydantic validation error)
    r10c = client.post("/nlp/skills", json={"text": 12345})
    assert r10c.status_code in (200, 422)  # Pydantic may coerce or reject; if 200, skills must be empty
    if r10c.status_code == 200:
        assert r10c.json()["skills"] == []

    # 11. Normalize endpoint security and isolation:
    # 11a. Injected version in /nlp/normalize -> cannot trigger legacy mode
    rn1 = client.post("/nlp/normalize", json={"label": "kubernetes", "version": "v0_legacy"})
    assert rn1.status_code == 200
    assert rn1.json()["canonical"] is None

    rn2 = client.post("/nlp/normalize", json={"label": "docker", "mode": "legacy"})
    assert rn2.status_code == 200
    assert rn2.json()["canonical"] is None

    rn3 = client.post("/nlp/normalize", json={"label": "frontend"})
    assert rn3.status_code == 200
    assert rn3.json()["canonical"] is None

    rn4 = client.post("/nlp/normalize", json={"label": "Python"})
    assert rn4.status_code == 200
    assert rn4.json()["canonical"] == "Python"


def test_extract_related_skills_isolated():
    """Verify related skill extraction preserves tools/frameworks without canonical promotion."""
    # Test Spring Boot
    rel_spring = nlp.extract_related_skills("Built backend microservices using Spring Boot and PostgreSQL.")
    spring_concepts = [r["concept_id"] for r in rel_spring]
    assert "CONCEPT-REL-SPRING_BOOT" in spring_concepts
    # Bare spring must NOT match
    bare_spring = nlp.extract_related_skills("Took a long vacation in the spring of 2024 near the mountain spring.")
    assert bare_spring == []

    # Test PyTorch, Docker, Kubernetes
    text = "Experience with PyTorch, Docker containers and Kubernetes clusters for deployment."
    rel = nlp.extract_related_skills(text)
    cids = {r["concept_id"]: r for r in rel}
    assert "CONCEPT-REL-PYTORCH" in cids
    assert cids["CONCEPT-REL-PYTORCH"]["related_canonical"] == "Deep Learning"
    assert cids["CONCEPT-REL-PYTORCH"]["relation_type"] == "FRAMEWORK"

    assert "CONCEPT-REL-DOCKER" in cids
    assert cids["CONCEPT-REL-DOCKER"]["related_canonical"] == "DevOps"
    assert cids["CONCEPT-REL-DOCKER"]["relation_type"] == "TOOL"

    assert "CONCEPT-REL-KUBERNETES" in cids
    assert cids["CONCEPT-REL-KUBERNETES"]["related_canonical"] == "DevOps"
    assert cids["CONCEPT-REL-KUBERNETES"]["relation_type"] == "TOOL"


def test_nlp_skills_endpoint_includes_related_skills():
    """Verify /nlp/skills endpoint returns canonical skills and related skills distinctly."""
    from fastapi.testclient import TestClient
    from main import app
    client = TestClient(app)

    # Resume with Spring Boot only: must NOT have Java in canonical skills
    resp = client.post("/nlp/skills", json={"text": "Backend engineer skilled in Spring Boot microservices."})
    assert resp.status_code == 200
    data = resp.json()
    canonical_skills = [s["canonical"] for s in data["skills"]]
    assert "Java" not in canonical_skills
    assert "related_skills" in data
    assert any(r["concept_id"] == "CONCEPT-REL-SPRING_BOOT" for r in data["related_skills"])

    # Resume with both Java and Spring Boot
    resp2 = client.post("/nlp/skills", json={"text": "Senior Java developer building enterprise services with Spring Boot."})
    assert resp2.status_code == 200
    data2 = resp2.json()
    canonical_skills2 = [s["canonical"] for s in data2["skills"]]
    assert "Java" in canonical_skills2
    assert any(r["concept_id"] == "CONCEPT-REL-SPRING_BOOT" for r in data2["related_skills"])

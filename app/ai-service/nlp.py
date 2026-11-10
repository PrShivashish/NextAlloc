"""
Deterministic resume/skill intelligence.

Pipeline: raw text -> candidate skill mentions -> normalized labels ->
canonical taxonomy skills. Only taxonomy-validated skills are returned;
unvalidated labels never become trusted allocation input.

When a richer local model is not installed the engine is the deterministic
lexicon ("local-fallback"); when sentence-transformers is available the
engine can additionally rank mentions ("ai-assisted").
"""

import re

CANONICAL = [
    "Python", "Java", "C++", "SQL", "Data Analysis", "Machine Learning", "Excel",
    "Statistics", "Power BI", "Tableau", "Web Development", "React", "Node.js",
    "JavaScript", "HTML CSS", "Git", "Cloud Computing", "DevOps", "Cybersecurity",
    "NLP", "Deep Learning", "Communication", "Presentation", "Research",
    "Content Writing", "Graphic Design", "UI/UX Design", "Digital Marketing",
    "Social Media", "SEO", "Finance", "Accounting", "Budgeting",
    "Public Administration", "Policy Analysis", "HR Management", "Operations",
    "Supply Chain", "Legal Research", "Environmental Science", "Healthcare Data",
    "Project Management",
]

# 1. Verified abbreviations and direct synonyms (True Hard Equivalents ONLY)
# Must be unambiguous equivalent labels for the exact canonical skill concept.
SYNONYMS = {
    "python3": "Python", "py": "Python",
    "java programming": "Java",
    "c plus plus": "C++", "cpp": "C++",
    "mysql": "SQL", "postgresql": "SQL", "postgres": "SQL", "sql server": "SQL", "databases": "SQL",
    "data analytics": "Data Analysis", "data science": "Data Analysis", "analytics": "Data Analysis",
    "ml": "Machine Learning", "ai models": "Machine Learning",
    "ms excel": "Excel", "spreadsheets": "Excel", "ms office": "Excel", "advanced excel": "Excel",
    "microsoft excel": "Excel", "ms-excel": "Excel", "spreadsheet": "Excel",
    "powerbi": "Power BI", "power-bi": "Power BI", "data visualization": "Tableau",
    "full stack": "Web Development", "full-stack": "Web Development", "fullstack": "Web Development",
    "web dev": "Web Development",
    "react.js": "React", "reactjs": "React", "react js": "React",
    "node": "Node.js", "node js": "Node.js", "nodejs": "Node.js", "node-js": "Node.js",
    "js": "JavaScript",
    "html": "HTML CSS", "css": "HTML CSS", "html5": "HTML CSS", "css3": "HTML CSS",
    "html/css": "HTML CSS", "html-css": "HTML CSS",
    "tailwind": "HTML CSS", "tailwind css": "HTML CSS",
    "git github": "Git", "github": "Git", "gitlab": "Git",
    "aws": "Cloud Computing", "azure": "Cloud Computing", "gcp": "Cloud Computing", "google cloud": "Cloud Computing",
    "cyber security": "Cybersecurity", "infosec": "Cybersecurity", "information security": "Cybersecurity",
    "natural language processing": "NLP",
    "neural networks": "Deep Learning",
    "public speaking": "Communication", "interpersonal": "Communication",
    "blogging": "Content Writing",
    "figma": "UI/UX Design", "ui design": "UI/UX Design", "ux design": "UI/UX Design", "product design": "UI/UX Design",
    "ui/ux": "UI/UX Design", "ui ux": "UI/UX Design", "ui-ux": "UI/UX Design",
    "social media marketing": "Social Media",
    "search engine optimization": "SEO",
    "financial analysis": "Finance", "accountancy": "Accounting",
    "public policy": "Policy Analysis", "policy research": "Policy Analysis",
    "government": "Public Administration", "policy": "Policy Analysis",
    "human resources": "HR Management", "hr management": "HR Management",
    "operations management": "Operations",
    "supply chain management": "Supply Chain",
    "sustainability": "Environmental Science",
    "health data": "Healthcare Data", "healthcare analytics": "Healthcare Data",
    "agile": "Project Management", "scrum": "Project Management",
}

# 2. Relationship Type Taxonomy
RELATION_EXACT_CANONICAL = "EXACT_CANONICAL"
RELATION_VERIFIED_ALIAS = "VERIFIED_ALIAS"
RELATION_RELATED_CONCEPT = "RELATED_CONCEPT"
RELATION_COMPOSITE_LABEL = "COMPOSITE_LABEL"
RELATION_OUT_OF_SCOPE_TAXONOMY = "OUT_OF_SCOPE_TAXONOMY"
RELATION_UNRELATED_TERM = "UNRELATED_TERM"

# 3. Related concepts, tools, and sub-disciplines (Candidates for soft fit, but NOT hard equivalents)
# Any query in this dictionary strictly abstains from mandatory qualification (is_mandatory_eligible = False).
RELATED_CONCEPTS = {
    # DevOps tools and practices
    "kubernetes": ("DevOps", "Container orchestration platform; related engineering tool, not equivalent to the full DevOps domain"),
    "docker": ("DevOps", "Container runtime and packaging tool; related engineering tool, not equivalent to the full DevOps domain"),
    "k8s": ("DevOps", "Abbreviation for Kubernetes (container orchestration tool); related to DevOps, but not equivalent to the full DevOps domain"),
    "ci/cd": ("DevOps", "Continuous Integration / Continuous Deployment practice; related engineering discipline, not equivalent to the full DevOps domain"),
    "ci cd": ("DevOps", "Continuous Integration / Continuous Deployment practice; related engineering discipline, not equivalent to the full DevOps domain"),
    "ci-cd": ("DevOps", "Continuous Integration / Continuous Deployment practice; related engineering discipline, not equivalent to the full DevOps domain"),
    "ansible": ("DevOps", "Configuration management automation tool; related to DevOps"),
    "terraform": ("Cloud Computing", "Infrastructure-as-Code automation tool; related to Cloud Computing and DevOps"),

    # Web development sub-disciplines (Narrower specializations, not full web development)
    "frontend": ("Web Development", "Client-side specialization; sub-discipline of Web Development, does not certify complete Web Development competence"),
    "front-end": ("Web Development", "Client-side specialization; sub-discipline of Web Development, does not certify complete Web Development competence"),
    "back-end": ("Web Development", "Server-side specialization; sub-discipline of Web Development, does not certify complete Web Development competence"),
    "backend": ("Web Development", "Server-side specialization; sub-discipline of Web Development, does not certify complete Web Development competence"),

    # Accounting software vs general accounting
    "tally": ("Accounting", "Accounting software application; software familiarity does not certify comprehensive general Accounting competency"),

    # Deep learning frameworks vs theoretical domain
    "pytorch": ("Deep Learning", "Deep learning framework/library; specialized implementation tool for Deep Learning"),
    "tensorflow": ("Deep Learning", "Deep learning framework/library; specialized implementation tool for Deep Learning"),
    "keras": ("Deep Learning", "High-level neural networks API; specialized framework for Deep Learning"),

    # Language frameworks vs programming languages
    "fastapi": ("Python", "Python web framework; specialized library, not an equivalent qualification for Python"),
    "django": ("Python", "Python full-stack web framework; specialized library, not an equivalent qualification for Python"),
    "flask": ("Python", "Python lightweight microframework; specialized library, not an equivalent qualification for Python"),
    "spring": ("Java", "Java application framework and ecosystem; related framework, not equivalent to the Java programming language"),
    "spring boot": ("Java", "Java-based application framework; specialized framework, not equivalent to the Java programming language"),
    "spring framework": ("Java", "Java application framework; specialized framework, not equivalent to the Java programming language"),

    # Related programming languages
    "typescript": ("JavaScript", "Typed programming language superset; distinct language with separate compiler and type system"),

    # Web UI frameworks
    "next.js": ("React", "React production framework; specialized application framework"),
    "nextjs": ("React", "React production framework; specialized application framework"),
    "flutter": ("Web Development", "Cross-platform UI software development kit"),

    # Data science libraries
    "pandas": ("Data Analysis", "Data manipulation and tabular analysis library for Python"),
    "numpy": ("Data Analysis", "Scientific computing and numerical array library for Python"),
    "seaborn": ("Data Analysis", "Statistical data visualization library for Python"),
    "scikit-learn": ("Machine Learning", "Machine learning library for Python"),
    "sklearn": ("Machine Learning", "Machine learning library for Python"),

    # NLP frameworks
    "huggingface": ("NLP", "Pretrained transformer model hub and library ecosystem"),
    "transformers": ("NLP", "Pretrained transformer model library"),
}

# 4. Composite multi-skill declarations requiring explicit decomposition
COMPOSITE_LABELS = {
    "c/c++": ("C++", "Composite multi-language label ('C and C++'); cannot be silently coerced into single verified C++ qualification without explicit decomposition"),
    "c / c++": ("C++", "Composite multi-language label ('C and C++'); cannot be silently coerced into single verified C++ qualification without explicit decomposition"),
}

# 5. Out-of-scope legitimate sectoral skills (Taxonomy gaps across national sectors)
# These are valid occupational skills under ESCO/national classifications, but not yet present in prototype catalog.
OUT_OF_SCOPE_SECTOR_SKILLS = {
    "gardening": ("Horticulture & Agriculture", "Horticultural plant cultivation, garden maintenance, and landscaping"),
    "cricket": ("Sports & Physical Education", "Professional athletic competition, sports rules, and coaching"),
    "baking": ("Food Processing & Culinary", "Commercial baking, fermentation, and food production"),
    "food safety": ("Food Processing & Culinary", "HACCP guidelines and food preservation"),
    "culinary arts": ("Hospitality & Culinary", "Commercial food preparation and culinary science"),
    "welding": ("Manufacturing & Fabrication", "MIG, TIG, and shielded metal arc welding"),
    "cnc machining": ("Manufacturing & Operations", "Computer Numerical Control mill/lathe operation"),
    "lathe operation": ("Manufacturing & Operations", "Precision metal turning and shaping"),
    "carpentry": ("Construction & Infrastructure", "Structural woodworking and joinery"),
    "crop agronomy": ("Agriculture & Rural Development", "Soil health, planting schedules, and agronomy"),
    "soil testing": ("Agriculture & Rural Development", "Chemical and nutrient agricultural testing"),
    "irrigation management": ("Agriculture & Rural Development", "Drip irrigation and agricultural water logistics"),
    "phlebotomy": ("Healthcare Clinical", "Clinical venipuncture and laboratory specimen handling"),
    "nursing care": ("Healthcare Clinical", "Inpatient vital monitoring and bedside patient care"),
}

# 6. Non-work, hobby, or nonsensical terms
UNRELATED_TERMS = {
    "quantum flux", "pasta cooking", "guitar playing", "chess strategy",
    "dog walking", "knitting", "hiking", "sourdough bread", "playing piano",
}

_PHRASE_RE = {
    canonical: re.compile(r"(?<![A-Za-z0-9+#])" + re.escape(canonical) + r"(?![A-Za-z0-9+#])", re.IGNORECASE)
    for canonical in CANONICAL
}
_SYNONYM_RE = {
    syn: (canonical, re.compile(r"(?<![A-Za-z0-9+#])" + re.escape(syn) + r"(?![A-Za-z0-9+#])", re.IGNORECASE))
    for syn, canonical in SYNONYMS.items()
}

_RELATED_PHRASE_RE = {
    "spring boot": ("CONCEPT-REL-SPRING_BOOT", "Java", "FRAMEWORK", re.compile(r"(?<![A-Za-z0-9+#])spring\s+boot(?![A-Za-z0-9+#])", re.IGNORECASE)),
    "spring framework": ("CONCEPT-REL-SPRING_FRAMEWORK", "Java", "FRAMEWORK", re.compile(r"(?<![A-Za-z0-9+#])spring\s+framework(?![A-Za-z0-9+#])", re.IGNORECASE)),
    "pytorch": ("CONCEPT-REL-PYTORCH", "Deep Learning", "FRAMEWORK", re.compile(r"(?<![A-Za-z0-9+#])pytorch(?![A-Za-z0-9+#])", re.IGNORECASE)),
    "tensorflow": ("CONCEPT-REL-TENSORFLOW", "Deep Learning", "FRAMEWORK", re.compile(r"(?<![A-Za-z0-9+#])tensorflow(?![A-Za-z0-9+#])", re.IGNORECASE)),
    "kubernetes": ("CONCEPT-REL-KUBERNETES", "DevOps", "TOOL", re.compile(r"(?<![A-Za-z0-9+#])kubernetes(?![A-Za-z0-9+#])", re.IGNORECASE)),
    "k8s": ("CONCEPT-REL-KUBERNETES", "DevOps", "TOOL", re.compile(r"(?<![A-Za-z0-9+#])k8s(?![A-Za-z0-9+#])", re.IGNORECASE)),
    "docker": ("CONCEPT-REL-DOCKER", "DevOps", "TOOL", re.compile(r"(?<![A-Za-z0-9+#])docker(?![A-Za-z0-9+#])", re.IGNORECASE)),
    "fastapi": ("CONCEPT-REL-FASTAPI", "Python", "FRAMEWORK", re.compile(r"(?<![A-Za-z0-9+#])fastapi(?![A-Za-z0-9+#])", re.IGNORECASE)),
    "django": ("CONCEPT-REL-DJANGO", "Python", "FRAMEWORK", re.compile(r"(?<![A-Za-z0-9+#])django(?![A-Za-z0-9+#])", re.IGNORECASE)),
    "flask": ("CONCEPT-REL-FLASK", "Python", "FRAMEWORK", re.compile(r"(?<![A-Za-z0-9+#])flask(?![A-Za-z0-9+#])", re.IGNORECASE)),
    "typescript": ("CONCEPT-REL-TYPESCRIPT", "JavaScript", "LANGUAGE_SUPERSET", re.compile(r"(?<![A-Za-z0-9+#])typescript(?![A-Za-z0-9+#])", re.IGNORECASE)),
    "pandas": ("CONCEPT-REL-PANDAS", "Data Analysis", "LIBRARY", re.compile(r"(?<![A-Za-z0-9+#])pandas(?![A-Za-z0-9+#])", re.IGNORECASE)),
    "numpy": ("CONCEPT-REL-NUMPY", "Data Analysis", "LIBRARY", re.compile(r"(?<![A-Za-z0-9+#])numpy(?![A-Za-z0-9+#])", re.IGNORECASE)),
    "scikit-learn": ("CONCEPT-REL-SCIKIT_LEARN", "Machine Learning", "LIBRARY", re.compile(r"(?<![A-Za-z0-9+#])scikit-learn(?![A-Za-z0-9+#])", re.IGNORECASE)),
    "sklearn": ("CONCEPT-REL-SCIKIT_LEARN", "Machine Learning", "LIBRARY", re.compile(r"(?<![A-Za-z0-9+#])sklearn(?![A-Za-z0-9+#])", re.IGNORECASE)),
}


def _clean_label(label: str) -> str:
    """Sanitize label: remove bullets, quotes, surrounding brackets, and redundant spaces."""
    if not label:
        return ""
    cleaned = label.strip()
    cleaned = re.sub(r"^[•\-\*\>]\s*", "", cleaned)
    cleaned = re.sub(r"^[\"\'\(\[\{]+|[\"\'\)\]\}]+$", "", cleaned).strip()
    return cleaned


def classify_skill_relation(label: str) -> dict:
    """Classify the relationship between an input query and NextAlloc's canonical skill catalog.

    Distinguishes:
    1. EXACT_CANONICAL: Query matches one of the 42 official canonical skills.
    2. COMPOSITE_LABEL: Query bundles multiple skills (e.g. C/C++); cannot be coerced without decomposition.
    3. RELATED_CONCEPT: Query is a specialized tool, library, or sub-discipline (NOT hard equivalent).
    4. VERIFIED_ALIAS: Query is a verified direct abbreviation or unambiguous synonym.
    5. OUT_OF_SCOPE_TAXONOMY: Query is a legitimate real-world skill from non-software sectors (horticulture, sports, manufacturing, agriculture).
    6. UNRELATED_TERM: Query is a non-work hobby or nonsensical term.
    """
    raw = label or ""
    cleaned = _clean_label(raw).lower()
    if not cleaned:
        return {
            "query": raw,
            "relation_type": RELATION_UNRELATED_TERM,
            "canonical": None,
            "related_domain": None,
            "is_mandatory_eligible": False,
            "taxonomy_gap": False,
            "confidence": 0.0,
            "reason": "Empty or whitespace-only skill label",
        }

    # 1. Exact Canonical Match
    for canonical in CANONICAL:
        if canonical.lower() == cleaned:
            return {
                "query": raw,
                "relation_type": RELATION_EXACT_CANONICAL,
                "canonical": canonical,
                "related_domain": canonical,
                "is_mandatory_eligible": True,
                "taxonomy_gap": False,
                "confidence": 1.0,
                "reason": f"Exact canonical match for '{canonical}'",
            }

    # 2. Composite multi-skill declarations (Disallowed from single-skill coercion)
    if cleaned in COMPOSITE_LABELS:
        domain, desc = COMPOSITE_LABELS[cleaned]
        return {
            "query": raw,
            "relation_type": RELATION_COMPOSITE_LABEL,
            "canonical": None,
            "related_domain": domain,
            "is_mandatory_eligible": False,
            "taxonomy_gap": False,
            "confidence": 0.0,
            "reason": desc,
        }

    # 3. Related Technology, Practice, or Sub-Discipline (Hard Equivalence Disallowed)
    # Evaluated before SYNONYMS to prevent sub-disciplines or practices from becoming verified aliases.
    if cleaned in RELATED_CONCEPTS:
        domain, desc = RELATED_CONCEPTS[cleaned]
        return {
            "query": raw,
            "relation_type": RELATION_RELATED_CONCEPT,
            "canonical": None,
            "related_domain": domain,
            "is_mandatory_eligible": False,
            "taxonomy_gap": False,
            "confidence": 0.0,
            "reason": f"{desc} in the '{domain}' domain; cannot satisfy mandatory '{domain}' requirement without approved policy conversion",
        }

    # 4. Verified Direct Abbreviation or Equivalent Synonym
    if cleaned in SYNONYMS:
        canon = SYNONYMS[cleaned]
        return {
            "query": raw,
            "relation_type": RELATION_VERIFIED_ALIAS,
            "canonical": canon,
            "related_domain": canon,
            "is_mandatory_eligible": True,
            "taxonomy_gap": False,
            "confidence": 1.0,
            "reason": f"Approved synonym or standard abbreviation for '{canon}'",
        }

    # 5. Out-of-Scope Legitimate Sectoral Skills (Taxonomy Gap)
    if cleaned in OUT_OF_SCOPE_SECTOR_SKILLS:
        sector, desc = OUT_OF_SCOPE_SECTOR_SKILLS[cleaned]
        return {
            "query": raw,
            "relation_type": RELATION_OUT_OF_SCOPE_TAXONOMY,
            "canonical": None,
            "related_domain": None,
            "is_mandatory_eligible": False,
            "taxonomy_gap": True,
            "sector": sector,
            "confidence": 0.0,
            "reason": f"Legitimate occupational skill in {sector} ('{desc}'). Currently out of scope for the prototype software-focused taxonomy",
        }

    # 6. Non-Skill or Unrelated Term
    return {
        "query": raw,
        "relation_type": RELATION_UNRELATED_TERM,
        "canonical": None,
        "related_domain": None,
        "is_mandatory_eligible": False,
        "taxonomy_gap": False,
        "confidence": 0.0,
        "reason": "Unrecognized or non-occupational term",
    }


def normalize(label: str, mode: str = "strict") -> str | None:
    """Normalize a skill label to its canonical representation.

    Enforces safe relation-aware normalization: only exact canonicals and approved
    equivalent aliases satisfy mandatory normalization. Related tools (Kubernetes, Docker),
    sub-disciplines (frontend), composites, out-of-scope skills, and non-skills strictly return None.
    """
    if not label:
        return None

    classification = classify_skill_relation(label)
    if classification["is_mandatory_eligible"]:
        return classification["canonical"]
    return None


def extract_skills(text: str):
    """Scan text and return taxonomy-validated skill mentions.

    The engine is a deterministic lexicon + synonym table over the validated
    taxonomy. It is intentionally labelled exactly that — no embeddings are
    used for matching, and nothing is claimed beyond what the rules produce.
    """
    if not text:
        return [], "taxonomy-lexicon"
    lowered = text.lower()
    found = {}
    for canonical, rx in _PHRASE_RE.items():
        if rx.search(lowered):
            found[canonical] = canonical
    for syn, (canonical, rx) in _SYNONYM_RE.items():
        if syn in lowered and rx.search(lowered):
            found[canonical] = syn
    skills = [{"raw": raw, "canonical": canon, "confidence": 1.0} for canon, raw in sorted(found.items())]
    return skills, "taxonomy-lexicon"


def extract_related_skills(text: str) -> list[dict]:
    """Scan text for explicit related technical concepts.

    Extracts distinct related technical concepts (tools, frameworks, libraries)
    with their concept ID, related canonical domain, and relation type.
    Ordinary ambiguous words (such as standalone 'spring') are never matched.
    """
    if not text:
        return []
    found = {}
    for phrase, (concept_id, related_canonical, rel_type, rx) in _RELATED_PHRASE_RE.items():
        m = rx.search(text)
        if m:
            span_text = text[m.start():m.end()]
            found[concept_id] = {
                "raw": span_text,
                "concept_id": concept_id,
                "related_canonical": related_canonical,
                "relation_type": rel_type,
            }
    return sorted(found.values(), key=lambda x: x["concept_id"])


def engine_mode():
    """Honest engine identity: deterministic taxonomy matching (no embeddings)."""
    return "deterministic-taxonomy"


def engine_description():
    return ("Deterministic taxonomy matching — validated skill lexicon with synonym "
            "normalization. No embedding model is used, and the engine only ever "
            "reports skills that exist in the validated taxonomy.")

package in.nextalloc.service;

import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Deterministic skill normalization pipeline:
 * raw label → normalized label → canonical (validated) skill.
 * Unvalidated labels never become trusted allocation input.
 */
public final class SkillTaxonomy {

    public static final String TAXONOMY_VERSION = "nextalloc-2026.11-v1";

    public static String conceptId(String canonical) {
        if (canonical == null || canonical.isBlank()) return null;
        return "CONCEPT-" + canonical.trim().toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]+", "_");
    }

    public static final List<String> CANONICAL = List.of(
            "Python", "Java", "C++", "SQL", "Data Analysis", "Machine Learning", "Excel",
            "Statistics", "Power BI", "Tableau", "Web Development", "React", "Node.js",
            "JavaScript", "HTML CSS", "Git", "Cloud Computing", "DevOps", "Cybersecurity",
            "NLP", "Deep Learning", "Communication", "Presentation", "Research",
            "Content Writing", "Graphic Design", "UI/UX Design", "Digital Marketing",
            "Social Media", "SEO", "Finance", "Accounting", "Budgeting",
            "Public Administration", "Policy Analysis", "HR Management", "Operations",
            "Supply Chain", "Legal Research", "Environmental Science", "Healthcare Data",
            "Project Management");

    private static final Map<String, String> SYNONYMS = Map.ofEntries(
            Map.entry("python3", "Python"), Map.entry("py", "Python"),
            Map.entry("java programming", "Java"),
            Map.entry("c plus plus", "C++"), Map.entry("cpp", "C++"),
            Map.entry("mysql", "SQL"), Map.entry("postgresql", "SQL"), Map.entry("postgres", "SQL"),
            Map.entry("sql server", "SQL"), Map.entry("databases", "SQL"),
            Map.entry("data analytics", "Data Analysis"), Map.entry("data science", "Data Analysis"),
            Map.entry("analytics", "Data Analysis"),
            Map.entry("ml", "Machine Learning"), Map.entry("ai models", "Machine Learning"),
            Map.entry("ms excel", "Excel"), Map.entry("spreadsheets", "Excel"), Map.entry("ms office", "Excel"),
            Map.entry("microsoft excel", "Excel"), Map.entry("ms-excel", "Excel"),
            Map.entry("powerbi", "Power BI"), Map.entry("power-bi", "Power BI"), Map.entry("data visualization", "Tableau"),
            Map.entry("full stack", "Web Development"), Map.entry("full-stack", "Web Development"),
            Map.entry("web dev", "Web Development"),
            Map.entry("react.js", "React"), Map.entry("reactjs", "React"), Map.entry("react js", "React"),
            Map.entry("node", "Node.js"), Map.entry("node js", "Node.js"), Map.entry("nodejs", "Node.js"),
            Map.entry("node-js", "Node.js"),
            Map.entry("js", "JavaScript"), Map.entry("html", "HTML CSS"), Map.entry("css", "HTML CSS"),
            Map.entry("html5", "HTML CSS"), Map.entry("tailwind", "HTML CSS"),
            Map.entry("git github", "Git"), Map.entry("github", "Git"),
            Map.entry("aws", "Cloud Computing"), Map.entry("azure", "Cloud Computing"),
            Map.entry("gcp", "Cloud Computing"), Map.entry("google cloud", "Cloud Computing"),
            Map.entry("cyber security", "Cybersecurity"),
            Map.entry("natural language processing", "NLP"),
            Map.entry("neural networks", "Deep Learning"),
            Map.entry("public speaking", "Communication"), Map.entry("interpersonal", "Communication"),
            Map.entry("blogging", "Content Writing"),
            Map.entry("figma", "UI/UX Design"), Map.entry("ui design", "UI/UX Design"),
            Map.entry("ux design", "UI/UX Design"), Map.entry("product design", "UI/UX Design"),
            Map.entry("ui/ux", "UI/UX Design"), Map.entry("ui ux", "UI/UX Design"), Map.entry("ui-ux", "UI/UX Design"),
            Map.entry("social media marketing", "Social Media"),
            Map.entry("search engine optimization", "SEO"),
            Map.entry("financial analysis", "Finance"), Map.entry("accountancy", "Accounting"),
            Map.entry("public policy", "Policy Analysis"), Map.entry("policy research", "Policy Analysis"),
            Map.entry("government", "Public Administration"), Map.entry("policy", "Policy Analysis"),
            Map.entry("human resources", "HR Management"), Map.entry("hr management", "HR Management"),
            Map.entry("operations management", "Operations"),
            Map.entry("supply chain management", "Supply Chain"),
            Map.entry("sustainability", "Environmental Science"),
            Map.entry("health data", "Healthcare Data"), Map.entry("healthcare analytics", "Healthcare Data"),
            Map.entry("agile", "Project Management"), Map.entry("scrum", "Project Management"),
            Map.entry("pm", "Project Management"));

    private SkillTaxonomy() { }

    public record RelatedConcept(
            String name,
            String conceptId,
            String relatedCanonical,
            String relationType,
            String description
    ) {}

    public static final Map<String, RelatedConcept> RELATED_CONCEPTS = Map.ofEntries(
            Map.entry("spring boot", new RelatedConcept("Spring Boot", "CONCEPT-REL-SPRING_BOOT", "Java", "FRAMEWORK", "Java enterprise framework")),
            Map.entry("spring framework", new RelatedConcept("Spring Framework", "CONCEPT-REL-SPRING_FRAMEWORK", "Java", "FRAMEWORK", "Java application framework")),
            Map.entry("pytorch", new RelatedConcept("PyTorch", "CONCEPT-REL-PYTORCH", "Deep Learning", "FRAMEWORK", "Deep learning tensor framework")),
            Map.entry("tensorflow", new RelatedConcept("TensorFlow", "CONCEPT-REL-TENSORFLOW", "Deep Learning", "FRAMEWORK", "Machine learning & deep learning platform")),
            Map.entry("kubernetes", new RelatedConcept("Kubernetes", "CONCEPT-REL-KUBERNETES", "DevOps", "TOOL", "Container orchestration platform")),
            Map.entry("k8s", new RelatedConcept("Kubernetes", "CONCEPT-REL-KUBERNETES", "DevOps", "TOOL", "Container orchestration platform")),
            Map.entry("docker", new RelatedConcept("Docker", "CONCEPT-REL-DOCKER", "DevOps", "TOOL", "Container runtime and packaging tool")),
            Map.entry("fastapi", new RelatedConcept("FastAPI", "CONCEPT-REL-FASTAPI", "Python", "FRAMEWORK", "Python web framework")),
            Map.entry("django", new RelatedConcept("Django", "CONCEPT-REL-DJANGO", "Python", "FRAMEWORK", "Python full-stack framework")),
            Map.entry("flask", new RelatedConcept("Flask", "CONCEPT-REL-FLASK", "Python", "FRAMEWORK", "Python microframework")),
            Map.entry("typescript", new RelatedConcept("TypeScript", "CONCEPT-REL-TYPESCRIPT", "JavaScript", "LANGUAGE_SUPERSET", "Typed JavaScript superset")),
            Map.entry("pandas", new RelatedConcept("Pandas", "CONCEPT-REL-PANDAS", "Data Analysis", "LIBRARY", "Data manipulation library")),
            Map.entry("numpy", new RelatedConcept("NumPy", "CONCEPT-REL-NUMPY", "Data Analysis", "LIBRARY", "Numerical computation library")),
            Map.entry("scikit-learn", new RelatedConcept("Scikit-Learn", "CONCEPT-REL-SCIKIT_LEARN", "Machine Learning", "LIBRARY", "Machine learning library")),
            Map.entry("sklearn", new RelatedConcept("Scikit-Learn", "CONCEPT-REL-SCIKIT_LEARN", "Machine Learning", "LIBRARY", "Machine learning library"))
    );

    public static RelatedConcept findRelatedConcept(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String n = raw.trim().toLowerCase(Locale.ROOT);
        return RELATED_CONCEPTS.get(n);
    }

    public static String normalizeOptional(String raw) {
        String canonical = normalize(raw);
        if (canonical != null) return canonical;
        RelatedConcept rc = findRelatedConcept(raw);
        return rc != null ? rc.name() : null;
    }

    public static String normalize(String raw) {
        if (raw == null) return null;
        String n = raw.trim().toLowerCase(Locale.ROOT);
        if (n.isEmpty()) return null;
        String mapped = SYNONYMS.get(n);
        if (mapped != null) return mapped;
        String lower = n.toLowerCase(Locale.ROOT);
        for (String canonical : CANONICAL) {
            if (canonical.equalsIgnoreCase(n)) return canonical;
            if (canonical.toLowerCase(Locale.ROOT).equals(lower)) return canonical;
        }
        return null;
    }
}

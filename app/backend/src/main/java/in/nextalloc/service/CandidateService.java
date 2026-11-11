package in.nextalloc.service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.fasterxml.jackson.databind.ObjectMapper;

import in.nextalloc.ai.AiServiceClient;
import in.nextalloc.common.ApiException;
import in.nextalloc.common.Labels;
import in.nextalloc.common.Weights;
import in.nextalloc.config.AppProperties;
import in.nextalloc.domain.*;
import in.nextalloc.domain.enums.*;
import in.nextalloc.repo.*;
import in.nextalloc.security.AuthUser;

/**
 * Candidate-facing services: profile, skills, interests, preferences,
 * resume intelligence, readiness, allocation view and eligibility.
 * Every method is scoped to the authenticated candidate (self-scope).
 */
@Service
public class CandidateService {

    private final UserRepository users;
    private final CandidateProfileRepository profiles;
    private final CandidateSkillRepository skills;
    private final CandidateRelatedSkillRepository relatedSkills;
    private final CandidateInterestRepository interests;
    private final CandidatePreferenceRepository preferences;
    private final OpportunityRepository opportunities;
    private final OpportunitySkillRepository oppSkills;
    private final AssignmentRepository assignments;
    private final AllocationRunRepository runs;
    private final DatasetSnapshotRepository snapshots;
    private final ResumeFileRepository resumes;
    private final SuitabilityService suitability;
    private final ReadinessService readiness;
    private final ResumeIntelligenceService resumeIntelligence;
    private final AuditService audit;
    private final AiServiceClient ai;
    private final AppProperties props;
    private final ObjectMapper json;

    @org.springframework.beans.factory.annotation.Autowired
    public CandidateService(UserRepository users, CandidateProfileRepository profiles,
                            CandidateSkillRepository skills, CandidateRelatedSkillRepository relatedSkills,
                            CandidateInterestRepository interests,
                            CandidatePreferenceRepository preferences, OpportunityRepository opportunities,
                            OpportunitySkillRepository oppSkills, AssignmentRepository assignments,
                            AllocationRunRepository runs, DatasetSnapshotRepository snapshots,
                            ResumeFileRepository resumes, SuitabilityService suitability,
                            ReadinessService readiness, ResumeIntelligenceService resumeIntelligence,
                            AuditService audit, AiServiceClient ai,
                            AppProperties props, ObjectMapper json) {
        this.users = users; this.profiles = profiles; this.skills = skills;
        this.relatedSkills = relatedSkills;
        this.interests = interests; this.preferences = preferences;
        this.opportunities = opportunities; this.oppSkills = oppSkills;
        this.assignments = assignments; this.runs = runs; this.snapshots = snapshots;
        this.resumes = resumes; this.suitability = suitability; this.readiness = readiness;
        this.resumeIntelligence = resumeIntelligence;
        this.audit = audit; this.ai = ai; this.props = props; this.json = json;
    }

    public CandidateService(UserRepository users, CandidateProfileRepository profiles,
                            CandidateSkillRepository skills, CandidateInterestRepository interests,
                            CandidatePreferenceRepository preferences, OpportunityRepository opportunities,
                            OpportunitySkillRepository oppSkills, AssignmentRepository assignments,
                            AllocationRunRepository runs, DatasetSnapshotRepository snapshots,
                            ResumeFileRepository resumes, SuitabilityService suitability,
                            ReadinessService readiness, ResumeIntelligenceService resumeIntelligence,
                            AuditService audit, AiServiceClient ai,
                            AppProperties props, ObjectMapper json) {
        this(users, profiles, skills, null, interests, preferences, opportunities, oppSkills, assignments,
             runs, snapshots, resumes, suitability, readiness, resumeIntelligence, audit, ai, props, json);
    }

    // ------------------------------------------------------------------
    // Self-scoped profile
    // ------------------------------------------------------------------

    public CandidateProfile requireSelfProfile(AuthUser me) {
        return profiles.findByUserId(me.id()).orElseThrow(() ->
                ApiException.notFound("Your profile has not been initialized yet."));
    }

    public CandidateProfile requireSelfProfileForUpdate(AuthUser me) {
        return profiles.findByUserIdForUpdate(me.id())
                .or(() -> profiles.findByUserId(me.id()))
                .orElseThrow(() -> ApiException.notFound("Your profile has not been initialized yet."));
    }

    public record ProfileInput(String fullName, String phone, java.time.LocalDate dob,
                               String qualification, String candidateStatus,
                               String state, String district, String locationType,
                               String bio, Double experienceYears) { }

    @Transactional
    public CandidateProfile updateProfile(AuthUser me, ProfileInput in) {
        CandidateProfile p = requireSelfProfile(me);
        if (in.fullName != null) {
            if (in.fullName.isBlank()) throw ApiException.badRequest("Full name cannot be empty.");
            p.fullName = in.fullName;
        }
        if (in.phone != null) {
            if (!in.phone.isBlank() && !in.phone.matches("\\+?[0-9]{8,15}")) {
                throw ApiException.badRequest("Phone number is not valid (8-15 digits).");
            }
            p.phone = in.phone;
        }
        if (in.dob != null) p.dob = in.dob;
        if (in.qualification != null) {
            p.qualification = parseEnum(Qualification.class, in.qualification, "qualification");
        }
        if (in.candidateStatus != null) {
            p.candidateStatus = parseEnum(CandidateStatus.class, in.candidateStatus, "current status");
        }
        if (in.state != null) p.state = in.state;
        if (in.district != null) p.district = in.district;
        if (in.locationType != null) {
            p.locationType = parseEnum(LocationType.class, in.locationType, "location type");
        }
        if (in.bio != null) {
            if (in.bio.length() > 600) throw ApiException.badRequest("Keep the introduction under 600 characters.");
            p.bio = in.bio;
        }
        if (in.experienceYears != null) {
            if (in.experienceYears < 0 || in.experienceYears > 50) {
                throw ApiException.badRequest("Experience must be between 0 and 50 years.");
            }
            p.experienceYears = in.experienceYears;
        }
        p.touch();
        profiles.save(p);
        audit.log(me, AuditAction.PROFILE_UPDATED, "CandidateProfile", String.valueOf(p.id),
                me.name() + " updated their profile.", null);
        return p;
    }

    @SuppressWarnings("unchecked")
    private <E extends Enum<E>> E parseEnum(Class<E> type, String value, String field) {
        try {
            return Enum.valueOf(type, value);
        } catch (IllegalArgumentException e) {
            throw ApiException.badRequest("Invalid value for " + field + ".");
        }
    }

    public record SkillItem(
            Long id,
            String raw,
            String canonical,
            String source,
            boolean validated,
            String conceptId,
            String taxonomyVersion,
            String originalInput,
            String claimSource,
            String evidenceStatus
    ) {
        public SkillItem(Long id, String raw, String canonical, String source, boolean validated) {
            this(id, raw, canonical, source, validated, null, null, null, null, null);
        }
    }

    public List<SkillItem> mySkills(AuthUser me) {
        CandidateProfile p = requireSelfProfile(me);
        return skills.findByCandidateId(p.id).stream()
                .map(s -> new SkillItem(
                        s.id,
                        s.rawLabel,
                        s.canonical,
                        s.source != null ? s.source.name() : "PROFILE",
                        s.validated,
                        s.conceptId,
                        s.taxonomyVersion,
                        s.originalInput,
                        s.claimSource != null ? s.claimSource.name() : "LEGACY_UNSPECIFIED",
                        s.evidenceStatus != null ? s.evidenceStatus.name() : "UNVERIFIED"
                ))
                .toList();
    }

    @Transactional
    public List<SkillItem> setSkills(AuthUser me, List<String> labels) {
        CandidateProfile p = requireSelfProfileForUpdate(me);
        if (labels == null) labels = List.of();

        // 1. Group submitted labels by normalized canonical name, retaining first original wording
        Map<String, String> canonicalToRaw = new LinkedHashMap<>();
        for (String raw : labels) {
            if (raw == null || raw.isBlank()) continue;
            String trimmed = raw.trim();
            String c = SkillTaxonomy.normalize(trimmed);
            if (c == null) {
                throw ApiException.badRequest("Unrecognized skill: \"" + trimmed + "\". Please use a skill from the suggested list.");
            }
            if (!canonicalToRaw.containsKey(c)) {
                canonicalToRaw.put(c, trimmed);
            }
        }

        if (canonicalToRaw.size() > 20) {
            throw ApiException.badRequest("Please keep the list to at most 20 skills.");
        }

        // 2. Fetch existing skills to preserve verified status on canonical match
        List<CandidateSkill> existingSkills = skills.findByCandidateId(p.id);
        Map<String, CandidateSkill> existingByCanonical = new HashMap<>();
        for (CandidateSkill es : existingSkills) {
            existingByCanonical.put(es.canonical, es);
        }

        // 3. Delete unverified skills that are no longer present in labels.
        // Genuinely VERIFIED records are preserved even if omitted from manual form.
        List<CandidateSkill> toDelete = new ArrayList<>();
        for (CandidateSkill es : existingSkills) {
            if (!canonicalToRaw.containsKey(es.canonical)) {
                if (es.evidenceStatus != SkillEvidenceStatus.VERIFIED) {
                    toDelete.add(es);
                }
            }
        }
        if (!toDelete.isEmpty()) {
            skills.deleteAll(toDelete);
        }

        // 4. Update or insert submitted skills with strict provenance
        List<CandidateSkill> toSave = new ArrayList<>();
        for (Map.Entry<String, String> entry : canonicalToRaw.entrySet()) {
            String canonical = entry.getKey();
            String originalInput = entry.getValue();
            CandidateSkill existing = existingByCanonical.get(canonical);

            if (existing != null && existing.evidenceStatus == SkillEvidenceStatus.VERIFIED) {
                // Existing genuinely VERIFIED record must NOT be deleted or have its status borrowed by a newly created self-declared row.
                // Preserve the existing entity (its database id, createdAt, claimSource, evidenceStatus, conceptId).
                if (existing.conceptId == null) {
                    existing.conceptId = SkillTaxonomy.conceptId(canonical);
                }
                if (existing.taxonomyVersion == null) {
                    existing.taxonomyVersion = SkillTaxonomy.TAXONOMY_VERSION;
                }
                toSave.add(existing);
            } else if (existing != null) {
                // Existing UNVERIFIED skill: update in-place preserving its primary key ID
                existing.rawLabel = originalInput;
                existing.originalInput = originalInput;
                existing.conceptId = SkillTaxonomy.conceptId(canonical);
                existing.taxonomyVersion = SkillTaxonomy.TAXONOMY_VERSION;
                existing.source = SkillSource.PROFILE;
                existing.claimSource = SkillClaimSource.SELF_DECLARED;
                existing.evidenceStatus = SkillEvidenceStatus.UNVERIFIED;
                existing.validated = true;
                toSave.add(existing);
            } else {
                // Newly declared skill: strictly SELF_DECLARED and UNVERIFIED
                CandidateSkill s = new CandidateSkill();
                s.candidateId = p.id;
                s.rawLabel = originalInput;
                s.canonical = canonical;
                s.originalInput = originalInput;
                s.conceptId = SkillTaxonomy.conceptId(canonical);
                s.taxonomyVersion = SkillTaxonomy.TAXONOMY_VERSION;
                s.source = SkillSource.PROFILE;
                s.claimSource = SkillClaimSource.SELF_DECLARED;
                s.evidenceStatus = SkillEvidenceStatus.UNVERIFIED;
                s.validated = true;
                toSave.add(s);
            }
        }

        skills.saveAll(toSave);
        p.touch();
        profiles.save(p);
        return mySkills(me);
    }

    public record RelatedSkillItem(
            Long id,
            String raw,
            String conceptId,
            String relatedCanonical,
            String relationshipType,
            String taxonomyVersion,
            String claimSource,
            String evidenceStatus
    ) {}

    public List<RelatedSkillItem> myRelatedSkills(AuthUser me) {
        CandidateProfile p = requireSelfProfile(me);
        if (relatedSkills == null) return List.of();
        return relatedSkills.findByCandidateId(p.id).stream()
                .map(s -> new RelatedSkillItem(
                        s.id,
                        s.rawLabel,
                        s.conceptId,
                        s.relatedCanonical,
                        s.relationshipType,
                        s.taxonomyVersion,
                        s.claimSource != null ? s.claimSource.name() : "SELF_DECLARED",
                        s.evidenceStatus != null ? s.evidenceStatus.name() : "UNVERIFIED"
                ))
                .toList();
    }

    @Transactional
    public List<RelatedSkillItem> setRelatedSkills(AuthUser me, List<String> labels) {
        CandidateProfile p = requireSelfProfileForUpdate(me);
        if (relatedSkills == null) return List.of();
        if (labels == null) labels = List.of();

        // 1. Group and validate submitted labels against recognized related concepts
        Map<String, SkillTaxonomy.RelatedConcept> conceptsToSave = new LinkedHashMap<>();
        Map<String, String> rawLabels = new HashMap<>();
        for (String raw : labels) {
            if (raw == null || raw.isBlank()) continue;
            String trimmed = raw.trim();
            SkillTaxonomy.RelatedConcept rc = SkillTaxonomy.findRelatedConcept(trimmed);
            if (rc == null) {
                throw ApiException.badRequest("Unrecognized related skill: \"" + trimmed + "\". Please select from supported related technical skills.");
            }
            if (!conceptsToSave.containsKey(rc.conceptId())) {
                conceptsToSave.put(rc.conceptId(), rc);
                rawLabels.put(rc.conceptId(), trimmed);
            }
        }

        if (conceptsToSave.size() > 20) {
            throw ApiException.badRequest("Please keep the related skills list to at most 20 skills.");
        }

        // 2. Fetch existing related skills to preserve verified status
        List<CandidateRelatedSkill> existing = relatedSkills.findByCandidateId(p.id);
        Map<String, CandidateRelatedSkill> existingByConcept = new HashMap<>();
        for (CandidateRelatedSkill es : existing) {
            existingByConcept.put(es.conceptId, es);
        }

        // 3. Delete unverified related skills not present in new submission
        List<CandidateRelatedSkill> toDelete = new ArrayList<>();
        for (CandidateRelatedSkill es : existing) {
            if (!conceptsToSave.containsKey(es.conceptId)) {
                if (es.evidenceStatus != SkillEvidenceStatus.VERIFIED) {
                    toDelete.add(es);
                }
            }
        }
        if (!toDelete.isEmpty()) {
            relatedSkills.deleteAll(toDelete);
        }

        // 4. Update or insert submitted related skills
        List<CandidateRelatedSkill> toSave = new ArrayList<>();
        for (SkillTaxonomy.RelatedConcept rc : conceptsToSave.values()) {
            CandidateRelatedSkill es = existingByConcept.get(rc.conceptId());
            if (es != null && es.evidenceStatus == SkillEvidenceStatus.VERIFIED) {
                // Preserve verified record intact
                toSave.add(es);
            } else if (es != null) {
                // Update in place
                es.rawLabel = rawLabels.get(rc.conceptId());
                es.relatedCanonical = rc.relatedCanonical();
                es.relationshipType = rc.relationType();
                es.taxonomyVersion = SkillTaxonomy.TAXONOMY_VERSION;
                es.claimSource = SkillClaimSource.SELF_DECLARED;
                es.evidenceStatus = SkillEvidenceStatus.UNVERIFIED;
                toSave.add(es);
            } else {
                CandidateRelatedSkill s = new CandidateRelatedSkill();
                s.candidateId = p.id;
                s.rawLabel = rawLabels.get(rc.conceptId());
                s.conceptId = rc.conceptId();
                s.relatedCanonical = rc.relatedCanonical();
                s.relationshipType = rc.relationType();
                s.taxonomyVersion = SkillTaxonomy.TAXONOMY_VERSION;
                s.claimSource = SkillClaimSource.SELF_DECLARED;
                s.evidenceStatus = SkillEvidenceStatus.UNVERIFIED;
                toSave.add(s);
            }
        }
        relatedSkills.saveAll(toSave);
        p.touch();
        profiles.save(p);
        return myRelatedSkills(me);
    }

    public List<Sector> myInterests(AuthUser me) {
        CandidateProfile p = requireSelfProfile(me);
        return interests.findByCandidateId(p.id).stream().map(i -> i.sector).toList();
    }

    @Transactional
    public List<Sector> setInterests(AuthUser me, List<Sector> sectors) {
        CandidateProfile p = requireSelfProfile(me);
        interests.deleteByCandidateId(p.id);
        for (Sector s : new java.util.TreeSet<>(sectors)) {
            CandidateInterest it = new CandidateInterest();
            it.candidateId = p.id;
            it.sector = s;
            interests.save(it);
        }
        p.touch();
        profiles.save(p);
        return myInterests(me);
    }

    public record PreferenceInput(Long opportunityId, int rank) { }

    public List<PreferenceInput> myPreferences(AuthUser me) {
        CandidateProfile p = requireSelfProfile(me);
        return preferences.findByCandidateId(p.id).stream()
                .sorted(java.util.Comparator.comparing(x -> x.rank))
                .map(x -> new PreferenceInput(x.opportunityId, x.rank))
                .toList();
    }

    @Transactional
    public List<PreferenceInput> setPreferences(AuthUser me, List<PreferenceInput> inputs) {
        CandidateProfile p = requireSelfProfile(me);
        preferences.deleteByCandidateId(p.id);
        Set<Integer> ranks = new HashSet<>();
        Set<Long> oppIds = new HashSet<>();
        for (PreferenceInput in : inputs) {
            if (in.rank() < 1 || in.rank() > 10) throw ApiException.badRequest("Preference rank must be between 1 and 10.");
            if (!ranks.add(in.rank())) throw ApiException.badRequest("Each preference needs a different rank.");
            if (!oppIds.add(in.opportunityId())) throw ApiException.badRequest("The same opportunity cannot be listed twice.");
            opportunities.findById(in.opportunityId())
                    .orElseThrow(() -> ApiException.badRequest("Unknown opportunity in preferences."));
            CandidatePreference cp = new CandidatePreference();
            cp.candidateId = p.id;
            cp.opportunityId = in.opportunityId();
            cp.rank = in.rank();
            preferences.save(cp);
        }
        p.touch();
        profiles.save(p);
        return myPreferences(me);
    }

    // ------------------------------------------------------------------
    // Resume intelligence
    // ------------------------------------------------------------------

    public record ResumeInfo(Long id, String originalName, long sizeBytes, String status,
                             int textLength, List<String> pendingSkills, List<String> pendingInterests,
                             String statusMessage, java.time.Instant createdAt) { }

    public record ResumeSuggestionsView(Long resumeId, String status, String statusMessage,
                                        List<ResumeIntelligenceService.FieldSuggestion> fields,
                                        List<String> skills, List<String> interests) { }

    public ResumeInfo latestResume(AuthUser me) {
        return resumes.findTopByUserIdOrderByIdDesc(me.id()).map(r -> {
            List<String> pending = new ArrayList<>();
            List<String> interestsPending = new ArrayList<>();
            if (r.skillsJson != null) {
                try {
                    for (var node : json.readTree(r.skillsJson)) pending.add(node.asText());
                } catch (Exception ignored) { }
            }
            if (r.suggestionsJson != null) {
                try {
                    var root = json.readTree(r.suggestionsJson);
                    if (root.has("interests")) for (var n : root.get("interests")) interestsPending.add(n.asText());
                } catch (Exception ignored) { }
            }
            return new ResumeInfo(r.id, r.originalName, r.sizeBytes, r.status, r.textLength,
                    pending, interestsPending, r.statusMessage, r.createdAt);
        }).orElse(null);
    }

    /** The current resume's suggestions. The UI compares each value with the
     *  current profile (fetched from /me/profile) to distinguish "fill a blank"
     *  from "proposed update of data you already entered". */
    public ResumeSuggestionsView mySuggestions(AuthUser me) {
        ResumeFile r = resumes.findTopByUserIdOrderByIdDesc(me.id())
                .orElseThrow(() -> ApiException.notFound("Upload a resume first."));
        CandidateProfile p = requireSelfProfile(me);
        List<ResumeIntelligenceService.FieldSuggestion> fields = new ArrayList<>();
        List<String> skills = new ArrayList<>();
        List<String> interests = new ArrayList<>();
        if (r.suggestionsJson != null) {
            try {
                var root = json.readTree(r.suggestionsJson);
                for (var n : root.path("fields")) fields.add(new ResumeIntelligenceService.FieldSuggestion(
                        n.get("field").asText(), n.get("value").asText(),
                        n.get("confidence").asText(), n.get("evidence").asText()));
                for (var n : root.path("skills")) skills.add(n.asText());
                for (var n : root.path("interests")) interests.add(n.asText());
            } catch (Exception ignored) { }
        }
        return new ResumeSuggestionsView(r.id, r.status, r.statusMessage, fields, skills, interests);
    }

    @Transactional
    public ResumeInfo uploadResume(AuthUser me, MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) throw ApiException.badRequest("Please choose a file to upload.");
        if (file.getSize() > 5L * 1024 * 1024) throw ApiException.badRequest("The resume must be at most 5 MB.");
        String name = file.getOriginalFilename() == null ? "resume" : file.getOriginalFilename();
        String lower = name.toLowerCase();
        boolean pdf = lower.endsWith(".pdf");
        boolean docx = lower.endsWith(".docx");
        if (!pdf && !docx) throw ApiException.badRequest("Upload a PDF or Word (.docx) resume.");
        byte[] head = new byte[4];
        try (var in = file.getInputStream()) {
            int read = in.read(head);
            if (read < 4) throw ApiException.badRequest("The file could not be read.");
        }
        boolean magicPdf = head[0] == 0x25 && head[1] == 0x50 && head[2] == 0x44 && head[3] == 0x46;
        boolean magicZip = head[0] == 0x50 && head[1] == 0x4B;
        if (pdf && !magicPdf) throw ApiException.badRequest("The file does not look like a valid PDF.");
        if (docx && !magicZip) throw ApiException.badRequest("The file does not look like a valid Word document.");

        Path dir = Path.of(props.getUploads().getDir()).toAbsolutePath().normalize();
        Files.createDirectories(dir);
        String stored = UUID.randomUUID().toString() + (pdf ? ".pdf" : ".docx");
        Path target = dir.resolve(stored);
        if (!target.normalize().startsWith(dir)) throw ApiException.badRequest("Invalid file name.");
        Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);

        String text = extractText(target, pdf);
        ResumeFile r = new ResumeFile();
        r.userId = me.id();
        r.originalName = name.substring(0, Math.min(255, name.length()));
        r.storedName = stored;
        r.contentType = file.getContentType();
        r.sizeBytes = file.getSize();
        r.textLength = text.length();

        // A scanned / image-only file yields no readable text: fail honestly
        // instead of pretending the extraction succeeded.
        if (text == null || text.strip().length() < 40) {
            r.status = "FAILED";
            r.statusMessage = "We could not reliably read this PDF. Please upload a text-based PDF or a Word (.docx) resume.";
            resumes.save(r);
            audit.log(me, AuditAction.RESUME_UPLOADED, "ResumeFile", String.valueOf(r.id),
                    me.name() + " uploaded a resume that could not be read (" + name + ").", null);
            return latestResume(me);
        }

        r.status = "PROCESSING";
        List<ExtractedSkillDetail> extracted = extractSkillDetails(text);
        List<ExtractedRelatedDetail> extractedRelated = extractRelatedSkillDetails(text);
        // Normalized, taxonomy-validated skills only; user confirms before they count.
        Map<String, ExtractedSkillDetail> uniqueCanonicals = new LinkedHashMap<>();
        for (ExtractedSkillDetail es : extracted) {
            if (es.canonical() != null && !uniqueCanonicals.containsKey(es.canonical())) {
                uniqueCanonicals.put(es.canonical(), es);
            }
            if (uniqueCanonicals.size() >= 15) break;
        }
        List<String> validated = new ArrayList<>(uniqueCanonicals.keySet());
        try { r.skillsJson = json.writeValueAsString(validated); } catch (Exception ignored) { }

        // Structured profile suggestions (deterministic, evidence-backed, never auto-applied).
        try {
            ResumeIntelligenceService.ResumeSuggestions sugg = resumeIntelligence.extract(text);
            var node = json.createObjectNode();
            var fields = node.putArray("fields");
            for (var f : sugg.fields()) {
                var fn = fields.addObject();
                fn.put("field", f.field());
                fn.put("value", f.value());
                fn.put("confidence", f.confidence());
                fn.put("evidence", f.evidence());
            }
            var skillsArr = node.putArray("skills");
            for (String s : validated) skillsArr.add(s);

            var detailsArr = node.putArray("skillsDetailed");
            for (ExtractedSkillDetail es : uniqueCanonicals.values()) {
                var dn = detailsArr.addObject();
                dn.put("canonical", es.canonical());
                dn.put("raw", es.raw());
            }

            var relatedArr = node.putArray("relatedSkills");
            for (ExtractedRelatedDetail rd : extractedRelated) {
                var rn = relatedArr.addObject();
                rn.put("raw", rd.raw());
                rn.put("conceptId", rd.conceptId());
                rn.put("relatedCanonical", rd.relatedCanonical());
                rn.put("relationType", rd.relationType());
            }

            var interestsArr = node.putArray("interests");
            for (String s : sugg.interests()) interestsArr.add(s);
            r.suggestionsJson = json.writeValueAsString(node);
        } catch (Exception e) {
            r.suggestionsJson = null;
        }

        boolean anythingToReview = !validated.isEmpty()
                || !extractedRelated.isEmpty()
                || (r.suggestionsJson != null && r.suggestionsJson.contains("\"fields\":[{\""));
        r.status = anythingToReview ? "PENDING_REVIEW" : "REVIEWED";
        if (!anythingToReview) r.statusMessage = "No profile suggestions found — nothing to review.";
        resumes.save(r);
        audit.log(me, AuditAction.RESUME_UPLOADED, "ResumeFile", String.valueOf(r.id),
                me.name() + " uploaded a resume (" + name + ").", Map.of("skillsFound", validated.size()));
        return latestResume(me);
    }

    // ------------------------------------------------------------------
    // Resume suggestion review & safe auto-fill
    // ------------------------------------------------------------------

    public record ApplyInput(
            Long resumeId,
            Map<String, String> profile,
            List<String> skills,
            List<String> interests,
            List<String> relatedSkills
    ) {
        public ApplyInput(Long resumeId, Map<String, String> profile, List<String> skills, List<String> interests) {
            this(resumeId, profile, skills, interests, List.of());
        }
    }

    /** Applies only what the candidate explicitly confirms.
     *  - only the latest resume of this user can be reviewed;
     *  - profile values are validated with the same rules as manual entry;
     *  - skills must be among the skills this resume actually suggested;
     *  - interests must be among the sectors this resume actually suggested;
     *  - after confirmation the resume becomes REVIEWED (readiness counts it).
     */
    @Transactional
    public ResumeInfo applySuggestions(AuthUser me, ApplyInput in) {
        if (in == null || in.resumeId() == null) throw ApiException.badRequest("resumeId is required.");
        CandidateProfile p = requireSelfProfileForUpdate(me);
        ResumeFile latest = resumes.findTopByUserIdOrderByIdDesc(me.id())
                .orElseThrow(() -> ApiException.notFound("Upload a resume first."));
        if (!latest.id.equals(in.resumeId())) {
            throw ApiException.conflict("A newer resume was uploaded after these suggestions were generated. Review the latest resume instead.");
        }
        if (!"PENDING_REVIEW".equals(latest.status) && !"PROCESSING".equals(latest.status)) {
            throw ApiException.badRequest("This resume has already been reviewed.");
        }
        Set<String> suggestedSkills = new HashSet<>();
        Set<String> suggestedInterests = new HashSet<>();
        Set<String> suggestedFields = new HashSet<>();
        Map<String, String> detailedRawPhrases = new HashMap<>();
        Map<String, ExtractedRelatedDetail> suggestedRelatedMap = new HashMap<>();
        if (latest.suggestionsJson != null) {
            try {
                var root = json.readTree(latest.suggestionsJson);
                for (var n : root.path("skills")) suggestedSkills.add(n.asText());
                for (var n : root.path("interests")) suggestedInterests.add(n.asText());
                for (var n : root.path("fields")) suggestedFields.add(n.get("field").asText());
                if (root.has("skillsDetailed")) {
                    for (var n : root.get("skillsDetailed")) {
                        if (n.has("canonical") && n.has("raw")) {
                            detailedRawPhrases.put(n.get("canonical").asText(), n.get("raw").asText());
                        }
                    }
                }
                if (root.has("relatedSkills")) {
                    for (var n : root.get("relatedSkills")) {
                        if (n.has("conceptId") && n.has("raw")) {
                            String raw = n.get("raw").asText();
                            String cid = n.get("conceptId").asText();
                            String rc = n.has("relatedCanonical") ? n.get("relatedCanonical").asText() : "";
                            String rt = n.has("relationType") ? n.get("relationType").asText() : "RELATED_CONCEPT";
                            ExtractedRelatedDetail detail = new ExtractedRelatedDetail(raw, cid, rc, rt);
                            suggestedRelatedMap.put(raw, detail);
                            suggestedRelatedMap.put(cid, detail);
                            suggestedRelatedMap.put(raw.toLowerCase(Locale.ROOT), detail);
                        }
                    }
                }
            } catch (Exception ignored) { }
        }

        Map<String, String> profile = in.profile() == null ? Map.of() : in.profile();
        for (var e : profile.entrySet()) {
            String field = e.getKey();
            if (!ResumeIntelligenceService.PROFILE_FIELDS.contains(field)) {
                throw ApiException.badRequest("Unknown profile field: " + field);
            }
            if (!suggestedFields.contains(field)) {
                throw ApiException.badRequest("The resume did not suggest a value for " + field + ".");
            }
        }
        for (String s : in.skills() == null ? List.<String>of() : in.skills()) {
            if (!suggestedSkills.contains(s)) throw ApiException.badRequest("Skill not suggested by this resume: " + s);
        }
        for (String rs : in.relatedSkills() == null ? List.<String>of() : in.relatedSkills()) {
            if (!suggestedRelatedMap.containsKey(rs) && !suggestedRelatedMap.containsKey(rs.toLowerCase(Locale.ROOT))) {
                throw ApiException.badRequest("Related skill not suggested by this resume: " + rs);
            }
        }
        for (String it : in.interests() == null ? List.<String>of() : in.interests()) {
            if (!suggestedInterests.contains(it)) throw ApiException.badRequest("Interest not suggested by this resume: " + it);
        }

        // Apply confirmed profile values with the same validation as manual entry.
        CandidateProfile updated = updateProfile(me, new ProfileInput(
                profile.get("fullName"), profile.get("phone"), null,
                profile.get("qualification"), profile.get("candidateStatus"),
                profile.get("state"), profile.get("district"), null,
                profile.get("bio"),
                profile.get("experienceYears") == null ? null : Double.valueOf(profile.get("experienceYears"))));

        // Merge confirmed skills (source RESUME) and interests.
        if (in.skills() != null && !in.skills().isEmpty()) {
            Set<String> existing = skills.findByCandidateId(p.id).stream().map(s -> s.canonical).collect(java.util.stream.Collectors.toSet());
            for (String raw : in.skills()) {
                String canonical = SkillTaxonomy.normalize(raw);
                if (canonical == null || existing.contains(canonical)) continue;
                CandidateSkill s = new CandidateSkill();
                s.candidateId = p.id;

                String originalPhrase = detailedRawPhrases.get(canonical);
                if (originalPhrase != null && !originalPhrase.isBlank()) {
                    s.originalInput = originalPhrase;
                    s.rawLabel = originalPhrase;
                } else {
                    s.originalInput = null;
                    s.rawLabel = raw;
                }

                s.canonical = canonical;
                s.conceptId = SkillTaxonomy.conceptId(canonical);
                s.taxonomyVersion = SkillTaxonomy.TAXONOMY_VERSION;
                s.source = SkillSource.RESUME;
                s.claimSource = SkillClaimSource.RESUME_EXTRACTED;
                s.evidenceStatus = SkillEvidenceStatus.UNVERIFIED;
                s.validated = true;
                skills.save(s);
                existing.add(canonical);
            }
        }
        if (in.relatedSkills() != null && !in.relatedSkills().isEmpty() && relatedSkills != null) {
            List<CandidateRelatedSkill> existingRel = relatedSkills.findByCandidateId(p.id);
            Map<String, CandidateRelatedSkill> existingByConcept = new HashMap<>();
            for (CandidateRelatedSkill es : existingRel) {
                existingByConcept.put(es.conceptId, es);
            }
            List<CandidateRelatedSkill> toSaveRel = new ArrayList<>();
            for (String rawOrConcept : in.relatedSkills()) {
                ExtractedRelatedDetail detail = suggestedRelatedMap.get(rawOrConcept);
                if (detail == null) {
                    detail = suggestedRelatedMap.get(rawOrConcept.toLowerCase(Locale.ROOT));
                }
                String conceptId = detail != null ? detail.conceptId() : null;
                String rawLabel = detail != null ? detail.raw() : rawOrConcept;
                String relatedCanonical = detail != null ? detail.relatedCanonical() : "";
                String relType = detail != null ? detail.relationType() : "RELATED_CONCEPT";

                if (conceptId == null) {
                    var rc = SkillTaxonomy.findRelatedConcept(rawOrConcept);
                    if (rc != null) {
                        conceptId = rc.conceptId();
                        relatedCanonical = rc.relatedCanonical();
                        relType = rc.relationType();
                    }
                }
                if (conceptId == null) continue;

                CandidateRelatedSkill existingSkill = existingByConcept.get(conceptId);
                if (existingSkill != null && existingSkill.evidenceStatus == SkillEvidenceStatus.VERIFIED) {
                    // Preserve verified status
                    continue;
                } else if (existingSkill != null) {
                    existingSkill.rawLabel = rawLabel;
                    existingSkill.taxonomyVersion = SkillTaxonomy.TAXONOMY_VERSION;
                    existingSkill.claimSource = SkillClaimSource.RESUME_EXTRACTED;
                    existingSkill.evidenceStatus = SkillEvidenceStatus.UNVERIFIED;
                    toSaveRel.add(existingSkill);
                } else {
                    CandidateRelatedSkill crs = new CandidateRelatedSkill();
                    crs.candidateId = p.id;
                    crs.rawLabel = rawLabel;
                    crs.conceptId = conceptId;
                    crs.relatedCanonical = relatedCanonical;
                    crs.relationshipType = relType;
                    crs.taxonomyVersion = SkillTaxonomy.TAXONOMY_VERSION;
                    crs.claimSource = SkillClaimSource.RESUME_EXTRACTED;
                    crs.evidenceStatus = SkillEvidenceStatus.UNVERIFIED;
                    toSaveRel.add(crs);
                    existingByConcept.put(conceptId, crs);
                }
            }
            if (!toSaveRel.isEmpty()) {
                relatedSkills.saveAll(toSaveRel);
            }
        }
        if (in.interests() != null && !in.interests().isEmpty()) {
            Set<Sector> current = new java.util.TreeSet<>(myInterests(me));
            for (String it : in.interests()) current.add(Sector.valueOf(it));
            setInterests(me, new ArrayList<>(current));
        }

        updated.touch();
        profiles.save(updated);
        latest.status = "REVIEWED";
        latest.statusMessage = null;
        resumes.save(latest);
        audit.log(me, AuditAction.RESUME_REVIEWED, "ResumeFile", String.valueOf(latest.id),
                me.name() + " reviewed resume suggestions ("
                        + profile.size() + " profile fields, "
                        + (in.skills() == null ? 0 : in.skills().size()) + " skills, "
                        + (in.relatedSkills() == null ? 0 : in.relatedSkills().size()) + " related skills, "
                        + (in.interests() == null ? 0 : in.interests().size()) + " interests confirmed).", null);
        return latestResume(me);
    }

    private String extractText(Path file, boolean pdf) {
        try {
            if (pdf) {
                org.apache.pdfbox.pdmodel.PDDocument doc = org.apache.pdfbox.Loader.loadPDF(file.toFile());
                try {
                    return new org.apache.pdfbox.text.PDFTextStripper().getText(doc);
                } finally {
                    doc.close();
                }
            } else {
                // DOCX: body paragraphs, tables (row by row) and headers/footers,
                // so contact details in a table or header are not lost.
                try (java.io.FileInputStream fis = new java.io.FileInputStream(file.toFile());
                     org.apache.poi.xwpf.usermodel.XWPFDocument doc =
                             new org.apache.poi.xwpf.usermodel.XWPFDocument(fis)) {
                    StringBuilder sb = new StringBuilder();
                    for (var para : doc.getParagraphs()) sb.append(para.getText()).append('\n');
                    for (var table : doc.getTables()) {
                        for (var row : table.getRows()) {
                            List<String> cells = new ArrayList<>();
                            for (var cell : row.getTableCells()) cells.add(cell.getText().trim());
                            sb.append(String.join("  |  ", cells)).append('\n');
                        }
                    }
                    for (var header : doc.getHeaderList()) for (var p : header.getParagraphs()) sb.append(p.getText()).append('\n');
                    for (var footer : doc.getFooterList()) for (var p : footer.getParagraphs()) sb.append(p.getText()).append('\n');
                    return sb.toString();
                }
            }
        } catch (Exception e) {
            throw ApiException.badRequest("We could not read this file. Please try a different resume.");
        }
    }

    record ExtractedSkillDetail(String raw, String canonical) {}

    private List<ExtractedSkillDetail> extractSkillDetails(String text) {
        // AI-assisted when the AI service is available; deterministic local fallback otherwise.
        if (text == null || text.isBlank()) return List.of();
        try {
            AiServiceClient.SkillsResult res = ai.extractSkills(text);
            if (res != null && res.skills() != null) {
                return res.skills().stream()
                        .map(s -> new ExtractedSkillDetail(s.raw(), s.canonical()))
                        .toList();
            }
            return List.of();
        } catch (Exception e) {
            List<ExtractedSkillDetail> found = new ArrayList<>();
            String lower = text.toLowerCase(Locale.ROOT);
            for (String canonical : SkillTaxonomy.CANONICAL) {
                if (lower.contains(canonical.toLowerCase(Locale.ROOT))) {
                    found.add(new ExtractedSkillDetail(canonical, canonical));
                }
            }
            return found;
        }
    }

    private List<String> extractSkills(String text) {
        return extractSkillDetails(text).stream()
                .map(ExtractedSkillDetail::canonical)
                .toList();
    }

    record ExtractedRelatedDetail(String raw, String conceptId, String relatedCanonical, String relationType) {}

    private List<ExtractedRelatedDetail> extractRelatedSkillDetails(String text) {
        if (text == null || text.isBlank()) return List.of();
        try {
            AiServiceClient.SkillsResult res = ai.extractSkills(text);
            if (res != null && res.relatedSkills() != null) {
                return res.relatedSkills().stream()
                        .map(r -> new ExtractedRelatedDetail(r.raw(), r.conceptId(), r.relatedCanonical(), r.relationType()))
                        .toList();
            }
            return List.of();
        } catch (Exception e) {
            List<ExtractedRelatedDetail> found = new ArrayList<>();
            String lower = text.toLowerCase(Locale.ROOT);
            for (var entry : SkillTaxonomy.RELATED_CONCEPTS.entrySet()) {
                String alias = entry.getKey();
                if (lower.matches(".*\\b" + java.util.regex.Pattern.quote(alias) + "\\b.*")) {
                    var rc = entry.getValue();
                    found.add(new ExtractedRelatedDetail(alias, rc.conceptId(), rc.relatedCanonical(), rc.relationType()));
                }
            }
            return found;
        }
    }

    // ------------------------------------------------------------------
    // Readiness & allocation view
    // ------------------------------------------------------------------

    public ReadinessService.Readiness myReadiness(AuthUser me) {
        CandidateProfile p = requireSelfProfile(me);
        int skillCount = (int) skills.findByCandidateId(p.id).stream().filter(s -> s.validated).count();
        int interestCount = interests.findByCandidateId(p.id).size();
        int preferenceCount = preferences.findByCandidateId(p.id).size();
        String resumeState = resumes.findTopByUserIdOrderByIdDesc(me.id())
                .map(r -> r.status).orElse(null);
        return readiness.compute(p, skillCount, interestCount, preferenceCount, resumeState);
    }

    public record AllocationView(String state, String message, Long runId, int runNumber,
                                 String opportunityTitle, String sector, String opportunityState,
                                 double suitability, Integer preferenceRank, java.time.Instant runAt) { }

    public AllocationView myAllocation(AuthUser me) {
        CandidateProfile p = requireSelfProfile(me);
        DatasetSnapshot current = snapshots.findTopByOrderByIdDesc().orElse(null);
        AllocationRun latest = runs.findTopByOrderByIdDesc().orElse(null);
        if (latest == null) {
            return new AllocationView("NO_RUN", "No allocation has been completed yet.",
                    null, 0, null, null, null, 0, null, null);
        }
        if (latest.status != RunStatus.COMPLETED) {
            return new AllocationView("IN_PROGRESS",
                    "An allocation is " + (latest.status == RunStatus.RUNNING ? "running" : "queued") + " right now.",
                    latest.id, latest.number, null, null, null, 0, null, latest.createdAt);
        }
        if (current != null && !current.id.equals(latest.snapshotId)) {
            return new AllocationView("STALE",
                    "The dataset changed after this allocation. Results may be outdated — please run the allocation again.",
                    latest.id, latest.number, null, null, null, 0, null, latest.completedAt);
        }
        java.util.Optional<Assignment> a = assignments.findByRunIdAndCandidateIdAndSource(
                latest.id, p.id, AssignmentSource.GLOBAL);
        if (a.isEmpty()) {
            return new AllocationView("NOT_ALLOCATED",
                    "No opportunity was assigned in the latest run. This can happen when eligible seats are fewer than eligible candidates.",
                    latest.id, latest.number, null, null, null, 0, null, latest.completedAt);
        }
        Opportunity o = opportunities.findById(a.get().opportunityId).orElseThrow();
        Integer rank = preferences.findByCandidateId(p.id).stream()
                .filter(x -> x.opportunityId.equals(o.id)).map(x -> x.rank).findFirst().orElse(null);
        return new AllocationView("ALLOCATED",
                "You are fit for " + o.title + ". Allocated in the latest global allocation.",
                latest.id, latest.number, o.title, Labels.label(o.sector), o.state,
                a.get().suitability, rank, latest.completedAt);
    }

    public record HistoryEntry(Long runId, int runNumber, java.time.Instant completedAt,
                               String status, String opportunityTitle, double suitability) { }

    public List<HistoryEntry> myHistory(AuthUser me) {
        CandidateProfile p = requireSelfProfile(me);
        return assignments.findByCandidateIdAndSource(p.id, AssignmentSource.GLOBAL).stream()
                .sorted(java.util.Comparator.comparing((in.nextalloc.domain.Assignment a) -> a.runId).reversed())
                .map(a -> {
                    AllocationRun r = runs.findById(a.runId).orElse(null);
                    if (r == null) return null;
                    String title = opportunities.findById(a.opportunityId)
                            .map(o -> o.title).orElse("Opportunity");
                    return new HistoryEntry(r.id, r.number, r.completedAt,
                            r.status == RunStatus.COMPLETED ? "Completed" : Labels.label(r.status),
                            title, a.suitability);
                })
                .filter(java.util.Objects::nonNull)
                .toList();
    }

    public record EligibilityEntry(Long opportunityId, String title, String sector, String state,
                                   int capacity, boolean eligible, List<String> reasons) { }

    public Page<EligibilityEntry> myEligibility(AuthUser me, int page, int size) {
        CandidateProfile p = requireSelfProfile(me);
        Set<String> mySkills = skills.findByCandidateId(p.id).stream()
                .filter(s -> s.validated).map(s -> s.canonical)
                .collect(java.util.stream.Collectors.toSet());
        List<Opportunity> opps = opportunities.findAllByStatus(OppStatus.ACTIVE);
        Map<Long, List<OpportunitySkill>> reqMap = new HashMap<>();
        List<Long> ids = opps.stream().map(o -> o.id).toList();
        for (OpportunitySkill s : oppSkills.findByOpportunityIdIn(ids)) {
            reqMap.computeIfAbsent(s.opportunityId, k -> new ArrayList<>()).add(s);
        }
        List<EligibilityEntry> all = new ArrayList<>();
        for (Opportunity o : opps) {
            SuitabilityService.EligibilityResult res =
                    suitability.check(p, mySkills, o, reqMap.getOrDefault(o.id, List.of()));
            all.add(new EligibilityEntry(o.id, o.title, Labels.label(o.sector), o.state,
                    o.capacity, res.eligible(), res.reasons()));
        }
        int from = Math.min(page * size, all.size());
        return new org.springframework.data.domain.PageImpl<>(
                all.subList(from, Math.min(from + size, all.size())),
                PageRequest.of(page, size), all.size());
    }
}

package in.nextalloc.web;

import java.io.IOException;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import org.springframework.core.io.Resource;
import org.springframework.data.domain.Page;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import in.nextalloc.domain.enums.Sector;
import in.nextalloc.domain.enums.SignatoryRole;
import in.nextalloc.security.AuthUser;
import in.nextalloc.service.CandidateAcademicService;
import in.nextalloc.service.CandidateService;
import in.nextalloc.service.EvidenceService;
import in.nextalloc.service.ReadinessService;
import in.nextalloc.web.dto.CandidateAcademicDto;
import in.nextalloc.web.dto.CandidateAcademicInput;
import in.nextalloc.web.dto.NocEvidenceDto;
import in.nextalloc.web.dto.NocSubmissionInput;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/candidates")
@Tag(name = "Candidates", description = "Profile, skills, preferences, resume, readiness and allocation view (self-scoped).")
public class CandidateController {

    private final CandidateService candidateService;
    private final EvidenceService evidenceService;
    private final CandidateAcademicService academicService;
    private final in.nextalloc.service.OfferService offerService;

    @org.springframework.beans.factory.annotation.Autowired
    public CandidateController(CandidateService candidateService,
                               EvidenceService evidenceService,
                               CandidateAcademicService academicService,
                               @org.springframework.beans.factory.annotation.Autowired(required = false) in.nextalloc.service.OfferService offerService) {
        this.candidateService = candidateService;
        this.evidenceService = evidenceService;
        this.academicService = academicService;
        this.offerService = offerService;
    }

    public CandidateController(CandidateService candidateService,
                               EvidenceService evidenceService,
                               CandidateAcademicService academicService) {
        this(candidateService, evidenceService, academicService, null);
    }

    @GetMapping("/me/profile")
    @Operation(summary = "My profile with skills and interests.")
    public Map<String, Object> profile(@AuthenticationPrincipal AuthUser me) {
        in.nextalloc.domain.CandidateProfile p = candidateService.requireSelfProfile(me);
        java.util.Map<String, Object> out = new java.util.LinkedHashMap<>();
        out.put("id", p.id);
        out.put("fullName", p.fullName == null ? "" : p.fullName);
        out.put("phone", p.phone == null ? "" : p.phone);
        out.put("dob", p.dob == null ? null : p.dob.toString());
        out.put("qualification", p.qualification == null ? null : p.qualification.name());
        out.put("candidateStatus", p.candidateStatus == null ? null : p.candidateStatus.name());
        out.put("state", p.state == null ? "" : p.state);
        out.put("district", p.district == null ? "" : p.district);
        out.put("locationType", p.locationType == null ? null : p.locationType.name());
        out.put("bio", p.bio == null ? "" : p.bio);
        out.put("experienceYears", p.experienceYears == null ? 0 : p.experienceYears);
        out.put("skills", candidateService.mySkills(me));
        out.put("relatedSkills", candidateService.myRelatedSkills(me));
        out.put("interests", candidateService.myInterests(me));
        return out;
    }

    @PutMapping("/me/profile")
    @Operation(summary = "Update my profile (validated, human-readable errors).")
    public Map<String, Object> updateProfile(@AuthenticationPrincipal AuthUser me,
                                             @RequestBody CandidateService.ProfileInput input) {
        candidateService.updateProfile(me, input);
        return profile(me);
    }

    @PutMapping("/me/skills")
    @Operation(summary = "Replace my skills (labels are normalized to the validated taxonomy).")
    public List<CandidateService.SkillItem> setSkills(@AuthenticationPrincipal AuthUser me,
                                                      @RequestBody List<String> skills) {
        return candidateService.setSkills(me, skills);
    }

    @GetMapping("/me/related-skills")
    @Operation(summary = "My declared and extracted related skills.")
    public List<CandidateService.RelatedSkillItem> relatedSkills(@AuthenticationPrincipal AuthUser me) {
        return candidateService.myRelatedSkills(me);
    }

    @PutMapping("/me/related-skills")
    @Operation(summary = "Replace my declared related skills (validated against recognized tools, frameworks, and libraries).")
    public List<CandidateService.RelatedSkillItem> setRelatedSkills(@AuthenticationPrincipal AuthUser me,
                                                                   @RequestBody List<String> skills) {
        return candidateService.setRelatedSkills(me, skills);
    }

    @PutMapping("/me/interests")
    @Operation(summary = "Replace my sector interests.")
    public List<Sector> setInterests(@AuthenticationPrincipal AuthUser me,
                                     @RequestBody List<Sector> sectors) {
        return candidateService.setInterests(me, sectors);
    }

    @GetMapping("/me/preferences")
    @Operation(summary = "My ranked opportunity preferences.")
    public List<CandidateService.PreferenceInput> preferences(@AuthenticationPrincipal AuthUser me) {
        return candidateService.myPreferences(me);
    }

    @PutMapping("/me/preferences")
    @Operation(summary = "Replace my ranked preferences (1 = top choice).")
    public List<CandidateService.PreferenceInput> setPreferences(@AuthenticationPrincipal AuthUser me,
                                                                 @RequestBody List<CandidateService.PreferenceInput> prefs) {
        return candidateService.setPreferences(me, prefs);
    }

    @GetMapping("/me/readiness")
    @Operation(summary = "Allocation readiness: a calculated completeness score (never a guarantee).")
    public ReadinessService.Readiness readiness(@AuthenticationPrincipal AuthUser me) {
        return candidateService.myReadiness(me);
    }

    @PostMapping("/me/resume")
    @Operation(summary = "Upload a resume (PDF/DOCX, 5 MB max). Skills are extracted and await your review.")
    public CandidateService.ResumeInfo uploadResume(@AuthenticationPrincipal AuthUser me,
                                                    @RequestParam("file") MultipartFile file) throws IOException {
        return candidateService.uploadResume(me, file);
    }

    @GetMapping("/me/resume")
    @Operation(summary = "Latest resume and its extracted skills.")
    public CandidateService.ResumeInfo resume(@AuthenticationPrincipal AuthUser me) {
        CandidateService.ResumeInfo r = candidateService.latestResume(me);
        return r == null ? new CandidateService.ResumeInfo(null, null, 0, "NONE", 0, List.of(), List.of(), null, null) : r;
    }

    @GetMapping("/me/resume/suggestions")
    @Operation(summary = "The current resume's structured suggestions (profile fields with confidence + evidence, skills, interests).")
    public CandidateService.ResumeSuggestionsView suggestions(@AuthenticationPrincipal AuthUser me) {
        return candidateService.mySuggestions(me);
    }

    @PostMapping("/me/resume/apply-suggestions")
    @Operation(summary = "Confirm resume suggestions. Only explicitly confirmed values are saved; "
            + "nothing is ever auto-overwritten. Marks the resume REVIEWED.")
    public CandidateService.ResumeInfo applySuggestions(@AuthenticationPrincipal AuthUser me,
                                                        @RequestBody CandidateService.ApplyInput input) {
        return candidateService.applySuggestions(me, input);
    }

    @GetMapping("/me/allocation")
    @Operation(summary = "My allocation in the latest run, with a clear state (allocated / not allocated / no run yet / stale).")
    public CandidateService.AllocationView allocation(@AuthenticationPrincipal AuthUser me) {
        return candidateService.myAllocation(me);
    }

    @GetMapping("/me/allocation/history")
    @Operation(summary = "My allocation history across runs.")
    public List<CandidateService.HistoryEntry> history(@AuthenticationPrincipal AuthUser me) {
        return candidateService.myHistory(me);
    }

    @GetMapping("/me/eligibility")
    @Operation(summary = "My eligibility per active opportunity, with explicit human-readable reasons.")
    public Page<CandidateService.EligibilityEntry> eligibility(@AuthenticationPrincipal AuthUser me,
                                                               @RequestParam(defaultValue = "0") int page,
                                                               @RequestParam(defaultValue = "10") int size) {
        return candidateService.myEligibility(me, page, size);
    }

    // ------------------------------------------------------------------
    // Phase 4A-2C: Institutional NOC Evidence
    // ------------------------------------------------------------------

    @PostMapping(value = "/me/evidence/noc", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Submit institutional NOC (PDF max 5 MB) with verified metadata.")
    public NocEvidenceDto uploadNoc(
            @AuthenticationPrincipal AuthUser me,
            @RequestParam("file") MultipartFile file,
            @RequestParam("issuingInstitution") String issuingInstitution,
            @RequestParam("signatoryRole") SignatoryRole signatoryRole,
            @RequestParam("signatoryName") String signatoryName,
            @RequestParam("signatoryEmail") String signatoryEmail,
            @RequestParam(name = "declaresNoAcademicConflict", defaultValue = "false") boolean declaresNoAcademicConflict,
            @RequestParam(name = "validFrom", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate validFrom,
            @RequestParam(name = "validUntil", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate validUntil) throws IOException {

        NocSubmissionInput input = new NocSubmissionInput(
                issuingInstitution,
                signatoryRole,
                signatoryName,
                signatoryEmail,
                declaresNoAcademicConflict,
                validFrom,
                validUntil
        );
        return evidenceService.submitNoc(me, file, input);
    }

    @GetMapping("/me/evidence/noc")
    @Operation(summary = "Get active institutional NOC verification status.")
    public NocEvidenceDto getActiveNoc(@AuthenticationPrincipal AuthUser me) {
        return evidenceService.getActiveNoc(me);
    }

    @GetMapping(value = "/me/evidence/noc/download", produces = MediaType.APPLICATION_PDF_VALUE)
    @Operation(summary = "Download active submitted institutional NOC.")
    public ResponseEntity<Resource> downloadActiveNoc(@AuthenticationPrincipal AuthUser me) {
        Resource res = evidenceService.downloadMyNoc(me, null);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + res.getFilename() + "\"")
                .header("X-Content-Type-Options", "nosniff")
                .contentType(MediaType.APPLICATION_PDF)
                .body(res);
    }

    @GetMapping(value = "/me/evidence/noc/{id}/download", produces = MediaType.APPLICATION_PDF_VALUE)
    @Operation(summary = "Download specific historical institutional NOC submitted by caller.")
    public ResponseEntity<Resource> downloadNocById(@AuthenticationPrincipal AuthUser me,
                                                    @PathVariable("id") Long id) {
        Resource res = evidenceService.downloadMyNoc(me, id);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + res.getFilename() + "\"")
                .header("X-Content-Type-Options", "nosniff")
                .contentType(MediaType.APPLICATION_PDF)
                .body(res);
    }

    // ------------------------------------------------------------------
    // Phase 4A-2C Commit 3A: Candidate Academic Declaration
    // ------------------------------------------------------------------

    @GetMapping("/me/academic")
    @Operation(summary = "Get candidate's academic enrollment profile and verification status.")
    public ResponseEntity<CandidateAcademicDto> getMyAcademic(@AuthenticationPrincipal AuthUser me) {
        CandidateAcademicDto dto = academicService.getMyAcademic(me);
        return ResponseEntity.ok(dto);
    }

    @PutMapping("/me/academic")
    @Operation(summary = "Submit or update candidate academic declaration (self-service; verification is reviewer-controlled).")
    public ResponseEntity<CandidateAcademicDto> updateMyAcademic(
            @AuthenticationPrincipal AuthUser me,
            @Valid @RequestBody CandidateAcademicInput input) {
        CandidateAcademicDto dto = academicService.updateMyAcademic(me, input);
        return ResponseEntity.ok(dto);
    }

    @GetMapping("/me/dashboard")
    @Operation(summary = "Candidate dashboard aggregate: allocation state, readiness, next actions.")
    public Map<String, Object> dashboard(@AuthenticationPrincipal AuthUser me) {
        CandidateService.AllocationView alloc = candidateService.myAllocation(me);
        ReadinessService.Readiness ready = candidateService.myReadiness(me);
        List<String> actions = new java.util.ArrayList<>();
        String resumeState = candidateService.latestResume(me) == null ? null : candidateService.latestResume(me).status();
        if ("PENDING_REVIEW".equals(resumeState)) {
            actions.add("Review the suggestions found in your resume");
        }
        if (ready.items().stream().anyMatch(i -> !i.status().equals("COMPLETED") && i.key().equals("basic"))) {
            actions.add("Complete your basic information");
        }
        if (ready.items().stream().anyMatch(i -> !i.status().equals("COMPLETED") && i.key().equals("skills"))) {
            actions.add("Add at least 3 skills");
        }
        if (ready.items().stream().anyMatch(i -> !i.status().equals("COMPLETED") && i.key().equals("preferences"))) {
            actions.add("Rank at least one opportunity");
        }
        if (!"REVIEWED".equals(resumeState) && !"PENDING_REVIEW".equals(resumeState)) {
            actions.add("Upload your resume");
        }
        if (actions.isEmpty()) {
            actions.add("You are ready — watch for the next allocation run");
        }
        return Map.of("allocation", alloc, "readiness", ready, "nextActions", actions);
    }

    @GetMapping("/me/offers")
    @Operation(summary = "List all offers received by the current candidate.")
    public ResponseEntity<List<in.nextalloc.service.OfferService.CandidateOfferView>> getMyOffers(@AuthenticationPrincipal AuthUser me) {
        if (offerService == null) return ResponseEntity.ok(List.of());
        return ResponseEntity.ok(offerService.myOffers(me));
    }

    @PostMapping("/me/offers/{id}/accept")
    @Operation(summary = "Accept an offer received by the candidate.")
    public ResponseEntity<in.nextalloc.service.OfferService.CandidateOfferView> acceptOffer(
            @AuthenticationPrincipal AuthUser me,
            @PathVariable Long id) {
        if (offerService == null) throw in.nextalloc.common.ApiException.badRequest("Offer service unavailable.");
        return ResponseEntity.ok(offerService.acceptOffer(me, id));
    }

    @PostMapping("/me/offers/{id}/decline")
    @Operation(summary = "Decline an offer received by the candidate, releasing the seat.")
    public ResponseEntity<in.nextalloc.service.OfferService.CandidateOfferView> declineOffer(
            @AuthenticationPrincipal AuthUser me,
            @PathVariable Long id,
            @RequestBody(required = false) in.nextalloc.service.OfferService.DeclineRequest req) {
        if (offerService == null) throw in.nextalloc.common.ApiException.badRequest("Offer service unavailable.");
        String reason = req != null ? req.reason() : null;
        return ResponseEntity.ok(offerService.declineOffer(me, id, reason));
    }
}

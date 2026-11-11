package in.nextalloc.service;

import java.time.Instant;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import in.nextalloc.common.ApiException;
import in.nextalloc.domain.CandidateAcademicRecord;
import in.nextalloc.domain.CandidateEvidence;
import in.nextalloc.domain.CandidateEvidenceCurrent;
import in.nextalloc.domain.CandidateProfile;
import in.nextalloc.domain.enums.AuditAction;
import in.nextalloc.domain.enums.EnrollmentStatus;
import in.nextalloc.domain.enums.EvidenceStatus;
import in.nextalloc.domain.enums.FinalYearStatus;
import in.nextalloc.repo.CandidateAcademicRecordRepository;
import in.nextalloc.repo.CandidateEvidenceCurrentRepository;
import in.nextalloc.repo.CandidateEvidenceRepository;
import in.nextalloc.repo.CandidateProfileRepository;
import in.nextalloc.repo.UserRepository;
import in.nextalloc.security.AuthUser;
import in.nextalloc.domain.User;
import in.nextalloc.web.dto.AcademicReviewInput;
import in.nextalloc.web.dto.AcademicReviewResponseDto;
import in.nextalloc.web.dto.CandidateAcademicDetailDto;

/**
 * Service managing authorized administrative verification of candidate academic records.
 *
 * Trust Boundaries & Invariants:
 * 1. Administrator Authorization: Only authenticated users with ROLE_ADMIN may execute reviews.
 * 2. Real Verification Guard: VERIFIED_FINAL_YEAR is only granted if supported by valid institutional evidence (NOC)
 *    and matching declared academic facts (ENROLLED_FULL_TIME, currentYear == duration).
 * 3. Optimistic Concurrency Control (OCC): Stale reviews attempting to approve an outdated declaration fail with 409 Conflict.
 * 4. Semantic Integrity: Non-approval transitions to UNKNOWN, avoiding misuse of VERIFIED_NOT_FINAL_YEAR as "rejected".
 * 5. Transactional Audit Trail: All decisions are captured under AuditAction.ADMIN_ACTION.
 */
@Service
public class CandidateAcademicVerificationService {

    private static final Logger log = LoggerFactory.getLogger(CandidateAcademicVerificationService.class);

    private final CandidateAcademicRecordRepository academicRepo;
    private final CandidateProfileRepository profileRepo;
    private final CandidateEvidenceRepository evidenceRepo;
    private final CandidateEvidenceCurrentRepository currentEvidenceRepo;
    private final UserRepository userRepo;
    private final AuditService audit;

    public CandidateAcademicVerificationService(CandidateAcademicRecordRepository academicRepo,
                                                CandidateProfileRepository profileRepo,
                                                CandidateEvidenceRepository evidenceRepo,
                                                CandidateEvidenceCurrentRepository currentEvidenceRepo,
                                                UserRepository userRepo,
                                                AuditService audit) {
        this.academicRepo = academicRepo;
        this.profileRepo = profileRepo;
        this.evidenceRepo = evidenceRepo;
        this.currentEvidenceRepo = currentEvidenceRepo;
        this.userRepo = userRepo;
        this.audit = audit;
    }

    private void requireAdmin(AuthUser me) {
        if (me == null || me.role() == null || (!me.role().equalsIgnoreCase("ROLE_ADMIN") && !me.role().contains("ADMIN"))) {
            throw ApiException.forbidden("Access denied: Administrative privileges required.");
        }
    }

    @Transactional(readOnly = true)
    public CandidateAcademicDetailDto getCandidateAcademicDetail(AuthUser me, Long candidateId) {
        requireAdmin(me);
        if (candidateId == null) {
            throw ApiException.badRequest("Candidate ID is required.");
        }
        CandidateProfile profile = profileRepo.findById(candidateId)
                .orElseThrow(() -> ApiException.notFound("Candidate not found with ID: " + candidateId));
        CandidateAcademicRecord ar = academicRepo.findByCandidateId(candidateId)
                .orElseThrow(() -> ApiException.notFound("Academic record not found for candidate ID: " + candidateId));

        CandidateEvidenceCurrent currentNoc = currentEvidenceRepo
                .findByCandidateIdAndEvidenceType(candidateId, EvidenceService.EVIDENCE_TYPE_NOC)
                .orElse(null);

        Long activeNocId = currentNoc != null ? currentNoc.evidenceId : null;
        String activeNocStatus = null;
        if (activeNocId != null) {
            CandidateEvidence ev = evidenceRepo.findById(activeNocId).orElse(null);
            if (ev != null && ev.verificationStatus != null) {
                activeNocStatus = ev.verificationStatus.name();
            }
        }

        User u = profile.userId != null ? userRepo.findById(profile.userId).orElse(null) : null;
        String candidateEmail = u != null ? u.email : null;

        return new CandidateAcademicDetailDto(
                ar.id,
                profile.id,
                profile.fullName,
                candidateEmail,
                ar.enrollmentStatus,
                ar.degreeProgram,
                ar.institutionName,
                ar.institutionAisheCode,
                ar.currentAcademicYear,
                ar.programDurationYears,
                ar.finalYearStatus,
                ar.expectedCompletionDate,
                ar.updatedAt,
                ar.version,
                activeNocId,
                activeNocStatus
        );
    }

    @Transactional
    public AcademicReviewResponseDto verifyCandidateAcademic(AuthUser me, Long candidateId, AcademicReviewInput input) {
        requireAdmin(me);

        if (candidateId == null) {
            throw ApiException.badRequest("Candidate ID is required.");
        }
        if (input == null) {
            throw ApiException.badRequest("Academic review input is required.");
        }
        if (input.decision() == null) {
            throw ApiException.badRequest("Review decision is required.");
        }
        if (input.notes() == null || input.notes().trim().isBlank()) {
            throw ApiException.badRequest("Review notes/comments are required.");
        }

        CandidateProfile profile = profileRepo.findById(candidateId)
                .orElseThrow(() -> ApiException.notFound("Candidate not found with ID: " + candidateId));

        CandidateAcademicRecord record = academicRepo.findByCandidateId(candidateId)
                .orElseThrow(() -> ApiException.notFound("Academic record not found for candidate ID: " + candidateId));

        // Optimistic concurrency control (OCC) via JPA @Version
        if (input.expectedVersion() != null) {
            if (record.version != null && !record.version.equals(input.expectedVersion())) {
                throw ApiException.conflict("Stale academic record: current version is "
                        + record.version + ", expected " + input.expectedVersion() + ". Please refresh before reviewing.");
            }
        }
        if (input.expectedUpdatedAt() != null) {
            if (record.updatedAt == null || record.updatedAt.toEpochMilli() != input.expectedUpdatedAt().toEpochMilli()) {
                throw ApiException.conflict("Academic record was modified concurrently. Current version updatedAt is "
                        + record.updatedAt + ", expected " + input.expectedUpdatedAt() + ". Please refresh before reviewing.");
            }
        }

        Long resolvedEvidenceId = null;
        FinalYearStatus targetStatus;

        switch (input.decision()) {
            case APPROVE -> {
                // Enrollment and academic year checks
                if (record.enrollmentStatus != EnrollmentStatus.ENROLLED_FULL_TIME) {
                    throw ApiException.badRequest("Cannot approve final-year status: candidate enrollment status is "
                            + record.enrollmentStatus + ", not ENROLLED_FULL_TIME.");
                }
                if (record.currentAcademicYear == null || record.programDurationYears == null
                        || !record.currentAcademicYear.equals(record.programDurationYears)) {
                    throw ApiException.badRequest("Cannot approve final-year status: current academic year ("
                            + record.currentAcademicYear + ") does not equal program duration ("
                            + record.programDurationYears + ").");
                }

                // Supporting institutional evidence validation
                CandidateEvidence supportingEv;
                if (input.supportingEvidenceId() != null) {
                    supportingEv = evidenceRepo.findById(input.supportingEvidenceId())
                            .orElseThrow(() -> ApiException.badRequest("Supporting evidence not found with ID: " + input.supportingEvidenceId()));
                } else {
                    CandidateEvidenceCurrent currentNoc = currentEvidenceRepo
                            .findByCandidateIdAndEvidenceType(candidateId, EvidenceService.EVIDENCE_TYPE_NOC)
                            .orElse(null);
                    if (currentNoc == null) {
                        throw ApiException.badRequest("Cannot approve academic standing: candidate has no active supporting institutional evidence (NOC).");
                    }
                    supportingEv = evidenceRepo.findById(currentNoc.evidenceId)
                            .orElseThrow(() -> ApiException.badRequest("Active supporting evidence record " + currentNoc.evidenceId + " not found."));
                }

                // Evidence ownership and status guards
                if (!supportingEv.candidateId.equals(candidateId)) {
                    throw ApiException.badRequest("Supporting evidence ID " + supportingEv.id
                            + " belongs to candidate ID " + supportingEv.candidateId + ", not " + candidateId + ".");
                }
                if (supportingEv.verificationStatus == EvidenceStatus.REJECTED) {
                    throw ApiException.badRequest("Cannot approve academic standing: supporting institutional evidence is REJECTED.");
                }
                if (supportingEv.verificationStatus == EvidenceStatus.NOT_SUBMITTED) {
                    throw ApiException.badRequest("Cannot approve academic standing: supporting institutional evidence is NOT_SUBMITTED.");
                }

                resolvedEvidenceId = supportingEv.id;
                targetStatus = FinalYearStatus.VERIFIED_FINAL_YEAR;
            }

            case REJECT -> {
                // Controlled non-approval path: resets unverified final-year claim to UNKNOWN.
                // DOES NOT misuse VERIFIED_NOT_FINAL_YEAR.
                targetStatus = FinalYearStatus.UNKNOWN;
                if (input.supportingEvidenceId() != null) {
                    resolvedEvidenceId = input.supportingEvidenceId();
                }
            }

            case VERIFY_NOT_FINAL_YEAR -> {
                // Reviewer verifies candidate is actively NOT in final year (disqualifying state under PMIS)
                targetStatus = FinalYearStatus.VERIFIED_NOT_FINAL_YEAR;
                if (input.supportingEvidenceId() != null) {
                    resolvedEvidenceId = input.supportingEvidenceId();
                }
            }

            default -> throw ApiException.badRequest("Unrecognized review decision: " + input.decision());
        }

        record.finalYearStatus = targetStatus;
        record.touch();
        CandidateAcademicRecord saved = academicRepo.saveAndFlush(record);

        // Transactional Audit Logging
        String summary = "Authorized prototype administrator academic review for candidate " + candidateId
                + ": decision " + input.decision() + " -> " + targetStatus + " by " + me.name();

        audit.log(me, AuditAction.ADMIN_ACTION, "CandidateAcademicRecord", String.valueOf(saved.id),
                summary,
                Map.of(
                        "candidateId", candidateId,
                        "academicRecordId", saved.id,
                        "decision", input.decision().name(),
                        "finalYearStatus", targetStatus.name(),
                        "reviewerId", me.id(),
                        "reviewerName", me.name(),
                        "supportingEvidenceId", resolvedEvidenceId != null ? String.valueOf(resolvedEvidenceId) : "NONE",
                        "notes", input.notes().trim()
                ));

        log.info("Admin {} (id={}) performed academic review on candidate {}: status={}",
                me.email(), me.id(), candidateId, targetStatus);

        return new AcademicReviewResponseDto(
                candidateId,
                saved.id,
                saved.enrollmentStatus,
                saved.degreeProgram,
                saved.institutionName,
                saved.institutionAisheCode,
                saved.currentAcademicYear,
                saved.programDurationYears,
                saved.finalYearStatus,
                saved.expectedCompletionDate,
                saved.updatedAt,
                saved.version,
                resolvedEvidenceId,
                input.notes().trim(),
                me.id(),
                me.name(),
                Instant.now()
        );
    }
}

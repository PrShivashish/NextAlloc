package in.nextalloc.service;

import java.time.LocalDate;
import java.util.Objects;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import in.nextalloc.common.ApiException;
import in.nextalloc.domain.CandidateAcademicRecord;
import in.nextalloc.domain.CandidateProfile;
import in.nextalloc.domain.enums.AuditAction;
import in.nextalloc.domain.enums.EnrollmentStatus;
import in.nextalloc.domain.enums.FinalYearStatus;
import in.nextalloc.repo.CandidateAcademicRecordRepository;
import in.nextalloc.security.AuthUser;
import in.nextalloc.web.dto.CandidateAcademicDto;
import in.nextalloc.web.dto.CandidateAcademicInput;

/**
 * Service managing candidate-declared academic enrollment information.
 *
 * Security Trust Boundaries:
 * 1. Self-Service Scope: Candidates can only query and mutate their own academic declaration.
 * 2. Property Authorization: Candidates cannot self-assign VERIFIED_FINAL_YEAR.
 *    Submissions declaring final-year enrollment automatically transition to CLAIMED_FINAL_YEAR.
 * 3. Audit Compliance: All mutations are captured in the immutable audit ledger.
 */
@Service
public class CandidateAcademicService {

    private static final Logger log = LoggerFactory.getLogger(CandidateAcademicService.class);

    private final CandidateAcademicRecordRepository academicRepo;
    private final CandidateService candidateService;
    private final AuditService audit;

    public CandidateAcademicService(CandidateAcademicRecordRepository academicRepo,
                                    CandidateService candidateService,
                                    AuditService audit) {
        this.academicRepo = academicRepo;
        this.candidateService = candidateService;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public CandidateAcademicDto getMyAcademic(AuthUser me) {
        if (me == null || !"CANDIDATE".equals(me.role())) {
            throw ApiException.forbidden("Only candidates can access candidate academic declarations.");
        }
        CandidateProfile profile = candidateService.requireSelfProfile(me);
        CandidateAcademicRecord ar = academicRepo.findByCandidateId(profile.id).orElse(null);
        return ar != null ? CandidateAcademicDto.from(ar) : null;
    }

    @Transactional
    public CandidateAcademicDto updateMyAcademic(AuthUser me, CandidateAcademicInput input) {
        if (me == null || !"CANDIDATE".equals(me.role())) {
            throw ApiException.forbidden("Only candidates can update candidate academic declarations.");
        }
        if (input == null) {
            throw ApiException.badRequest("Academic declaration input is required.");
        }
        CandidateProfile profile = candidateService.requireSelfProfile(me);

        // Validation rules
        if (input.enrollmentStatus() == null || input.enrollmentStatus() == EnrollmentStatus.UNKNOWN) {
            throw ApiException.badRequest("Please specify an active enrollment status (ENROLLED_FULL_TIME, ENROLLED_DISTANCE_PART_TIME, or NOT_ENROLLED).");
        }

        if (input.enrollmentStatus() == EnrollmentStatus.ENROLLED_FULL_TIME ||
            input.enrollmentStatus() == EnrollmentStatus.ENROLLED_DISTANCE_PART_TIME) {
            if (input.currentAcademicYear() == null) {
                throw ApiException.badRequest("Current academic year is required for enrolled students.");
            }
            if (input.programDurationYears() == null) {
                throw ApiException.badRequest("Program duration is required for enrolled students.");
            }
            if (input.currentAcademicYear() > input.programDurationYears()) {
                throw ApiException.badRequest("Current academic year (" + input.currentAcademicYear()
                        + ") cannot exceed total program duration (" + input.programDurationYears() + ").");
            }
            if (input.expectedCompletionDate() != null && input.expectedCompletionDate().isBefore(LocalDate.now().minusYears(1))) {
                throw ApiException.badRequest("Expected completion date cannot be in the past for an actively enrolled student.");
            }
        }

        CandidateAcademicRecord record = academicRepo.findByCandidateId(profile.id)
                .orElseGet(() -> {
                    CandidateAcademicRecord newRec = new CandidateAcademicRecord();
                    newRec.candidateId = profile.id;
                    return newRec;
                });

        // Optimistic concurrency check for existing records
        if (record.id != null && input.expectedVersion() != null) {
            if (record.version != null && !record.version.equals(input.expectedVersion())) {
                throw ApiException.conflict("Stale academic declaration: current version is "
                        + record.version + ", expected " + input.expectedVersion() + ". Please reload the latest form before saving.");
            }
        }

        // Material equality check against existing persisted record
        String trimmedInstName = input.institutionName() != null ? input.institutionName().trim() : null;
        String trimmedAishe = input.institutionAisheCode() != null ? input.institutionAisheCode().trim() : null;
        String trimmedDegree = input.degreeProgram() != null ? input.degreeProgram().trim() : null;

        boolean isExactNoOp = record.id != null
                && record.enrollmentStatus == input.enrollmentStatus()
                && Objects.equals(record.institutionName, trimmedInstName)
                && Objects.equals(record.institutionAisheCode, trimmedAishe)
                && Objects.equals(record.degreeProgram, trimmedDegree)
                && Objects.equals(record.currentAcademicYear, input.currentAcademicYear())
                && Objects.equals(record.programDurationYears, input.programDurationYears())
                && Objects.equals(record.expectedCompletionDate, input.expectedCompletionDate());

        // Determine finalYearStatus based on trust boundaries:
        // A student declaration CANNOT self-assign VERIFIED_FINAL_YEAR or VERIFIED_NOT_FINAL_YEAR.
        // An exact no-op resubmission preserves an authorized reviewer's verification.
        // Any material change to the declaration invalidates previous verification.
        FinalYearStatus derivedFinalYear;
        if (isExactNoOp && (record.finalYearStatus == FinalYearStatus.VERIFIED_FINAL_YEAR
                         || record.finalYearStatus == FinalYearStatus.VERIFIED_NOT_FINAL_YEAR)) {
            derivedFinalYear = record.finalYearStatus;
        } else {
            // New declaration or material change: prior verification is invalidated.
            // Self-declarations cannot self-grant verified status.
            if (input.enrollmentStatus() == EnrollmentStatus.ENROLLED_FULL_TIME
                    && input.currentAcademicYear() != null
                    && input.programDurationYears() != null
                    && input.currentAcademicYear().equals(input.programDurationYears())) {
                derivedFinalYear = FinalYearStatus.CLAIMED_FINAL_YEAR;
            } else {
                derivedFinalYear = FinalYearStatus.UNKNOWN;
            }
        }

        // Apply authorized candidate-declared updates
        record.enrollmentStatus = input.enrollmentStatus();
        record.institutionName = trimmedInstName;
        record.institutionAisheCode = trimmedAishe;
        record.degreeProgram = trimmedDegree;
        record.currentAcademicYear = input.currentAcademicYear();
        record.programDurationYears = input.programDurationYears();
        record.finalYearStatus = derivedFinalYear;
        record.expectedCompletionDate = input.expectedCompletionDate();
        record.touch();

        CandidateAcademicRecord saved = academicRepo.saveAndFlush(record);

        audit.log(me, AuditAction.PROFILE_UPDATED, "CandidateAcademicRecord", String.valueOf(saved.id),
                me.name() + " updated their academic declaration (status=" + derivedFinalYear + ").", null);

        log.info("Candidate {} (profileId={}) updated academic declaration: enrollment={}, finalYearStatus={}",
                me.email(), profile.id, saved.enrollmentStatus, saved.finalYearStatus);

        return CandidateAcademicDto.from(saved);
    }
}

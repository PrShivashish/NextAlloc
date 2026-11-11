package in.nextalloc.service;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

import in.nextalloc.common.ApiException;
import in.nextalloc.config.AppProperties;
import in.nextalloc.domain.CandidateAcademicRecord;
import in.nextalloc.domain.CandidateEvidence;
import in.nextalloc.domain.CandidateEvidenceCurrent;
import in.nextalloc.domain.CandidateProfile;
import in.nextalloc.domain.User;
import in.nextalloc.domain.enums.AuditAction;
import in.nextalloc.domain.enums.EligibilityReasonCode;
import in.nextalloc.domain.enums.EvidenceStatus;
import in.nextalloc.domain.enums.SignatoryRole;
import in.nextalloc.repo.CandidateAcademicRecordRepository;
import in.nextalloc.repo.CandidateEvidenceCurrentRepository;
import in.nextalloc.repo.CandidateEvidenceRepository;
import in.nextalloc.repo.CandidateProfileRepository;
import in.nextalloc.repo.UserRepository;
import in.nextalloc.security.AuthUser;
import in.nextalloc.web.dto.NocEvidenceDto;
import in.nextalloc.web.dto.NocReviewDecisionInput;
import in.nextalloc.web.dto.NocReviewQueueItemDto;
import in.nextalloc.web.dto.NocSubmissionInput;

@Service
public class EvidenceService {

    private static final Logger log = LoggerFactory.getLogger(EvidenceService.class);
    public static final String EVIDENCE_TYPE_NOC = "INSTITUTIONAL_NOC";
    private static final long MAX_FILE_SIZE = 5L * 1024 * 1024; // 5 MB

    private final CandidateService candidateService;
    private final CandidateProfileRepository profileRepo;
    private final CandidateAcademicRecordRepository academicRepo;
    private final CandidateEvidenceRepository evidenceRepo;
    private final CandidateEvidenceCurrentRepository currentEvidenceRepo;
    private final UserRepository userRepo;
    private final AuditService auditService;
    private final AppProperties props;

    public EvidenceService(CandidateService candidateService,
                           CandidateProfileRepository profileRepo,
                           CandidateAcademicRecordRepository academicRepo,
                           CandidateEvidenceRepository evidenceRepo,
                           CandidateEvidenceCurrentRepository currentEvidenceRepo,
                           UserRepository userRepo,
                           AuditService auditService,
                           AppProperties props) {
        this.candidateService = candidateService;
        this.profileRepo = profileRepo;
        this.academicRepo = academicRepo;
        this.evidenceRepo = evidenceRepo;
        this.currentEvidenceRepo = currentEvidenceRepo;
        this.userRepo = userRepo;
        this.auditService = auditService;
        this.props = props;
    }

    // ------------------------------------------------------------------
    // Candidate Actions (Self-Scoped)
    // ------------------------------------------------------------------

    @Transactional
    public NocEvidenceDto submitNoc(AuthUser me, MultipartFile file, NocSubmissionInput input) throws IOException {
        CandidateProfile profile = candidateService.requireSelfProfile(me);

        // 1. Metadata validation
        if (input == null) {
            throw ApiException.badRequest("Submission metadata is required.");
        }
        if (input.issuingInstitution() == null || input.issuingInstitution().isBlank()) {
            throw ApiException.badRequest("Issuing institution is required.");
        }
        if (input.issuingInstitution().length() > 200) {
            throw ApiException.badRequest("Issuing institution name must not exceed 200 characters.");
        }
        if (input.signatoryRole() == null) {
            throw ApiException.badRequest("Signatory role is required.");
        }
        if (input.signatoryName() == null || input.signatoryName().isBlank()) {
            throw ApiException.badRequest("Signatory name is required.");
        }
        if (input.signatoryEmail() == null || input.signatoryEmail().isBlank() || !input.signatoryEmail().contains("@")) {
            throw ApiException.badRequest("A valid signatory email address is required.");
        }
        if (input.validFrom() != null && input.validUntil() != null && input.validUntil().isBefore(input.validFrom())) {
            throw ApiException.badRequest("NOC validity end date cannot be earlier than start date.");
        }

        // 2. File validation & staging
        Path baseDir = Path.of(props.getUploads().getDir()).toAbsolutePath().normalize();
        Path stagingDir = baseDir.resolve("staging");
        Path nocDir = baseDir.resolve("noc");
        Files.createDirectories(stagingDir);
        Files.createDirectories(nocDir);

        if (file == null || file.isEmpty()) {
            throw ApiException.badRequest("Please select a PDF document to upload.");
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw ApiException.badRequest("The NOC document must not exceed 5 MB.");
        }
        String originalName = file.getOriginalFilename() == null ? "noc.pdf" : file.getOriginalFilename();
        if (!originalName.toLowerCase().endsWith(".pdf")) {
            throw ApiException.badRequest("Only PDF documents (.pdf) are accepted for institutional NOC.");
        }

        // Stage file to staging directory with SHA-256 digest
        String stageName = "stage-noc-" + UUID.randomUUID() + ".tmp";
        Path stagePath = stagingDir.resolve(stageName);
        if (!stagePath.normalize().startsWith(stagingDir.normalize())) {
            throw ApiException.badRequest("Invalid staging path.");
        }
        String sha256Hex;

        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            try (InputStream in = file.getInputStream();
                 OutputStream out = Files.newOutputStream(stagePath)) {
                byte[] buffer = new byte[8192];
                int bytesRead;
                while ((bytesRead = in.read(buffer)) != -1) {
                    digest.update(buffer, 0, bytesRead);
                    out.write(buffer, 0, bytesRead);
                }
            }
            sha256Hex = toHex(digest.digest());

            // Validate PDF header magic bytes: %PDF- (or %PDF)
            byte[] fileBytes = Files.readAllBytes(stagePath);
            if (fileBytes.length < 5 || fileBytes[0] != 0x25 || fileBytes[1] != 0x50 || fileBytes[2] != 0x44 || fileBytes[3] != 0x46) {
                Files.deleteIfExists(stagePath);
                throw ApiException.badRequest("The uploaded file does not have a valid PDF header (%PDF).");
            }

            // Validate PDF trailer: last 1024 bytes must contain %%EOF
            int searchWindow = Math.min(fileBytes.length, 1024);
            int startIdx = fileBytes.length - searchWindow;
            String tail = new String(fileBytes, startIdx, searchWindow, java.nio.charset.StandardCharsets.ISO_8859_1);
            if (!tail.contains("%%EOF")) {
                Files.deleteIfExists(stagePath);
                throw ApiException.badRequest("The uploaded PDF is corrupted or incomplete (missing %%EOF marker).");
            }
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            Files.deleteIfExists(stagePath);
            throw ApiException.badRequest("Failed to process uploaded file: " + e.getMessage());
        }

        // 3. Atomically move to permanent storage
        String permName = "noc-" + profile.id + "-" + sha256Hex.substring(0, 8) + "-" + UUID.randomUUID() + ".pdf";
        Path permPath = nocDir.resolve(permName);
        if (!permPath.normalize().startsWith(nocDir.normalize())) {
            Files.deleteIfExists(stagePath);
            throw ApiException.badRequest("Invalid permanent storage path.");
        }
        try {
            Files.move(stagePath, permPath, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            Files.deleteIfExists(stagePath);
            throw new RuntimeException("Failed to persist NOC file: " + e.getMessage(), e);
        }

        // Register Spring transaction synchronization rollback cleanup
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCompletion(int status) {
                    if (status != TransactionSynchronization.STATUS_COMMITTED) {
                        try {
                            Files.deleteIfExists(permPath);
                            log.info("Rolled back NOC upload file {}", permPath);
                        } catch (Exception ex) {
                            log.warn("Failed to clean up file after rollback: {}", permPath, ex);
                        }
                    }
                }
            });
        }

        // 4. Create new immutable CandidateEvidence record
        CandidateEvidence evidence = new CandidateEvidence();
        evidence.candidateId = profile.id;
        evidence.evidenceType = EVIDENCE_TYPE_NOC;
        evidence.documentReference = "noc/" + permName;
        evidence.documentSha256 = sha256Hex;
        evidence.issuingInstitution = input.issuingInstitution().trim();
        evidence.signatoryRole = input.signatoryRole();
        evidence.signatoryName = input.signatoryName().trim();
        evidence.signatoryEmail = input.signatoryEmail().trim().toLowerCase();
        evidence.declaresNoAcademicConflict = input.declaresNoAcademicConflict();
        evidence.validFrom = input.validFrom();
        evidence.validUntil = input.validUntil();
        evidence.verificationStatus = EvidenceStatus.SUBMITTED;
        evidence.rejectionReasonCode = null;
        evidence.rejectionNotes = null;
        evidence.verifiedAt = null;
        evidence.verifiedByUserId = null;
        evidence.touch();

        CandidateEvidence savedEvidence = evidenceRepo.save(evidence);

        // 5. Update or insert current active pointer in CandidateEvidenceCurrent
        if (!savedEvidence.candidateId.equals(profile.id) || !savedEvidence.evidenceType.equals(EVIDENCE_TYPE_NOC)) {
            throw ApiException.badRequest("Mismatched candidate or evidence type for active pointer.");
        }

        CandidateEvidenceCurrent current = currentEvidenceRepo
                .findByCandidateIdAndEvidenceType(profile.id, EVIDENCE_TYPE_NOC)
                .orElseGet(() -> new CandidateEvidenceCurrent(profile.id, EVIDENCE_TYPE_NOC, savedEvidence.id));

        current.evidenceId = savedEvidence.id;
        current.touch();
        currentEvidenceRepo.save(current);

        // 6. Log audit event
        auditService.log(me, AuditAction.NOC_SUBMITTED, "CandidateEvidence", savedEvidence.id.toString(),
                "Candidate " + (profile.fullName != null ? profile.fullName : me.name()) + " submitted institutional NOC",
                Map.of("candidateId", profile.id, "sha256", sha256Hex, "evidenceId", savedEvidence.id));

        return NocEvidenceDto.from(savedEvidence);
    }

    @Transactional(readOnly = true)
    public NocEvidenceDto getActiveNoc(AuthUser me) {
        CandidateProfile profile = candidateService.requireSelfProfile(me);
        CandidateEvidence evidence = evidenceRepo.findByCandidateIdAndEvidenceType(profile.id, EVIDENCE_TYPE_NOC).orElse(null);
        return evidence != null ? NocEvidenceDto.from(evidence) : null;
    }

    @Transactional(readOnly = true)
    public Resource downloadMyNoc(AuthUser me, Long evidenceId) {
        CandidateProfile profile = candidateService.requireSelfProfile(me);
        CandidateEvidence evidence;
        if (evidenceId != null) {
            evidence = evidenceRepo.findById(evidenceId)
                    .orElseThrow(() -> ApiException.notFound("Evidence not found."));
            if (!evidence.candidateId.equals(profile.id)) {
                throw ApiException.forbidden("You do not have permission to access another applicant's evidence.");
            }
        } else {
            evidence = evidenceRepo.findByCandidateIdAndEvidenceType(profile.id, EVIDENCE_TYPE_NOC)
                    .orElseThrow(() -> ApiException.notFound("No active NOC submitted yet."));
        }
        return resolveFileResource(evidence);
    }

    // ------------------------------------------------------------------
    // Reviewer / Administrator Actions
    // ------------------------------------------------------------------

    private void requireAdmin(AuthUser me) {
        if (me == null || me.role() == null || (!me.role().equalsIgnoreCase("ROLE_ADMIN") && !me.role().contains("ADMIN"))) {
            throw ApiException.forbidden("Access denied: Administrative privileges required.");
        }
    }

    @Transactional(readOnly = true)
    public Page<NocReviewQueueItemDto> getPendingQueue(AuthUser me, Pageable pageable) {
        requireAdmin(me);
        Page<CandidateEvidence> page = evidenceRepo.findByVerificationStatusOrderByIdAsc(EvidenceStatus.SUBMITTED, pageable);
        List<NocReviewQueueItemDto> items = page.getContent().stream()
                .map(this::enrichQueueItem)
                .toList();
        return new PageImpl<>(items, pageable, page.getTotalElements());
    }

    @Transactional(readOnly = true)
    public NocReviewQueueItemDto getEvidenceDetail(AuthUser me, Long evidenceId) {
        requireAdmin(me);
        CandidateEvidence evidence = evidenceRepo.findById(evidenceId)
                .orElseThrow(() -> ApiException.notFound("Evidence record not found with ID: " + evidenceId));
        return enrichQueueItem(evidence);
    }

    @Transactional(readOnly = true)
    public Resource downloadEvidenceForAdmin(AuthUser me, Long evidenceId) {
        requireAdmin(me);
        CandidateEvidence evidence = evidenceRepo.findById(evidenceId)
                .orElseThrow(() -> ApiException.notFound("Evidence record not found with ID: " + evidenceId));
        return resolveFileResource(evidence);
    }

    @Transactional
    public NocReviewQueueItemDto verifyNoc(AuthUser me, Long evidenceId, NocReviewDecisionInput decision) {
        requireAdmin(me);
        CandidateEvidence evidence = evidenceRepo.findById(evidenceId)
                .orElseThrow(() -> ApiException.notFound("Evidence record not found with ID: " + evidenceId));

        // Optimistic concurrency check
        if (decision != null && decision.expectedVersion() != null && !decision.expectedVersion().equals(evidence.version)) {
            throw ApiException.conflict("Stale evidence version: current version is " + evidence.version
                    + ", expected " + decision.expectedVersion() + ". Please refresh before reviewing.");
        }

        // State machine guard
        if (evidence.verificationStatus != EvidenceStatus.SUBMITTED && evidence.verificationStatus != EvidenceStatus.PENDING_ADDITIONAL_INFO) {
            throw ApiException.badRequest("Cannot verify NOC with status " + evidence.verificationStatus
                    + ". Only SUBMITTED or PENDING_ADDITIONAL_INFO records can be verified.");
        }

        // Active pointer / supersession guard
        CandidateEvidenceCurrent current = currentEvidenceRepo
                .findByCandidateIdAndEvidenceType(evidence.candidateId, evidence.evidenceType)
                .orElse(null);
        if (current == null || !evidence.id.equals(current.evidenceId)) {
            throw ApiException.conflict("Evidence ID " + evidence.id
                    + " is not the current active submission for candidate " + evidence.candidateId + ".");
        }

        // Academic Conflict Guard
        if (!evidence.declaresNoAcademicConflict) {
            throw ApiException.badRequest("Cannot verify NOC: applicant has declared or failed to affirm absence of academic conflict.");
        }

        // MCA Signatory Authorization Guard
        if (evidence.signatoryRole == SignatoryRole.OTHER_UNRECOGNIZED) {
            throw ApiException.badRequest("Cannot verify NOC: signatory role OTHER_UNRECOGNIZED is not an authorized institutional signatory.");
        }

        CandidateAcademicRecord acad = academicRepo.findByCandidateId(evidence.candidateId).orElse(null);
        String warning = evaluateSignatoryWarning(evidence, acad);
        if (warning != null && warning.contains("UNAUTHORIZED_SIGNATORY_MISMATCH")) {
            throw ApiException.badRequest("Signatory role " + evidence.signatoryRole + " is not authorized for institution: " + warning);
        }

        // Apply verification
        evidence.verificationStatus = EvidenceStatus.VERIFIED;
        evidence.verifiedAt = Instant.now();
        evidence.verifiedByUserId = me.id();
        evidence.rejectionReasonCode = null;
        evidence.rejectionNotes = (decision != null && decision.notes() != null) ? decision.notes().trim() : null;

        if (decision != null && decision.validFrom() != null) {
            evidence.validFrom = decision.validFrom();
        }
        if (decision != null && decision.validUntil() != null) {
            evidence.validUntil = decision.validUntil();
        }
        evidence.touch();

        CandidateEvidence saved = evidenceRepo.save(evidence);

        auditService.log(me, AuditAction.NOC_VERIFIED, "CandidateEvidence", saved.id.toString(),
                "Institutional NOC verified by reviewer " + me.name(),
                Map.of("evidenceId", saved.id, "candidateId", saved.candidateId, "reviewerId", me.id()));

        return enrichQueueItem(saved);
    }

    @Transactional
    public NocReviewQueueItemDto rejectNoc(AuthUser me, Long evidenceId, NocReviewDecisionInput decision) {
        requireAdmin(me);
        CandidateEvidence evidence = evidenceRepo.findById(evidenceId)
                .orElseThrow(() -> ApiException.notFound("Evidence record not found with ID: " + evidenceId));

        if (decision != null && decision.expectedVersion() != null && !decision.expectedVersion().equals(evidence.version)) {
            throw ApiException.conflict("Stale evidence version: current version is " + evidence.version
                    + ", expected " + decision.expectedVersion() + ". Please refresh before reviewing.");
        }

        if (evidence.verificationStatus != EvidenceStatus.SUBMITTED && evidence.verificationStatus != EvidenceStatus.PENDING_ADDITIONAL_INFO) {
            throw ApiException.badRequest("Cannot reject NOC with status " + evidence.verificationStatus + ".");
        }

        // Active pointer / supersession guard
        CandidateEvidenceCurrent current = currentEvidenceRepo
                .findByCandidateIdAndEvidenceType(evidence.candidateId, evidence.evidenceType)
                .orElse(null);
        if (current == null || !evidence.id.equals(current.evidenceId)) {
            throw ApiException.conflict("Evidence ID " + evidence.id
                    + " is not the current active submission for candidate " + evidence.candidateId + ".");
        }

        evidence.verificationStatus = EvidenceStatus.REJECTED;
        evidence.verifiedAt = Instant.now();
        evidence.verifiedByUserId = me.id();
        evidence.rejectionReasonCode = (decision != null && decision.reasonCode() != null)
                ? decision.reasonCode()
                : EligibilityReasonCode.INSTITUTIONAL_NOC_REJECTED;
        evidence.rejectionNotes = (decision != null && decision.notes() != null) ? decision.notes().trim() : "Document rejected by reviewer.";
        evidence.touch();

        CandidateEvidence saved = evidenceRepo.save(evidence);

        auditService.log(me, AuditAction.NOC_REJECTED, "CandidateEvidence", saved.id.toString(),
                "Institutional NOC rejected by reviewer " + me.name() + ": " + evidence.rejectionReasonCode,
                Map.of("evidenceId", saved.id, "candidateId", saved.candidateId, "reviewerId", me.id(),
                        "reasonCode", evidence.rejectionReasonCode.name()));

        return enrichQueueItem(saved);
    }

    @Transactional
    public NocReviewQueueItemDto requestClarification(AuthUser me, Long evidenceId, NocReviewDecisionInput decision) {
        requireAdmin(me);
        CandidateEvidence evidence = evidenceRepo.findById(evidenceId)
                .orElseThrow(() -> ApiException.notFound("Evidence record not found with ID: " + evidenceId));

        if (decision != null && decision.expectedVersion() != null && !decision.expectedVersion().equals(evidence.version)) {
            throw ApiException.conflict("Stale evidence version: current version is " + evidence.version
                    + ", expected " + decision.expectedVersion() + ". Please refresh before reviewing.");
        }

        if (evidence.verificationStatus != EvidenceStatus.SUBMITTED) {
            throw ApiException.badRequest("Clarification can only be requested for SUBMITTED records.");
        }

        // Active pointer / supersession guard
        CandidateEvidenceCurrent current = currentEvidenceRepo
                .findByCandidateIdAndEvidenceType(evidence.candidateId, evidence.evidenceType)
                .orElse(null);
        if (current == null || !evidence.id.equals(current.evidenceId)) {
            throw ApiException.conflict("Evidence ID " + evidence.id
                    + " is not the current active submission for candidate " + evidence.candidateId + ".");
        }

        evidence.verificationStatus = EvidenceStatus.PENDING_ADDITIONAL_INFO;
        evidence.verifiedAt = Instant.now();
        evidence.verifiedByUserId = me.id();
        evidence.rejectionReasonCode = EligibilityReasonCode.INSTITUTIONAL_NOC_UNVERIFIED;
        evidence.rejectionNotes = (decision != null && decision.notes() != null) ? decision.notes().trim() : "Additional clarification required.";
        evidence.touch();

        CandidateEvidence saved = evidenceRepo.save(evidence);

        auditService.log(me, AuditAction.NOC_CLARIFICATION_REQUESTED, "CandidateEvidence", saved.id.toString(),
                "Clarification requested by reviewer " + me.name(),
                Map.of("evidenceId", saved.id, "candidateId", saved.candidateId, "reviewerId", me.id()));

        return enrichQueueItem(saved);
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    private Resource resolveFileResource(CandidateEvidence evidence) {
        Path baseDir = Path.of(props.getUploads().getDir()).toAbsolutePath().normalize();
        Path filePath = baseDir.resolve(evidence.documentReference).normalize();
        if (!filePath.startsWith(baseDir)) {
            throw ApiException.forbidden("Access denied: Invalid file path reference.");
        }
        if (!Files.exists(filePath) || !Files.isReadable(filePath)) {
            throw ApiException.notFound("Document file not found on storage.");
        }
        return new FileSystemResource(filePath);
    }

    private NocReviewQueueItemDto enrichQueueItem(CandidateEvidence e) {
        CandidateProfile p = profileRepo.findById(e.candidateId).orElse(null);
        User u = (p != null && p.userId != null) ? userRepo.findById(p.userId).orElse(null) : null;
        CandidateAcademicRecord acad = academicRepo.findByCandidateId(e.candidateId).orElse(null);
        String warning = evaluateSignatoryWarning(e, acad);
        return NocReviewQueueItemDto.from(e, p, u, acad, warning);
    }

    public String evaluateSignatoryWarning(CandidateEvidence e, CandidateAcademicRecord acad) {
        if (e.signatoryRole == SignatoryRole.OTHER_UNRECOGNIZED) {
            return "UNAUTHORIZED_SIGNATORY_MISMATCH: OTHER_UNRECOGNIZED is not accepted.";
        }
        if (acad != null && acad.institutionName != null) {
            String inst = acad.institutionName.toLowerCase();
            boolean isUniversity = inst.contains("university") || inst.contains("deemed") || inst.contains("iit") || inst.contains("nit");
            if (!isUniversity) {
                // College / affiliated institute: Principal or TPO authorized
                if (e.signatoryRole != SignatoryRole.PRINCIPAL && e.signatoryRole != SignatoryRole.TRAINING_AND_PLACEMENT_OFFICER) {
                    return "SIGNATORY_NOTICE: College institution typically requires Principal or TPO authorization; current signatory is " + e.signatoryRole;
                }
            }
        }
        if (!e.declaresNoAcademicConflict) {
            return "ACADEMIC_CONFLICT_WARNING: Applicant has not declared absence of academic conflict.";
        }
        return null;
    }

    /**
     * Reconciles unreferenced files in permanent storage.
     * Deletes files older than olderThan that are not referenced in candidate_evidences.
     */
    public int reconcileOrphanFiles(java.time.Duration olderThan) {
        return reconcileOrphanFiles(olderThan, false);
    }

    /**
     * Reconciles unreferenced files in permanent storage.
     * Supports dry-run mode and fails closed if reference retrieval encounters an error.
     */
    public int reconcileOrphanFiles(java.time.Duration olderThan, boolean dryRun) {
        Path baseDir = Path.of(props.getUploads().getDir()).toAbsolutePath().normalize();
        Path nocDir = baseDir.resolve("noc");
        if (!Files.exists(nocDir)) return 0;

        // Fail-closed database reference query: collect all retained document references
        Set<String> referencedRefs = new HashSet<>();
        try {
            for (CandidateEvidence e : evidenceRepo.findAll()) {
                if (e.documentReference != null && !e.documentReference.isBlank()) {
                    referencedRefs.add(e.documentReference.trim());
                }
            }
        } catch (Exception ex) {
            log.error("Failed to query evidence references during orphan reconciliation; failing closed without deleting files", ex);
            return 0; // Fail closed!
        }

        int cleaned = 0;
        Instant threshold = Instant.now().minus(olderThan);
        try (var stream = Files.list(nocDir)) {
            Path canonicalNocDir = nocDir.toRealPath();
            for (Path file : stream.toList()) {
                try {
                    // Symlink protection: never follow or delete symlinks outside storage root
                    if (Files.isSymbolicLink(file)) {
                        log.warn("Skipping symbolic link during reconciliation: {}", file);
                        continue;
                    }
                    Path canonicalFile = file.toRealPath();
                    if (!canonicalFile.startsWith(canonicalNocDir)) {
                        log.warn("File path resolves outside noc directory: {}", file);
                        continue;
                    }

                    Instant modified = Files.getLastModifiedTime(file).toInstant();
                    if (!modified.isAfter(threshold)) {
                        String ref = "noc/" + file.getFileName().toString();
                        if (!referencedRefs.contains(ref)) {
                            if (!dryRun) {
                                Files.deleteIfExists(file);
                                log.info("Reconciled unreferenced orphan file: {}", file);
                            } else {
                                log.info("Dry-run: would reconcile unreferenced orphan file: {}", file);
                            }
                            cleaned++;
                        }
                    }
                } catch (Exception ex) {
                    log.warn("Error checking file {}", file, ex);
                }
            }
        } catch (Exception ex) {
            log.warn("Error listing noc directory for reconciliation", ex);
        }
        return cleaned;
    }

    private static String toHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }
}

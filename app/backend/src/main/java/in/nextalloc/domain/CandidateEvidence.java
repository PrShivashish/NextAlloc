package in.nextalloc.domain;

import java.time.Instant;
import java.time.LocalDate;

import in.nextalloc.domain.enums.EligibilityReasonCode;
import in.nextalloc.domain.enums.EvidenceStatus;
import in.nextalloc.domain.enums.SignatoryRole;
import jakarta.persistence.*;

@Entity
@Table(name = "candidate_evidences",
       uniqueConstraints = {@UniqueConstraint(name = "uq_cand_evid_composite", columnNames = {"id", "candidateId", "evidenceType"})},
       indexes = {@Index(name = "idx_evid_candidate_type", columnList = "candidateId, evidenceType"),
                  @Index(name = "idx_evid_status", columnList = "verificationStatus")})
public class CandidateEvidence {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(nullable = false)
    public Long candidateId;

    @Column(nullable = false, length = 40)
    public String evidenceType;

    @Column(nullable = false, length = 300)
    public String documentReference;

    @Column(length = 64)
    public String documentSha256;

    @Column(length = 200)
    public String issuingInstitution;

    @Enumerated(EnumType.STRING)
    @Column(length = 40)
    public SignatoryRole signatoryRole;

    @Column(length = 120)
    public String signatoryName;

    @Column(length = 120)
    public String signatoryEmail;

    @Column(nullable = false)
    public boolean declaresNoAcademicConflict = false;

    public LocalDate validFrom;

    public LocalDate validUntil;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    public EvidenceStatus verificationStatus = EvidenceStatus.NOT_SUBMITTED;

    public Instant verifiedAt;

    public Long verifiedByUserId;

    @Enumerated(EnumType.STRING)
    @Column(length = 50)
    public EligibilityReasonCode rejectionReasonCode;

    @Column(length = 500)
    public String rejectionNotes;

    @Version
    public Integer version;

    @Column(nullable = false, updatable = false)
    public Instant createdAt = Instant.now();

    @Column(nullable = false)
    public Instant updatedAt = Instant.now();

    public void touch() {
        this.updatedAt = Instant.now();
    }
}


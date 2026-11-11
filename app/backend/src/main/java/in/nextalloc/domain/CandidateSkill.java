package in.nextalloc.domain;

import java.time.Instant;
import jakarta.persistence.*;
import in.nextalloc.domain.enums.SkillSource;
import in.nextalloc.domain.enums.SkillClaimSource;
import in.nextalloc.domain.enums.SkillEvidenceStatus;

@Entity
@Table(name = "candidate_skills", indexes = {
    @Index(name = "idx_skill_candidate", columnList = "candidateId"),
    @Index(name = "idx_skill_candidate_concept", columnList = "candidateId, conceptId")
})
public class CandidateSkill {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(nullable = false)
    public Long candidateId;

    @Column(nullable = false, length = 80)
    public String rawLabel;

    @Column(nullable = false, length = 80)
    public String canonical;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    public SkillSource source = SkillSource.PROFILE;

    @Column(nullable = false)
    public boolean validated = true;

    // --- Additive Phase 4B-2B.2A Provenance & Versioning Foundation ---

    @Column(length = 64)
    public String conceptId;

    @Column(length = 32)
    public String taxonomyVersion;

    @Column(length = 120)
    public String originalInput;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    public SkillClaimSource claimSource = SkillClaimSource.LEGACY_UNSPECIFIED;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    public SkillEvidenceStatus evidenceStatus = SkillEvidenceStatus.UNVERIFIED;

    @Column(updatable = false)
    public Instant createdAt;

    @Column
    public Instant updatedAt;

    @Version
    @Column(nullable = false)
    public Long version = 0L;

    @PrePersist
    protected void onCreate() {
        Instant now = Instant.now();
        if (createdAt == null) {
            createdAt = now;
        }
        if (updatedAt == null) {
            updatedAt = now;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = Instant.now();
    }
}

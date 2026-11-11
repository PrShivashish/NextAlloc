package in.nextalloc.domain;

import java.time.Instant;
import jakarta.persistence.*;
import in.nextalloc.domain.enums.SkillClaimSource;
import in.nextalloc.domain.enums.SkillEvidenceStatus;

@Entity
@Table(name = "candidate_related_skills", indexes = {
    @Index(name = "idx_cand_related_skill_cand", columnList = "candidateId"),
    @Index(name = "idx_cand_related_skill_concept", columnList = "conceptId"),
    @Index(name = "idx_cand_related_skill_canonical", columnList = "relatedCanonical")
}, uniqueConstraints = {
    @UniqueConstraint(name = "uq_cand_related_skill", columnNames = {"candidateId", "conceptId"})
})
public class CandidateRelatedSkill {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(nullable = false)
    public Long candidateId;

    @Column(nullable = false, length = 80)
    public String rawLabel;

    @Column(nullable = false, length = 64)
    public String conceptId;

    @Column(nullable = false, length = 80)
    public String relatedCanonical;

    @Column(nullable = false, length = 32)
    public String relationshipType;

    @Column(nullable = false, length = 32)
    public String taxonomyVersion;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    public SkillClaimSource claimSource = SkillClaimSource.SELF_DECLARED;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    public SkillEvidenceStatus evidenceStatus = SkillEvidenceStatus.UNVERIFIED;

    @Column(nullable = false, updatable = false)
    public Instant createdAt;

    @Column
    public Instant updatedAt;

    @Version
    public Long version;

    @PrePersist
    public void onPrePersist() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    @PreUpdate
    public void onPreUpdate() {
        updatedAt = Instant.now();
    }
}

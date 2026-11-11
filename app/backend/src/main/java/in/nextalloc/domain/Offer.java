package in.nextalloc.domain;

import java.time.Instant;
import jakarta.persistence.*;
import in.nextalloc.domain.enums.OfferStatus;

@Entity
@Table(name = "offers", indexes = {
    @Index(name = "idx_offer_candidate_status", columnList = "candidateId,status"),
    @Index(name = "idx_offer_opp_status", columnList = "opportunityId,status"),
    @Index(name = "idx_offer_run", columnList = "runId")
}, uniqueConstraints = {
    @UniqueConstraint(name = "uq_offer_run_candidate", columnNames = {"runId", "candidateId"})
})
public class Offer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(nullable = false)
    public Long runId;

    @Column(nullable = false)
    public Long candidateId;

    @Column(nullable = false)
    public Long opportunityId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    public OfferStatus status = OfferStatus.OFFERED;

    @Column(nullable = false)
    public Instant offeredAt = Instant.now();

    @Column
    public Instant respondedAt;

    @Column
    public Instant joinedAt;

    @Column(length = 500)
    public String declineReason;

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
        if (offeredAt == null) {
            offeredAt = Instant.now();
        }
    }

    @PreUpdate
    public void onPreUpdate() {
        updatedAt = Instant.now();
    }
}


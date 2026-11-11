package in.nextalloc.domain;

import java.time.Instant;

import in.nextalloc.domain.enums.EligibilityDecision;
import jakarta.persistence.*;

/**
 * Point-in-time eligibility evaluation record captured at the time of an allocation run.
 * Foundational schema for the Reproducible Decision Ledger.
 */
@Entity
@Table(name = "allocation_eligibility_snapshots",
       uniqueConstraints = @UniqueConstraint(name = "uq_run_candidate_elig", columnNames = {"runId", "candidateId"}),
       indexes = {@Index(name = "idx_eligsanp_run_cand", columnList = "runId, candidateId")})
public class AllocationEligibilitySnapshot {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(nullable = false)
    public Long runId;

    @Column(nullable = false)
    public Long candidateId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    public EligibilityDecision decision;

    @Column(columnDefinition = "TEXT")
    public String reasonCodesJson;

    @Column(length = 40)
    public String evidenceStatusSnapshot;

    public Long evidenceIdRef;

    @Column(nullable = false, updatable = false)
    public Instant evaluatedAt = Instant.now();
}


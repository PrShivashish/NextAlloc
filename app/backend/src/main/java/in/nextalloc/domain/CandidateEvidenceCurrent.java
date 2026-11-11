package in.nextalloc.domain;

import java.time.Instant;
import jakarta.persistence.*;

@Entity
@Table(name = "candidate_evidence_current",
       uniqueConstraints = @UniqueConstraint(name = "uq_cand_evid_current", columnNames = {"candidateId", "evidenceType"}),
       indexes = {@Index(name = "idx_evid_cur_lookup", columnList = "candidateId, evidenceType")})
public class CandidateEvidenceCurrent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(nullable = false)
    public Long candidateId;

    @Column(nullable = false, length = 40)
    public String evidenceType;

    @Column(nullable = false)
    public Long evidenceId;

    @Version
    public Integer version;

    @Column(nullable = false)
    public Instant updatedAt = Instant.now();

    public CandidateEvidenceCurrent() {}

    public CandidateEvidenceCurrent(Long candidateId, String evidenceType, Long evidenceId) {
        this.candidateId = candidateId;
        this.evidenceType = evidenceType;
        this.evidenceId = evidenceId;
        this.version = 0;
        this.updatedAt = Instant.now();
    }

    public void touch() {
        this.updatedAt = Instant.now();
    }
}

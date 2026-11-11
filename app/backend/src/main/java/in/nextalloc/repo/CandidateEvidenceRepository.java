package in.nextalloc.repo;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import in.nextalloc.domain.CandidateEvidence;
import in.nextalloc.domain.enums.EvidenceStatus;

public interface CandidateEvidenceRepository extends JpaRepository<CandidateEvidence, Long> {

    @Query("SELECT ce FROM CandidateEvidence ce " +
           "WHERE ce.candidateId = :candidateId AND (" +
           "  ce.id IN (SELECT cec.evidenceId FROM CandidateEvidenceCurrent cec WHERE cec.candidateId = :candidateId AND cec.evidenceType = ce.evidenceType) " +
           "  OR (NOT EXISTS (SELECT 1 FROM CandidateEvidenceCurrent cec2 WHERE cec2.candidateId = :candidateId AND cec2.evidenceType = ce.evidenceType) " +
           "      AND (SELECT COUNT(sub.id) FROM CandidateEvidence sub WHERE sub.candidateId = :candidateId AND sub.evidenceType = ce.evidenceType) = 1)" +
           ")")
    List<CandidateEvidence> findByCandidateId(@Param("candidateId") Long candidateId);

    @Query("SELECT ce FROM CandidateEvidence ce " +
           "WHERE ce.candidateId = :candidateId AND ce.evidenceType = :evidenceType AND (" +
           "  ce.id IN (SELECT cec.evidenceId FROM CandidateEvidenceCurrent cec WHERE cec.candidateId = :candidateId AND cec.evidenceType = :evidenceType) " +
           "  OR (NOT EXISTS (SELECT 1 FROM CandidateEvidenceCurrent cec2 WHERE cec2.candidateId = :candidateId AND cec2.evidenceType = :evidenceType) " +
           "      AND (SELECT COUNT(sub.id) FROM CandidateEvidence sub WHERE sub.candidateId = :candidateId AND sub.evidenceType = :evidenceType) = 1)" +
           ")")
    Optional<CandidateEvidence> findByCandidateIdAndEvidenceType(@Param("candidateId") Long candidateId,
                                                                 @Param("evidenceType") String evidenceType);

    @Query("SELECT ce FROM CandidateEvidence ce " +
           "WHERE ce.candidateId IN :candidateIds AND (" +
           "  ce.id IN (SELECT cec.evidenceId FROM CandidateEvidenceCurrent cec WHERE cec.candidateId = ce.candidateId AND cec.evidenceType = ce.evidenceType) " +
           "  OR (NOT EXISTS (SELECT 1 FROM CandidateEvidenceCurrent cec2 WHERE cec2.candidateId = ce.candidateId AND cec2.evidenceType = ce.evidenceType) " +
           "      AND (SELECT COUNT(sub.id) FROM CandidateEvidence sub WHERE sub.candidateId = ce.candidateId AND sub.evidenceType = ce.evidenceType) = 1)" +
           ")")
    List<CandidateEvidence> findByCandidateIdIn(@Param("candidateIds") Collection<Long> candidateIds);

    List<CandidateEvidence> findByVerificationStatus(EvidenceStatus status);

    @Query("SELECT ce FROM CandidateEvidence ce, CandidateEvidenceCurrent cec " +
           "WHERE ce.id = cec.evidenceId AND ce.verificationStatus = :status ORDER BY ce.id ASC")
    List<CandidateEvidence> findByVerificationStatusOrderByIdAsc(@Param("status") EvidenceStatus status);

    @Query("SELECT ce FROM CandidateEvidence ce, CandidateEvidenceCurrent cec " +
           "WHERE ce.id = cec.evidenceId AND ce.verificationStatus = :status ORDER BY ce.id ASC")
    Page<CandidateEvidence> findByVerificationStatusOrderByIdAsc(@Param("status") EvidenceStatus status, Pageable pageable);

    List<CandidateEvidence> findAllByCandidateIdOrderByIdDesc(Long candidateId);
}

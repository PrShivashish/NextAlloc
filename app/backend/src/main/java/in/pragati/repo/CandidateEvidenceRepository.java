package in.pragati.repo;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import in.pragati.domain.CandidateEvidence;
import in.pragati.domain.enums.EvidenceStatus;

public interface CandidateEvidenceRepository extends JpaRepository<CandidateEvidence, Long> {
    List<CandidateEvidence> findByCandidateId(Long candidateId);
    Optional<CandidateEvidence> findByCandidateIdAndEvidenceType(Long candidateId, String evidenceType);
    List<CandidateEvidence> findByVerificationStatus(EvidenceStatus status);
    List<CandidateEvidence> findByCandidateIdIn(Collection<Long> candidateIds);
}


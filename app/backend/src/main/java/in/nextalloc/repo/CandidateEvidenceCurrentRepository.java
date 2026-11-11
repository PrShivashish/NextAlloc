package in.nextalloc.repo;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import in.nextalloc.domain.CandidateEvidenceCurrent;

public interface CandidateEvidenceCurrentRepository extends JpaRepository<CandidateEvidenceCurrent, Long> {
    Optional<CandidateEvidenceCurrent> findByCandidateIdAndEvidenceType(Long candidateId, String evidenceType);
    List<CandidateEvidenceCurrent> findByCandidateId(Long candidateId);
    List<CandidateEvidenceCurrent> findByCandidateIdIn(Collection<Long> candidateIds);
    Optional<CandidateEvidenceCurrent> findByEvidenceId(Long evidenceId);
}

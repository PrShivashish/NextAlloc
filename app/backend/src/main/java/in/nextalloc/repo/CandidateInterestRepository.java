package in.nextalloc.repo;

import org.springframework.data.jpa.repository.JpaRepository;
import in.nextalloc.domain.CandidateInterest;
import java.util.List;

public interface CandidateInterestRepository extends JpaRepository<CandidateInterest, Long> {
    List<CandidateInterest> findByCandidateId(Long candidateId);
    List<CandidateInterest> findByCandidateIdIn(List<Long> candidateIds);
    void deleteByCandidateId(Long candidateId);
}

package in.nextalloc.repo;

import org.springframework.data.jpa.repository.JpaRepository;
import in.nextalloc.domain.CandidateRelatedSkill;
import java.util.List;
import java.util.Optional;

public interface CandidateRelatedSkillRepository extends JpaRepository<CandidateRelatedSkill, Long> {
    List<CandidateRelatedSkill> findByCandidateId(Long candidateId);
    List<CandidateRelatedSkill> findByCandidateIdIn(List<Long> candidateIds);
    Optional<CandidateRelatedSkill> findByCandidateIdAndConceptId(Long candidateId, String conceptId);
    void deleteByCandidateId(Long candidateId);
}

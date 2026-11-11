package in.nextalloc.repo;

import org.springframework.data.jpa.repository.JpaRepository;
import in.nextalloc.domain.CandidateSkill;
import in.nextalloc.domain.enums.SkillEvidenceStatus;
import java.util.List;

public interface CandidateSkillRepository extends JpaRepository<CandidateSkill, Long> {
    List<CandidateSkill> findByCandidateId(Long candidateId);
    List<CandidateSkill> findByCandidateIdIn(List<Long> candidateIds);
    List<CandidateSkill> findByCandidateIdAndConceptId(Long candidateId, String conceptId);
    List<CandidateSkill> findByConceptId(String conceptId);
    List<CandidateSkill> findByCandidateIdAndEvidenceStatus(Long candidateId, SkillEvidenceStatus evidenceStatus);
    void deleteByCandidateId(Long candidateId);
}

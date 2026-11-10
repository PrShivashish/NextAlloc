package in.pragati.repo;

import org.springframework.data.jpa.repository.JpaRepository;
import in.pragati.domain.CandidateSkill;
import in.pragati.domain.enums.SkillEvidenceStatus;
import java.util.List;

public interface CandidateSkillRepository extends JpaRepository<CandidateSkill, Long> {
    List<CandidateSkill> findByCandidateId(Long candidateId);
    List<CandidateSkill> findByCandidateIdIn(List<Long> candidateIds);
    List<CandidateSkill> findByCandidateIdAndConceptId(Long candidateId, String conceptId);
    List<CandidateSkill> findByConceptId(String conceptId);
    List<CandidateSkill> findByCandidateIdAndEvidenceStatus(Long candidateId, SkillEvidenceStatus evidenceStatus);
    void deleteByCandidateId(Long candidateId);
}

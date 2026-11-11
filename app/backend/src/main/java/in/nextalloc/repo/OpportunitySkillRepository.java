package in.nextalloc.repo;

import org.springframework.data.jpa.repository.JpaRepository;
import in.nextalloc.domain.OpportunitySkill;
import java.util.List;

public interface OpportunitySkillRepository extends JpaRepository<OpportunitySkill, Long> {
    List<OpportunitySkill> findByOpportunityId(Long opportunityId);
    List<OpportunitySkill> findByOpportunityIdIn(List<Long> opportunityIds);
    void deleteByOpportunityId(Long opportunityId);
}

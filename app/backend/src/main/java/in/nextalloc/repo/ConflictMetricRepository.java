package in.nextalloc.repo;

import org.springframework.data.jpa.repository.JpaRepository;
import in.nextalloc.domain.ConflictMetric;
import java.util.List;

public interface ConflictMetricRepository extends JpaRepository<ConflictMetric, Long> {
    List<ConflictMetric> findByRunId(Long runId);
    void deleteByRunId(Long runId);
}

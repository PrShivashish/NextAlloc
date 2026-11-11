package in.nextalloc.repo;

import org.springframework.data.jpa.repository.JpaRepository;
import in.nextalloc.domain.GeoMetric;
import java.util.List;

public interface GeoMetricRepository extends JpaRepository<GeoMetric, Long> {
    List<GeoMetric> findByRunId(Long runId);
    void deleteByRunId(Long runId);
}

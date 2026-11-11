package in.nextalloc.repo;

import org.springframework.data.jpa.repository.JpaRepository;
import in.nextalloc.domain.DatasetSnapshot;
import in.nextalloc.domain.enums.ScenarioKey;
import java.util.Optional;

public interface DatasetSnapshotRepository extends JpaRepository<DatasetSnapshot, Long> {
    Optional<DatasetSnapshot> findTopByOrderByIdDesc();
    long countByScenario(ScenarioKey scenario);
}

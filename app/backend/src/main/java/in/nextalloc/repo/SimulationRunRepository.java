package in.nextalloc.repo;

import org.springframework.data.jpa.repository.JpaRepository;
import in.nextalloc.domain.SimulationRun;

public interface SimulationRunRepository extends JpaRepository<SimulationRun, Long> {
    org.springframework.data.domain.Page<SimulationRun> findAllByOrderByCreatedAtDesc(
            org.springframework.data.domain.Pageable pageable);
}

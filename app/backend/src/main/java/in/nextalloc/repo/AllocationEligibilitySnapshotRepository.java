package in.nextalloc.repo;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import in.nextalloc.domain.AllocationEligibilitySnapshot;

public interface AllocationEligibilitySnapshotRepository extends JpaRepository<AllocationEligibilitySnapshot, Long> {
    List<AllocationEligibilitySnapshot> findByRunId(Long runId);
    Optional<AllocationEligibilitySnapshot> findByRunIdAndCandidateId(Long runId, Long candidateId);
}


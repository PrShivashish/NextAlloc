package in.nextalloc.repo;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.query.Param;
import in.nextalloc.domain.Opportunity;
import in.nextalloc.domain.enums.OppStatus;
import in.nextalloc.domain.enums.Qualification;
import in.nextalloc.domain.enums.Sector;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import jakarta.persistence.LockModeType;

public interface OpportunityRepository extends JpaRepository<Opportunity, Long> {
    Page<Opportunity> findByStatus(OppStatus status, Pageable pageable);
    List<Opportunity> findByProviderId(Long providerId);
    List<Opportunity> findAllByStatus(OppStatus status);
    long countByStatus(OppStatus status);
    @org.springframework.data.jpa.repository.Query("select coalesce(sum(o.capacity), 0) from Opportunity o where o.status = :status")
    long sumCapacityByStatus(@Param("status") OppStatus status);
    List<Opportunity> findByStateIn(List<String> states);
    Optional<Opportunity> findByIdAndProviderId(Long id, Long providerId);
    List<Opportunity> findTop20ByOrderByCreatedAtDesc();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT o FROM Opportunity o WHERE o.id = :id")
    Optional<Opportunity> findByIdForUpdate(@Param("id") Long id);
}

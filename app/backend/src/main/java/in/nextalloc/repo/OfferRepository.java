package in.nextalloc.repo;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import in.nextalloc.domain.Offer;
import in.nextalloc.domain.enums.OfferStatus;
import jakarta.persistence.LockModeType;

public interface OfferRepository extends JpaRepository<Offer, Long> {
    List<Offer> findByCandidateId(Long candidateId);
    List<Offer> findByCandidateIdOrderByCreatedAtDesc(Long candidateId);
    Optional<Offer> findByCandidateIdAndRunId(Long candidateId, Long runId);
    List<Offer> findByOpportunityId(Long opportunityId);
    List<Offer> findByOpportunityIdAndStatus(Long opportunityId, OfferStatus status);
    List<Offer> findByRunId(Long runId);
    long countByOpportunityIdAndStatusIn(Long opportunityId, Collection<OfferStatus> statuses);
    long countByCandidateIdAndStatusIn(Long candidateId, Collection<OfferStatus> statuses);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT o FROM Offer o WHERE o.id = :id")
    Optional<Offer> findByIdForUpdate(@Param("id") Long id);

    @Query("SELECT COUNT(o) FROM Offer o WHERE o.opportunityId = :oppId AND o.status IN :statuses")
    long countActiveSeatsForOpportunity(@Param("oppId") Long oppId, @Param("statuses") Collection<OfferStatus> statuses);
}


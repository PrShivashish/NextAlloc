package in.nextalloc.repo;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import in.nextalloc.domain.CandidateProfile;
import in.nextalloc.domain.enums.CandidateState;
import java.util.List;
import java.util.Optional;

public interface CandidateProfileRepository extends JpaRepository<CandidateProfile, Long> {
    Optional<CandidateProfile> findByUserId(Long userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM CandidateProfile p WHERE p.userId = :userId")
    Optional<CandidateProfile> findByUserIdForUpdate(@Param("userId") Long userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM CandidateProfile p WHERE p.id = :id")
    Optional<CandidateProfile> findByIdForUpdate(@Param("id") Long id);

    List<CandidateProfile> findAllByCandidateState(CandidateState state);
    long countByCandidateState(CandidateState state);
}

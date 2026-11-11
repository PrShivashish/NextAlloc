package in.nextalloc.repo;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import in.nextalloc.domain.CandidateAcademicRecord;

public interface CandidateAcademicRecordRepository extends JpaRepository<CandidateAcademicRecord, Long> {
    Optional<CandidateAcademicRecord> findByCandidateId(Long candidateId);
    List<CandidateAcademicRecord> findByCandidateIdIn(Collection<Long> candidateIds);
}


package in.pragati.repo;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import in.pragati.domain.CandidateAcademicRecord;

public interface CandidateAcademicRecordRepository extends JpaRepository<CandidateAcademicRecord, Long> {
    Optional<CandidateAcademicRecord> findByCandidateId(Long candidateId);
}


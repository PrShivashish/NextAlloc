package in.nextalloc.domain;

import java.time.Instant;
import java.time.LocalDate;

import in.nextalloc.domain.enums.EnrollmentStatus;
import in.nextalloc.domain.enums.FinalYearStatus;
import jakarta.persistence.*;

@Entity
@Table(name = "candidate_academic_records",
       uniqueConstraints = @UniqueConstraint(name = "uq_acad_candidate", columnNames = "candidateId"),
       indexes = {@Index(name = "idx_acad_candidate", columnList = "candidateId")})
public class CandidateAcademicRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(nullable = false)
    public Long candidateId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    public EnrollmentStatus enrollmentStatus = EnrollmentStatus.UNKNOWN;

    @Column(length = 120)
    public String degreeProgram;

    @Column(length = 200)
    public String institutionName;

    @Column(length = 30)
    public String institutionAisheCode;

    public Integer currentAcademicYear;

    public Integer programDurationYears;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    public FinalYearStatus finalYearStatus = FinalYearStatus.UNKNOWN;

    public LocalDate expectedCompletionDate;

    @Version
    @Column(nullable = false)
    public Long version;

    @Column(nullable = false)
    public Instant updatedAt = Instant.now();

    public void touch() {
        this.updatedAt = Instant.now();
    }
}

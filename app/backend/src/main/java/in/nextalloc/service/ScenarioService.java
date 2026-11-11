package in.nextalloc.service;

import java.util.Optional;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import in.nextalloc.common.ApiException;
import in.nextalloc.domain.AllocationRun;
import in.nextalloc.domain.DatasetSnapshot;
import in.nextalloc.domain.enums.AuditAction;
import in.nextalloc.domain.enums.RunStatus;
import in.nextalloc.domain.enums.ScenarioKey;
import in.nextalloc.repo.AllocationEligibilitySnapshotRepository;
import in.nextalloc.repo.AllocationRunRepository;
import in.nextalloc.repo.AssignmentRepository;
import in.nextalloc.repo.CandidateAcademicRecordRepository;
import in.nextalloc.repo.CandidateEvidenceRepository;
import in.nextalloc.repo.CandidateRelatedSkillRepository;
import in.nextalloc.repo.DatasetSnapshotRepository;
import in.nextalloc.security.AuthUser;
import in.nextalloc.seed.ScenarioSeeder;
import org.springframework.beans.factory.annotation.Autowired;

/** Scenario lifecycle: load (seed) the active dataset and expose the current snapshot. */
@Service
public class ScenarioService {

    public static final String ERROR_HISTORICAL_RUNS_PRESERVED =
            "Cannot reload or reset demonstration scenarios while historical allocation runs exist. "
            + "Allocation runs and assignments are immutable and preserved for audit. "
            + "To test another scenario, launch an isolated demonstration instance or preserve the existing allocation history.";

    public static final String ERROR_HISTORICAL_DECISIONS_PRESERVED =
            "Cannot reload or reset demonstration scenarios while historical allocation eligibility snapshots exist. "
            + "Eligibility decision records are immutable and protected by referential integrity. "
            + "To test another scenario, launch an isolated demonstration instance or preserve the existing decision ledger.";

    public static final String ERROR_CANDIDATE_EVIDENCE_PRESERVED =
            "Cannot reload or reset demonstration scenarios while applicant academic or NOC evidence exists. "
            + "Candidate-submitted records must not be deleted or orphaned. "
            + "To test another scenario, launch an isolated demonstration instance or preserve applicant records.";

    public static final String ERROR_CANDIDATE_SKILLS_PRESERVED =
            "Cannot reload or reset demonstration scenarios while candidate-submitted related skill records exist. "
            + "Candidate-submitted records must not be deleted or orphaned. "
            + "To test another scenario, launch an isolated demonstration instance or preserve applicant records.";

    private final ScenarioSeeder seeder;
    private final DatasetSnapshotRepository snapshots;
    private final AllocationRunRepository runs;
    private final AllocationEligibilitySnapshotRepository eligSnapshots;
    private final AssignmentRepository assignments;
    private final CandidateEvidenceRepository candidateEvidences;
    private final CandidateAcademicRecordRepository candidateAcademicRecords;
    private final CandidateRelatedSkillRepository candidateRelatedSkills;
    private final AuditService audit;

    @Autowired
    public ScenarioService(ScenarioSeeder seeder, DatasetSnapshotRepository snapshots,
                           AllocationRunRepository runs,
                           AllocationEligibilitySnapshotRepository eligSnapshots,
                           AssignmentRepository assignments,
                           CandidateEvidenceRepository candidateEvidences,
                           CandidateAcademicRecordRepository candidateAcademicRecords,
                           CandidateRelatedSkillRepository candidateRelatedSkills,
                           AuditService audit) {
        this.seeder = seeder;
        this.snapshots = snapshots;
        this.runs = runs;
        this.eligSnapshots = eligSnapshots;
        this.assignments = assignments;
        this.candidateEvidences = candidateEvidences;
        this.candidateAcademicRecords = candidateAcademicRecords;
        this.candidateRelatedSkills = candidateRelatedSkills;
        this.audit = audit;
    }

    public ScenarioService(ScenarioSeeder seeder, DatasetSnapshotRepository snapshots,
                           AllocationRunRepository runs,
                           AllocationEligibilitySnapshotRepository eligSnapshots,
                           AssignmentRepository assignments,
                           CandidateEvidenceRepository candidateEvidences,
                           CandidateAcademicRecordRepository candidateAcademicRecords,
                           AuditService audit) {
        this(seeder, snapshots, runs, eligSnapshots, assignments, candidateEvidences, candidateAcademicRecords, null, audit);
    }

    public Optional<DatasetSnapshot> currentSnapshot() {
        return snapshots.findTopByOrderByIdDesc();
    }

    public void ensureNoActiveRun() {
        recoverStaleRuns();
        long active = runs.findAllByStatusIn(java.util.List.of(RunStatus.QUEUED, RunStatus.RUNNING)).size();
        if (active > 0) {
            throw ApiException.conflict("An allocation is already in progress. Wait for it to finish before changing the scenario.");
        }
    }

    public void ensureSafeToReset() {
        ensureNoActiveRun();
        if (eligSnapshots.count() > 0) {
            throw ApiException.conflict(ERROR_HISTORICAL_DECISIONS_PRESERVED);
        }
        if (runs.count() > 0 || assignments.count() > 0) {
            throw ApiException.conflict(ERROR_HISTORICAL_RUNS_PRESERVED);
        }
        if (candidateEvidences.count() > 0 || candidateAcademicRecords.count() > 0) {
            throw ApiException.conflict(ERROR_CANDIDATE_EVIDENCE_PRESERVED);
        }
        if (candidateRelatedSkills != null && candidateRelatedSkills.count() > 0) {
            throw ApiException.conflict(ERROR_CANDIDATE_SKILLS_PRESERVED);
        }
    }

    /** Marks runs stuck in QUEUED/RUNNING (e.g. after an abrupt restart) as failed. */
    public void recoverStaleRuns() {
        java.time.Instant now = java.time.Instant.now();
        for (AllocationRun r : runs.findAllByStatusIn(java.util.List.of(RunStatus.QUEUED, RunStatus.RUNNING))) {
            java.time.Instant ref = r.startedAt != null ? r.startedAt : r.createdAt;
            long mins = java.time.Duration.between(ref, now).toMinutes();
            if (r.status == RunStatus.QUEUED && mins > 10 || r.status == RunStatus.RUNNING && mins > 15) {
                r.status = RunStatus.FAILED;
                r.errorMessage = "The run did not complete (application restart). Please start a new run.";
                r.completedAt = now;
                runs.save(r);
            }
        }
    }

    @Transactional
    public DatasetSnapshot load(ScenarioKey key, AuthUser actor) {
        ensureSafeToReset();
        seeder.reset();
        DatasetSnapshot snapshot = seeder.seed(key);
        audit.log(actor, AuditAction.SCENARIO_LOADED, "Scenario", key.name(),
                "Scenario '" + in.nextalloc.common.Labels.label(key) + "' loaded with "
                        + snapshot.candidateCount + " candidates and "
                        + snapshot.opportunityCount + " opportunities.", null);
        return snapshot;
    }
}

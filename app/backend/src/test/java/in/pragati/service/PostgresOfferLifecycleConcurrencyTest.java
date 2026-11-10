package in.pragati.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Instant;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.TestPropertySource;

import in.pragati.common.ApiException;
import in.pragati.domain.AllocationRun;
import in.pragati.domain.CandidateProfile;
import in.pragati.domain.Offer;
import in.pragati.domain.Opportunity;
import in.pragati.domain.Provider;
import in.pragati.domain.User;
import in.pragati.domain.enums.CandidateState;
import in.pragati.domain.enums.CandidateStatus;
import in.pragati.domain.enums.LocationType;
import in.pragati.domain.enums.OfferStatus;
import in.pragati.domain.enums.OppStatus;
import in.pragati.domain.enums.Qualification;
import in.pragati.domain.enums.Role;
import in.pragati.domain.enums.RunStatus;
import in.pragati.domain.enums.ScenarioKey;
import in.pragati.domain.enums.Sector;
import in.pragati.repo.AllocationRunRepository;
import in.pragati.repo.CandidateProfileRepository;
import in.pragati.repo.OfferRepository;
import in.pragati.repo.OpportunityRepository;
import in.pragati.repo.ProviderRepository;
import in.pragati.repo.UserRepository;
import in.pragati.security.AuthUser;

@SpringBootTest
@TestPropertySource(properties = {
    "spring.datasource.url=jdbc:postgresql://localhost:5439/test_db_spring",
    "spring.datasource.username=postgres",
    "spring.datasource.password=postgres",
    "spring.datasource.driver-class-name=org.postgresql.Driver",
    "spring.jpa.hibernate.ddl-auto=none",
    "spring.flyway.enabled=true"
})
public class PostgresOfferLifecycleConcurrencyTest {

    @Autowired
    private OfferService offerService;

    @Autowired
    private OfferRepository offerRepo;

    @Autowired
    private CandidateProfileRepository candidateRepo;

    @Autowired
    private OpportunityRepository oppRepo;

    @Autowired
    private AllocationRunRepository runRepo;

    @Autowired
    private UserRepository userRepo;

    @Autowired
    private ProviderRepository providerRepo;

    private User testUser;
    private CandidateProfile candidate;
    private Opportunity opp;
    private AllocationRun run1;
    private AllocationRun run2;

    @BeforeEach
    void setUp() {
        offerRepo.deleteAll();

        testUser = userRepo.findByEmail("pg_test_cand@pragati.local").orElseGet(() -> {
            User u = new User();
            u.email = "pg_test_cand@pragati.local";
            u.name = "Postgres Test Candidate";
            u.role = Role.CANDIDATE;
            u.passwordHash = "$2a$10$abcdef";
            return userRepo.save(u);
        });

        candidate = candidateRepo.findByUserId(testUser.id).orElseGet(() -> {
            CandidateProfile cp = new CandidateProfile();
            cp.userId = testUser.id;
            cp.fullName = "Postgres Test Candidate";
            cp.qualification = Qualification.BACHELORS;
            cp.state = "Karnataka";
            cp.district = "Bengaluru";
            cp.locationType = LocationType.URBAN;
            cp.candidateState = CandidateState.ACTIVE;
            cp.candidateStatus = CandidateStatus.STUDENT;
            return candidateRepo.save(cp);
        });

        User provUser = userRepo.findByEmail("pg_test_prov@pragati.local").orElseGet(() -> {
            User u = new User();
            u.email = "pg_test_prov@pragati.local";
            u.name = "Postgres Provider";
            u.role = Role.PROVIDER;
            u.passwordHash = "$2a$10$abcdef";
            return userRepo.save(u);
        });

        Provider prov = providerRepo.findByUserId(provUser.id).orElseGet(() -> {
            Provider p = new Provider();
            p.userId = provUser.id;
            p.orgName = "Postgres Org";
            p.state = "Karnataka";
            return providerRepo.save(p);
        });

        opp = oppRepo.findAll().stream().findFirst().orElseGet(() -> {
            Opportunity o = new Opportunity();
            o.providerId = prov.id;
            o.title = "Postgres Opportunity";
            o.capacity = 2;
            o.durationMonths = 6;
            o.sector = Sector.SOFTWARE_IT;
            o.state = "Karnataka";
            o.city = "Bengaluru";
            o.minQualification = Qualification.BACHELORS;
            o.status = OppStatus.ACTIVE;
            o.createdAt = Instant.now();
            o.updatedAt = Instant.now();
            return oppRepo.save(o);
        });

        run1 = runRepo.findByRunCode("PG-RUN-1").orElseGet(() -> {
            AllocationRun r = new AllocationRun();
            r.runCode = "PG-RUN-1";
            r.number = 101;
            r.scenario = ScenarioKey.STANDARD_SHOWCASE;
            r.snapshotId = 1L;
            r.policyName = "PG Test Policy 1";
            r.policyKey = "balanced";
            r.policyVersion = "1.0.0";
            r.weightsJson = "{}";
            r.status = RunStatus.COMPLETED;
            r.fullCoverage = false;
            r.createdAt = Instant.now();
            return runRepo.save(r);
        });

        run2 = runRepo.findByRunCode("PG-RUN-2").orElseGet(() -> {
            AllocationRun r = new AllocationRun();
            r.runCode = "PG-RUN-2";
            r.number = 102;
            r.scenario = ScenarioKey.STANDARD_SHOWCASE;
            r.snapshotId = 1L;
            r.policyName = "PG Test Policy 2";
            r.policyKey = "balanced";
            r.policyVersion = "1.0.0";
            r.weightsJson = "{}";
            r.status = RunStatus.COMPLETED;
            r.fullCoverage = false;
            r.createdAt = Instant.now();
            return runRepo.save(r);
        });
    }

    private Offer createOffer(Long runId, Long candId, Long oppId, OfferStatus status) {
        Offer o = new Offer();
        o.runId = runId;
        o.candidateId = candId;
        o.opportunityId = oppId;
        o.status = status;
        o.offeredAt = Instant.now();
        return offerRepo.save(o);
    }

    @Test
    @DisplayName("PostgreSQL native concurrency: Candidate cannot simultaneously accept offers from two distinct runs")
    void testConcurrentSameCandidateDifferentRunsRacePostgres() throws Exception {
        Offer offer1 = createOffer(run1.id, candidate.id, opp.id, OfferStatus.OFFERED);
        Offer offer2 = createOffer(run2.id, candidate.id, opp.id, OfferStatus.OFFERED);

        AuthUser authCand = new AuthUser(testUser.id, testUser.email, testUser.name, "CANDIDATE");

        int threadCount = 2;
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        CountDownLatch startGate = new CountDownLatch(1);
        CountDownLatch endGate = new CountDownLatch(threadCount);

        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger conflictCount = new AtomicInteger(0);

        final Long o1Id = offer1.id;
        final Long o2Id = offer2.id;

        Future<?> f1 = executor.submit(() -> {
            try {
                startGate.await();
                offerService.acceptOffer(authCand, o1Id);
                successCount.incrementAndGet();
            } catch (ApiException e) {
                if (e.getStatus() == HttpStatus.CONFLICT) conflictCount.incrementAndGet();
            } catch (Exception ignored) {}
            finally { endGate.countDown(); }
        });

        Future<?> f2 = executor.submit(() -> {
            try {
                startGate.await();
                offerService.acceptOffer(authCand, o2Id);
                successCount.incrementAndGet();
            } catch (ApiException e) {
                if (e.getStatus() == HttpStatus.CONFLICT) conflictCount.incrementAndGet();
            } catch (Exception ignored) {}
            finally { endGate.countDown(); }
        });

        startGate.countDown();
        boolean completed = endGate.await(10, TimeUnit.SECONDS);
        executor.shutdown();

        assertTrue(completed, "Concurrency barrier timed out on PostgreSQL");
        assertEquals(1, successCount.get(), "Exactly one offer acceptance must succeed on native PostgreSQL");
        assertEquals(1, conflictCount.get(), "The second concurrent attempt must receive HTTP 409 Conflict");

        long activeCount = offerRepo.countByCandidateIdAndStatusIn(candidate.id, Set.of(OfferStatus.ACCEPTED, OfferStatus.JOINED));
        assertEquals(1, activeCount, "Native PostgreSQL database must never contain more than 1 active placement for candidate");
    }
}

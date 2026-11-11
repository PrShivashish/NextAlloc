package in.nextalloc.service;

import static org.junit.jupiter.api.Assertions.*;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import in.nextalloc.common.ApiException;
import in.nextalloc.domain.AllocationRun;
import in.nextalloc.domain.CandidateProfile;
import in.nextalloc.domain.Offer;
import in.nextalloc.domain.Opportunity;
import in.nextalloc.domain.Provider;
import in.nextalloc.domain.User;
import in.nextalloc.domain.enums.CandidateState;
import in.nextalloc.domain.enums.CandidateStatus;
import in.nextalloc.domain.enums.OfferStatus;
import in.nextalloc.domain.enums.OppStatus;
import in.nextalloc.domain.enums.Qualification;
import in.nextalloc.domain.enums.Role;
import in.nextalloc.domain.enums.RunStatus;
import in.nextalloc.domain.enums.ScenarioKey;
import in.nextalloc.domain.enums.Sector;
import in.nextalloc.repo.AllocationRunRepository;
import in.nextalloc.repo.CandidateProfileRepository;
import in.nextalloc.repo.OfferRepository;
import in.nextalloc.repo.OpportunityRepository;
import in.nextalloc.repo.ProviderRepository;
import in.nextalloc.repo.UserRepository;
import in.nextalloc.security.AuthUser;

@SpringBootTest
public class OfferLifecycleConcurrencyTest {

    @Autowired
    private OfferService offerService;

    @Autowired
    private OfferRepository offerRepo;

    @Autowired
    private OpportunityRepository oppRepo;

    @Autowired
    private CandidateProfileRepository profileRepo;

    @Autowired
    private UserRepository userRepo;

    @Autowired
    private ProviderRepository providerRepo;

    @Autowired
    private AllocationRunRepository runRepo;

    @Autowired
    private Flyway flyway;

    private User candUserA;
    private User candUserB;
    private User candUserC;
    private User provUser;
    private User adminUser;

    private CandidateProfile candA;
    private CandidateProfile candB;
    private CandidateProfile candC;
    private Provider provider;
    private AllocationRun testRun;

    @BeforeEach
    void setUp() {
        offerRepo.deleteAll();

        // Admin User
        adminUser = userRepo.findByEmail("admin-offer-test@pragati.local").orElseGet(() -> {
            User u = new User();
            u.email = "admin-offer-test@pragati.local";
            u.name = "Admin Offer Tester";
            u.passwordHash = "hashed";
            u.role = Role.ADMIN;
            return userRepo.save(u);
        });

        // Provider User & Entity
        provUser = userRepo.findByEmail("provider-offer-test@pragati.local").orElseGet(() -> {
            User u = new User();
            u.email = "provider-offer-test@pragati.local";
            u.name = "Provider Lead";
            u.passwordHash = "hashed";
            u.role = Role.PROVIDER;
            return userRepo.save(u);
        });

        provider = providerRepo.findByUserId(provUser.id).orElseGet(() -> {
            Provider p = new Provider();
            p.userId = provUser.id;
            p.orgName = "Apex Technologies";
            p.state = "Karnataka";
            return providerRepo.save(p);
        });

        // Candidates A, B, C
        candUserA = getOrCreateUser("cand-a-offer@pragati.local", "Candidate A", Role.CANDIDATE);
        candA = getOrCreateProfile(candUserA);

        candUserB = getOrCreateUser("cand-b-offer@pragati.local", "Candidate B", Role.CANDIDATE);
        candB = getOrCreateProfile(candUserB);

        candUserC = getOrCreateUser("cand-c-offer@pragati.local", "Candidate C", Role.CANDIDATE);
        candC = getOrCreateProfile(candUserC);

        // Test Run
        testRun = runRepo.findByRunCode("RUN-OFFER-TEST").orElseGet(() -> {
            AllocationRun r = new AllocationRun();
            r.runCode = "RUN-OFFER-TEST";
            r.number = 999;
            r.scenario = ScenarioKey.STANDARD_SHOWCASE;
            r.snapshotId = 1L;
            r.policyName = "Test Policy";
            r.policyKey = "balanced";
            r.policyVersion = "1.0.0";
            r.weightsJson = "{}";
            r.status = RunStatus.COMPLETED;
            return runRepo.save(r);
        });
    }

    private User getOrCreateUser(String email, String name, Role role) {
        return userRepo.findByEmail(email).orElseGet(() -> {
            User u = new User();
            u.email = email;
            u.name = name;
            u.passwordHash = "hashed";
            u.role = role;
            return userRepo.save(u);
        });
    }

    private CandidateProfile getOrCreateProfile(User u) {
        return profileRepo.findByUserId(u.id).orElseGet(() -> {
            CandidateProfile p = new CandidateProfile();
            p.userId = u.id;
            p.fullName = u.name;
            p.qualification = Qualification.BACHELORS;
            p.state = "Karnataka";
            p.candidateState = CandidateState.ACTIVE;
            p.candidateStatus = CandidateStatus.STUDENT;
            return profileRepo.save(p);
        });
    }

    private Opportunity createOpportunity(String title, int capacity) {
        Opportunity o = new Opportunity();
        o.providerId = provider.id;
        o.title = title;
        o.sector = Sector.SOFTWARE_IT;
        o.state = "Karnataka";
        o.city = "Bengaluru";
        o.capacity = capacity;
        o.durationMonths = 6;
        o.minQualification = Qualification.BACHELORS;
        o.status = OppStatus.ACTIVE;
        return oppRepo.save(o);
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

    private AuthUser auth(User u) {
        return new AuthUser(u.id, u.email, u.name, u.role.name());
    }

    @Test
    @DisplayName("V7 migration is successfully applied with offers table")
    void testFlywayV7MigrationApplied() {
        var applied = flyway.info().applied();
        assertTrue(applied.length >= 7, "Flyway schema history must have at least 7 migrations");
        var v7 = java.util.Arrays.stream(applied)
                .filter(m -> m.getVersion() != null && m.getVersion().getVersion().equals("7"))
                .findFirst()
                .orElse(null);
        assertNotNull(v7, "V7 migration must be present in applied migrations");
        assertEquals("offer lifecycle", v7.getDescription());
    }

    @Test
    @DisplayName("Offer lifecycle happy path: OFFERED -> ACCEPTED -> JOINED")
    void testOfferLifecycleHappyPath() {
        Opportunity opp = createOpportunity("Full-Stack Dev Intern", 2);
        Offer offer = createOffer(testRun.id, candA.id, opp.id, OfferStatus.OFFERED);

        // Candidate views offers
        var myOffers = offerService.myOffers(auth(candUserA));
        assertEquals(1, myOffers.size());
        assertEquals(OfferStatus.OFFERED, myOffers.get(0).status());
        assertEquals("Full-Stack Dev Intern", myOffers.get(0).opportunityTitle());

        // Candidate accepts
        var accepted = offerService.acceptOffer(auth(candUserA), offer.id);
        assertEquals(OfferStatus.ACCEPTED, accepted.status());
        assertNotNull(accepted.respondedAt());

        // Provider marks joined
        var joined = offerService.markJoined(auth(provUser), offer.id);
        assertEquals(OfferStatus.JOINED, joined.status());
        assertNotNull(joined.joinedAt());

        // Candidate cannot decline after joining
        assertThrows(ApiException.class, () ->
                offerService.declineOffer(auth(candUserA), offer.id, "Attempted late decline"));
    }

    @Test
    @DisplayName("Offer decline releases seat capacity with audit reason")
    void testOfferDeclineReleasesCapacity() {
        Opportunity opp = createOpportunity("AI Engineer Intern", 1);
        Offer offer = createOffer(testRun.id, candA.id, opp.id, OfferStatus.OFFERED);

        var declined = offerService.declineOffer(auth(candUserA), offer.id, "Accepted another offer");
        assertEquals(OfferStatus.DECLINED, declined.status());
        assertEquals("Accepted another offer", declined.declineReason());
        assertNotNull(declined.respondedAt());

        // Opportunity active seats must be 0
        long activeSeats = offerRepo.countByOpportunityIdAndStatusIn(
                opp.id, List.of(OfferStatus.ACCEPTED, OfferStatus.JOINED));
        assertEquals(0, activeSeats);
    }

    @Test
    @DisplayName("Accept and decline operations are strictly idempotent")
    void testIdempotencyOfAcceptAndDecline() {
        Opportunity opp = createOpportunity("Data Science Intern", 2);
        Offer offer = createOffer(testRun.id, candA.id, opp.id, OfferStatus.OFFERED);

        var acc1 = offerService.acceptOffer(auth(candUserA), offer.id);
        var acc2 = offerService.acceptOffer(auth(candUserA), offer.id);
        assertEquals(OfferStatus.ACCEPTED, acc1.status());
        assertEquals(OfferStatus.ACCEPTED, acc2.status());

        // Re-declining
        var dec1 = offerService.declineOffer(auth(candUserA), offer.id, "Declining after initial accept");
        var dec2 = offerService.declineOffer(auth(candUserA), offer.id, "Declining again");
        assertEquals(OfferStatus.DECLINED, dec1.status());
        assertEquals(OfferStatus.DECLINED, dec2.status());
    }

    @Test
    @DisplayName("Security: Candidate cannot accept or decline another candidate's offer")
    void testForbiddenWhenCandidateRespondsToOthersOffer() {
        Opportunity opp = createOpportunity("Security Analyst Intern", 1);
        Offer offerA = createOffer(testRun.id, candA.id, opp.id, OfferStatus.OFFERED);

        // Candidate B attempts to accept Candidate A's offer
        ApiException ex = assertThrows(ApiException.class, () ->
                offerService.acceptOffer(auth(candUserB), offerA.id));
        assertEquals(403, ex.getStatus().value());

        // Candidate B attempts to decline Candidate A's offer
        ex = assertThrows(ApiException.class, () ->
                offerService.declineOffer(auth(candUserB), offerA.id, "Malicious decline"));
        assertEquals(403, ex.getStatus().value());
    }

    @Test
    @DisplayName("Seat Contention Concurrency Guard: Two candidates compete for last seat (capacity=1), zero oversubscription")
    void testConcurrentSeatContentionPessimisticGuard() throws Exception {
        Opportunity opp = createOpportunity("Single Seat Hotshot Intern", 1);
        Offer offerA = createOffer(testRun.id, candA.id, opp.id, OfferStatus.OFFERED);
        Offer offerB = createOffer(testRun.id, candB.id, opp.id, OfferStatus.OFFERED);

        int threads = 2;
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CountDownLatch readyLatch = new CountDownLatch(threads);
        CountDownLatch startLatch = new CountDownLatch(1);

        List<String> results = Collections.synchronizedList(new ArrayList<>());

        Future<?> f1 = pool.submit(() -> {
            try {
                readyLatch.countDown();
                startLatch.await();
                offerService.acceptOffer(auth(candUserA), offerA.id);
                results.add("A_SUCCESS");
            } catch (ApiException e) {
                results.add("A_CONFLICT_" + e.getStatus().value());
            } catch (Exception e) {
                results.add("A_ERROR_" + e.getMessage());
            }
        });

        Future<?> f2 = pool.submit(() -> {
            try {
                readyLatch.countDown();
                startLatch.await();
                offerService.acceptOffer(auth(candUserB), offerB.id);
                results.add("B_SUCCESS");
            } catch (ApiException e) {
                results.add("B_CONFLICT_" + e.getStatus().value());
            } catch (Exception e) {
                results.add("B_ERROR_" + e.getMessage());
            }
        });

        assertTrue(readyLatch.await(5, TimeUnit.SECONDS), "All threads must be ready");
        startLatch.countDown(); // Fire concurrently!

        f1.get(10, TimeUnit.SECONDS);
        f2.get(10, TimeUnit.SECONDS);
        pool.shutdown();

        // Exactly one must succeed with SUCCESS, and the other must fail with HTTP 409 CONFLICT
        long successCount = results.stream().filter(r -> r.endsWith("_SUCCESS")).count();
        long conflictCount = results.stream().filter(r -> r.contains("_CONFLICT_409")).count();

        assertEquals(1, successCount, "Exactly 1 candidate must successfully secure the single available seat");
        assertEquals(1, conflictCount, "The second candidate must receive an explicit 409 Conflict rejection");

        // Verify database state: exactly 1 ACCEPTED offer and 1 OFFERED offer
        long activeInDb = offerRepo.countByOpportunityIdAndStatusIn(
                opp.id, List.of(OfferStatus.ACCEPTED, OfferStatus.JOINED));
        assertEquals(1, activeInDb, "Active seats in database must strictly not exceed opportunity capacity (1)");
    }

    @Test
    @DisplayName("Cross-Run Inventory Guard: Candidate cannot hold duplicate active placements across runs, and opportunity capacity is globally bounded")
    void testCrossRunCandidateUniquenessAndCapacityProtection() {
        AllocationRun run1 = testRun;
        AllocationRun run2 = runRepo.findByRunCode("RUN-OFFER-TEST-2").orElseGet(() -> {
            AllocationRun r = new AllocationRun();
            r.runCode = "RUN-OFFER-TEST-2";
            r.number = 1000;
            r.scenario = ScenarioKey.STANDARD_SHOWCASE;
            r.snapshotId = 1L;
            r.policyName = "Test Policy 2";
            r.policyKey = "balanced";
            r.policyVersion = "1.0.0";
            r.weightsJson = "{}";
            r.status = RunStatus.COMPLETED;
            return runRepo.save(r);
        });

        Opportunity opp1 = createOpportunity("Cross-Run Opp 1", 1);
        Opportunity opp2 = createOpportunity("Cross-Run Opp 2", 1);

        // 1. Candidate A receives Offer 1 in Run 1 and Offer 2 in Run 2
        Offer offer1 = createOffer(run1.id, candA.id, opp1.id, OfferStatus.OFFERED);
        Offer offer2 = createOffer(run2.id, candA.id, opp2.id, OfferStatus.OFFERED);

        // Candidate A accepts Offer 1 in Run 1 -> Success
        var acc1 = offerService.acceptOffer(auth(candUserA), offer1.id);
        assertEquals(OfferStatus.ACCEPTED, acc1.status());

        // Idempotency: Candidate A accepts Offer 1 again -> Success without error
        var reAcc1 = offerService.acceptOffer(auth(candUserA), offer1.id);
        assertEquals(OfferStatus.ACCEPTED, reAcc1.status());

        // 2. Candidate A attempts to accept Offer 2 in Run 2 while Offer 1 is still active
        // MUST BE REJECTED with 409 Conflict
        ApiException candConflict = assertThrows(ApiException.class, () ->
                offerService.acceptOffer(auth(candUserA), offer2.id));
        assertEquals(409, candConflict.getStatus().value(), "Must reject with 409 Conflict");
        assertTrue(candConflict.getMessage().contains("already holds an active internship placement"));

        // 3. Cross-Run Opportunity Capacity: Opp 1 has capacity 1, already occupied by Candidate A
        // Candidate B receives an offer for Opp 1 in Run 2
        Offer offerOpp1CandB = createOffer(run2.id, candB.id, opp1.id, OfferStatus.OFFERED);
        ApiException oppFullConflict = assertThrows(ApiException.class, () ->
                offerService.acceptOffer(auth(candUserB), offerOpp1CandB.id));
        assertEquals(409, oppFullConflict.getStatus().value(), "Must reject with 409 Conflict");
        assertTrue(oppFullConflict.getMessage().contains("capacity is full"));

        // 4. Candidate A declines Offer 1 -> seat is released and candidate is no longer holding active placement
        offerService.declineOffer(auth(candUserA), offer1.id, "Switching preference");
        assertEquals(0, offerRepo.countByCandidateIdAndStatusIn(candA.id, List.of(OfferStatus.ACCEPTED, OfferStatus.JOINED)));

        // Now Candidate A can successfully accept Offer 2
        var acc2 = offerService.acceptOffer(auth(candUserA), offer2.id);
        assertEquals(OfferStatus.ACCEPTED, acc2.status());

        // And Candidate B can now successfully accept the freed seat on Opp 1
        var accB = offerService.acceptOffer(auth(candUserB), offerOpp1CandB.id);
        assertEquals(OfferStatus.ACCEPTED, accB.status());
    }

    @Test
    @DisplayName("Gate 1 Test 1A: Simultaneous Overlapping Acceptance Race for Same Candidate Across Runs")
    void testConcurrentSameCandidateDifferentRunsRace() throws Exception {
        AllocationRun run1 = testRun;
        AllocationRun run2 = runRepo.findByRunCode("RUN-OFFER-RACE-2").orElseGet(() -> {
            AllocationRun r = new AllocationRun();
            r.runCode = "RUN-OFFER-RACE-2";
            r.number = 1001;
            r.scenario = ScenarioKey.STANDARD_SHOWCASE;
            r.snapshotId = 1L;
            r.policyName = "Test Policy Race";
            r.policyKey = "balanced";
            r.policyVersion = "1.0.0";
            r.weightsJson = "{}";
            r.status = RunStatus.COMPLETED;
            return runRepo.save(r);
        });

        Opportunity oppA = createOpportunity("Concurrent Race Opp A", 5);
        Opportunity oppB = createOpportunity("Concurrent Race Opp B", 5);

        Offer offerRun1 = createOffer(run1.id, candA.id, oppA.id, OfferStatus.OFFERED);
        Offer offerRun2 = createOffer(run2.id, candA.id, oppB.id, OfferStatus.OFFERED);

        int threads = 2;
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CountDownLatch readyLatch = new CountDownLatch(threads);
        CountDownLatch startLatch = new CountDownLatch(1);

        List<String> outcomes = Collections.synchronizedList(new ArrayList<>());

        Future<?> f1 = pool.submit(() -> {
            try {
                readyLatch.countDown();
                startLatch.await();
                offerService.acceptOffer(auth(candUserA), offerRun1.id);
                outcomes.add("OFFER1_SUCCESS");
            } catch (ApiException e) {
                outcomes.add("OFFER1_CONFLICT_" + e.getStatus().value());
            } catch (Exception e) {
                outcomes.add("OFFER1_ERROR_" + e.getMessage());
            }
        });

        Future<?> f2 = pool.submit(() -> {
            try {
                readyLatch.countDown();
                startLatch.await();
                offerService.acceptOffer(auth(candUserA), offerRun2.id);
                outcomes.add("OFFER2_SUCCESS");
            } catch (ApiException e) {
                outcomes.add("OFFER2_CONFLICT_" + e.getStatus().value());
            } catch (Exception e) {
                outcomes.add("OFFER2_ERROR_" + e.getMessage());
            }
        });

        assertTrue(readyLatch.await(5, TimeUnit.SECONDS), "Threads must be aligned at starting gate");
        startLatch.countDown(); // Fire simultaneous transactions!

        f1.get(10, TimeUnit.SECONDS);
        f2.get(10, TimeUnit.SECONDS);
        pool.shutdown();

        // Exactly 1 must succeed, exactly 1 must receive HTTP 409 Conflict
        long successes = outcomes.stream().filter(o -> o.endsWith("_SUCCESS")).count();
        long conflicts = outcomes.stream().filter(o -> o.contains("_CONFLICT_409")).count();

        assertEquals(1, successes, "Exactly 1 offer acceptance must succeed for the candidate: " + outcomes);
        assertEquals(1, conflicts, "The overlapping acceptance must receive an explicit 409 Conflict: " + outcomes);

        // Assert database state: exactly 1 active offer exists for candidate A across all runs
        long activeOffersForCand = offerRepo.countByCandidateIdAndStatusIn(
                candA.id, List.of(OfferStatus.ACCEPTED, OfferStatus.JOINED));
        assertEquals(1, activeOffersForCand, "Candidate cannot have more than 1 active placement in the database");

        // Verify both offer rows still exist (no silent deletion)
        assertTrue(offerRepo.findById(offerRun1.id).isPresent(), "Offer 1 must still exist");
        assertTrue(offerRepo.findById(offerRun2.id).isPresent(), "Offer 2 must still exist");
    }

    @Test
    @DisplayName("Gate 1 Test 1C: Repeated Declines and Re-acceptance Lifecycle Guarantees")
    void testRepeatedDeclinesAndIdempotency() {
        Opportunity opp = createOpportunity("Lifecycle Multi-Decline Opp", 1);
        Offer offer = createOffer(testRun.id, candC.id, opp.id, OfferStatus.OFFERED);

        // Candidate accepts
        offerService.acceptOffer(auth(candUserC), offer.id);
        assertEquals(1, offerRepo.countByOpportunityIdAndStatusIn(opp.id, List.of(OfferStatus.ACCEPTED, OfferStatus.JOINED)));

        // Candidate declines once -> releases seat
        var dec1 = offerService.declineOffer(auth(candUserC), offer.id, "First decline");
        assertEquals(OfferStatus.DECLINED, dec1.status());
        assertEquals(0, offerRepo.countByOpportunityIdAndStatusIn(opp.id, List.of(OfferStatus.ACCEPTED, OfferStatus.JOINED)));

        // Candidate declines again -> idempotent, does NOT decrement or corrupt capacity
        var dec2 = offerService.declineOffer(auth(candUserC), offer.id, "Second decline");
        assertEquals(OfferStatus.DECLINED, dec2.status());
        assertEquals(0, offerRepo.countByOpportunityIdAndStatusIn(opp.id, List.of(OfferStatus.ACCEPTED, OfferStatus.JOINED)));

        // Candidate C can no longer accept this declined offer
        assertThrows(ApiException.class, () ->
                offerService.acceptOffer(auth(candUserC), offer.id));
    }
}

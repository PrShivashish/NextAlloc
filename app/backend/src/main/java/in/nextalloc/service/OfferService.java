package in.nextalloc.service;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Objects;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import in.nextalloc.common.ApiException;
import in.nextalloc.domain.AllocationRun;
import in.nextalloc.domain.Assignment;
import in.nextalloc.domain.CandidateProfile;
import in.nextalloc.domain.Offer;
import in.nextalloc.domain.Opportunity;
import in.nextalloc.domain.Provider;
import in.nextalloc.domain.User;
import in.nextalloc.domain.enums.AssignmentSource;
import in.nextalloc.domain.enums.AuditAction;
import in.nextalloc.domain.enums.OfferStatus;
import in.nextalloc.domain.enums.Role;
import in.nextalloc.repo.AllocationRunRepository;
import in.nextalloc.repo.AssignmentRepository;
import in.nextalloc.repo.CandidateProfileRepository;
import in.nextalloc.repo.OfferRepository;
import in.nextalloc.repo.OpportunityRepository;
import in.nextalloc.repo.ProviderRepository;
import in.nextalloc.repo.UserRepository;
import in.nextalloc.security.AuthUser;

@Service
public class OfferService {

    private static final Logger log = LoggerFactory.getLogger(OfferService.class);

    private final OfferRepository offerRepo;
    private final OpportunityRepository oppRepo;
    private final AssignmentRepository assignmentRepo;
    private final AllocationRunRepository runRepo;
    private final CandidateProfileRepository profileRepo;
    private final ProviderRepository providerRepo;
    private final UserRepository userRepo;
    private final AuditService audit;

    public OfferService(OfferRepository offerRepo,
                        OpportunityRepository oppRepo,
                        AssignmentRepository assignmentRepo,
                        AllocationRunRepository runRepo,
                        CandidateProfileRepository profileRepo,
                        ProviderRepository providerRepo,
                        UserRepository userRepo,
                        AuditService audit) {
        this.offerRepo = offerRepo;
        this.oppRepo = oppRepo;
        this.assignmentRepo = assignmentRepo;
        this.runRepo = runRepo;
        this.profileRepo = profileRepo;
        this.providerRepo = providerRepo;
        this.userRepo = userRepo;
        this.audit = audit;
    }

    public record CandidateOfferView(
            Long id,
            Long runId,
            Long opportunityId,
            String opportunityTitle,
            String providerName,
            String sector,
            String state,
            String city,
            int capacity,
            int durationMonths,
            OfferStatus status,
            Instant offeredAt,
            Instant respondedAt,
            Instant joinedAt,
            String declineReason
    ) { }

    public record ProviderOfferView(
            Long id,
            Long runId,
            Long candidateId,
            String candidateName,
            String qualification,
            OfferStatus status,
            Instant offeredAt,
            Instant respondedAt,
            Instant joinedAt,
            String declineReason
    ) { }

    public record DeclineRequest(String reason) { }

    /**
     * Durable offer generation for all GLOBAL assignments in an allocation run.
     * Idempotent: existing offers for (runId, candidateId) are preserved.
     */
    @Transactional
    public int generateOffersForRun(AllocationRun run) {
        if (run == null || run.id == null) return 0;
        List<Assignment> globalAssignments = assignmentRepo.findByRunIdAndSource(run.id, AssignmentSource.GLOBAL);
        int generated = 0;
        for (Assignment a : globalAssignments) {
            if (offerRepo.findByCandidateIdAndRunId(a.candidateId, run.id).isEmpty()) {
                Offer o = new Offer();
                o.runId = run.id;
                o.candidateId = a.candidateId;
                o.opportunityId = a.opportunityId;
                o.status = OfferStatus.OFFERED;
                o.offeredAt = Instant.now();
                offerRepo.save(o);
                generated++;
            }
        }
        log.info("Generated {} durable offers for allocation run {}", generated, run.runCode);
        return generated;
    }

    /**
     * Get all offers for the current authenticated candidate.
     */
    @Transactional(readOnly = true)
    public List<CandidateOfferView> myOffers(AuthUser me) {
        CandidateProfile p = profileRepo.findByUserId(me.id())
                .orElseThrow(() -> ApiException.badRequest("Candidate profile not found."));
        return offerRepo.findByCandidateIdOrderByCreatedAtDesc(p.id).stream()
                .map(this::toCandidateOfferView)
                .filter(Objects::nonNull)
                .toList();
    }

    /**
     * Accept an offer.
     * Guarded by pessimistic row lock on Opportunity to prevent oversubscription.
     */
    @Transactional
    public CandidateOfferView acceptOffer(AuthUser me, Long offerId) {
        CandidateProfile p = profileRepo.findByUserIdForUpdate(me.id())
                .orElseThrow(() -> ApiException.badRequest("Candidate profile not found."));

        Offer offer = offerRepo.findByIdForUpdate(offerId)
                .orElseThrow(() -> ApiException.notFound("Offer not found: " + offerId));

        if (!offer.candidateId.equals(p.id)) {
            throw ApiException.forbidden("You are not authorized to respond to this offer.");
        }

        // Idempotency: if already accepted, return without double processing
        if (offer.status == OfferStatus.ACCEPTED) {
            return toCandidateOfferView(offer);
        }

        if (offer.status != OfferStatus.OFFERED) {
            throw ApiException.badRequest("Offer cannot be accepted from status: " + offer.status);
        }

        // Concurrency Guard 1: Candidate active-placement uniqueness across operational cycles/runs
        long candidateActive = offerRepo.countByCandidateIdAndStatusIn(
                p.id, Set.of(OfferStatus.ACCEPTED, OfferStatus.JOINED));
        if (candidateActive > 0) {
            throw ApiException.conflict("Candidate already holds an active internship placement. You must decline your existing accepted seat before accepting a new offer.");
        }

        // Concurrency Guard 2: Lock Opportunity and check remaining seat capacity across all runs
        Opportunity opp = oppRepo.findByIdForUpdate(offer.opportunityId)
                .orElseThrow(() -> ApiException.notFound("Opportunity not found: " + offer.opportunityId));

        long activeSeats = offerRepo.countByOpportunityIdAndStatusIn(
                opp.id, Set.of(OfferStatus.ACCEPTED, OfferStatus.JOINED));

        if (activeSeats >= opp.capacity) {
            throw ApiException.conflict("Seat capacity is full for opportunity '" + opp.title + "'.");
        }

        offer.status = OfferStatus.ACCEPTED;
        offer.respondedAt = Instant.now();
        offerRepo.save(offer);

        audit.log(me, AuditAction.ALLOCATION_COMPLETED, "Offer", String.valueOf(offer.id),
                "Candidate " + me.name() + " accepted offer for opportunity " + opp.title, null);

        return toCandidateOfferView(offer);
    }

    /**
     * Decline an offer with optional reason. Releases seat capacity for reallocation.
     */
    @Transactional
    public CandidateOfferView declineOffer(AuthUser me, Long offerId, String reason) {
        CandidateProfile p = profileRepo.findByUserIdForUpdate(me.id())
                .orElseThrow(() -> ApiException.badRequest("Candidate profile not found."));

        Offer offer = offerRepo.findByIdForUpdate(offerId)
                .orElseThrow(() -> ApiException.notFound("Offer not found: " + offerId));

        if (!offer.candidateId.equals(p.id)) {
            throw ApiException.forbidden("You are not authorized to respond to this offer.");
        }

        // Idempotency: if already declined, return current state
        if (offer.status == OfferStatus.DECLINED) {
            return toCandidateOfferView(offer);
        }

        if (offer.status == OfferStatus.JOINED) {
            throw ApiException.badRequest("Cannot decline an internship after joining.");
        }

        offer.status = OfferStatus.DECLINED;
        offer.respondedAt = Instant.now();
        offer.declineReason = reason != null && reason.length() > 500 ? reason.substring(0, 500) : reason;
        offerRepo.save(offer);

        Opportunity opp = oppRepo.findById(offer.opportunityId).orElse(null);
        String oppTitle = opp != null ? opp.title : String.valueOf(offer.opportunityId);

        audit.log(me, AuditAction.ALLOCATION_COMPLETED, "Offer", String.valueOf(offer.id),
                "Candidate " + me.name() + " declined offer for opportunity " + oppTitle + ". Reason: " + reason, null);

        return toCandidateOfferView(offer);
    }

    /**
     * Administrative cancellation of an offer (releases candidate and seat).
     */
    @Transactional
    public CandidateOfferView cancelOffer(AuthUser me, Long offerId, String reason) {
        boolean isAdmin = me != null && me.role() != null && me.role().contains("ADMIN");
        if (!isAdmin) {
            throw ApiException.forbidden("Only administrators can cancel an offer.");
        }

        Offer offer = offerRepo.findByIdForUpdate(offerId)
                .orElseThrow(() -> ApiException.notFound("Offer not found: " + offerId));

        offer.status = OfferStatus.DECLINED;
        offer.respondedAt = Instant.now();
        offer.declineReason = "Administrative withdrawal: " + (reason != null ? reason : "Cancelled by admin");
        offerRepo.save(offer);

        audit.log(me, AuditAction.ALLOCATION_COMPLETED, "Offer", String.valueOf(offer.id),
                "Administrator " + me.name() + " cancelled offer " + offer.id + ". Reason: " + reason, null);

        return toCandidateOfferView(offer);
    }

    /**
     * Mark an accepted candidate as JOINED.
     * Can be invoked by Opportunity Provider or Administrator.
     */
    @Transactional
    public CandidateOfferView markJoined(AuthUser me, Long offerId) {
        Offer offer = offerRepo.findByIdForUpdate(offerId)
                .orElseThrow(() -> ApiException.notFound("Offer not found: " + offerId));

        Opportunity opp = oppRepo.findById(offer.opportunityId)
                .orElseThrow(() -> ApiException.notFound("Opportunity not found."));

        boolean isAdmin = me != null && me.role() != null && me.role().contains("ADMIN");
        boolean isProvider = me != null && me.role() != null && me.role().contains("PROVIDER");

        if (!isAdmin) {
            if (!isProvider) {
                throw ApiException.forbidden("Only providers and administrators can mark joining.");
            }
            Provider provider = providerRepo.findByUserId(me.id())
                    .orElseThrow(() -> ApiException.badRequest("Provider profile not found."));
            if (!opp.providerId.equals(provider.id)) {
                throw ApiException.forbidden("You can only manage joining for your own opportunities.");
            }
        }

        if (offer.status == OfferStatus.JOINED) {
            return toCandidateOfferView(offer);
        }

        if (offer.status != OfferStatus.ACCEPTED) {
            throw ApiException.badRequest("Candidate must accept the offer before joining. Current status: " + offer.status);
        }

        offer.status = OfferStatus.JOINED;
        offer.joinedAt = Instant.now();
        offerRepo.save(offer);

        audit.log(me, AuditAction.ALLOCATION_COMPLETED, "Offer", String.valueOf(offer.id),
                me.name() + " marked candidate ID " + offer.candidateId + " as JOINED for " + opp.title, null);

        return toCandidateOfferView(offer);
    }

    /**
     * Get offers for an opportunity owned by the provider.
     */
    @Transactional(readOnly = true)
    public List<ProviderOfferView> getOpportunityOffers(AuthUser me, Long opportunityId) {
        Opportunity opp = oppRepo.findById(opportunityId)
                .orElseThrow(() -> ApiException.notFound("Opportunity not found: " + opportunityId));

        boolean isAdmin = me != null && me.role() != null && me.role().contains("ADMIN");
        if (!isAdmin) {
            Provider provider = providerRepo.findByUserId(me.id())
                    .orElseThrow(() -> ApiException.badRequest("Provider profile not found."));
            if (!opp.providerId.equals(provider.id)) {
                throw ApiException.forbidden("You do not own this opportunity.");
            }
        }

        return offerRepo.findByOpportunityId(opportunityId).stream()
                .map(this::toProviderOfferView)
                .filter(Objects::nonNull)
                .toList();
    }

    /**
     * Get all offers for a specific allocation run (Admin).
     */
    @Transactional(readOnly = true)
    public List<ProviderOfferView> getRunOffers(Long runId) {
        return offerRepo.findByRunId(runId).stream()
                .map(this::toProviderOfferView)
                .filter(Objects::nonNull)
                .toList();
    }

    private CandidateOfferView toCandidateOfferView(Offer offer) {
        Opportunity opp = oppRepo.findById(offer.opportunityId).orElse(null);
        if (opp == null) return null;
        String providerName = providerRepo.findById(opp.providerId)
                .map(pr -> pr.orgName).orElse("Internship Provider");
        return new CandidateOfferView(
                offer.id,
                offer.runId,
                opp.id,
                opp.title,
                providerName,
                opp.sector != null ? opp.sector.name() : null,
                opp.state,
                opp.city,
                opp.capacity,
                opp.durationMonths,
                offer.status,
                offer.offeredAt,
                offer.respondedAt,
                offer.joinedAt,
                offer.declineReason
        );
    }

    private ProviderOfferView toProviderOfferView(Offer offer) {
        CandidateProfile p = profileRepo.findById(offer.candidateId).orElse(null);
        if (p == null) return null;
        String candidateName = userRepo.findById(p.userId).map(u -> u.name).orElse("Candidate #" + p.id);
        return new ProviderOfferView(
                offer.id,
                offer.runId,
                offer.candidateId,
                candidateName,
                p.qualification != null ? p.qualification.name() : null,
                offer.status,
                offer.offeredAt,
                offer.respondedAt,
                offer.joinedAt,
                offer.declineReason
        );
    }
}

package com.careerops.service;

import org.jspecify.annotations.Nullable;

import com.careerops.exception.ApiException;
import com.careerops.model.Referral;
import com.careerops.repository.ReferralRepository;
import com.careerops.repository.UserRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.NoResultException;
import jakarta.persistence.PersistenceContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

/**
 * Section 9 — Task 96.
 *
 * Handles all Refer-a-Friend business logic:
 * - createReferral → creates DB row + fires invite email
 * - validateToken → returns referrer name for the signup page
 * - onRefereeSignup → called by AuthService on new user creation;
 * marks signed_up → rewarded + fires success email + notification
 * - getMyReferrals → paginated list for the dashboard table
 * - getMyStats → aggregate counts for the dashboard header
 */
@Service
public class ReferralService {

    private static final Logger log = LoggerFactory.getLogger(ReferralService.class);

    /**
     * In-app notification type — mirrors Notification.TYPE_REFERRAL (added in
     * Section 9).
     */
    private static final String NOTIF_TYPE_REFERRAL = "REFERRAL";

    @PersistenceContext
    private EntityManager em;

    private final ReferralRepository referrals;
    private final UserRepository userRepository;
    private final ResendEmailService emailService;
    private final NotificationService notificationService;

    @Value("${app.base.url:https://careersops.app}")
    private String appBaseUrl;

    public ReferralService(
            ReferralRepository referrals,
            UserRepository userRepository,
            ResendEmailService emailService,
            NotificationService notificationService) {
        this.referrals = referrals;
        this.userRepository = userRepository;
        this.emailService = emailService;
        this.notificationService = notificationService;
    }

    // ── Create a referral + send invite email ─────────────────────────────────

    @Transactional(timeout = 10)
    public ReferralDto createReferral(UUID referrerId, String refereeEmail) {
        String normalised = refereeEmail.trim().toLowerCase();

        // Prevent self-referral
        String referrerEmail = resolveEmail(referrerId);
        if (referrerEmail != null && referrerEmail.equalsIgnoreCase(normalised))
            throw new ApiException(HttpStatus.BAD_REQUEST, "You cannot refer yourself.");

        // Prevent duplicate (uq_referrals_referrer_email enforces this at DB level too)
        referrals.findByRefereeEmail(normalised).ifPresent(existing -> {
            if (existing.getReferrerId().equals(referrerId))
                throw new ApiException(HttpStatus.CONFLICT,
                        "You have already sent a referral to " + normalised + ".");
        });

        Referral r = Referral.builder()
                .referrerId(referrerId)
                .refereeEmail(normalised)
                .build();
        r = referrals.save(r);

        // Build the invite link (token-based so each invite is traceable)
        String referralLink = appBaseUrl + "/signup?ref=" + r.getToken();
        String referrerName = resolveDisplayName(referrerId);

        // Send invite email (non-fatal)
        try {
            emailService.sendReferralInviteEmail(referrerName, normalised, referralLink);
        } catch (Exception e) {
            log.warn("sendReferralInviteEmail non-fatal: {}", e.getMessage());
        }

        return toDto(r);
    }

    // ── Validate token on signup page ──────────────────────────────────────────

    /**
     * Returns referrer display name so the signup page can show
     * "You were invited by &lt;name&gt;".
     *
     * The token in the URL may be:
     * (a) A referral row token → from a specific email invite
     * (b) A user UUID → from the generic shareable link
     */
    public Map<String, Object> validateToken(@Nullable UUID token) {
        // (a) look up by referral token first
        Optional<Referral> byToken = referrals.findByToken(token);
        if (byToken.isPresent()) {
            Referral r = byToken.get();
            String name = resolveDisplayName(r.getReferrerId());
            return Map.of(
                    "valid", true,
                    "referrerName", name,
                    "status", r.getStatus(),
                    "tokenType", "invite");
        }

        // (b) treat token as a user UUID (generic shareable link)
        String name = resolveDisplayName(token);
        if (name != null) {
            return Map.of(
                    "valid", true,
                    "referrerName", name,
                    "status", "pending",
                    "tokenType", "link");
        }

        return Map.of("valid", false);
    }

    // ── Called by AuthService on new user creation ──────────────────────────────

    /**
     * Marks a pending referral as signed_up + rewarded when the referee creates an
     * account.
     * If no pending referral exists for this email, this is a no-op.
     *
     * @param refereeEmail the email of the newly registered user
     * @param refereeName  display name of the new user (shown in success email to
     *                     referrer)
     */
    @Transactional(timeout = 10)
    public void onRefereeSignup(String refereeEmail, String refereeName) {
        String normalised = refereeEmail.trim().toLowerCase();

        Optional<Referral> opt = referrals.findPendingByRefereeEmail(normalised);
        if (opt.isEmpty()) {
            log.debug("onRefereeSignup: no pending referral found for {}", normalised);
            return;
        }

        Referral r = opt.get();
        r.setStatus(Referral.STATUS_REWARDED); // signed_up → rewarded in one step (immediate reward)
        r.setRewardedAt(Instant.now());
        referrals.save(r);

        log.info("Referral rewarded: referrerId={} refereeEmail={}", r.getReferrerId(), normalised);

        // Notify referrer (non-fatal)
        try {
            emailService.sendReferralSuccessEmail(r.getReferrerId(), refereeName);
        } catch (Exception e) {
            log.warn("sendReferralSuccessEmail non-fatal: {}", e.getMessage());
        }

        try {
            notificationService.create(
                    r.getReferrerId(),
                    NOTIF_TYPE_REFERRAL,
                    "\uD83C\uDF89 " + refereeName + " joined CareerOps!",
                    refereeName + " signed up using your referral link. You\'ve earned a reward!",
                    Map.of("referralId", r.getId().toString(), "refereeName", refereeName));
        } catch (Exception e) {
            log.warn("Referral notification non-fatal: {}", e.getMessage());
        }
    }

    /** 3.011 — Background processor for the referral outbox. */
    @Transactional(timeout = 10)
    public void processOutbox(com.careerops.repository.ReferralOutboxRepository outboxRepo) {
        List<com.careerops.model.ReferralOutbox> pending = outboxRepo.findByProcessedFalseOrderByCreatedAtAsc();
        if (pending.isEmpty())
            return;

        log.info("Processing {} pending referral outbox entries", pending.size());

        for (com.careerops.model.ReferralOutbox entry : pending) {
            try {
                onRefereeSignup(entry.getRefereeEmail(), entry.getRefereeName());
                entry.setProcessed(true);
                entry.setProcessedAt(Instant.now());
            } catch (Exception e) {
                entry.setAttempts(entry.getAttempts() + 1);
                entry.setLastError(e.getMessage());
                log.error("Failed to process referral outbox entry {}: {}", entry.getId(), e.getMessage());
            }
            outboxRepo.save(entry);
        }
    }

    // ── Get my referrals list ─────────────────────────────────────────────────

    public List<ReferralDto> getMyReferrals(UUID userId) {
        return referrals.findByReferrerIdOrderByCreatedAtDesc(userId)
                .stream().map(this::toDto).toList();
    }

    public Map<String, Object> getMyStats(UUID userId) {
        long sent = referrals.countByReferrerIdAndStatus(userId, Referral.STATUS_PENDING)
                + referrals.countByReferrerIdAndStatus(userId, Referral.STATUS_SIGNED_UP)
                + referrals.countByReferrerIdAndStatus(userId, Referral.STATUS_REWARDED);
        long signedUp = referrals.countByReferrerIdAndStatus(userId, Referral.STATUS_SIGNED_UP)
                + referrals.countByReferrerIdAndStatus(userId, Referral.STATUS_REWARDED);
        long rewarded = referrals.countByReferrerIdAndStatus(userId, Referral.STATUS_REWARDED);
        return Map.of("sent", sent, "signedUp", signedUp, "rewarded", rewarded);
    }

    // ── DTO + Helpers ───────────────────────────────────────────────────────────

    public record ReferralDto(
            UUID id,
            String refereeEmail,
            String status,
            Instant createdAt,
            Instant rewardedAt) {
    }

    private ReferralDto toDto(Referral r) {
        return new ReferralDto(
                r.getId(), r.getRefereeEmail(), r.getStatus(),
                r.getCreatedAt(), r.getRewardedAt());
    }

    /** Resolves display name (first_name + last_name) for a given userId. */
    private @Nullable String resolveDisplayName(@Nullable UUID userId) {
        if (userId == null)
            return null;
        return userRepository.findById(userId)
                .map(u -> {
                    String name = u.getName();
                    return (name != null && !name.isBlank()) ? name : "A CareerOps user";
                })
                .orElse(null);
    }

    /** Resolves email for a given userId (used for self-referral check). */
    private @Nullable String resolveEmail(@Nullable UUID userId) {
        if (userId == null)
            return null;
        return userRepository.findById(userId)
                .map(com.careerops.model.User::getEmail)
                .orElse(null);
    }
}

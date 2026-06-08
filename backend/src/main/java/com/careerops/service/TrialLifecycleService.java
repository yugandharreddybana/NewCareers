package com.careerops.service;

import com.careerops.model.Subscription;
import com.careerops.model.SubscriptionPlan;
import com.careerops.model.SubscriptionStatus;
import com.careerops.model.User;
import com.careerops.repository.SubscriptionRepository;
import com.careerops.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class TrialLifecycleService {

    private static final Logger log = LoggerFactory.getLogger(TrialLifecycleService.class);

    private final SubscriptionRepository subscriptionRepository;
    private final SaasLifecycleTelemetry lifecycleTelemetry;
    private final TrialEmailService trialEmailService;
    private final UserRepository userRepository;

    public TrialLifecycleService(
            SubscriptionRepository subscriptionRepository,
            SaasLifecycleTelemetry lifecycleTelemetry,
            TrialEmailService trialEmailService,
            UserRepository userRepository) {
        this.subscriptionRepository = subscriptionRepository;
        this.lifecycleTelemetry = lifecycleTelemetry;
        this.trialEmailService = trialEmailService;
        this.userRepository = userRepository;
    }

    @Transactional
    public void processDailyTrialLifecycle() {
        sendEndingTomorrowReminders();
        downgradeExpiredTrials();
    }

    void sendEndingTomorrowReminders() {
        LocalDate tomorrow = LocalDate.now(ZoneOffset.UTC).plusDays(1);
        Instant start = tomorrow.atStartOfDay(ZoneOffset.UTC).toInstant();
        Instant end = tomorrow.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();

        List<Subscription> endingTomorrow = subscriptionRepository.findTrialsEndingBetween(
                SubscriptionStatus.TRIALING, start, end);

        for (Subscription subscription : endingTomorrow) {
            resolveOwner(subscription.getOrganizationId()).ifPresent(owner -> {
                try {
                    trialEmailService.sendTrialEndingSoon(
                            owner.getEmail(),
                            firstName(owner),
                            subscription.getTrialEndsAt());
                } catch (Exception ex) {
                    log.warn("Trial ending soon email failed for org {}: {}",
                            subscription.getOrganizationId(), ex.getMessage());
                }
            });
        }

        log.info("Trial ending-soon reminders processed: {}", endingTomorrow.size());
    }

    @Transactional
    public void downgradeExpiredTrials() {
        Instant now = Instant.now();
        List<Subscription> expired = subscriptionRepository.findExpiredTrialing(
                SubscriptionStatus.TRIALING, now);

        for (Subscription subscription : expired) {
            UUID orgId = subscription.getOrganizationId();
            subscription.setStatus(SubscriptionStatus.ACTIVE);
            subscription.setPlan(SubscriptionPlan.FREE);
            subscriptionRepository.save(subscription);

            resolveOwner(orgId).ifPresent(owner -> {
                lifecycleTelemetry.trackTrialEnded(owner.getId(), orgId);
                try {
                    trialEmailService.sendTrialEndedUpgrade(owner.getEmail(), firstName(owner));
                } catch (Exception ex) {
                    log.warn("Trial ended email failed for org {}: {}", orgId, ex.getMessage());
                }
            });
        }

        log.info("Expired trials downgraded: {}", expired.size());
    }

    private Optional<User> resolveOwner(UUID orgId) {
        return lifecycleTelemetry.findOrgOwnerUserId(orgId)
                .flatMap(userRepository::findById);
    }

    private static String firstName(User user) {
        if (user.getName() == null || user.getName().isBlank()) {
            return "there";
        }
        return user.getName().trim().split("\\s+")[0];
    }
}

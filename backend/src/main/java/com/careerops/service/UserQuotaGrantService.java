package com.careerops.service;

import com.careerops.config.QuotaGrantProperties;
import com.careerops.config.QuotaGrantProperties.QuotaGrantEntry;
import com.careerops.model.PlanTier;
import com.careerops.model.PlanTierLimits;
import com.careerops.repository.UserRepository;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Resolves optional per-email or per-user-id quota grants configured in {@code careerops.quota-grants}.
 * Grants apply only to listed accounts — no other user is affected.
 */
@Service
public class UserQuotaGrantService {

    private static final Logger log = LoggerFactory.getLogger(UserQuotaGrantService.class);

    private final QuotaGrantProperties properties;
    private final UserRepository userRepository;
    private Map<String, QuotaGrantEntry> grantsByEmail = Map.of();
    private Map<UUID, QuotaGrantEntry> grantsByUserId = Map.of();

    public UserQuotaGrantService(QuotaGrantProperties properties, UserRepository userRepository) {
        this.properties = properties;
        this.userRepository = userRepository;
    }

    @PostConstruct
    void indexGrants() {
        Map<String, QuotaGrantEntry> emailIndex = new HashMap<>();
        Map<UUID, QuotaGrantEntry> userIdIndex = new HashMap<>();
        for (QuotaGrantEntry entry : properties.getQuotaGrants()) {
            if (entry == null) {
                continue;
            }
            if (entry.getUserId() != null) {
                userIdIndex.putIfAbsent(entry.getUserId(), entry);
            }
            if (entry.getEmail() != null && !entry.getEmail().isBlank()) {
                emailIndex.putIfAbsent(normalizeEmail(entry.getEmail()), entry);
            }
        }
        grantsByEmail = Map.copyOf(emailIndex);
        grantsByUserId = Map.copyOf(userIdIndex);
        log.info(
                "Loaded {} quota grant(s) ({} by user-id, {} by email)",
                grantsByEmail.size() + grantsByUserId.size(),
                grantsByUserId.size(),
                grantsByEmail.size());
    }

    @EventListener(ApplicationReadyEvent.class)
    void logGrantMatchesAtStartup() {
        for (QuotaGrantEntry entry : properties.getQuotaGrants()) {
            if (entry == null) {
                continue;
            }
            if (entry.getUserId() != null) {
                userRepository.findById(entry.getUserId()).ifPresentOrElse(
                        user -> log.info(
                                "Quota grant active for userId={} email={} (jobs/day={}, tokens={}, unlimitedSkills={}, unlimitedAccess={})",
                                user.getId(),
                                user.getEmail(),
                                entry.getJobsPerDay(),
                                entry.getTokenBudget(),
                                entry.isUnlimitedSkills(),
                                entry.isUnlimitedAccess()),
                        () -> log.warn(
                                "Quota grant configured for userId={} but no active user found in database",
                                entry.getUserId()));
            }
            if (entry.getEmail() != null && !entry.getEmail().isBlank()) {
                String normalized = normalizeEmail(entry.getEmail());
                userRepository.findByEmail(normalized).ifPresentOrElse(
                        user -> log.info(
                                "Quota grant active for email={} userId={}",
                                normalized,
                                user.getId()),
                        () -> log.warn(
                                "Quota grant configured for email={} but no active user found in database",
                                normalized));
            }
        }
    }

    public Optional<QuotaGrantEntry> grantForUser(UUID userId) {
        if (userId == null || (grantsByEmail.isEmpty() && grantsByUserId.isEmpty())) {
            return Optional.empty();
        }
        QuotaGrantEntry byId = grantsByUserId.get(userId);
        if (byId != null) {
            return Optional.of(byId);
        }
        return userRepository.findById(userId)
                .map(user -> normalizeEmail(user.getEmail()))
                .flatMap(email -> Optional.ofNullable(grantsByEmail.get(email)));
    }

    public boolean unlimitedAccess(UUID userId) {
        return grantForUser(userId)
                .map(QuotaGrantEntry::isUnlimitedAccess)
                .orElse(false);
    }

    public long tokenBudget(UUID userId, PlanTier tier) {
        if (unlimitedAccess(userId)) {
            return Long.MAX_VALUE;
        }
        return grantForUser(userId)
                .map(QuotaGrantEntry::getTokenBudget)
                .orElseGet(() -> PlanTierLimits.tokenBudget(tier));
    }

    public int jobsPerDay(UUID userId, PlanTier tier) {
        if (unlimitedAccess(userId)) {
            return Integer.MAX_VALUE;
        }
        return grantForUser(userId)
                .map(QuotaGrantEntry::getJobsPerDay)
                .orElseGet(() -> PlanTierLimits.jobCap(tier));
    }

    public boolean unlimitedSkills(UUID userId) {
        if (unlimitedAccess(userId)) {
            return true;
        }
        return grantForUser(userId)
                .map(QuotaGrantEntry::isUnlimitedSkills)
                .orElse(false);
    }

    static String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }
}

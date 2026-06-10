package com.careerops.service;

import com.careerops.config.QuotaGrantProperties;
import com.careerops.model.PlanTier;
import com.careerops.model.User;
import com.careerops.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserQuotaGrantServiceTest {

    @Mock private UserRepository userRepository;

    private UserQuotaGrantService service;
    private final UUID grantedUserId = UUID.randomUUID();
    private final UUID otherUserId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        QuotaGrantProperties properties = new QuotaGrantProperties();
        QuotaGrantProperties.QuotaGrantEntry entry = new QuotaGrantProperties.QuotaGrantEntry();
        entry.setEmail("yugandharreddybana@outlook.com");
        entry.setTokenBudget(500_000L);
        entry.setJobsPerDay(25);
        entry.setUnlimitedSkills(true);
        properties.setQuotaGrants(List.of(entry));

        service = new UserQuotaGrantService(properties, userRepository);
        service.indexGrants();
    }

    @Test
    void grant_appliesOnlyToConfiguredEmail() {
        when(userRepository.findById(grantedUserId)).thenReturn(Optional.of(user("yugandharreddybana@outlook.com")));
        when(userRepository.findById(otherUserId)).thenReturn(Optional.of(user("other@example.com")));

        assertThat(service.tokenBudget(grantedUserId, PlanTier.FREE)).isEqualTo(500_000L);
        assertThat(service.jobsPerDay(grantedUserId, PlanTier.FREE)).isEqualTo(25);
        assertThat(service.unlimitedSkills(grantedUserId)).isTrue();

        assertThat(service.tokenBudget(otherUserId, PlanTier.FREE)).isEqualTo(50_000L);
        assertThat(service.jobsPerDay(otherUserId, PlanTier.FREE)).isEqualTo(5);
        assertThat(service.unlimitedSkills(otherUserId)).isFalse();
    }

    @Test
    void grant_matchesNormalizedEmailCase() {
        when(userRepository.findById(grantedUserId)).thenReturn(Optional.of(user("  YugandharReddyBana@Outlook.COM ")));

        assertThat(service.grantForUser(grantedUserId)).isPresent();
        assertThat(service.jobsPerDay(grantedUserId, PlanTier.FREE)).isEqualTo(25);
    }

    @Test
    void unlimitedAccess_grantsMaxBudgetAndSkills() {
        UUID userId = UUID.randomUUID();
        QuotaGrantProperties properties = new QuotaGrantProperties();
        QuotaGrantProperties.QuotaGrantEntry entry = new QuotaGrantProperties.QuotaGrantEntry();
        entry.setUserId(userId);
        entry.setUnlimitedAccess(true);
        properties.setQuotaGrants(List.of(entry));

        UserQuotaGrantService unlimitedService = new UserQuotaGrantService(properties, userRepository);
        unlimitedService.indexGrants();

        assertThat(unlimitedService.unlimitedAccess(userId)).isTrue();
        assertThat(unlimitedService.tokenBudget(userId, PlanTier.FREE)).isEqualTo(Long.MAX_VALUE);
        assertThat(unlimitedService.jobsPerDay(userId, PlanTier.FREE)).isEqualTo(Integer.MAX_VALUE);
        assertThat(unlimitedService.unlimitedSkills(userId)).isTrue();
    }

    @Test
    void grant_appliesByUserIdWithoutEmailLookup() {
        UUID userId = UUID.randomUUID();
        QuotaGrantProperties properties = new QuotaGrantProperties();
        QuotaGrantProperties.QuotaGrantEntry entry = new QuotaGrantProperties.QuotaGrantEntry();
        entry.setUserId(userId);
        entry.setTokenBudget(500_000L);
        entry.setJobsPerDay(25);
        entry.setUnlimitedSkills(true);
        properties.setQuotaGrants(List.of(entry));

        UserQuotaGrantService byIdService = new UserQuotaGrantService(properties, userRepository);
        byIdService.indexGrants();

        assertThat(byIdService.tokenBudget(userId, PlanTier.FREE)).isEqualTo(500_000L);
        assertThat(byIdService.jobsPerDay(userId, PlanTier.FREE)).isEqualTo(25);
        assertThat(byIdService.unlimitedSkills(userId)).isTrue();
    }

    private static User user(String email) {
        User user = new User();
        user.setEmail(email);
        return user;
    }
}

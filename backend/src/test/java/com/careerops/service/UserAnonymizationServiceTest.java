package com.careerops.service;

import com.careerops.model.User;
import com.careerops.model.UserProfile;
import com.careerops.repository.AuditLogRepository;
import com.careerops.repository.UserProfileRepository;
import com.careerops.repository.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserAnonymizationServiceTest {

    @Mock UserRepository users;
    @Mock UserProfileRepository profiles;
    @Mock AuthService authService;
    @Mock CvService cvService;
    @Mock SupabaseStorageService storage;
    @Mock AuditLogService audit;
    @Mock AuditLogRepository auditLogs;
    @Mock HttpServletRequest request;

    @InjectMocks UserAnonymizationService service;

    private final UUID userId = UUID.randomUUID();

    @Test
    @DisplayName("anonymizeAndDelete revokes tokens first, deletes CVs, scrubs PII, audits ACCOUNT_DELETED_GDPR")
    void anonymizeAndDelete() {
        User user = User.builder()
                .id(userId)
                .name("Alice")
                .email("alice@example.com")
                .username("alice")
                .passwordHash("hash")
                .googleSub("google-sub")
                .build();
        UserProfile profile = UserProfile.builder()
                .userId(userId)
                .location("Dublin")
                .targetRoles(new String[] {"Engineer"})
                .techStack(new String[] {"Java"})
                .salaryMin(50_000)
                .salaryMax(80_000)
                .goalTitle("Engineer")
                .build();

        when(users.findById(userId)).thenReturn(Optional.of(user));
        when(profiles.findByUserId(userId)).thenReturn(Optional.of(profile));
        when(users.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        when(profiles.save(any(UserProfile.class))).thenAnswer(inv -> inv.getArgument(0));

        service.anonymizeAndDelete(userId, request);

        InOrder order = inOrder(authService, cvService, profiles, users, audit, auditLogs, storage);
        order.verify(authService).revokeAllTokensForUser(userId);
        order.verify(cvService).deleteAllForUser(userId);
        order.verify(profiles).save(any(UserProfile.class));
        order.verify(users).save(any(User.class));
        order.verify(audit).log(eq(userId), eq("ACCOUNT_DELETED_GDPR"), eq(request), any(Map.class));
        order.verify(auditLogs).nullifyUserId(userId);
        order.verify(storage).purgeUserFiles(userId);

        ArgumentCaptor<User> userCap = ArgumentCaptor.forClass(User.class);
        verify(users).save(userCap.capture());
        User saved = userCap.getValue();
        assertThat(saved.getEmail()).isEqualTo("deleted_" + userId + "@redacted.invalid");
        assertThat(saved.getName()).isEqualTo("Deleted User");
        assertThat(saved.getPasswordHash()).isNull();
        assertThat(saved.getGoogleSub()).isNull();
        assertThat(saved.getDeletedAt()).isNotNull();

        ArgumentCaptor<UserProfile> profileCap = ArgumentCaptor.forClass(UserProfile.class);
        verify(profiles).save(profileCap.capture());
        UserProfile scrubbed = profileCap.getValue();
        assertThat(scrubbed.getLocation()).isNull();
        assertThat(scrubbed.getTargetRoles()).isNull();
        assertThat(scrubbed.getTechStack()).isNull();
        assertThat(scrubbed.getSalaryMin()).isNull();
        assertThat(scrubbed.getSalaryMax()).isNull();

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> metaCap = ArgumentCaptor.forClass(Map.class);
        verify(audit).log(eq(userId), eq("ACCOUNT_DELETED_GDPR"), eq(request), metaCap.capture());
        assertThat(metaCap.getValue()).containsKey("deletedAt");
        assertThat(metaCap.getValue().get("deletedAt")).isEqualTo(saved.getDeletedAt().toString());
    }
}

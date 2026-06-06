package com.careerops.service;

import com.careerops.model.AuditLog;
import com.careerops.model.User;
import com.careerops.model.UserConsent;
import com.careerops.model.UserConsent.ConsentType;
import com.careerops.model.UserCv;
import com.careerops.model.UserJob;
import com.careerops.model.UserProfile;
import com.careerops.repository.AuditLogRepository;
import com.careerops.repository.UserConsentRepository;
import com.careerops.repository.UserCvRepository;
import com.careerops.repository.UserJobRepository;
import com.careerops.repository.UserProfileRepository;
import com.careerops.repository.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GdprExportServiceTest {

    @Mock UserRepository users;
    @Mock UserProfileRepository profiles;
    @Mock UserCvRepository cvs;
    @Mock UserConsentRepository consents;
    @Mock UserJobRepository userJobs;
    @Mock AuditLogRepository auditLogs;
    @Mock AuditLogService audit;
    @Mock HttpServletRequest request;
    @Spy ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();

    @InjectMocks GdprExportService service;

    private final UUID userId = UUID.randomUUID();

    @Test
    @DisplayName("exportUserDataJson assembles all domains and audits DATA_EXPORT_REQUESTED")
    void exportUserDataJson() throws Exception {
        User user = User.builder()
                .id(userId)
                .name("Alice")
                .email("alice@example.com")
                .username("alice")
                .passwordHash("must-not-export")
                .createdAt(Instant.parse("2026-01-01T00:00:00Z"))
                .build();
        UserProfile profile = UserProfile.builder()
                .userId(userId)
                .location("Dublin")
                .onboarded(true)
                .build();
        UserCv cv = UserCv.builder()
                .id(UUID.randomUUID())
                .userId(userId)
                .fileName("cv.pdf")
                .storagePath("/cvs/cv.pdf")
                .parsedText("Experience")
                .fileData(new byte[] {1, 2, 3})
                .build();
        UserConsent consent = UserConsent.builder()
                .userId(userId)
                .consentType(ConsentType.AI_PROCESSING)
                .version("v1.0")
                .accepted(true)
                .acceptedAt(Instant.now())
                .build();
        UserJob job = UserJob.builder().userId(userId).jobId(UUID.randomUUID()).status("Saved").build();
        AuditLog auditRow = AuditLog.builder()
                .userId(userId)
                .action("LOGIN")
                .createdAt(Instant.now())
                .build();

        when(users.findById(userId)).thenReturn(Optional.of(user));
        when(profiles.findByUserId(userId)).thenReturn(Optional.of(profile));
        when(cvs.findByUserIdOrderByUploadedAtDesc(userId)).thenReturn(List.of(cv));
        when(userJobs.findByUserIdOrderByDeliveredAtDesc(userId)).thenReturn(List.of(job));
        when(auditLogs.findByUserIdOrderByCreatedAtDesc(userId)).thenReturn(List.of(auditRow));
        when(consents.findAllByUserIdOrderByAcceptedAtDesc(userId)).thenReturn(List.of(consent));

        byte[] json = service.exportUserDataJson(userId, request);
        JsonNode root = objectMapper.readTree(json);

        assertThat(root.has("exportedAt")).isTrue();
        assertThat(root.has("user")).isTrue();
        assertThat(root.has("profile")).isTrue();
        assertThat(root.get("cvs")).isNotEmpty();
        assertThat(root.get("jobs")).isNotEmpty();
        assertThat(root.get("auditLogs")).isNotEmpty();
        assertThat(root.get("consents")).isNotEmpty();
        assertThat(root.get("user").has("passwordHash")).isFalse();
        assertThat(root.get("cvs").get(0).has("fileData")).isFalse();
        assertThat(root.get("cvs").get(0).get("fileName").asText()).isEqualTo("cv.pdf");

        verify(audit).log(eq(userId), eq("DATA_EXPORT_REQUESTED"), eq(request), org.mockito.ArgumentMatchers.anyMap());
    }
}

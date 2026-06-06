package com.careerops.dto;

import com.careerops.model.AuditLog;
import com.careerops.model.User;
import com.careerops.model.UserConsent;
import com.careerops.model.UserCv;
import com.careerops.model.UserJob;
import com.careerops.model.UserProfile;
import com.fasterxml.jackson.databind.JsonNode;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * GDPR portability export payload. Excludes secrets ({@code passwordHash}, {@code googleSub})
 * and heavy binary fields ({@code UserCv.fileData}).
 */
public final class GdprExportDtos {

    private GdprExportDtos() {}

    public record GdprUserDataExport(
            Instant exportedAt,
            UserExport user,
            UserProfile profile,
            List<UserCvExport> cvs,
            List<UserJob> jobs,
            List<AuditLog> auditLogs,
            List<UserConsent> consents
    ) {}

    public record UserExport(
            UUID id,
            String name,
            String username,
            String email,
            User.AuthProvider authProvider,
            User.Role role,
            String locale,
            Instant createdAt,
            Instant emailVerifiedAt,
            Instant lastLoginAt
    ) {
        public static UserExport from(User user) {
            return new UserExport(
                    user.getId(),
                    user.getName(),
                    user.getUsername(),
                    user.getEmail(),
                    user.getAuthProvider(),
                    user.getRole(),
                    user.getLocale(),
                    user.getCreatedAt(),
                    user.getEmailVerifiedAt(),
                    user.getLastLoginAt());
        }
    }

    public record UserCvExport(
            UUID id,
            UUID userId,
            String fileName,
            String storagePath,
            String fileType,
            String parsedText,
            String cvMarkdown,
            JsonNode vectorJson,
            Instant uploadedAt,
            Boolean isActive
    ) {
        public static UserCvExport from(UserCv cv) {
            return new UserCvExport(
                    cv.getId(),
                    cv.getUserId(),
                    cv.getFileName(),
                    cv.getStoragePath(),
                    cv.getFileType(),
                    cv.getParsedText(),
                    cv.getCvMarkdown(),
                    cv.getVectorJson(),
                    cv.getUploadedAt(),
                    cv.getIsActive());
        }
    }
}

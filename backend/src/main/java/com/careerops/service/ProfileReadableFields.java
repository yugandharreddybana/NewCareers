package com.careerops.service;

import com.careerops.model.UserProfile;
import com.careerops.security.AesFieldEncryptor;
import com.careerops.security.AesGcmCodec;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * Decrypts profile PII fields for AI prompts and user-facing text.
 * Returns null when decryption fails or the value still looks encrypted.
 */
@Component
public class ProfileReadableFields {

    private final AesFieldEncryptor fieldEncryptor;

    public ProfileReadableFields(AesFieldEncryptor fieldEncryptor) {
        this.fieldEncryptor = fieldEncryptor;
    }

    public String goalTitle(UserProfile profile) {
        return readable(profile, profile != null ? profile.getGoalTitle() : null);
    }

    public String location(UserProfile profile) {
        return readable(profile, profile != null ? profile.getLocation() : null);
    }

    public String goalLocation(UserProfile profile) {
        return readable(profile, profile != null ? profile.getGoalLocation() : null);
    }

    private String readable(UserProfile profile, String raw) {
        if (profile == null || raw == null || raw.isBlank()) {
            return null;
        }
        UUID userId = profile.getUserId();
        String decrypted = userId != null ? fieldEncryptor.decrypt(raw, userId) : raw;
        if (decrypted == null || decrypted.isBlank()) {
            return null;
        }
        if (AesGcmCodec.looksEncrypted(decrypted.trim())) {
            return null;
        }
        return decrypted.trim();
    }
}

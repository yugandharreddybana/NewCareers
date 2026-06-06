package com.careerops.persistence;

import com.careerops.model.User;
import com.careerops.model.UserProfile;
import com.careerops.security.AesFieldEncryptor;
import com.careerops.security.AesGcmCodec;
import com.careerops.service.UserKeyService;
import jakarta.persistence.PostLoad;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
public class FieldEncryptionListener {

    /** Prevents Hibernate preUpdate → key provision → flush → preUpdate recursion. */
    private static final ThreadLocal<Boolean> ENCRYPTING = ThreadLocal.withInitial(() -> false);

    private static AesFieldEncryptor encryptor;
    private static UserKeyService userKeyService;

    @Autowired
    void setDependencies(AesFieldEncryptor aesFieldEncryptor, UserKeyService userKeyServiceBean) {
        encryptor = aesFieldEncryptor;
        userKeyService = userKeyServiceBean;
    }

    @PrePersist
    @PreUpdate
    public void encryptFields(Object entity) {
        if (encryptor == null || userKeyService == null || Boolean.TRUE.equals(ENCRYPTING.get())) {
            return;
        }
        ENCRYPTING.set(true);
        try {
            if (entity instanceof User user) {
                encryptUserFields(user);
            } else if (entity instanceof UserProfile profile) {
                encryptProfileFields(profile);
            }
        } finally {
            ENCRYPTING.set(false);
        }
    }

    @PostLoad
    public void decryptFields(Object entity) {
        if (encryptor == null) {
            return;
        }
        if (entity instanceof User user) {
            decryptUserFields(user);
        } else if (entity instanceof UserProfile profile) {
            decryptProfileFields(profile);
        }
    }

    private void encryptUserFields(User user) {
        UUID userId = user.getId();
        if (userId == null) {
            return;
        }
        userKeyService.ensureProvisioned(userId);
        user.setName(encryptIfPlaintext(user.getName(), userId));
    }

    private void decryptUserFields(User user) {
        UUID userId = user.getId();
        if (userId == null) {
            return;
        }
        user.setName(encryptor.decrypt(user.getName(), userId));
    }

    private void encryptProfileFields(UserProfile profile) {
        UUID userId = profile.getUserId();
        if (userId == null) {
            return;
        }
        userKeyService.ensureProvisioned(userId);
        profile.setLocation(encryptIfPlaintext(profile.getLocation(), userId));
        profile.setGoalTitle(encryptIfPlaintext(profile.getGoalTitle(), userId));
        profile.setGoalLocation(encryptIfPlaintext(profile.getGoalLocation(), userId));
    }

    private void decryptProfileFields(UserProfile profile) {
        UUID userId = profile.getUserId();
        if (userId == null) {
            return;
        }
        profile.setLocation(encryptor.decrypt(profile.getLocation(), userId));
        profile.setGoalTitle(encryptor.decrypt(profile.getGoalTitle(), userId));
        profile.setGoalLocation(encryptor.decrypt(profile.getGoalLocation(), userId));
    }

    private String encryptIfPlaintext(String value, UUID userId) {
        if (value == null || value.isBlank() || AesGcmCodec.looksEncrypted(value)) {
            return value;
        }
        return encryptor.encrypt(value, userId);
    }
}

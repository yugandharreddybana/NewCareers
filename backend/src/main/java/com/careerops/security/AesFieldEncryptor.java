package com.careerops.security;

import com.careerops.service.UserKeyService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.spec.SecretKeySpec;
import java.util.UUID;

/**
 * Per-user AES-256-GCM field encryption using DEKs from {@link UserKeyService}.
 * Legacy rows encrypted with the global APP_ENCRYPTION_KEY decrypt via fallback.
 */
@Component
public class AesFieldEncryptor {

    private final UserKeyService userKeyService;
    private final SecretKeySpec legacyKey;

    @Autowired
    public AesFieldEncryptor(UserKeyService userKeyService,
                             @Value("${app.encryption.key:}") String encodedLegacyKey) {
        this.userKeyService = userKeyService;
        this.legacyKey = decodeLegacyKeyOptional(encodedLegacyKey);
    }

    /** Test-only factory — not a Spring bean constructor. */
    public static AesFieldEncryptor forTest(UserKeyService userKeyService, byte[] legacyKeyBytes) {
        SecretKeySpec legacy = legacyKeyBytes != null ? AesGcmCodec.secretKey(legacyKeyBytes) : null;
        return new AesFieldEncryptor(userKeyService, legacy);
    }

    private AesFieldEncryptor(UserKeyService userKeyService, SecretKeySpec legacyKey) {
        this.userKeyService = userKeyService;
        this.legacyKey = legacyKey;
    }

    public String encrypt(String plaintext, UUID userId) {
        if (plaintext == null || plaintext.isBlank()) {
            return null;
        }
        if (userId == null) {
            throw new IllegalArgumentException("userId is required for field encryption");
        }
        SecretKeySpec dek = AesGcmCodec.secretKey(userKeyService.getUserDek(userId));
        return AesGcmCodec.encryptUtf8(dek, plaintext);
    }

    public String decrypt(String ciphertext, UUID userId) {
        if (ciphertext == null || ciphertext.isBlank()) {
            return null;
        }
        if (!AesGcmCodec.looksEncrypted(ciphertext)) {
            return ciphertext;
        }
        if (userId != null) {
            try {
                userKeyService.ensureProvisioned(userId);
                SecretKeySpec dek = AesGcmCodec.secretKey(userKeyService.getUserDek(userId));
                return AesGcmCodec.decryptUtf8(dek, ciphertext);
            } catch (AesGcmCodec.DecryptionFailedException | IllegalStateException ignored) {
                // fall through to legacy key
            }
        }
        if (legacyKey != null) {
            try {
                return AesGcmCodec.decryptUtf8(legacyKey, ciphertext);
            } catch (AesGcmCodec.DecryptionFailedException e) {
                return ciphertext;
            }
        }
        return ciphertext;
    }

    private static SecretKeySpec decodeLegacyKeyOptional(String encodedKey) {
        if (encodedKey == null || encodedKey.isBlank()) {
            return null;
        }
        return AesGcmCodec.decodeKey(encodedKey, "APP_ENCRYPTION_KEY (app.encryption.key)");
    }
}

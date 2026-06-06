package com.careerops.service;

import com.careerops.model.UserKey;
import com.careerops.repository.UserKeyRepository;
import com.careerops.security.AesGcmCodec;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.spec.SecretKeySpec;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.UUID;

@Service
public class UserKeyService {

    private final UserKeyRepository userKeys;
    private final SecretKeySpec masterKek;

    @Autowired
    public UserKeyService(UserKeyRepository userKeys,
                          @Value("${app.master.kek}") String encodedMasterKek) {
        this.userKeys = userKeys;
        this.masterKek = AesGcmCodec.decodeKey(encodedMasterKek, "APP_MASTER_KEK (app.master.kek)");
    }

    /** Test-only factory — not a Spring bean constructor. */
    static UserKeyService forTest(UserKeyRepository userKeys, byte[] masterKekBytes) {
        return new UserKeyService(userKeys, AesGcmCodec.secretKey(masterKekBytes));
    }

    private UserKeyService(UserKeyRepository userKeys, SecretKeySpec masterKek) {
        this.userKeys = userKeys;
        this.masterKek = masterKek;
    }

    @Transactional
    public void provisionForUser(UUID userId) {
        if (userId == null) {
            throw new IllegalArgumentException("userId is required");
        }
        if (userKeys.existsByUserId(userId)) {
            return;
        }
        byte[] dek = generateDek();
        String wrapped = AesGcmCodec.encryptBytes(masterKek, dek);
        userKeys.save(UserKey.builder()
                .userId(userId)
                .encryptedDek(wrapped)
                .createdAt(Instant.now())
                .build());
    }

    @Transactional
    public void ensureProvisioned(UUID userId) {
        provisionForUser(userId);
    }

    @Transactional(readOnly = true)
    public byte[] getUserDek(UUID userId) {
        if (userId == null) {
            throw new IllegalArgumentException("userId is required");
        }
        UserKey row = userKeys.findById(userId)
                .orElseThrow(() -> new IllegalStateException("No encryption key for user " + userId));
        return AesGcmCodec.decryptBytes(masterKek, row.getEncryptedDek());
    }

    private static byte[] generateDek() {
        byte[] dek = new byte[AesGcmCodec.KEY_LENGTH_BYTES];
        try {
            SecureRandom.getInstanceStrong().nextBytes(dek);
        } catch (Exception e) {
            new SecureRandom().nextBytes(dek);
        }
        return dek;
    }
}

package com.careerops.service;

import com.careerops.dto.SecurityDtos.TwoFactorEnableResponse;
import com.careerops.dto.SecurityDtos.TwoFactorSetupResponse;
import com.careerops.dto.SecurityDtos.TwoFactorStatusResponse;
import com.careerops.exception.ApiException;
import com.careerops.model.User;
import com.careerops.model.UserTwoFactor;
import com.careerops.repository.UserRepository;
import com.careerops.repository.UserTwoFactorRepository;
import com.careerops.security.AesGcmCodec;
import com.careerops.security.JwtService;
import dev.samstevens.totp.code.*;
import dev.samstevens.totp.qr.QrData;
import dev.samstevens.totp.secret.DefaultSecretGenerator;
import dev.samstevens.totp.secret.SecretGenerator;
import dev.samstevens.totp.time.SystemTimeProvider;
import dev.samstevens.totp.time.TimeProvider;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.spec.SecretKeySpec;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class TwoFactorService {

    private final UserTwoFactorRepository repo;
    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final AuditLogService audit;
    private final JwtService jwt;

    @Value("${security.two-factor.rollout-enabled:false}")
    private boolean rolloutEnabled;

    @Value("${app.master.kek:}")
    private String masterKekEncoded;

    @Value("${spring.application.name:CareerOps}")
    private String issuerName;

    private final SecretGenerator secretGenerator = new DefaultSecretGenerator();
    private final TimeProvider timeProvider = new SystemTimeProvider();
    private final CodeVerifier verifier = new DefaultCodeVerifier(new DefaultCodeGenerator(), timeProvider);

    @Transactional(readOnly = true)
    public TwoFactorStatusResponse getStatus(UUID userId) {
        UserTwoFactor row = repo.findById(userId).orElse(null);
        boolean enabled = row != null && row.isEnabled();
        Instant enabledAt = row != null ? row.getEnabledAt() : null;
        return new TwoFactorStatusResponse(enabled, rolloutEnabled, enabledAt);
    }

    @Transactional(readOnly = true)
    public boolean isEnabled(UUID userId) {
        return repo.findById(userId).map(UserTwoFactor::isEnabled).orElse(false);
    }

    @Transactional
    public TwoFactorSetupResponse beginSetup(UUID userId) {
        assertRolloutEnabled();
        User user = users.findById(userId)
                .orElseThrow(() -> new IllegalStateException("User not found"));
        UserTwoFactor row = repo.findById(userId).orElseGet(() -> UserTwoFactor.builder().userId(userId).build());
        if (row.isEnabled()) {
            throw ApiException.badRequest("Two-factor authentication is already enabled");
        }

        String secret = secretGenerator.generate();
        row.setPendingSecretEncrypted(encrypt(secret));
        repo.save(row);

        String otpauthUri = new QrData.Builder()
                .label(user.getEmail())
                .secret(secret)
                .issuer(issuerName)
                .algorithm(HashingAlgorithm.SHA1)
                .digits(6)
                .period(30)
                .build()
                .getUri();

        return new TwoFactorSetupResponse(otpauthUri, secret);
    }

    @Transactional
    public TwoFactorEnableResponse confirmSetup(UUID userId, String code, HttpServletRequest request) {
        assertRolloutEnabled();
        UserTwoFactor row = repo.findById(userId)
                .orElseThrow(() -> ApiException.badRequest("Start setup before enabling two-factor authentication"));
        if (row.isEnabled()) {
            throw ApiException.badRequest("Two-factor authentication is already enabled");
        }
        String pending = decrypt(row.getPendingSecretEncrypted());
        if (pending == null || pending.isBlank()) {
            throw ApiException.badRequest("Start setup before enabling two-factor authentication");
        }
        if (!verifier.isValidCode(pending, code)) {
            throw ApiException.badRequest("Invalid verification code");
        }

        BackupBundle backup = generateBackupCodes();
        row.setSecretEncrypted(encrypt(pending));
        row.setPendingSecretEncrypted(null);
        row.setEnabledAt(Instant.now());
        row.setBackupCodesHash(backup.hashes());
        repo.save(row);

        audit.log(userId, "TWO_FACTOR_ENABLED", request);

        return new TwoFactorEnableResponse(backup.plain());
    }

    @Transactional
    public void disable(UUID userId, String currentPassword, HttpServletRequest request) {
        User user = users.findById(userId)
                .orElseThrow(() -> new IllegalStateException("User not found"));
        if (user.getPasswordHash() == null || !encoder.matches(currentPassword, user.getPasswordHash())) {
            throw ApiException.badRequest("Incorrect current password");
        }
        repo.findById(userId).ifPresent(row -> {
            repo.delete(row);
            audit.log(userId, "TWO_FACTOR_DISABLED", request);
        });
    }

    public String issueChallengeToken(UUID userId, boolean rememberMe) {
        return jwt.issueTwoFactorChallenge(userId.toString(), rememberMe);
    }

    public record TwoFactorLoginVerification(UUID userId, boolean rememberMe) {}

    @Transactional
    public TwoFactorLoginVerification verifyLoginCode(String challengeToken, String code) {
        UUID userId = jwt.parseTwoFactorChallengeUserId(challengeToken);
        boolean rememberMe = jwt.parseTwoFactorRememberMe(challengeToken);
        UserTwoFactor row = repo.findById(userId)
                .orElseThrow(() -> ApiException.unauthorized("Two-factor authentication is not configured"));
        if (!row.isEnabled()) {
            throw ApiException.unauthorized("Two-factor authentication is not enabled");
        }
        String secret = decrypt(row.getSecretEncrypted());
        if (secret == null) {
            throw ApiException.unauthorized("Two-factor authentication is not configured");
        }
        if (verifier.isValidCode(secret, code)) {
            return new TwoFactorLoginVerification(userId, rememberMe);
        }
        if (consumeBackupCode(row, code)) {
            repo.save(row);
            return new TwoFactorLoginVerification(userId, rememberMe);
        }
        throw ApiException.unauthorized("Invalid verification code");
    }

    private boolean consumeBackupCode(UserTwoFactor row, String code) {
        List<String> hashes = row.getBackupCodesHash();
        if (hashes == null || hashes.isEmpty()) {
            return false;
        }
        String normalized = code.replace("-", "").trim().toUpperCase();
        for (int i = 0; i < hashes.size(); i++) {
            String stored = hashes.get(i);
            if (stored != null && encoder.matches(normalized, stored)) {
                List<String> next = new ArrayList<>(hashes);
                next.remove(i);
                row.setBackupCodesHash(next);
                return true;
            }
        }
        return false;
    }

    private BackupBundle generateBackupCodes() {
        SecureRandom random = new SecureRandom();
        List<String> hashes = new ArrayList<>();
        List<String> plain = new ArrayList<>();
        for (int i = 0; i < 8; i++) {
            String code = randomBackupCode(random);
            plain.add(code);
            hashes.add(encoder.encode(code));
        }
        return new BackupBundle(plain, hashes);
    }

    private record BackupBundle(List<String> plain, List<String> hashes) {}

    private static String randomBackupCode(SecureRandom random) {
        int value = random.nextInt(1_0000_0000);
        return String.format("%08d", value);
    }

    private void assertRolloutEnabled() {
        if (!rolloutEnabled) {
            throw new ApiException(HttpStatus.FORBIDDEN,
                    "Two-factor authentication is not available yet. Please try again later.");
        }
    }

    private SecretKeySpec masterKey() {
        return AesGcmCodec.decodeKey(masterKekEncoded, "APP_MASTER_KEK (app.master.kek)");
    }

    private String encrypt(String plaintext) {
        return AesGcmCodec.encryptUtf8(masterKey(), plaintext);
    }

    private String decrypt(String ciphertext) {
        if (ciphertext == null || ciphertext.isBlank()) {
            return null;
        }
        return AesGcmCodec.decryptUtf8(masterKey(), ciphertext);
    }
}

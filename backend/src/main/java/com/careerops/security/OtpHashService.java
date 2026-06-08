package com.careerops.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;

/**
 * HMAC-SHA256 OTP hashing keyed with {@code APP_OTP_PEPPER}.
 */
@Component
public class OtpHashService {

    private final byte[] pepperBytes;

    public OtpHashService(@Value("${app.otp.pepper:}") String pepper) {
        if (pepper == null || pepper.isBlank()) {
            throw new IllegalStateException("APP_OTP_PEPPER must be set (app.otp.pepper)");
        }
        this.pepperBytes = pepper.getBytes(StandardCharsets.UTF_8);
    }

    public String hash(String otp) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(pepperBytes, "HmacSHA256"));
            byte[] digest = mac.doFinal(otp.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (Exception e) {
            throw new IllegalStateException("OTP HMAC failed", e);
        }
    }

    public boolean matches(String otp, String storedHash) {
        if (storedHash == null || storedHash.isBlank()) {
            return false;
        }
        String computed = hash(otp);
        return MessageDigest.isEqual(
                computed.getBytes(StandardCharsets.UTF_8),
                storedHash.getBytes(StandardCharsets.UTF_8));
    }
}

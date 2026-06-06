package com.careerops.security;

import javax.crypto.AEADBadTagException;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * AES-256-GCM encode/decode helpers.
 * Ciphertext format: Base64(12-byte IV || ciphertext + 128-bit GCM tag).
 */
public final class AesGcmCodec {

    public static final String TRANSFORMATION = "AES/GCM/NoPadding";
    public static final int IV_LENGTH_BYTES = 12;
    public static final int GCM_TAG_BITS = 128;
    public static final int KEY_LENGTH_BYTES = 32;

    private AesGcmCodec() {
    }

    public static String encryptUtf8(SecretKeySpec key, String plaintext) {
        if (plaintext == null || plaintext.isBlank()) {
            return null;
        }
        return encryptBytes(key, plaintext.getBytes(StandardCharsets.UTF_8));
    }

    public static String decryptUtf8(SecretKeySpec key, String ciphertext) {
        if (ciphertext == null || ciphertext.isBlank()) {
            return null;
        }
        byte[] decrypted = decryptBytes(key, ciphertext);
        return new String(decrypted, StandardCharsets.UTF_8);
    }

    public static String encryptBytes(SecretKeySpec key, byte[] plaintext) {
        try {
            byte[] iv = new byte[IV_LENGTH_BYTES];
            SecureRandom.getInstanceStrong().nextBytes(iv);

            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_BITS, iv));
            byte[] encrypted = cipher.doFinal(plaintext);

            byte[] combined = new byte[IV_LENGTH_BYTES + encrypted.length];
            System.arraycopy(iv, 0, combined, 0, IV_LENGTH_BYTES);
            System.arraycopy(encrypted, 0, combined, IV_LENGTH_BYTES, encrypted.length);

            return Base64.getEncoder().encodeToString(combined);
        } catch (Exception e) {
            throw new IllegalStateException("AES-GCM encryption failed", e);
        }
    }

    public static byte[] decryptBytes(SecretKeySpec key, String ciphertext) {
        try {
            byte[] combined = Base64.getDecoder().decode(ciphertext);
            if (combined.length <= IV_LENGTH_BYTES) {
                throw new IllegalArgumentException("Ciphertext too short");
            }

            byte[] iv = new byte[IV_LENGTH_BYTES];
            System.arraycopy(combined, 0, iv, 0, IV_LENGTH_BYTES);

            byte[] encrypted = new byte[combined.length - IV_LENGTH_BYTES];
            System.arraycopy(combined, IV_LENGTH_BYTES, encrypted, 0, encrypted.length);

            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_BITS, iv));
            return cipher.doFinal(encrypted);
        } catch (AEADBadTagException e) {
            throw new DecryptionFailedException(e);
        } catch (IllegalArgumentException e) {
            throw new DecryptionFailedException(e);
        } catch (Exception e) {
            throw new IllegalStateException("AES-GCM decryption failed", e);
        }
    }

    public static boolean looksEncrypted(String value) {
        if (value == null || value.isBlank()) {
            return false;
        }
        try {
            byte[] combined = Base64.getDecoder().decode(value);
            return combined.length > IV_LENGTH_BYTES + GCM_TAG_BITS / 8;
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    public static SecretKeySpec decodeKey(String encodedKey, String envName) {
        if (encodedKey == null || encodedKey.isBlank()) {
            throw new IllegalStateException(
                    envName + " is required — generate with: openssl rand -base64 32");
        }
        byte[] raw;
        try {
            raw = Base64.getDecoder().decode(encodedKey.trim());
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException(envName + " must be valid Base64", e);
        }
        if (raw.length != KEY_LENGTH_BYTES) {
            throw new IllegalStateException(
                    envName + " must decode to exactly " + KEY_LENGTH_BYTES + " bytes (256-bit AES key)");
        }
        return new SecretKeySpec(raw, "AES");
    }

    public static SecretKeySpec secretKey(byte[] rawKeyBytes) {
        if (rawKeyBytes == null || rawKeyBytes.length != KEY_LENGTH_BYTES) {
            throw new IllegalArgumentException(
                    "AES key must be exactly " + KEY_LENGTH_BYTES + " bytes");
        }
        return new SecretKeySpec(rawKeyBytes, "AES");
    }

    public static final class DecryptionFailedException extends RuntimeException {
        DecryptionFailedException(Throwable cause) {
            super(cause);
        }
    }
}

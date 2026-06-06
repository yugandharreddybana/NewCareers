package com.careerops.security;

import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;

/**
 * Parses RSA key material from PEM or bare Base64 DER (PKCS#8 private, SPKI public).
 */
final class RsaKeyMaterialParser {

    private RsaKeyMaterialParser() {
    }

    static PrivateKey parsePrivateKey(String material) throws GeneralSecurityExceptionWrapper {
        try {
            String normalized = normalize(material);
            byte[] der;
            if (normalized.contains("BEGIN RSA PRIVATE KEY")) {
                der = wrapPkcs1InPkcs8(decodePemBody(normalized, "RSA PRIVATE KEY"));
            } else {
                der = decodePemBody(normalized, "PRIVATE KEY");
            }
            KeyFactory keyFactory = KeyFactory.getInstance("RSA");
            return keyFactory.generatePrivate(new PKCS8EncodedKeySpec(der));
        } catch (Exception e) {
            throw new GeneralSecurityExceptionWrapper(e);
        }
    }

    static PublicKey parsePublicKey(String material) throws GeneralSecurityExceptionWrapper {
        try {
            byte[] der = decodePemBody(normalize(material), "PUBLIC KEY");
            KeyFactory keyFactory = KeyFactory.getInstance("RSA");
            return keyFactory.generatePublic(new X509EncodedKeySpec(der));
        } catch (Exception e) {
            throw new GeneralSecurityExceptionWrapper(e);
        }
    }

    private static String normalize(String value) {
        return value.replace("\\n", "\n").trim();
    }

    private static byte[] decodePemBody(String normalized, String label) {
        String header = "-----BEGIN " + label + "-----";
        String footer = "-----END " + label + "-----";
        String body = normalized;
        if (body.contains(header)) {
            body = body.replace(header, "").replace(footer, "");
        }
        return Base64.getDecoder().decode(body.replaceAll("\\s", ""));
    }

    /** Wrap PKCS#1 RSAPrivateKey DER in a PKCS#8 PrivateKeyInfo envelope. */
    private static byte[] wrapPkcs1InPkcs8(byte[] pkcs1) {
        int pkcs1Length = pkcs1.length;
        byte[] header = new byte[] {
                0x30, (byte) 0x82, (byte) ((pkcs1Length + 22) >> 8), (byte) ((pkcs1Length + 22) & 0xff),
                0x02, 0x01, 0x00,
                0x30, 0x0d, 0x06, 0x09, 0x2a, (byte) 0x86, 0x48, (byte) 0x86, (byte) 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00,
                0x04, (byte) 0x82, (byte) (pkcs1Length >> 8), (byte) (pkcs1Length & 0xff),
        };
        byte[] pkcs8 = new byte[header.length + pkcs1.length];
        System.arraycopy(header, 0, pkcs8, 0, header.length);
        System.arraycopy(pkcs1, 0, pkcs8, header.length, pkcs1.length);
        return pkcs8;
    }

    static final class GeneralSecurityExceptionWrapper extends RuntimeException {
        GeneralSecurityExceptionWrapper(Exception cause) {
            super(cause);
        }
    }
}

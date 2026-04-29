package com.careerops.service.sources;

import org.apache.commons.codec.digest.DigestUtils;

public final class FingerprintUtil {
    private FingerprintUtil() {}
    public static String of(String company, String title, String location) {
        String key = ((company == null ? "" : company) + (title == null ? "" : title)
            + (location == null ? "" : location)).toLowerCase().replaceAll("\\s+", "").trim();
        return DigestUtils.sha256Hex(key);
    }
}

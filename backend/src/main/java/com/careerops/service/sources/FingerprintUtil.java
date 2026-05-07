package com.careerops.service.sources;

import org.apache.commons.codec.digest.DigestUtils;

public final class FingerprintUtil {
    private FingerprintUtil() {}
    public static String of(String company, String title, String location, Integer min, Integer max) {
        String key = ((company == null ? "" : company) 
            + (title == null ? "" : title)
            + (location == null ? "" : location)
            + (min == null ? "0" : min)
            + (max == null ? "0" : max)
        ).toLowerCase().replaceAll("\\s+", "").trim();
        return DigestUtils.sha256Hex(key);
    }
 
    public static String of(String company, String title, String location) {
        return of(company, title, location, null, null);
    }
}

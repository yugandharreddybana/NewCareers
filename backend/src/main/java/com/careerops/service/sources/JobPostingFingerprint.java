package com.careerops.service.sources;

import com.careerops.model.Job;
import com.careerops.service.LinkedInDescriptionHelper;

import java.net.URI;
import java.util.Locale;
import java.util.Optional;

/** Stable identity for job postings across URL tracking params and re-scrapes. */
public final class JobPostingFingerprint {

    private JobPostingFingerprint() {}

    public static String fingerprint(String title, String company, String url) {
        return FingerprintUtil.fingerprint(
                normalizeText(title),
                normalizeText(company),
                canonicalPostingUrl(url));
    }

    public static String canonicalPostingUrl(String url) {
        if (url == null || url.isBlank()) {
            return "";
        }
        String trimmed = url.trim();
        Optional<String> linkedInId = LinkedInDescriptionHelper.extractJobId(trimmed);
        if (linkedInId.isPresent()) {
            return "https://www.linkedin.com/jobs/view/" + linkedInId.get();
        }
        try {
            URI uri = URI.create(trimmed);
            String host = uri.getHost() != null ? uri.getHost().toLowerCase(Locale.ROOT) : "";
            String path = uri.getPath() != null ? uri.getPath() : "";
            if (path.endsWith("/") && path.length() > 1) {
                path = path.substring(0, path.length() - 1);
            }
            if (host.isBlank() && path.isBlank()) {
                return trimmed.toLowerCase(Locale.ROOT);
            }
            return (uri.getScheme() != null ? uri.getScheme() : "https") + "://" + host + path;
        } catch (Exception ignored) {
            int q = trimmed.indexOf('?');
            int h = trimmed.indexOf('#');
            int cut = trimmed.length();
            if (q >= 0) cut = Math.min(cut, q);
            if (h >= 0) cut = Math.min(cut, h);
            return trimmed.substring(0, cut).toLowerCase(Locale.ROOT);
        }
    }

    public static boolean samePosting(Job left, Job right) {
        if (left == null || right == null) {
            return false;
        }
        Optional<String> leftId = LinkedInDescriptionHelper.extractJobId(left.getSourceUrl());
        Optional<String> rightId = LinkedInDescriptionHelper.extractJobId(right.getSourceUrl());
        if (leftId.isPresent() && rightId.isPresent() && leftId.get().equals(rightId.get())) {
            return true;
        }
        String leftFp = fingerprint(left.getTitle(), left.getCompany(), left.getSourceUrl());
        String rightFp = fingerprint(right.getTitle(), right.getCompany(), right.getSourceUrl());
        return leftFp.equals(rightFp);
    }

    private static String normalizeText(String value) {
        return value == null ? "" : value.trim();
    }
}

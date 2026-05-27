package com.careerops.security;

import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.util.Locale;
import java.util.Set;

/**
 * Validates outbound fetch URLs to reduce SSRF risk (private networks, non-http schemes).
 */
public final class SafeUrlFetcher {

    private static final Set<String> ALLOWED_SCHEMES = Set.of("http", "https");

    private SafeUrlFetcher() {}

    public static URI validateFetchUrl(String rawUrl) {
        if (rawUrl == null || rawUrl.isBlank()) {
            throw new IllegalArgumentException("URL is required");
        }
        URI uri;
        try {
            uri = URI.create(rawUrl.trim());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Invalid URL");
        }
        String scheme = uri.getScheme();
        if (scheme == null || !ALLOWED_SCHEMES.contains(scheme.toLowerCase(Locale.ROOT))) {
            throw new IllegalArgumentException("Only http and https URLs are allowed");
        }
        String host = uri.getHost();
        if (host == null || host.isBlank()) {
            throw new IllegalArgumentException("URL host is required");
        }
        String lowerHost = host.toLowerCase(Locale.ROOT);
        if ("localhost".equals(lowerHost)
            || lowerHost.endsWith(".localhost")
            || "127.0.0.1".equals(lowerHost)
            || "::1".equals(lowerHost)
            || lowerHost.startsWith("127.")) {
            throw new IllegalArgumentException("Localhost URLs are not allowed");
        }
        try {
            for (InetAddress addr : InetAddress.getAllByName(host)) {
                if (addr.isAnyLocalAddress()
                    || addr.isLoopbackAddress()
                    || addr.isLinkLocalAddress()
                    || addr.isSiteLocalAddress()
                    || addr.isMulticastAddress()) {
                    throw new IllegalArgumentException("Private or reserved network URLs are not allowed");
                }
            }
        } catch (UnknownHostException e) {
            throw new IllegalArgumentException("URL host could not be resolved");
        }
        return uri;
    }
}

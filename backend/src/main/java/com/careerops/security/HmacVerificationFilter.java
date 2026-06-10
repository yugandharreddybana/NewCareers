package com.careerops.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.multipart.MultipartHttpServletRequest;
import org.springframework.web.multipart.MultipartResolver;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Verifies HMAC signatures on internal middleware → Java requests.
 * Public endpoints are skipped (same policy as {@link InternalTrustFilter}).
 */
@Component
public class HmacVerificationFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(HmacVerificationFilter.class);

    private final InternalHmacSigner signer;
    private final PublicPathPolicy publicPathPolicy;
    private final MultipartResolver multipartResolver;

    public HmacVerificationFilter(
            InternalHmacSigner signer,
            PublicPathPolicy publicPathPolicy,
            MultipartResolver multipartResolver) {
        this.signer = signer;
        this.publicPathPolicy = publicPathPolicy;
        this.multipartResolver = multipartResolver;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {

        String path = ServletPathNormalizer.normalize(req);
        if (publicPathPolicy.isPublic(path)) {
            chain.doFilter(req, res);
            return;
        }

        byte[] body = readBody(req);

        String timestampHeader = req.getHeader(InternalHmacSigner.TIMESTAMP_HEADER);
        String signature = req.getHeader(InternalHmacSigner.SIGNATURE_HEADER);
        long timestampMs;
        try {
            if (timestampHeader == null || timestampHeader.isBlank()) {
                reject(res, path);
                return;
            }
            timestampMs = Long.parseLong(timestampHeader.trim());
        } catch (NumberFormatException e) {
            reject(res, path);
            return;
        }

        boolean timestampFresh = signer.isTimestampFresh(timestampMs);
        boolean verifyIso = signer.verify(timestampMs, req.getMethod(), path, body, signature);
        if (!timestampFresh || !verifyIso) {
            // #region agent log
            agentDebugLog("A", "hmac verify failed", Map.of(
                    "path", path,
                    "method", req.getMethod(),
                    "bodyLen", body.length,
                    "timestampFresh", timestampFresh,
                    "verifyIso", verifyIso,
                    "verifyUtf8", verifyWithUtf8Body(timestampMs, req.getMethod(), path, body, signature)
            ));
            // #endregion
            log.warn("HMAC verification failed on path={} from IP={}", path, req.getRemoteAddr());
            reject(res, path);
            return;
        }

        HttpServletRequest replayable = body.length == 0 ? req : new CachedBodyHttpServletRequest(req, body);
        if (isMultipart(replayable)) {
            MultipartHttpServletRequest multipart = multipartResolver.resolveMultipart(replayable);
            try {
                chain.doFilter(multipart, res);
            } finally {
                multipartResolver.cleanupMultipart(multipart);
            }
            return;
        }
        chain.doFilter(replayable, res);
    }

    private static boolean isMultipart(HttpServletRequest request) {
        String contentType = request.getContentType();
        return contentType != null && contentType.toLowerCase().startsWith("multipart/");
    }

    private static byte[] readBody(HttpServletRequest req) throws IOException {
        return req.getInputStream().readAllBytes();
    }

    private static void reject(HttpServletResponse res, String path) throws IOException {
        res.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        res.setContentType("application/json");
        res.getWriter().write("{\"error\":\"Unauthorized: invalid or expired signature\"}");
    }

    /** Debug-only: would the pre-ISO-8859-1 UTF-8 verifier have accepted this signature? */
    private boolean verifyWithUtf8Body(long timestampMs, String method, String path, byte[] body, String signature) {
        return signer.verifyLegacyUtf8Body(timestampMs, method, path, body, signature);
    }

    // #region agent log
    private static void agentDebugLog(String hypothesisId, String message, Map<String, Object> data) {
        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("sessionId", "12c5a2");
            payload.put("hypothesisId", hypothesisId);
            payload.put("location", "HmacVerificationFilter.java");
            payload.put("message", message);
            payload.put("data", data);
            payload.put("timestamp", System.currentTimeMillis());
            String line = new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(payload);
            Path logPath = Path.of("..", "debug-12c5a2.log").toAbsolutePath().normalize();
            Files.writeString(logPath, line + System.lineSeparator(),
                    StandardOpenOption.CREATE, StandardOpenOption.APPEND);
        } catch (Exception ignored) {
            // ignore
        }
    }
    // #endregion
}

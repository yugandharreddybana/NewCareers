package com.careerops.service;

import org.jspecify.annotations.Nullable;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.util.Date;
import java.util.UUID;

import java.time.Duration;
import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * Batch 3 — Supabase Storage Service
 *
 * Provides: upload, upsert, signedUrl, publicUrl, delete, deleteMany, listFiles
 * Used by CvService and ResumeVersionService.
 */
@Service
public class SupabaseStorageService {
    private static final Logger log = LoggerFactory.getLogger(SupabaseStorageService.class);


    private final RestClient client;
    private final String url;
    private final String key;
    private final String anonKey; // 3.033
    private final String jwtSecret; // 3.033
    private final MeterRegistry meterRegistry;

    @Value("${supabase.bucket.cv:resumes}")
    private String bucketCv;

    @Value("${supabase.bucket.application-cv:application-cvs}")
    private String bucketApp;

    @Value("${supabase.bucket.resume:resume-versions}")
    private String bucketVersion;

    public SupabaseStorageService(RestClient.Builder builder,
                                  @Value("${supabase.url}") String url,
                                  @Value("${supabase.service.key}") String key,
                                  @Value("${supabase.anon.key:}") String anonKey,
                                  @Value("${supabase.jwt.secret:}") String jwtSecret,
                                  MeterRegistry meterRegistry) {
        this.url = url;
        this.key = key;
        this.anonKey = anonKey;
        this.jwtSecret = jwtSecret;
        this.meterRegistry = meterRegistry;
        String base = url != null ? url.trim() : "";
        this.client = isAbsoluteHttpUrl(base)
                ? builder.baseUrl(base).build()
                : builder.build();
    }

    /** True when {@code supabase.url} is a valid absolute HTTP(S) base URL. */
    public boolean isConfigured() {
        return isAbsoluteHttpUrl(url);
    }

    private static boolean isAbsoluteHttpUrl(@Nullable String raw) {
        if (raw == null || raw.isBlank()) {
            return false;
        }
        try {
            java.net.URI uri = java.net.URI.create(raw.trim());
            String scheme = uri.getScheme();
            return uri.isAbsolute()
                    && scheme != null
                    && ("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme));
        } catch (Exception e) {
            return false;
        }
    }
 
    /** 
     * 3.086 — Connectivity check for health monitoring. 
     * Attempts to list buckets to verify API key and network.
     */
    public void ping() {
        if (!isConfigured()) {
            throw new IllegalStateException("Supabase URL is not configured");
        }
        executeWithTimer("ping", () -> {
            try {
                client.get().uri("/storage/v1/bucket")
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + key)
                    .retrieve()
                    .toBodilessEntity();
            } catch (Exception e) {
                log.error("Supabase health check failed: {}", e.getMessage());
                throw new RuntimeException("Supabase Storage unreachable", e);
            }
        });
    }

    /**
     * 3.033 — Create a signed JWT for a specific user to satisfy Supabase RLS.
     */
    private String createScopedToken(@Nullable UUID userId) {
        if (jwtSecret == null || jwtSecret.isBlank() || userId == null) {
            return key; // Fallback to service key if secret missing or no user context
        }
        long exp = System.currentTimeMillis() + (10 * 60 * 1000); // 10 mins
        return Jwts.builder()
                .header().add("typ", "JWT").and()
                .claim("role", "authenticated")
                .claim("aud",  "authenticated")
                .subject(userId.toString())
                .expiration(new Date(exp))
                .signWith(Keys.hmacShaKeyFor(jwtSecret.getBytes(java.nio.charset.StandardCharsets.UTF_8)))
                .compact();
    }

    private String getAuthHeader(@Nullable UUID userId) {
        if (userId != null && !anonKey.isEmpty() && !jwtSecret.isEmpty()) {
            return "Bearer " + createScopedToken(userId);
        }
        return "Bearer " + key;
    }

    private String getApiKey(@Nullable UUID userId) {
        if (userId != null && !anonKey.isEmpty()) {
            return anonKey;
        }
        return key;
    }

    // Upload (new object — 409 if already exists)
    public void upload(String bucket, String path, byte[] bytes, @Nullable String contentType, @Nullable UUID userId) {
        if (!isConfigured()) {
            throw new IllegalStateException("Supabase Storage is not configured (set SUPABASE_URL)");
        }
        executeWithTimer("upload", () -> {
            try {
                client.post()
                    .uri("/storage/v1/object/{b}/{p}", bucket, path)
                    .header(HttpHeaders.AUTHORIZATION, getAuthHeader(userId))
                    .header("apikey", getApiKey(userId))
                    .contentType(MediaType.parseMediaType(safeContentType(path, contentType)))
                    .body(bytes)
                    .retrieve().body(String.class);
            } catch (Exception e) {
                log.error("[SupabaseStorage] Upload failed for bucket={}, path={}: {}", bucket, path, e.getMessage());
                throw e;
            }
        });
    }

    public void uploadStream(String bucket, String path, org.springframework.core.io.Resource resource, @Nullable String contentType, @Nullable UUID userId) {
        executeWithTimer("uploadStream", () -> {
            try {
                client.post()
                    .uri("/storage/v1/object/{b}/{p}", bucket, path)
                    .header(HttpHeaders.AUTHORIZATION, getAuthHeader(userId))
                    .header("apikey", getApiKey(userId))
                    .contentType(MediaType.parseMediaType(safeContentType(path, contentType)))
                    .body(resource)
                    .retrieve().body(String.class);
            } catch (Exception e) {
                log.error("[SupabaseStorage] UploadStream failed for bucket={}, path={}: {}", bucket, path, e.getMessage());
                throw e;
            }
        });
    }

    // Upsert (creates or overwrites)
    public void upsert(String bucket, String path, byte[] bytes, @Nullable String contentType, @Nullable UUID userId) {
        executeWithTimer("upsert", () -> {
            try {
                client.put()
                    .uri("/storage/v1/object/{b}/{p}", bucket, path)
                    .header(HttpHeaders.AUTHORIZATION, getAuthHeader(userId))
                    .header("apikey", getApiKey(userId))
                    .header("x-upsert", "true")
                    .contentType(MediaType.parseMediaType(safeContentType(path, contentType)))
                    .body(bytes)
                    .retrieve().body(String.class);
            } catch (Exception e) {
                log.error("[SupabaseStorage] Upsert failed for bucket={}, path={}: {}", bucket, path, e.getMessage());
                throw e;
            }
        });
    }

    public void upsertStream(String bucket, String path, org.springframework.core.io.Resource resource, @Nullable String contentType, @Nullable UUID userId) {
        executeWithTimer("upsertStream", () -> {
            try {
                client.put()
                    .uri("/storage/v1/object/{b}/{p}", bucket, path)
                    .header(HttpHeaders.AUTHORIZATION, getAuthHeader(userId))
                    .header("apikey", getApiKey(userId))
                    .header("x-upsert", "true")
                    .contentType(MediaType.parseMediaType(safeContentType(path, contentType)))
                    .body(resource)
                    .retrieve().body(String.class);
            } catch (Exception e) {
                log.error("[SupabaseStorage] UpsertStream failed for bucket={}, path={}: {}", bucket, path, e.getMessage());
                throw e;
            }
        });
    }

    // Signed URL (time-limited private access)
    public @Nullable String signedUrl(String bucket, String path, int expiresInSeconds, @Nullable UUID userId) {
        if (!isConfigured()) {
            return null;
        }
        return executeWithTimer("signedUrl", () -> {
            try {
                Map<?, ?> resp = client.post()
                    .uri("/storage/v1/object/sign/{b}/{p}", bucket, path)
                    .header(HttpHeaders.AUTHORIZATION, getAuthHeader(userId))
                    .header("apikey", getApiKey(userId))
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("expiresIn", expiresInSeconds))
                    .retrieve().body(Map.class);
                Object signed = resp == null ? null : resp.get("signedURL");
                return signed == null ? null : url + "/storage/v1" + signed;
            } catch (Exception e) {
                log.warn("[SupabaseStorage] Failed to generate signed URL for bucket={}, path={}: {}", bucket, path, e.getMessage());
                return null; // Return null so caller can handle missing file gracefully
            }
        });
    }

    // Public URL (for public buckets only)
    public String publicUrl(String bucket, String path) {
        return url + "/storage/v1/object/public/" + bucket + "/" + path;
    }

    // Delete a single object
    public void delete(String bucket, String path, @Nullable UUID userId) {
        executeWithTimer("delete", () -> {
            try {
                client.method(HttpMethod.DELETE)
                    .uri("/storage/v1/object/{b}", bucket)
                    .header(HttpHeaders.AUTHORIZATION, getAuthHeader(userId))
                    .header("apikey", getApiKey(userId))
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("prefixes", List.of(path)))
                    .retrieve().body(String.class);
            } catch (Exception e) {
                // 3.032 — Log the error but rethrow so transactional Saga can handle it or fail-fast
                log.error("[SupabaseStorage] Delete failed for bucket={}, path={}: {}", bucket, path, e.getMessage());
                throw e;
            }
        });
    }

    // Delete multiple objects
    public void deleteMany(String bucket, @Nullable List<String> paths, @Nullable UUID userId) {
        if (paths == null || paths.isEmpty()) return;
        executeWithTimer("deleteMany", () -> {
            try {
                client.method(HttpMethod.DELETE)
                    .uri("/storage/v1/object/{b}", bucket)
                    .header(HttpHeaders.AUTHORIZATION, getAuthHeader(userId))
                    .header("apikey", getApiKey(userId))
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("prefixes", paths))
                    .retrieve().body(String.class);
            } catch (Exception e) {
                log.error("[SupabaseStorage] DeleteMany failed for bucket={}, count={}: {}", bucket, paths.size(), e.getMessage());
                throw e;
            }
        });
    }

    // List files in a folder prefix
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> listFiles(String bucket, @Nullable String prefix, @Nullable UUID userId) {
        return executeWithTimer("listFiles", () -> {
            try {
                List<?> resp = client.post()
                    .uri("/storage/v1/object/list/{b}", bucket)
                    .header(HttpHeaders.AUTHORIZATION, getAuthHeader(userId))
                    .header("apikey", getApiKey(userId))
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of(
                        "prefix", prefix == null ? "" : prefix,
                        "limit", 100,
                        "offset", 0,
                        "sortBy", Map.of("column", "created_at", "order", "desc")
                    ))
                    .retrieve().body(List.class);
                if (resp == null) return Collections.emptyList();
                return (List<Map<String, Object>>) resp;
            } catch (RestClientResponseException e) {
                log.warn("[SupabaseStorage] listFiles failed: {}", e.getMessage());
                return Collections.emptyList();
            }
        });
    }

    /**
     * 3.042 — GDPR Cleanup: Delete all files in a folder prefix.
     */
    public void deleteFolder(String bucket, @Nullable String prefix, @Nullable UUID userId) {
        String cleanPrefix = (prefix != null && !prefix.endsWith("/")) ? prefix + "/" : prefix;
        List<Map<String, Object>> files = listFiles(bucket, prefix, userId);
        if (files == null || files.isEmpty()) return;

        List<String> paths = files.stream()
            .map(f -> (String) f.get("name"))
            .filter(n -> n != null && !n.isBlank())
            .map(n -> cleanPrefix + n)
            .toList();

        if (!paths.isEmpty()) {
            deleteMany(bucket, paths, userId);
            log.info("[SupabaseStorage] Purged {} files from bucket={} prefix={} (userId={})", paths.size(), bucket, prefix, userId);
        }
    }

    /**
     * 3.042 — GDPR Cleanup: Purge all user-related files across all known buckets.
     */
    public void purgeUserFiles(@Nullable UUID userId) {
        if (userId == null) return;
        String prefix = userId.toString();
        log.info("[SupabaseStorage] Starting full file purge for userId={}", userId);
        deleteFolder(bucketCv, prefix, userId);
        deleteFolder(bucketApp, prefix, userId);
        deleteFolder(bucketVersion, prefix, userId);
    }

    private String safeContentType(@Nullable String path, @Nullable String ct) {
        if (ct != null && !ct.isBlank() && !ct.equals("application/octet-stream")) {
            return ct;
        }
        if (path == null) return "application/octet-stream";
        String lc = path.toLowerCase();
        if (lc.endsWith(".pdf")) return "application/pdf";
        if (lc.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        if (lc.endsWith(".html")) return "text/html; charset=utf-8";
        if (lc.endsWith(".png")) return "image/png";
        if (lc.endsWith(".jpg") || lc.endsWith(".jpeg")) return "image/jpeg";
        return "application/octet-stream";
    }

    private <T> T executeWithTimer(String operation, java.util.function.Supplier<T> action) {
        Timer.Sample sample = Timer.start(meterRegistry);
        try {
            T res = action.get();
            sample.stop(meterRegistry.timer("outbound.call.latency", "service", "supabase", "operation", operation, "status", "success"));
            return res;
        } catch (Exception e) {
            sample.stop(meterRegistry.timer("outbound.call.latency", "service", "supabase", "operation", operation, "status", "failure"));
            throw e;
        }
    }

    private void executeWithTimer(String operation, Runnable action) {
        Timer.Sample sample = Timer.start(meterRegistry);
        try {
            action.run();
            sample.stop(meterRegistry.timer("outbound.call.latency", "service", "supabase", "operation", operation, "status", "success"));
        } catch (Exception e) {
            sample.stop(meterRegistry.timer("outbound.call.latency", "service", "supabase", "operation", operation, "status", "failure"));
            throw e;
        }
    }
}

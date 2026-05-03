package com.careerops.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

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

    private final WebClient client;
    private final String url;
    private final String key;

    public SupabaseStorageService(WebClient.Builder builder,
                                  @Value("${supabase.url}") String url,
                                  @Value("${supabase.service.key}") String key) {
        this.url = url;
        this.key = key;
        this.client = builder.baseUrl(url).build();
    }

    // Upload (new object — 409 if already exists)
    public void upload(String bucket, String path, byte[] bytes, String contentType) {
        client.post()
            .uri("/storage/v1/object/{b}/{p}", bucket, path)
            .header(HttpHeaders.AUTHORIZATION, "Bearer " + key)
            .contentType(MediaType.parseMediaType(safeContentType(contentType)))
            .body(BodyInserters.fromValue(bytes))
            .retrieve().bodyToMono(String.class)
            .block(Duration.ofSeconds(30));
    }

    // Upsert (creates or overwrites)
    public void upsert(String bucket, String path, byte[] bytes, String contentType) {
        client.put()
            .uri("/storage/v1/object/{b}/{p}", bucket, path)
            .header(HttpHeaders.AUTHORIZATION, "Bearer " + key)
            .header("x-upsert", "true")
            .contentType(MediaType.parseMediaType(safeContentType(contentType)))
            .body(BodyInserters.fromValue(bytes))
            .retrieve().bodyToMono(String.class)
            .block(Duration.ofSeconds(30));
    }

    // Signed URL (time-limited private access)
    public String signedUrl(String bucket, String path, int expiresInSeconds) {
        Map<?, ?> resp = client.post()
            .uri("/storage/v1/object/sign/{b}/{p}", bucket, path)
            .header(HttpHeaders.AUTHORIZATION, "Bearer " + key)
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue(Map.of("expiresIn", expiresInSeconds))
            .retrieve().bodyToMono(Map.class)
            .block(Duration.ofSeconds(15));
        Object signed = resp == null ? null : resp.get("signedURL");
        return signed == null ? null : url + "/storage/v1" + signed;
    }

    // Public URL (for public buckets only)
    public String publicUrl(String bucket, String path) {
        return url + "/storage/v1/object/public/" + bucket + "/" + path;
    }

    // Delete a single object
    public void delete(String bucket, String path) {
        try {
            client.method(HttpMethod.DELETE)
                .uri("/storage/v1/object/{b}", bucket)
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + key)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(Map.of("prefixes", List.of(path)))
                .retrieve().bodyToMono(String.class)
                .block(Duration.ofSeconds(15));
        } catch (WebClientResponseException e) {
            System.err.println("[SupabaseStorage] delete warning: " + e.getMessage());
        }
    }

    // Delete multiple objects
    public void deleteMany(String bucket, List<String> paths) {
        if (paths == null || paths.isEmpty()) return;
        try {
            client.method(HttpMethod.DELETE)
                .uri("/storage/v1/object/{b}", bucket)
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + key)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(Map.of("prefixes", paths))
                .retrieve().bodyToMono(String.class)
                .block(Duration.ofSeconds(20));
        } catch (WebClientResponseException e) {
            System.err.println("[SupabaseStorage] deleteMany warning: " + e.getMessage());
        }
    }

    // List files in a folder prefix
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> listFiles(String bucket, String prefix) {
        try {
            List<?> resp = client.post()
                .uri("/storage/v1/object/list/{b}", bucket)
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + key)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(Map.of(
                    "prefix", prefix == null ? "" : prefix,
                    "limit", 100,
                    "offset", 0,
                    "sortBy", Map.of("column", "created_at", "order", "desc")
                ))
                .retrieve().bodyToMono(List.class)
                .block(Duration.ofSeconds(15));
            if (resp == null) return Collections.emptyList();
            return (List<Map<String, Object>>) resp;
        } catch (WebClientResponseException e) {
            System.err.println("[SupabaseStorage] listFiles warning: " + e.getMessage());
            return Collections.emptyList();
        }
    }

    private String safeContentType(String ct) {
        return (ct == null || ct.isBlank()) ? "application/octet-stream" : ct;
    }
}

package com.careerops.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;
import java.util.Map;

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

    public void upload(String bucket, String path, byte[] bytes, String contentType) {
        client.post()
            .uri("/storage/v1/object/{b}/{p}", bucket, path)
            .header(HttpHeaders.AUTHORIZATION, "Bearer " + key)
            .contentType(MediaType.parseMediaType(contentType == null ? "application/octet-stream" : contentType))
            .body(BodyInserters.fromValue(bytes))
            .retrieve().bodyToMono(String.class)
            .block(Duration.ofSeconds(30));
    }

    public String signedUrl(String bucket, String path, int expiresInSeconds) {
        Map<?,?> resp = client.post()
            .uri("/storage/v1/object/sign/{b}/{p}", bucket, path)
            .header(HttpHeaders.AUTHORIZATION, "Bearer " + key)
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue(Map.of("expiresIn", expiresInSeconds))
            .retrieve().bodyToMono(Map.class)
            .block(Duration.ofSeconds(15));
        Object signed = resp == null ? null : resp.get("signedURL");
        return signed == null ? null : url + "/storage/v1" + signed;
    }
}

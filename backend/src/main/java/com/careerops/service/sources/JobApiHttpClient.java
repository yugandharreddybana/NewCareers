package com.careerops.service.sources;

import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

/**
 * Shared HTTP Client provider for external Job APIs.
 * Ensures sane default connection, read, and write timeouts are consistently applied across all sources.
 */
@Component
public class JobApiHttpClient {

    private final WebClient.Builder builder;

    public JobApiHttpClient(WebClient.Builder builder) {
        this.builder = builder;
    }

    /**
     * Creates a new WebClient instance with the given base URL using the pre-configured builder.
     * Uses builder.clone() to prevent base URL pollution between different sources.
     */
    public WebClient createClient(String baseUrl) {
        return builder.clone().baseUrl(baseUrl).build();
    }
}

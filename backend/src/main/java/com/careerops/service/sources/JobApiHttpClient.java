package com.careerops.service.sources;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

/**
 * Thin HTTP utility used by all scrapers for raw GET requests.
 *
 * Uses the shared pooled OkHttpClient bean from AppConfig.
 * All scrapers should use this instead of creating their own
 * RestTemplate or Jsoup connections for JSON/text endpoints.
 *
 * Methods:
 *   get(url)                         — basic GET with default User-Agent
 *   get(url, userAgent)              — GET with custom User-Agent
 *   getWithHeader(url, name, value)  — GET with a single extra header (e.g. Authorization)
 */
@Component
public class JobApiHttpClient {

    private static final Logger log = LoggerFactory.getLogger(JobApiHttpClient.class);
    private static final String DEFAULT_UA = "Mozilla/5.0 (compatible; CareerOps/2.0)";

    private final OkHttpClient httpClient;

    public JobApiHttpClient(@Qualifier("sharedHttpClient") OkHttpClient sharedHttpClient) {
        this.httpClient = sharedHttpClient;
    }

    /** WebClient rooted at {@code baseUrl} for JSON APIs (The Muse, Twin AI, etc.). */
    public WebClient createClient(String baseUrl) {
        return WebClient.builder().baseUrl(baseUrl).build();
    }

    /** GET with default User-Agent. Returns empty string on error. */
    public String get(String url) {
        return get(url, DEFAULT_UA);
    }

    /** GET with custom User-Agent. Returns empty string on error. */
    public String get(String url, String userAgent) {
        return execute(new Request.Builder()
                .url(url)
                .header("User-Agent",      userAgent)
                .header("Accept",          "application/json,text/html,*/*")
                .header("Accept-Encoding", "gzip, deflate")
                .build());
    }

    /** GET with a custom extra header (e.g. Authorization: Basic ...). */
    public String getWithHeader(String url, String headerName, String headerValue) {
        return execute(new Request.Builder()
                .url(url)
                .header("User-Agent",      DEFAULT_UA)
                .header("Accept",          "application/json,*/*")
                .header("Accept-Encoding", "gzip, deflate")
                .header(headerName,        headerValue)
                .build());
    }

    private String execute(Request request) {
        try (Response response = httpClient.newCall(request).execute()) {
            if (!response.isSuccessful()) {
                log.warn("HTTP {} for: {}", response.code(), request.url());
                return "";
            }
            return response.body() != null ? response.body().string() : "";
        } catch (Exception e) {
            log.warn("GET failed [{}]: {}", request.url(), e.getMessage());
            return "";
        }
    }
}

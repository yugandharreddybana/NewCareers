package com.careerops.service.sources;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Thin HTTP utility used by scrapers that need raw GET responses.
 * Uses the shared OkHttpClient bean (connection-pooled) injected from AppConfig.
 *
 * All scrapers should use this instead of creating their own RestTemplate
 * or Jsoup connections for JSON/text endpoints.
 */
@Component
public class JobApiHttpClient {

    private static final Logger log = LoggerFactory.getLogger(JobApiHttpClient.class);

    private final OkHttpClient httpClient;

    public JobApiHttpClient(OkHttpClient sharedHttpClient) {
        this.httpClient = sharedHttpClient;
    }

    /**
     * Performs a GET request and returns the response body as a String.
     * Returns empty string on error instead of throwing.
     */
    public String get(String url) {
        return get(url, "Mozilla/5.0 (compatible; CareerOps/2.0)");
    }

    public String get(String url, String userAgent) {
        Request request = new Request.Builder()
                .url(url)
                .header("User-Agent", userAgent)
                .header("Accept", "application/json,text/html,*/*")
                .header("Accept-Encoding", "gzip, deflate")
                .build();
        try (Response response = httpClient.newCall(request).execute()) {
            if (!response.isSuccessful()) {
                log.warn("HTTP {} for URL: {}", response.code(), url);
                return "";
            }
            return response.body() != null ? response.body().string() : "";
        } catch (Exception e) {
            log.warn("GET failed [{}]: {}", url, e.getMessage());
            return "";
        }
    }
}

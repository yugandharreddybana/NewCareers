package com.careerops.config;

import okhttp3.ConnectionPool;
import okhttp3.OkHttpClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.TimeUnit;

/**
 * Central infrastructure beans:
 * - Shared OkHttpClient with a connection pool (used by all scrapers + API callers)
 */
@Configuration
public class AppConfig {

    @Value("${scraper.http.max-connections:100}")
    private int maxConnections;

    @Value("${scraper.http.max-connections-per-host:20}")
    private int maxConnectionsPerHost;

    @Value("${scraper.http.connect-timeout-ms:5000}")
    private int connectTimeoutMs;

    @Value("${scraper.http.read-timeout-ms:20000}")
    private int readTimeoutMs;

    @Value("${scraper.http.write-timeout-ms:10000}")
    private int writeTimeoutMs;

    @Value("${scraper.http.keep-alive-duration-seconds:60}")
    private int keepAliveDurationSeconds;

    /**
     * Single shared OkHttpClient for all scrapers and REST API calls.
     * Uses a ConnectionPool so TCP connections are reused across sources,
     * dramatically reducing connection-setup overhead during parallel scraping.
     */
    @Bean
    public OkHttpClient sharedHttpClient() {
        ConnectionPool pool = new ConnectionPool(
                maxConnections,
                keepAliveDurationSeconds,
                TimeUnit.SECONDS
        );
        return new OkHttpClient.Builder()
                .connectionPool(pool)
                .connectTimeout(connectTimeoutMs, TimeUnit.MILLISECONDS)
                .readTimeout(readTimeoutMs, TimeUnit.MILLISECONDS)
                .writeTimeout(writeTimeoutMs, TimeUnit.MILLISECONDS)
                .retryOnConnectionFailure(true)
                .followRedirects(true)
                .build();
    }
}

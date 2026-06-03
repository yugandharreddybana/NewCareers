package com.careerops.config;

import okhttp3.ConnectionPool;
import okhttp3.OkHttpClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import java.util.concurrent.TimeUnit;

/**
 * Central infrastructure beans.
 *
 * Provides a single shared OkHttpClient with a ConnectionPool used by all
 * scrapers and REST API callers. Annotated @Primary so it wins any
 * OkHttpClient autowiring competition (e.g. if a test config or future
 * module also registers one).
 *
 * Configuration keys (all in application.properties under scraper.http.*):
 *   max-connections            total pool size across all hosts
 *   max-connections-per-host   max connections to any single hostname
 *   connect-timeout-ms         TCP connect timeout
 *   read-timeout-ms            socket read timeout
 *   write-timeout-ms           socket write timeout
 *   keep-alive-duration-seconds how long idle connections stay alive
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
     * Single shared pooled OkHttpClient.
     * All scrapers and REST callers should inject this bean by type or
     * via @Qualifier("sharedHttpClient") to reuse TCP connections.
     */
    @Primary
    @Bean(name = "sharedHttpClient")
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

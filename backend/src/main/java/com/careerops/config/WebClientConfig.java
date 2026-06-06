package com.careerops.config;

import io.netty.channel.ChannelOption;
import io.netty.handler.timeout.ReadTimeoutHandler;
import io.netty.handler.timeout.WriteTimeoutHandler;
import org.slf4j.MDC;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.web.reactive.function.client.ClientRequest;
import org.springframework.web.reactive.function.client.ExchangeFilterFunction;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;
import reactor.netty.http.client.HttpClient;
import reactor.netty.resources.ConnectionProvider;

import java.time.Duration;

/**
 * Reactor Netty WebClient configuration (used for reactive/streaming HTTP calls
 * e.g. NVIDIA NIM, Anthropic, Gemini AI endpoints).
 *
 * Improvements over original:
 *  - Pool raised to 100 connections (was 50)
 *  - evictInBackground(120s), maxIdleTime(30s), maxLifeTime(600s) for pool hygiene
 *  - pendingAcquireTimeout raised to 45s
 *  - propagateMdc now forwards both correlationId AND userId downstream
 *  - logRequest/logResponse demoted to DEBUG to avoid INFO noise in production
 */
@Configuration
public class WebClientConfig {

    private static final org.slf4j.Logger log =
            org.slf4j.LoggerFactory.getLogger(WebClientConfig.class);

    @Bean
    @Primary
    public WebClient.Builder webClientBuilder() {
        ConnectionProvider provider = ConnectionProvider.builder("careerops")
                .maxConnections(100)
                .pendingAcquireTimeout(Duration.ofSeconds(45))
                .maxIdleTime(Duration.ofSeconds(30))
                .maxLifeTime(Duration.ofSeconds(600))
                .evictInBackground(Duration.ofSeconds(120))
                .build();

        HttpClient http = HttpClient.create(provider)
                .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, 5000)
                .doOnConnected(c -> c
                        .addHandlerLast(new ReadTimeoutHandler(60))
                        .addHandlerLast(new WriteTimeoutHandler(30))
                )
                .responseTimeout(Duration.ofSeconds(60));

        return WebClient.builder()
                .clientConnector(new ReactorClientHttpConnector(http))
                .filter(logRequest())
                .filter(logResponse())
                .filter(propagateMdc());
    }

    /** Logs outbound requests at DEBUG to avoid production noise. */
    private ExchangeFilterFunction logRequest() {
        return ExchangeFilterFunction.ofRequestProcessor(req -> {
            log.debug("Outbound WebClient: {} {}", req.method(), req.url());
            return Mono.just(req);
        });
    }

    /** Logs inbound response status at DEBUG. */
    private ExchangeFilterFunction logResponse() {
        return ExchangeFilterFunction.ofResponseProcessor(res -> {
            log.debug("Inbound WebClient response: {}", res.statusCode());
            return Mono.just(res);
        });
    }

    /**
     * Propagates correlationId and userId from MDC into outbound request headers
     * so downstream services can trace the same request chain.
     */
    private ExchangeFilterFunction propagateMdc() {
        return (request, next) -> {
            String correlationId = MDC.get("correlationId");
            String userId = MDC.get("userId");
            if ((correlationId == null || correlationId.isBlank())
                    && (userId == null || userId.isBlank())) {
                return next.exchange(request);
            }
            ClientRequest.Builder builder = ClientRequest.from(request);
            if (correlationId != null && !correlationId.isBlank()) {
                builder.headers(h -> h.set("X-Correlation-Id", correlationId));
            }
            if (userId != null && !userId.isBlank()) {
                builder.headers(h -> h.set("X-User-Id", userId));
            }
            return next.exchange(builder.build());
        };
    }
}

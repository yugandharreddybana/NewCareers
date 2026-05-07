package com.careerops.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.netty.http.client.HttpClient;
import reactor.netty.resources.ConnectionProvider;
import io.netty.channel.ChannelOption;
import io.netty.handler.timeout.ReadTimeoutHandler;
import io.netty.handler.timeout.WriteTimeoutHandler;

import java.time.Duration;

@Configuration
public class WebClientConfig {
    private static final org.slf4j.Logger logger = org.slf4j.LoggerFactory.getLogger(WebClientConfig.class);

    @Bean
    public WebClient.Builder webClientBuilder() {
        ConnectionProvider provider = ConnectionProvider.builder("careerops")
            .maxConnections(50)
            .pendingAcquireTimeout(Duration.ofSeconds(30))
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
            .filter(propagateMdc())
            .codecs(c -> c.defaultCodecs().maxInMemorySize(2 * 1024 * 1024));
    }

    private org.springframework.web.reactive.function.client.ExchangeFilterFunction logRequest() {
        return org.springframework.web.reactive.function.client.ExchangeFilterFunction.ofRequestProcessor(clientRequest -> {
            logger.info("Outbound WebClient Request: {} {}", clientRequest.method(), clientRequest.url());
            return reactor.core.publisher.Mono.just(clientRequest);
        });
    }

    private org.springframework.web.reactive.function.client.ExchangeFilterFunction logResponse() {
        return org.springframework.web.reactive.function.client.ExchangeFilterFunction.ofResponseProcessor(clientResponse -> {
            logger.info("Inbound WebClient Response status: {}", clientResponse.statusCode());
            return reactor.core.publisher.Mono.just(clientResponse);
        });
    }

    private org.springframework.web.reactive.function.client.ExchangeFilterFunction propagateMdc() {
        return (request, next) -> {
            String correlationId = org.slf4j.MDC.get("correlationId");
            if (correlationId == null || correlationId.isBlank()) {
                return next.exchange(request);
            }

            org.springframework.web.reactive.function.client.ClientRequest propagated =
                org.springframework.web.reactive.function.client.ClientRequest.from(request)
                    .headers(headers -> headers.set("X-Correlation-Id", correlationId))
                    .build();
            return next.exchange(propagated);
        };
    }
}




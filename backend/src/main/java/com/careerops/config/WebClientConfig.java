package com.careerops.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.netty.http.client.HttpClient;

import java.time.Duration;

@Configuration
public class WebClientConfig {
    @Bean
    public WebClient.Builder webClientBuilder() {
        HttpClient http = HttpClient.create()
            .responseTimeout(Duration.ofSeconds(60));
        return WebClient.builder()
            .clientConnector(new ReactorClientHttpConnector(http))
            .codecs(c -> c.defaultCodecs().maxInMemorySize(8 * 1024 * 1024));
    }
}

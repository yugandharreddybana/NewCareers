package com.careerops.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

import java.util.Arrays;
import java.util.List;

/**
 * CORS for browser clients calling the Java API directly (local dev / tests).
 * Never use wildcard origins with credentials enabled.
 */
@Configuration
public class CorsConfig {

    @Value("${cors.allowed.origins}")
    private String origins;

    @Bean
    public CorsFilter corsFilter() {
        CorsConfiguration cfg = new CorsConfiguration();
        cfg.setAllowCredentials(true);
        cfg.setAllowedOrigins(Arrays.stream(origins.split(",")).map(String::trim).filter(s -> !s.isBlank()).toList());
        cfg.setAllowedMethods(List.of("GET","POST","PUT","PATCH","DELETE","OPTIONS"));
        cfg.setAllowedHeaders(List.of("Content-Type", "Authorization", "X-Requested-With", "X-CSRF-Token",
                "X-Internal-User-Id", "X-Timestamp", "X-Signature"));
        cfg.setExposedHeaders(List.of("X-RateLimit-Remaining", "X-RateLimit-Reset", "Retry-After"));
        cfg.setMaxAge(3600L);


        UrlBasedCorsConfigurationSource src = new UrlBasedCorsConfigurationSource();
        src.registerCorsConfiguration("/**", cfg);
        return new CorsFilter(src);
    }
}

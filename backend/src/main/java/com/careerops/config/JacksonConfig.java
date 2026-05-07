package com.careerops.config;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.http.converter.json.Jackson2ObjectMapperBuilder;

/**
 * Issue 2.074 — Structural validation.
 * Configures Jackson to FAIL_ON_UNKNOWN_PROPERTIES so that clients cannot send
 * extra fields in request bodies, enforcing strict schema compliance at the edge.
 */
@Configuration
public class JacksonConfig {

    @Bean
    @Primary
    public ObjectMapper objectMapper(Jackson2ObjectMapperBuilder builder) {
        // Issue 2.077 — Prevent OOM from deeply nested JSON
        com.fasterxml.jackson.core.JsonFactory factory = com.fasterxml.jackson.core.JsonFactory.builder()
                .streamReadConstraints(com.fasterxml.jackson.core.StreamReadConstraints.builder()
                        .maxNestingDepth(20) // Set a reasonable limit for this app
                        .build())
                .build();

        ObjectMapper mapper = builder.createXmlMapper(false)
                .factory(factory)
                .build();

        // Enforce structural validation: reject any JSON with unknown fields (Issue 2.074)
        mapper.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, true);
        mapper.registerModule(new JavaTimeModule());
        return mapper;
    }
}

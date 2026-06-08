package com.careerops.config;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;

import java.util.Arrays;

/**
 * Fail fast when unsafe dev-mode flags are enabled under the production profile.
 */
@Configuration
public class ProductionSafetyConfig {

    @Bean
    ApplicationRunner resendDevModeProdGuard(Environment env) {
        return (ApplicationArguments args) -> {
            boolean prod = Arrays.asList(env.getActiveProfiles()).contains("prod");
            boolean devMode = env.getProperty("resend.dev-mode", Boolean.class, false);
            if (prod && devMode) {
                throw new IllegalStateException(
                        "resend.dev-mode must be false when the prod profile is active");
            }
        };
    }
}

package com.careerops.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;

import java.util.Arrays;
import java.util.List;

/**
 * Fail fast when incompatible Spring profiles are active together (e.g. prod + dev leakage).
 */
@Configuration
public class ProfileActivationValidator {

    private static final Logger log = LoggerFactory.getLogger(ProfileActivationValidator.class);

    @Bean
    ApplicationRunner validateActiveProfiles(Environment env) {
        return (ApplicationArguments args) -> {
            List<String> profiles = Arrays.asList(env.getActiveProfiles());
            log.info("Active Spring profiles: {}", profiles.isEmpty() ? "[default]" : profiles);

            if (profiles.contains("prod") && profiles.contains("dev")) {
                throw new IllegalStateException(
                        "FATAL: 'prod' and 'dev' profiles cannot be active together. "
                                + "Remove spring.profiles.include=dev from base config.");
            }
            if (profiles.contains("staging") && profiles.contains("dev")) {
                throw new IllegalStateException(
                        "FATAL: 'staging' and 'dev' profiles cannot be active together.");
            }
        };
    }
}

package com.careerops.config;

import com.careerops.billing.StripeProperties;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;

import java.util.Arrays;

@Configuration
@EnableConfigurationProperties(StripeProperties.class)
public class StripeConfig {

    @Bean
    ApplicationRunner stripeProdSecretGuard(Environment env, StripeProperties stripe) {
        return (ApplicationArguments args) -> {
            boolean prod = Arrays.asList(env.getActiveProfiles()).contains("prod");
            if (!prod) {
                return;
            }
            requireNonBlank("STRIPE_SECRET_KEY", stripe.getSecretKey());
            requireNonBlank("STRIPE_WEBHOOK_SECRET", stripe.getWebhookSecret());
            requireNonBlank("STRIPE_PRICE_ID_PRO", stripe.getPriceId().getPro());
            requireNonBlank("STRIPE_PRICE_ID_ENTERPRISE", stripe.getPriceId().getEnterprise());
        };
    }

    private static void requireNonBlank(String envName, String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(
                    "FATAL: " + envName + " must be set when the prod profile is active");
        }
    }
}

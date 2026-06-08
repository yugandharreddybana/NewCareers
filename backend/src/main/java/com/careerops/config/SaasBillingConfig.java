package com.careerops.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(SaasBillingProperties.class)
public class SaasBillingConfig {
}

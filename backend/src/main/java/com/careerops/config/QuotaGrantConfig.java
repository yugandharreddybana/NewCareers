package com.careerops.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(QuotaGrantProperties.class)
public class QuotaGrantConfig {
}

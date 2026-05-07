package com.careerops.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.filter.ShallowEtagHeaderFilter;

/**
 * Task 2.062 — Support for ETag on read endpoints.
 * ShallowEtagHeaderFilter buffers the response and calculates a MD5 hash.
 * This hash is sent as the ETag header. Subsequent requests with If-None-Match
 * will return 304 Not Modified if the hash matches.
 */
@Configuration
public class WebConfig {

    @Bean
    public ShallowEtagHeaderFilter shallowEtagHeaderFilter() {
        return new ShallowEtagHeaderFilter();
    }

    @Bean
    public io.micrometer.core.aop.TimedAspect timedAspect(io.micrometer.core.instrument.MeterRegistry registry) {
        return new io.micrometer.core.aop.TimedAspect(registry);
    }
}

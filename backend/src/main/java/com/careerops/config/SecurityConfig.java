package com.careerops.config;

import com.careerops.ratelimit.RateLimitFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration(proxyBeanMethods = false)
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    private final com.careerops.security.InternalTrustFilter internalTrustFilter;
    private final RateLimitFilter rateLimitFilter;
    private final com.careerops.security.CorrelationIdFilter correlationIdFilter;
    private final com.careerops.security.IdempotencyFilter idempotencyFilter;
    private final com.careerops.security.PublicPathPolicy publicPathPolicy;
    private final org.springframework.core.env.Environment env;

    public SecurityConfig(com.careerops.security.InternalTrustFilter internalTrustFilter,
                          RateLimitFilter rateLimitFilter,
                          com.careerops.security.CorrelationIdFilter correlationIdFilter,
                          com.careerops.security.IdempotencyFilter idempotencyFilter,
                          com.careerops.security.PublicPathPolicy publicPathPolicy,
                          org.springframework.core.env.Environment env) {
        this.internalTrustFilter = internalTrustFilter;
        this.rateLimitFilter     = rateLimitFilter;
        this.correlationIdFilter = correlationIdFilter;
        this.idempotencyFilter   = idempotencyFilter;
        this.publicPathPolicy    = publicPathPolicy;
        this.env                 = env;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        // Disabling CSRF is safe here because our API is stateless. It uses JWT authentication
        // and an internal trust header (InternalTrustFilter) instead of session cookies.
        // INVARIANT: if cookie auth is reintroduced, CSRF MUST be re-enabled.
        http.csrf(c -> c.disable())
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .headers(h -> {
                h.contentSecurityPolicy(c -> c.policyDirectives("default-src 'none'"));
                h.referrerPolicy(r -> r.policy(org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter.ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN));
                h.httpStrictTransportSecurity(s -> s.maxAgeInSeconds(31536000).includeSubDomains(true).preload(true));
                h.permissionsPolicy(p -> p.policy("camera=(), geolocation=(), microphone=()"));
                h.frameOptions(f -> f.deny());
            })
            .authorizeHttpRequests(a -> a
                .requestMatchers(publicPathPolicy.securityPatterns()).permitAll()
                .anyRequest().authenticated()
            )

            // Add CorrelationIdFilter early in chain
            .addFilterBefore(correlationIdFilter, UsernamePasswordAuthenticationFilter.class)
            // InternalTrustFilter first — populates the request-scoped userId
            // from the configured internal trust header.
            .addFilterBefore(internalTrustFilter, UsernamePasswordAuthenticationFilter.class)
            // RateLimitFilter second — reads the authenticated userId resolved
            // by the filter above.
            .addFilterAfter(rateLimitFilter, com.careerops.security.InternalTrustFilter.class)
            // IdempotencyFilter third — requires userId for key scoping
            .addFilterAfter(idempotencyFilter, RateLimitFilter.class);

        if (env.acceptsProfiles(org.springframework.core.env.Profiles.of("prod"))) {
            http.requiresChannel(c -> c.anyRequest().requiresSecure());
        }

        return http.build();
    }
}

package com.careerops.config;

import com.careerops.ratelimit.IpRateLimitFilter;
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
import jakarta.servlet.http.HttpServletRequest;

@Configuration(proxyBeanMethods = false)
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    private final com.careerops.security.HmacVerificationFilter hmacVerificationFilter;
    private final com.careerops.security.InternalTrustFilter internalTrustFilter;
    private final IpRateLimitFilter ipRateLimitFilter;
    private final RateLimitFilter rateLimitFilter;
    private final com.careerops.security.CorrelationIdFilter correlationIdFilter;
    private final com.careerops.security.IdempotencyFilter idempotencyFilter;
    private final com.careerops.security.PublicPathPolicy publicPathPolicy;
    private final org.springframework.core.env.Environment env;

    public SecurityConfig(com.careerops.security.HmacVerificationFilter hmacVerificationFilter,
                          com.careerops.security.InternalTrustFilter internalTrustFilter,
                          IpRateLimitFilter ipRateLimitFilter,
                          RateLimitFilter rateLimitFilter,
                          com.careerops.security.CorrelationIdFilter correlationIdFilter,
                          com.careerops.security.IdempotencyFilter idempotencyFilter,
                          com.careerops.security.PublicPathPolicy publicPathPolicy,
                          org.springframework.core.env.Environment env) {
        this.hmacVerificationFilter = hmacVerificationFilter;
        this.internalTrustFilter = internalTrustFilter;
        this.ipRateLimitFilter   = ipRateLimitFilter;
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
                h.httpStrictTransportSecurity(s -> s
                        .requestMatcher(org.springframework.security.web.util.matcher.AnyRequestMatcher.INSTANCE)
                        .maxAgeInSeconds(31536000)
                        .includeSubDomains(true));
                h.contentTypeOptions(c -> {});
                h.frameOptions(f -> f.deny());
                h.contentSecurityPolicy(c -> c.policyDirectives("default-src 'self'"));
                h.referrerPolicy(r -> r.policy(
                        org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter.ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN));
                h.permissionsPolicy(p -> p.policy("camera=(), microphone=(), geolocation=()"));
            })
            .authorizeHttpRequests(a -> a
                .requestMatchers(this::isPublicServletPath).permitAll()
                .anyRequest().authenticated()
            )

            // Custom filters before UsernamePasswordAuthenticationFilter (last registered runs first).
            // Order: correlation → IP rate limit → HMAC → internal trust → rate limit → idempotency
            .addFilterBefore(idempotencyFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterBefore(rateLimitFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterBefore(internalTrustFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterBefore(hmacVerificationFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterBefore(ipRateLimitFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterBefore(correlationIdFilter, UsernamePasswordAuthenticationFilter.class);

        if (env.acceptsProfiles(org.springframework.core.env.Profiles.of("prod"))) {
            http.requiresChannel(c -> c.anyRequest().requiresSecure());
        }

        return http.build();
    }

    /** Matches public routes whether the servlet path is /auth/... or /v1/auth/... */
    private boolean isPublicServletPath(HttpServletRequest request) {
        return publicPathPolicy.isPublic(request);
    }
}

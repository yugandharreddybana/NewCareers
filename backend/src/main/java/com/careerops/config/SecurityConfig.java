package com.careerops.config;

import com.careerops.ratelimit.RateLimitFilter;
import com.careerops.security.InternalTrustFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final InternalTrustFilter internalTrustFilter;
    private final RateLimitFilter rateLimitFilter;

    public SecurityConfig(InternalTrustFilter internalTrustFilter,
                          RateLimitFilter rateLimitFilter) {
        this.internalTrustFilter = internalTrustFilter;
        this.rateLimitFilter     = rateLimitFilter;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http.csrf(c -> c.disable())
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(a -> a
                .requestMatchers("/auth/**", "/health").permitAll()
                .anyRequest().authenticated()
            )
            // InternalTrustFilter first — populates X-User-Id request attribute
            .addFilterBefore(internalTrustFilter, UsernamePasswordAuthenticationFilter.class)
            // RateLimitFilter second — reads X-User-Id set by the filter above
            .addFilterAfter(rateLimitFilter, InternalTrustFilter.class);
        return http.build();
    }
}

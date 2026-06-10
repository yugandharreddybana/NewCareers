package com.careerops.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.core.env.Environment;
import org.springframework.web.reactive.function.client.WebClient;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class CaptchaServiceTest {

    @Test
    @DisplayName("verify fails closed in production when secret is empty")
    void failsClosedInProductionWithoutSecret() {
        Environment env = mock(Environment.class);
        when(env.getActiveProfiles()).thenReturn(new String[] { "prod" });
        when(env.acceptsProfiles(org.springframework.core.env.Profiles.of("prod", "staging", "production")))
                .thenReturn(true);

        CaptchaService service = new CaptchaService(WebClient.builder(), "", false, env);

        assertThat(service.verify("token")).isFalse();
    }

    @Test
    @DisplayName("verify fails closed in staging when secret is empty")
    void failsClosedInStagingWithoutSecret() {
        Environment env = mock(Environment.class);
        when(env.getActiveProfiles()).thenReturn(new String[] { "staging" });
        when(env.acceptsProfiles(org.springframework.core.env.Profiles.of("prod", "staging", "production")))
                .thenReturn(true);

        CaptchaService service = new CaptchaService(WebClient.builder(), "", false, env);

        assertThat(service.verify("token")).isFalse();
    }

    @Test
    @DisplayName("verify allows requests in dev when secret is empty")
    void allowsDevWithoutSecret() {
        Environment env = mock(Environment.class);
        when(env.getActiveProfiles()).thenReturn(new String[] { "dev" });
        when(env.acceptsProfiles(org.springframework.core.env.Profiles.of("prod", "staging", "production")))
                .thenReturn(false);

        CaptchaService service = new CaptchaService(WebClient.builder(), "", false, env);

        assertThat(service.verify("token")).isTrue();
    }

    @Test
    @DisplayName("dev-mode disables enforcement even when secret is configured")
    void devModeSkipsEnforcementWithSecret() {
        Environment env = mock(Environment.class);
        when(env.getActiveProfiles()).thenReturn(new String[] { "dev" });
        when(env.acceptsProfiles(org.springframework.core.env.Profiles.of("prod", "staging", "production")))
                .thenReturn(false);

        CaptchaService service = new CaptchaService(
                WebClient.builder(), "6LcE-g8tAAAAAI1rCN3Cy7gy20Yj17Fn35KfgKAW", true, env);

        assertThat(service.isConfigured()).isTrue();
        assertThat(service.isEnforcementActive()).isFalse();
        assertThat(service.verify("any-token")).isTrue();
    }

    @Test
    @DisplayName("staging enforces when secret is configured and dev-mode is off")
    void stagingEnforcesWithSecret() {
        Environment env = mock(Environment.class);
        when(env.getActiveProfiles()).thenReturn(new String[] { "staging" });
        when(env.acceptsProfiles(org.springframework.core.env.Profiles.of("prod", "staging", "production")))
                .thenReturn(true);

        CaptchaService service = new CaptchaService(
                WebClient.builder(), "6LcE-g8tAAAAAI1rCN3Cy7gy20Yj17Fn35KfgKAW", true, env);

        assertThat(service.isEnforcementActive()).isTrue();
    }
}

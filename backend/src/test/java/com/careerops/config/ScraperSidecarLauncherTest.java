package com.careerops.config;

import org.junit.jupiter.api.Test;

import java.net.URI;

import static org.assertj.core.api.Assertions.assertThat;

class ScraperSidecarLauncherTest {

    @Test
    void isLocalSidecar_acceptsLoopbackHosts() {
        assertThat(ScraperSidecarLauncher.isLocalSidecar(URI.create("http://127.0.0.1:5500"))).isTrue();
        assertThat(ScraperSidecarLauncher.isLocalSidecar(URI.create("http://localhost:5500"))).isTrue();
        assertThat(ScraperSidecarLauncher.isLocalSidecar(URI.create("http://scraper:5500"))).isFalse();
    }

    @Test
    void parseBaseUrl_defaultsWhenBlank() {
        assertThat(ScraperSidecarLauncher.parseBaseUrl(""))
            .isEqualTo(URI.create("http://127.0.0.1:5500"));
    }
}

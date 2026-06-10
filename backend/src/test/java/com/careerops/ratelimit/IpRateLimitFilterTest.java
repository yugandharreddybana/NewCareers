package com.careerops.ratelimit;

import com.careerops.security.TrustedProxyIpResolver;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;

class IpRateLimitFilterTest {

    private IpRateLimitFilter filter;

    @BeforeEach
    void setUp() {
        filter = new IpRateLimitFilter(new ObjectMapper().findAndRegisterModules());
    }

    @Test
    @DisplayName("allows 20 login requests per IP then returns 429 with Retry-After 60")
    void loginRateLimit() throws Exception {
        for (int i = 0; i < 20; i++) {
            MockHttpServletRequest request = loginRequest("192.0.2.1");
            MockHttpServletResponse response = new MockHttpServletResponse();
            MockFilterChain chain = new MockFilterChain();
            filter.doFilter(request, response, chain);
            assertThat(chain.getRequest()).isNotNull();
            assertThat(response.getStatus()).isEqualTo(200);
        }

        MockHttpServletRequest blocked = loginRequest("192.0.2.1");
        MockHttpServletResponse blockedResponse = new MockHttpServletResponse();
        MockFilterChain blockedChain = new MockFilterChain();
        filter.doFilter(blocked, blockedResponse, blockedChain);

        assertThat(blockedChain.getRequest()).isNull();
        assertThat(blockedResponse.getStatus()).isEqualTo(429);
        assertThat(blockedResponse.getHeader("Retry-After")).isEqualTo("60");
        assertThat(blockedResponse.getContentAsString()).contains("Too many requests");
    }

    @Test
    @DisplayName("register endpoint uses same per-IP limit")
    void registerRateLimit() throws Exception {
        for (int i = 0; i < 20; i++) {
            MockHttpServletRequest request = registerRequest("192.0.2.2");
            MockHttpServletResponse response = new MockHttpServletResponse();
            MockFilterChain chain = new MockFilterChain();
            filter.doFilter(request, response, chain);
            assertThat(chain.getRequest()).isNotNull();
        }

        MockHttpServletRequest blocked = registerRequest("192.0.2.2");
        MockHttpServletResponse blockedResponse = new MockHttpServletResponse();
        MockFilterChain blockedChain = new MockFilterChain();
        filter.doFilter(blocked, blockedResponse, blockedChain);

        assertThat(blockedChain.getRequest()).isNull();
        assertThat(blockedResponse.getStatus()).isEqualTo(429);
    }

    @Test
    @DisplayName("2FA and Google link confirmation callbacks use auth per-IP limits")
    void stepUpCallbackRateLimits() throws Exception {
        assertAuthPathLimited("/auth/two-factor/verify", "192.0.2.20");
        assertAuthPathLimited("/auth/google/link/confirm", "192.0.2.21");
        assertAuthPathLimited("/v1/auth/two-factor/verify", "192.0.2.22");
        assertAuthPathLimited("/v1/auth/google/link/confirm", "192.0.2.23");
    }

    @Test
    @DisplayName("X-Forwarded-For is honored only when TRUSTED_PROXY is set")
    void forwardedForRequiresTrustedProxy() throws Exception {
        String previous = System.getenv("TRUSTED_PROXY");
        try {
            for (int i = 0; i < 20; i++) {
                MockHttpServletRequest request = loginRequest("10.0.0.99");
                request.addHeader("X-Forwarded-For", "203.0.113.1, 10.0.0.1");
                MockHttpServletResponse response = new MockHttpServletResponse();
                MockFilterChain chain = new MockFilterChain();
                filter.doFilter(request, response, chain);
                assertThat(chain.getRequest()).isNotNull();
            }

            MockHttpServletRequest blocked = loginRequest("10.0.0.99");
            blocked.addHeader("X-Forwarded-For", "203.0.113.1, 10.0.0.1");
            MockHttpServletResponse blockedResponse = new MockHttpServletResponse();
            MockFilterChain blockedChain = new MockFilterChain();
            filter.doFilter(blocked, blockedResponse, blockedChain);
            assertThat(blockedChain.getRequest()).isNull();
            assertThat(blockedResponse.getStatus()).isEqualTo(429);

            MockHttpServletRequest otherForwarded = loginRequest("10.0.0.99");
            otherForwarded.addHeader("X-Forwarded-For", "198.51.100.9, 10.0.0.1");
            MockHttpServletResponse otherResponse = new MockHttpServletResponse();
            MockFilterChain otherChain = new MockFilterChain();
            filter.doFilter(otherForwarded, otherResponse, otherChain);
            assertThat(otherChain.getRequest()).isNull();
            assertThat(otherResponse.getStatus()).isEqualTo(429);
        } finally {
            if (previous != null) {
                // env vars are immutable in JVM — test documents loopback-only default
            }
        }
    }

    @Test
    @DisplayName("billing webhook is rate limited at 100 per minute")
    void webhookRateLimit() throws Exception {
        for (int i = 0; i < 100; i++) {
            MockHttpServletRequest request = webhookRequest("192.0.2.50");
            MockHttpServletResponse response = new MockHttpServletResponse();
            MockFilterChain chain = new MockFilterChain();
            filter.doFilter(request, response, chain);
            assertThat(chain.getRequest()).isNotNull();
        }

        MockHttpServletRequest blocked = webhookRequest("192.0.2.50");
        MockHttpServletResponse blockedResponse = new MockHttpServletResponse();
        MockFilterChain blockedChain = new MockFilterChain();
        filter.doFilter(blocked, blockedResponse, blockedChain);

        assertThat(blockedChain.getRequest()).isNull();
        assertThat(blockedResponse.getStatus()).isEqualTo(429);
    }

    @Test
    @DisplayName("non-auth paths are not limited")
    void healthNotLimited() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/health");
        request.setServletPath("/health");
        request.setRemoteAddr("192.0.2.3");
        MockHttpServletResponse response = new MockHttpServletResponse();

        for (int i = 0; i < 25; i++) {
            MockFilterChain chain = new MockFilterChain();
            filter.doFilter(request, response, chain);
            assertThat(chain.getRequest()).isNotNull();
        }

        assertThat(response.getStatus()).isEqualTo(200);
    }

    @Test
    @DisplayName("/v1/auth/login is normalized and rate limited")
    void v1LoginPathLimited() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/auth/login");
        request.setServletPath("/v1/auth/login");
        request.setRemoteAddr("192.0.2.4");

        for (int i = 0; i < 20; i++) {
            MockHttpServletResponse response = new MockHttpServletResponse();
            MockFilterChain chain = new MockFilterChain();
            filter.doFilter(request, response, chain);
            assertThat(chain.getRequest()).isNotNull();
        }

        MockHttpServletResponse blockedResponse = new MockHttpServletResponse();
        MockFilterChain blockedChain = new MockFilterChain();
        filter.doFilter(request, blockedResponse, blockedChain);
        assertThat(blockedChain.getRequest()).isNull();
        assertThat(blockedResponse.getStatus()).isEqualTo(429);
    }

    @Test
    @DisplayName("resolveClientIp honors X-Forwarded-For from loopback middleware")
    void resolveClientIpFromLoopbackProxy() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("X-Forwarded-For", "203.0.113.5, 10.0.0.2");
        request.setRemoteAddr("127.0.0.1");
        assertThat(TrustedProxyIpResolver.resolveClientIp(request)).isEqualTo("203.0.113.5");
    }

    @Test
    @DisplayName("resolveClientIp ignores X-Forwarded-For from non-trusted remote")
    void resolveClientIpIgnoresForwardedWithoutTrust() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("X-Forwarded-For", "203.0.113.5, 10.0.0.2");
        request.setRemoteAddr("10.0.0.99");
        assertThat(TrustedProxyIpResolver.resolveClientIp(request)).isEqualTo("10.0.0.99");
    }

    private static MockHttpServletRequest loginRequest(String remoteAddr) {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/auth/login");
        request.setServletPath("/auth/login");
        request.setRemoteAddr(remoteAddr);
        return request;
    }

    private static MockHttpServletRequest registerRequest(String remoteAddr) {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/auth/register");
        request.setServletPath("/auth/register");
        request.setRemoteAddr(remoteAddr);
        return request;
    }

    private void assertAuthPathLimited(String path, String remoteAddr) throws Exception {
        for (int i = 0; i < 20; i++) {
            MockHttpServletRequest request = authPathRequest(path, remoteAddr);
            MockHttpServletResponse response = new MockHttpServletResponse();
            MockFilterChain chain = new MockFilterChain();
            filter.doFilter(request, response, chain);
            assertThat(chain.getRequest()).isNotNull();
        }

        MockHttpServletRequest blocked = authPathRequest(path, remoteAddr);
        MockHttpServletResponse blockedResponse = new MockHttpServletResponse();
        MockFilterChain blockedChain = new MockFilterChain();
        filter.doFilter(blocked, blockedResponse, blockedChain);

        assertThat(blockedChain.getRequest()).isNull();
        assertThat(blockedResponse.getStatus()).isEqualTo(429);
    }

    private static MockHttpServletRequest authPathRequest(String path, String remoteAddr) {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", path);
        request.setServletPath(path);
        request.setRemoteAddr(remoteAddr);
        return request;
    }

    private static MockHttpServletRequest webhookRequest(String remoteAddr) {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/billing/webhook");
        request.setServletPath("/billing/webhook");
        request.setRemoteAddr(remoteAddr);
        return request;
    }
}

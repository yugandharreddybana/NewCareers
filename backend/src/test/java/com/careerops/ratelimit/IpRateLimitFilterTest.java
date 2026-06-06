package com.careerops.ratelimit;

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
    @DisplayName("X-Forwarded-For first hop is used as client IP")
    void forwardedForClientIp() throws Exception {
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

        MockHttpServletRequest otherIp = loginRequest("10.0.0.99");
        otherIp.addHeader("X-Forwarded-For", "198.51.100.9, 10.0.0.1");
        MockHttpServletResponse otherResponse = new MockHttpServletResponse();
        MockFilterChain otherChain = new MockFilterChain();
        filter.doFilter(otherIp, otherResponse, otherChain);
        assertThat(otherChain.getRequest()).isNotNull();
    }

    @Test
    @DisplayName("non-auth paths are not limited")
    void healthNotLimited() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/health");
        request.setServletPath("/health");
        request.setRemoteAddr("192.0.2.3");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        for (int i = 0; i < 25; i++) {
            filter.doFilter(request, response, chain);
        }

        assertThat(chain.getRequest()).isNotNull();
        assertThat(response.getStatus()).isEqualTo(200);
    }

    @Test
    @DisplayName("resolveClientIp prefers X-Forwarded-For first hop")
    void resolveClientIp() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("X-Forwarded-For", "203.0.113.5, 10.0.0.2");
        request.setRemoteAddr("127.0.0.1");
        assertThat(IpRateLimitFilter.resolveClientIp(request)).isEqualTo("203.0.113.5");
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
}

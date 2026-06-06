package com.careerops.security;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;

class HmacVerificationFilterTest {

    private HmacVerificationFilter filter;

    @BeforeEach
    void setUp() {
        InternalHmacSigner signer = InternalHmacSigner.forTest(InternalRequestHeaders.TEST_SECRET.getBytes(StandardCharsets.UTF_8));
        filter = new HmacVerificationFilter(signer, new PublicPathPolicy());
    }

    @Test
    @DisplayName("public /health bypasses HMAC")
    void publicHealthBypass() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/health");
        request.setServletPath("/health");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        assertThat(chain.getRequest()).isNotNull();
        assertThat(response.getStatus()).isEqualTo(200);
    }

    @Test
    @DisplayName("missing signature returns 401 on protected path")
    void missingSignature() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/profile");
        request.setServletPath("/profile");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        assertThat(chain.getRequest()).isNull();
        assertThat(response.getStatus()).isEqualTo(401);
        assertThat(response.getContentAsString()).contains("invalid or expired signature");
    }

    @Test
    @DisplayName("valid signature allows protected path")
    void validSignature() throws Exception {
        long ts = System.currentTimeMillis();
        InternalHmacSigner signer = InternalHmacSigner.forTest(InternalRequestHeaders.TEST_SECRET.getBytes(StandardCharsets.UTF_8));
        String sig = signer.sign(ts, "GET", "/profile", new byte[0]);

        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/profile");
        request.setServletPath("/profile");
        request.addHeader(InternalHmacSigner.TIMESTAMP_HEADER, String.valueOf(ts));
        request.addHeader(InternalHmacSigner.SIGNATURE_HEADER, sig);

        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        assertThat(chain.getRequest()).isNotNull();
        assertThat(response.getStatus()).isEqualTo(200);
    }

    @Test
    @DisplayName("expired timestamp returns 401")
    void expiredTimestamp() throws Exception {
        long stale = System.currentTimeMillis() - InternalHmacSigner.DEFAULT_MAX_SKEW_MS - 5_000;
        InternalHmacSigner signer = InternalHmacSigner.forTest(InternalRequestHeaders.TEST_SECRET.getBytes(StandardCharsets.UTF_8));
        String sig = signer.sign(stale, "GET", "/profile", new byte[0]);

        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/profile");
        request.setServletPath("/profile");
        request.addHeader(InternalHmacSigner.TIMESTAMP_HEADER, String.valueOf(stale));
        request.addHeader(InternalHmacSigner.SIGNATURE_HEADER, sig);

        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        assertThat(chain.getRequest()).isNull();
        assertThat(response.getStatus()).isEqualTo(401);
    }
}

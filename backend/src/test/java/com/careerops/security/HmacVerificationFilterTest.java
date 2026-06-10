package com.careerops.security;

import org.springframework.mock.env.MockEnvironment;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.multipart.support.StandardServletMultipartResolver;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;

class HmacVerificationFilterTest {

    private HmacVerificationFilter filter;

    @BeforeEach
    void setUp() {
        InternalHmacSigner signer = InternalHmacSigner.forTest(InternalRequestHeaders.TEST_SECRET.getBytes(StandardCharsets.UTF_8));
        filter = new HmacVerificationFilter(
                signer, new PublicPathPolicy(new MockEnvironment()), new StandardServletMultipartResolver());
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

    @Test
    @DisplayName("POST /auth/signup-intent bypasses HMAC (pre-auth signup)")
    void signupIntentBypassesHmac() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/auth/signup-intent");
        request.setServletPath("/auth/signup-intent");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        assertThat(chain.getRequest()).isNotNull();
        assertThat(response.getStatus()).isEqualTo(200);
    }

    @Test
    @DisplayName("POST /profile/cv with binary multipart body verifies when signed with ISO-8859-1")
    void binaryMultipartCvUpload() throws Exception {
        byte[] body = new byte[] {
                0x2d, 0x2d, 0x62, 0x6f, 0x75, 0x6e, 0x64, 0x61, 0x72, 0x79,
                (byte) 0xFF, (byte) 0xFE, 0x25, 0x50, 0x44, 0x46
        };
        long ts = System.currentTimeMillis();
        InternalHmacSigner signer = InternalHmacSigner.forTest(
                InternalRequestHeaders.TEST_SECRET.getBytes(StandardCharsets.UTF_8));
        String sig = signer.sign(ts, "POST", "/profile/cv", body);

        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/profile/cv");
        request.setServletPath("/profile/cv");
        request.setContent(body);
        request.setContentType("multipart/form-data; boundary=----probe");
        request.addHeader(InternalHmacSigner.TIMESTAMP_HEADER, String.valueOf(ts));
        request.addHeader(InternalHmacSigner.SIGNATURE_HEADER, sig);

        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        assertThat(chain.getRequest()).isNotNull();
        assertThat(response.getStatus()).isEqualTo(200);
    }

    @Test
    @DisplayName("multipart replay resolves file part for downstream controllers")
    void multipartReplayExposesFilePart() throws Exception {
        byte[] body = java.nio.file.Files.readAllBytes(
                java.nio.file.Path.of("src/test/resources/probe-multipart.bin"));
        long ts = System.currentTimeMillis();
        InternalHmacSigner signer = InternalHmacSigner.forTest(
                InternalRequestHeaders.TEST_SECRET.getBytes(StandardCharsets.UTF_8));
        String sig = signer.sign(ts, "POST", "/profile/cv", body);

        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/profile/cv");
        request.setServletPath("/profile/cv");
        request.setContent(body);
        request.setContentType("multipart/form-data; boundary=--------------------------8d587913365aae9a34188335");
        request.addHeader(InternalHmacSigner.TIMESTAMP_HEADER, String.valueOf(ts));
        request.addHeader(InternalHmacSigner.SIGNATURE_HEADER, sig);

        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        assertThat(chain.getRequest()).isInstanceOf(org.springframework.web.multipart.MultipartHttpServletRequest.class);
        var multipart = (org.springframework.web.multipart.MultipartHttpServletRequest) chain.getRequest();
        assertThat(multipart.getFile("file")).isNotNull();
        assertThat(multipart.getFile("file").getOriginalFilename()).isEqualTo("t.pdf");
    }

    @Test
    @DisplayName("H-3: /auth/me requires HMAC — BFF-only protected route")
    void authMeRequiresHmac() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/auth/me");
        request.setServletPath("/auth/me");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        assertThat(chain.getRequest()).isNull();
        assertThat(response.getStatus()).isEqualTo(401);
        assertThat(response.getContentAsString()).contains("invalid or expired signature");
    }
}

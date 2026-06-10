package com.careerops.ratelimit;

import com.careerops.security.PublicPathPolicy;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.bucket4j.Bandwidth;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RateLimitFilterTest {

    @Mock
    private PublicPathPolicy publicPathPolicy;

    @Mock
    private StringRedisTemplate redisTemplate;

    @Mock
    private ValueOperations<String, String> valueOperations;

    @Test
    @DisplayName("configured trust header is rate limited without legacy X-User-Id")
    void configuredTrustHeaderIsRateLimitedWithoutLegacyHeader() throws Exception {
        RateLimitFilter filter = new RateLimitFilter(defaultBandwidth(), objectMapper(), publicPathPolicy);
        ReflectionTestUtils.setField(filter, "trustHeader", "X-Internal-User-Id");

        when(publicPathPolicy.isPublic("/skills/start")).thenReturn(false);

        MockHttpServletRequest firstRequest = new MockHttpServletRequest("POST", "/skills/start");
        firstRequest.setServletPath("/skills/start");
        firstRequest.addHeader("X-Internal-User-Id", "00000000-0000-0000-0000-000000000001");
        MockHttpServletResponse firstResponse = new MockHttpServletResponse();
        MockFilterChain firstChain = new MockFilterChain();

        filter.doFilter(firstRequest, firstResponse, firstChain);

        assertThat(firstChain.getRequest()).isNotNull();
        assertThat(firstResponse.getStatus()).isEqualTo(200);
        assertThat(firstResponse.getHeader("X-RateLimit-Limit")).isEqualTo("1");
        assertThat(firstResponse.getHeader("X-RateLimit-Remaining")).isEqualTo("0");

        MockHttpServletRequest secondRequest = new MockHttpServletRequest("POST", "/skills/start");
        secondRequest.setServletPath("/skills/start");
        secondRequest.addHeader("X-Internal-User-Id", "00000000-0000-0000-0000-000000000001");
        MockHttpServletResponse secondResponse = new MockHttpServletResponse();
        MockFilterChain secondChain = new MockFilterChain();

        filter.doFilter(secondRequest, secondResponse, secondChain);

        assertThat(secondChain.getRequest()).isNull();
        assertThat(secondResponse.getStatus()).isEqualTo(429);
        assertThat(secondResponse.getHeader("Retry-After")).isNotBlank();
    }

    @Test
    @DisplayName("/v1 servlet paths normalize before public-path policy check")
    void v1ServletPathsNormalizeBeforePublicPolicyCheck() throws Exception {
        RateLimitFilter filter = new RateLimitFilter(defaultBandwidth(), objectMapper(), publicPathPolicy);
        ReflectionTestUtils.setField(filter, "trustHeader", "X-Internal-User-Id");

        when(publicPathPolicy.isPublic("/skills/start")).thenReturn(false);

        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/skills/start");
        request.setServletPath("/v1/skills/start");
        request.addHeader("X-Internal-User-Id", "00000000-0000-0000-0000-000000000001");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        assertThat(chain.getRequest()).isNotNull();
        assertThat(response.getStatus()).isEqualTo(200);
    }

    @Test
    @DisplayName("shared-store mode fails startup when Redis is missing")
    void sharedStoreModeFailsStartupWhenRedisIsMissing() {
        RateLimitFilter filter = new RateLimitFilter(defaultBandwidth(), objectMapper(), publicPathPolicy);
        ReflectionTestUtils.setField(filter, "requireSharedStore", true);

        assertThatThrownBy(filter::validateSharedStoreConfiguration)
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("Shared rate limiting requires Redis");
    }

    @Test
    @DisplayName("shared-store mode rejects requests when Redis is unavailable")
    void sharedStoreModeRejectsRequestsWhenRedisIsUnavailable() throws Exception {
        RateLimitFilter filter = new RateLimitFilter(defaultBandwidth(), objectMapper(), publicPathPolicy);
        ReflectionTestUtils.setField(filter, "trustHeader", "X-Internal-User-Id");
        ReflectionTestUtils.setField(filter, "requireSharedStore", true);
        ReflectionTestUtils.setField(filter, "redisHost", "localhost");
        ReflectionTestUtils.setField(filter, "redisTemplate", redisTemplate);

        when(publicPathPolicy.isPublic("/skills/start")).thenReturn(false);
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.increment(anyString())).thenThrow(new RuntimeException("redis down"));

        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/skills/start");
        request.setServletPath("/skills/start");
        request.addHeader("X-Internal-User-Id", "00000000-0000-0000-0000-000000000001");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        assertThat(chain.getRequest()).isNull();
        assertThat(response.getStatus()).isEqualTo(503);
        assertThat(response.getContentAsString()).contains("Rate limiting is temporarily unavailable");
    }

    private Bandwidth defaultBandwidth() {
        return Bandwidth.builder()
            .capacity(1)
            .refillGreedy(1, Duration.ofMinutes(1))
            .initialTokens(1)
            .build();
    }

    private ObjectMapper objectMapper() {
        return new ObjectMapper().findAndRegisterModules();
    }
}
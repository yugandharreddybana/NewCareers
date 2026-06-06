package com.careerops.controller;

import com.careerops.model.AgentResult;
import com.careerops.ratelimit.RateLimitFilter;
import com.careerops.service.ClaudeAgentService;
import com.careerops.service.ClaudeDirectService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Task 142 — SkillsController full-HTTP integration tests
 * POST /skills/start for each of 14 skills returns expected shape.
 */
@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SkillsControllerIntegrationTest {

    @Autowired MockMvc mockMvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper mapper;
    @Autowired RateLimitFilter rateLimitFilter;

    @MockBean ClaudeAgentService claudeAgentService;
    @MockBean ClaudeDirectService claudeDirectService;

    private static final String USER_JOB_ID = "00000000-0000-0000-0000-000000000111";
    private static final String INTERNAL_SECRET = "test-internal-trust-secret-minimum-32-characters-long";
    private static final String INTERNAL_USER_ID = "00000000-0000-0000-0000-000000000001";
    private static final String INTERNAL_USERNAME = "skills-" + INTERNAL_USER_ID;
    private static final String INTERNAL_EMAIL = "skills-" + INTERNAL_USER_ID + "@example.com";

    @BeforeEach
    void ensureAuthenticatedUserExists() {
        UUID userId = UUID.fromString(INTERNAL_USER_ID);
        jdbc.update(
            """
            DELETE FROM careerops.users
            WHERE (email = ? OR username = ?) AND id <> ?
            """,
            INTERNAL_EMAIL,
            INTERNAL_USERNAME,
            userId
        );

        Integer existingUsers = jdbc.queryForObject(
            """
            SELECT COUNT(*)
            FROM careerops.users
            WHERE id = ?
            """,
            Integer.class,
            userId
        );

        if (existingUsers != null && existingUsers > 0) {
            jdbc.update(
                """
                UPDATE careerops.users
                SET name = ?,
                    username = ?,
                    email = ?,
                    password_hash = ?,
                    role = ?,
                    locale = ?,
                    failed_login_attempts = ?,
                    locked_until = NULL,
                    email_verified_at = NULL,
                    last_login_at = NULL,
                    ai_processing_consent = ?,
                    deleted_at = NULL
                WHERE id = ?
                """,
                "Skills Test User",
                INTERNAL_USERNAME,
                INTERNAL_EMAIL,
                "test-password-hash",
                "USER",
                "en",
                0,
                true,
                userId
            );
            return;
        }

        jdbc.update(
            """
            INSERT INTO careerops.users (
                id,
                name,
                username,
                email,
                password_hash,
                role,
                locale,
                failed_login_attempts,
                ai_processing_consent,
                created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP())
            """,
            userId,
            "Skills Test User",
            INTERNAL_USERNAME,
            INTERNAL_EMAIL,
            "test-password-hash",
            "USER",
            "en",
            0,
            true
        );
    }

    @BeforeEach
    void stubAiClients() {
        lenient().when(claudeAgentService.run(anyString(), any(ArrayNode.class), any(UUID.class), any(UUID.class)))
            .thenReturn(AgentResult.done("{\"source\":\"mock-agent\"}"));

        lenient().when(claudeDirectService.generateJson(anyString(), anyString(), any(UUID.class), anyString()))
            .thenAnswer(invocation -> mapper.createObjectNode()
                .put("source", "mock-direct")
                .put("feature", invocation.getArgument(3, String.class))
            );
    }

    @BeforeEach
    void resetRateLimitBuckets() {
        clearRateLimitCache("buckets");
        clearRateLimitCache("ipBuckets");
    }

    @ParameterizedTest(name = "POST /skills/start — skill: {0}")
    @ValueSource(strings = {
        "evaluate", "tailor-resume", "research", "outreach",
        "apply", "prep-interview", "compare", "triage", "scan",
        "salary-negotiation", "culture-fit", "linkedin-optimize",
        "cover-letter", "skills-gap-plan"
    })
    void postSkillStart_returnsExpectedShape(String skillName) throws Exception {
        String body = """
            {
              "userJobId": "%s",
              "skillName": "%s"
            }
            """.formatted(USER_JOB_ID, skillName);

        mockMvc.perform(
            post("/skills/start")
                .with(com.careerops.security.InternalRequestHeaders.hmac("POST", "/skills/start", body))
                .header("X-Internal-User-Id", INTERNAL_USER_ID)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body)
        )
        .andExpect(status().isOk())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
        .andExpect(jsonPath("$.type").exists())
        .andExpect(jsonPath("$.skillName").value(skillName));
    }

    @Test
    @DisplayName("GET /skills/last-run — no prior run returns 204")
    void getLastRun_noPriorRun_returns204() throws Exception {
        mockMvc.perform(
            get("/skills/last-run/{userJobId}/{skillName}", USER_JOB_ID, "tailor-resume")
                .with(com.careerops.security.InternalRequestHeaders.hmac(
                        "GET", "/skills/last-run/" + USER_JOB_ID + "/tailor-resume", new byte[0]))
                .header("X-Internal-User-Id", INTERNAL_USER_ID)
        )
        .andExpect(status().isNoContent());
    }

    @Test
    @DisplayName("POST /skills/start — unauthenticated returns 401")
    void postSkillStart_unauthenticated_returns401() throws Exception {
        mockMvc.perform(
            post("/skills/start")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"userJobId\":\"x\",\"skillName\":\"evaluate\"}")
        )
        .andExpect(status().isUnauthorized());
    }

    private void clearRateLimitCache(String fieldName) {
        Object cache = ReflectionTestUtils.getField(rateLimitFilter, fieldName);
        if (cache instanceof com.github.benmanes.caffeine.cache.Cache<?, ?> caffeineCache) {
            caffeineCache.invalidateAll();
        }
    }
}


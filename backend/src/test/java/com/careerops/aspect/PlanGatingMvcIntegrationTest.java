package com.careerops.aspect;

import com.careerops.annotation.PlanGated;
import com.careerops.exception.GlobalExceptionHandler;
import com.careerops.exception.PlanLimitExceededException;
import com.careerops.model.SubscriptionPlan;
import com.careerops.service.PlanEnforcementService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.EnableAspectJAutoProxy;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.junit.jupiter.SpringExtension;
import org.springframework.test.context.junit.jupiter.web.SpringJUnitWebConfig;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.WebApplicationContext;

import java.util.UUID;

import static org.mockito.Mockito.doThrow;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Proves gated controller endpoints return HTTP 402 through Spring MVC + AOP (BILL-TEST-006).
 */
@ExtendWith(SpringExtension.class)
@SpringJUnitWebConfig(classes = PlanGatingMvcIntegrationTest.Config.class)
class PlanGatingMvcIntegrationTest {

    @Configuration
    @EnableAspectJAutoProxy
    static class Config {

        static final PlanEnforcementService ENFORCEMENT = Mockito.mock(PlanEnforcementService.class);

        @Bean
        @Primary
        PlanEnforcementService planEnforcementService() {
            return ENFORCEMENT;
        }

        @Bean
        PlanGatingAspect planGatingAspect(PlanEnforcementService planEnforcementService) {
            return new PlanGatingAspect(planEnforcementService);
        }

        @Bean
        GatedTestController gatedTestController() {
            return new GatedTestController();
        }

        @Bean
        GlobalExceptionHandler globalExceptionHandler() {
            return new GlobalExceptionHandler();
        }

        @Bean
        MappingJackson2HttpMessageConverter mappingJackson2HttpMessageConverter() {
            return new MappingJackson2HttpMessageConverter();
        }
    }

    @RestController
    static class GatedTestController {

        @PostMapping("/test/cv-upload")
        @PlanGated("cv_upload")
        public void uploadCv() {
            // gated by aspect
        }
    }

    @Autowired
    private WebApplicationContext context;

    private final UUID userId = UUID.randomUUID();
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders
                .standaloneSetup(context.getBean(GatedTestController.class))
                .setControllerAdvice(new GlobalExceptionHandler())
                .setMessageConverters(new MappingJackson2HttpMessageConverter())
                .build();
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(userId.toString(), null));
        Mockito.reset(Config.ENFORCEMENT);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("POST gated endpoint returns 402 when plan limit exceeded")
    void gatedEndpointReturns402() throws Exception {
        doThrow(PlanLimitExceededException.of("cv_upload", SubscriptionPlan.FREE))
                .when(Config.ENFORCEMENT)
                .checkCvUploadAllowed(userId);

        mockMvc.perform(post("/test/cv-upload")
                        .contentType(MediaType.APPLICATION_JSON)
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isPaymentRequired())
                .andExpect(jsonPath("$.error").value("PLAN_LIMIT_EXCEEDED"))
                .andExpect(jsonPath("$.feature").value("cv_upload"))
                .andExpect(jsonPath("$.currentPlan").value("FREE"));
    }
}

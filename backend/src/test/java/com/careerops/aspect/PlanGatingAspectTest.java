package com.careerops.aspect;

import com.careerops.annotation.PlanGated;
import com.careerops.service.PlanEnforcementService;
import org.aspectj.lang.ProceedingJoinPoint;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PlanGatingAspectTest {

    @Mock
    private PlanEnforcementService enforcement;
    @Mock
    private ProceedingJoinPoint joinPoint;
    @Mock
    private PlanGated planGated;

    private PlanGatingAspect aspect;
    private final UUID userId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        aspect = new PlanGatingAspect(enforcement);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(userId.toString(), null));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void dispatchesAiSkillRunWithCost() throws Throwable {
        when(planGated.value()).thenReturn("ai_skill_run");
        when(planGated.cost()).thenReturn(9);
        when(joinPoint.proceed()).thenReturn("ok");

        Object result = aspect.gate(joinPoint, planGated);

        verify(enforcement).checkAiRunAllowed(userId, 9);
        assertEquals("ok", result);
    }

    @Test
    void dispatchesCvUploadGate() throws Throwable {
        when(planGated.value()).thenReturn("cv_upload");
        when(joinPoint.proceed()).thenReturn("uploaded");

        Object result = aspect.gate(joinPoint, planGated);

        verify(enforcement).checkCvUploadAllowed(userId);
        assertEquals("uploaded", result);
    }

    @Test
    void dispatchesJobApplicationGate() throws Throwable {
        when(planGated.value()).thenReturn("job_application");
        when(joinPoint.proceed()).thenReturn("started");

        Object result = aspect.gate(joinPoint, planGated);

        verify(enforcement).checkApplicationAllowed(userId);
        assertEquals("started", result);
    }
}

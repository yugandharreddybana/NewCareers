package com.careerops.aspect;

import com.careerops.annotation.PlanGated;
import com.careerops.service.PlanEnforcementService;
import com.careerops.util.AuthUtil;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Aspect
@Component
public class PlanGatingAspect {

    private final PlanEnforcementService enforcement;

    public PlanGatingAspect(PlanEnforcementService enforcement) {
        this.enforcement = enforcement;
    }

    @Around("@annotation(planGated)")
    public Object gate(ProceedingJoinPoint pjp, PlanGated planGated) throws Throwable {
        UUID userId = AuthUtil.currentUserId();
        switch (planGated.value()) {
            case "ai_skill_run" -> enforcement.checkAiRunAllowed(userId, planGated.cost());
            case "cv_upload" -> enforcement.checkCvUploadAllowed(userId);
            case "job_application" -> enforcement.checkApplicationAllowed(userId);
            default -> throw new IllegalStateException("Unknown plan gate: " + planGated.value());
        }
        return pjp.proceed();
    }
}

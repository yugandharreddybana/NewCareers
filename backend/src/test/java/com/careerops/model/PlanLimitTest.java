package com.careerops.model;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PlanLimitTest {

    @Test
    void freePlanMatchesSpec() {
        PlanLimit limit = PlanLimit.free();
        assertEquals(5, limit.aiSkillRunsPerMonth());
        assertEquals(10, limit.jobApplicationsPerMonth());
        assertEquals(1, limit.cvUploads());
        assertEquals(1, limit.teamMembers());
    }

    @Test
    void proPlanMatchesSpec() {
        PlanLimit limit = PlanLimit.pro();
        assertEquals(200, limit.aiSkillRunsPerMonth());
        assertTrue(limit.isUnlimited(limit.jobApplicationsPerMonth()));
        assertEquals(10, limit.cvUploads());
        assertEquals(5, limit.teamMembers());
    }

    @Test
    void enterprisePlanIsUnlimited() {
        PlanLimit limit = PlanLimit.enterprise();
        assertTrue(limit.isUnlimited(limit.aiSkillRunsPerMonth()));
        assertTrue(limit.isUnlimited(limit.jobApplicationsPerMonth()));
        assertTrue(limit.isUnlimited(limit.cvUploads()));
        assertTrue(limit.isUnlimited(limit.teamMembers()));
    }

    @Test
    void forPlanDispatchesCorrectly() {
        assertEquals(PlanLimit.free(), PlanLimit.forPlan(SubscriptionPlan.FREE));
        assertEquals(PlanLimit.pro(), PlanLimit.forPlan(SubscriptionPlan.PRO));
        assertEquals(PlanLimit.enterprise(), PlanLimit.forPlan(SubscriptionPlan.ENTERPRISE));
    }
}

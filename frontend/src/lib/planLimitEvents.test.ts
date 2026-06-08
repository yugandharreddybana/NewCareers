import { describe, expect, it, vi } from 'vitest';
import {
  emitPlanLimitExceeded,
  parsePlanLimitResponse,
  subscribePlanLimitExceeded,
} from '@/lib/planLimitEvents';

describe('planLimitEvents', () => {
  it('parsePlanLimitResponse maps 402 payload fields', () => {
    const parsed = parsePlanLimitResponse({
      error: 'PLAN_LIMIT_EXCEEDED',
      feature: 'ai_skill_run',
      currentPlan: 'FREE',
      upgradeUrl: '/pricing',
    });

    expect(parsed).toEqual({
      feature: 'ai_skill_run',
      currentPlan: 'FREE',
      upgradeUrl: '/pricing',
    });
  });

  it('emitPlanLimitExceeded notifies subscribers with feature name', () => {
    const listener = vi.fn();
    const unsubscribe = subscribePlanLimitExceeded(listener);

    emitPlanLimitExceeded({
      feature: 'job_application',
      currentPlan: 'FREE',
      upgradeUrl: '/pricing',
    });

    expect(listener).toHaveBeenCalledWith({
      feature: 'job_application',
      currentPlan: 'FREE',
      upgradeUrl: '/pricing',
    });

    unsubscribe();
  });
});

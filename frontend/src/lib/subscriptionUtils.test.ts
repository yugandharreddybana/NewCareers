import { describe, it, expect } from 'vitest';
import { formatPlanLimitFeature, subscriptionPlanToCardId } from '@/lib/subscriptionUtils';

describe('subscriptionUtils', () => {
  it('formatPlanLimitFeature replaces underscores', () => {
    expect(formatPlanLimitFeature('ai_skill_run')).toBe('ai skill run');
  });

  it('subscriptionPlanToCardId maps plan codes', () => {
    expect(subscriptionPlanToCardId('PRO')).toBe('pro');
    expect(subscriptionPlanToCardId('ENTERPRISE')).toBe('elite');
    expect(subscriptionPlanToCardId('FREE')).toBe('free');
  });
});

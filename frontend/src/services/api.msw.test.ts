import { describe, expect, it } from 'vitest';
import { CANONICAL_MOCK_JOB_IDS } from '@/test/canonicalMockJob';
import { authApi, jobsApi, publicApi } from './api';
import { skillsApi } from './skillsApi';

describe('service layer MSW integration', () => {
  it('intercepts core axios GET requests through the shared MSW server', async () => {
    const [stats, user, jobs] = await Promise.all([
      publicApi.stats(),
      authApi.me(),
      jobsApi.list(),
    ]);

    expect(stats).toEqual({ jobs: 0, users: 0, skills: 14 });
    expect(user.email).toBe('dev@NewCareers.ie');
    expect(jobs.items).toHaveLength(1);
    expect(jobs.items[0]?.userJobId).toBe(CANONICAL_MOCK_JOB_IDS.userJobId);
  });

  it('intercepts skill POST requests and returns mock result payloads', async () => {
    const result = await skillsApi.start({
      skillName: 'evaluate',
      userJobId: CANONICAL_MOCK_JOB_IDS.userJobId,
    });

    expect(result.type).toBe('RESULT');
    expect(result.skillName).toBe('evaluate');
    expect(result.data).toMatchObject({
      match: 92,
    });
  });
});
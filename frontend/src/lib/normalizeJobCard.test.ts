import { describe, it, expect } from 'vitest';
import { normalizeJobCard } from './normalizeJobCard';

describe('normalizeJobCard', () => {
  it('reads snake_case ids and skills from backend JSON', () => {
    const card = normalizeJobCard({
      user_job_id: 'uj-1',
      job_id: 'job-1',
      title: 'Engineer',
      company: 'Acme',
      location: 'Dublin',
      kanban_column: 'Discovered',
      matched_skills: ['Java', 'Spring'],
      unmatched_skills: ['Kubernetes'],
    });
    expect(card.userJobId).toBe('uj-1');
    expect(card.jobId).toBe('job-1');
    expect(card.matchedSkills).toEqual(['Java', 'Spring']);
    expect(card.unmatchedSkills).toEqual(['Kubernetes']);
  });

  it('does not fall back jobId to userJobId when job_id is missing', () => {
    const card = normalizeJobCard({
      user_job_id: 'uj-only',
      title: 'Role',
      company: 'Co',
      location: 'Remote',
    });
    expect(card.userJobId).toBe('uj-only');
    expect(card.jobId).toBe('');
    expect(card.jobId).not.toBe(card.userJobId);
  });
});

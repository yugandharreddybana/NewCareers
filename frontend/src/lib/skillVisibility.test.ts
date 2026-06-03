import { describe, expect, it } from 'vitest';
import { isSkillEnabledForJob, skillsForKanbanColumn } from '@/lib/skillVisibility';

describe('skillVisibility', () => {
  it('shows discovery skills on Discovered and bookmarked Saved', () => {
    const discovered = skillsForKanbanColumn('Discovered');
    const saved = skillsForKanbanColumn('Saved');
    expect(discovered).toContain('evaluate');
    expect(discovered).toContain('apply');
    expect(saved).toEqual(discovered);
    expect(discovered).not.toContain('prep-interview');
  });

  it('shows only interview prep when Applied', () => {
    expect(skillsForKanbanColumn('Applied')).toEqual(['prep-interview']);
  });

  it('hides all skills when Archived', () => {
    expect(skillsForKanbanColumn('Rejected')).toEqual([]);
    expect(isSkillEnabledForJob('evaluate', 'Rejected')).toBe(false);
  });
});

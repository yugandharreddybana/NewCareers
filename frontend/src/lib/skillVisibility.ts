import type { JobCard, KanbanColumn } from '@/types';
import type { SkillName } from '@/types/skills';

/**
 * Kanban: Discovered (includes bookmarked "Saved" jobs), Applied → Interview → Offer, Archived (Rejected).
 * "Saved" is a bookmark flag only — not a separate pipeline column on the board.
 */
const DISCOVERY_SKILLS: SkillName[] = [
  'evaluate',
  'tailor-resume',
  'cover-letter',
  'research',
  'outreach',
  'apply',
  'culture-fit',
  'skills-gap-plan',
];

const SKILLS_BY_COLUMN: Record<KanbanColumn, SkillName[]> = {
  Discovered: DISCOVERY_SKILLS,
  Saved: DISCOVERY_SKILLS,
  Applied: ['prep-interview'],
  Interview: ['prep-interview', 'salary-negotiation'],
  Offer: ['salary-negotiation'],
  Rejected: [],
};

/** Saved bookmarks use the same skill set as Discovered; Archived has none. */
export function pipelineStageForSkills(column: JobCard['kanbanColumn']): JobCard['kanbanColumn'] {
  if (column === 'Saved') return 'Discovered';
  return column;
}

export function skillsForKanbanColumn(column: JobCard['kanbanColumn']): SkillName[] {
  return SKILLS_BY_COLUMN[pipelineStageForSkills(column)] ?? [];
}

export function isSkillEnabledForJob(skillId: SkillName, column: JobCard['kanbanColumn']): boolean {
  return skillsForKanbanColumn(column).includes(skillId);
}

/**
 * Barrel export for all CareerOps skill components.
 * Import from '@/components/skills' rather than deep paths.
 *
 * Usage:
 *   import { SkillPanel, SkillQuestionModal, RunAllSkillsButton } from '@/components/skills';
 */

// ── Core unified components (new system) ─────────────────────────────────────
export { default as SkillPanel }            from './SkillPanel';
export { default as SkillQuestionModal }    from './SkillQuestionModal';
export { default as RunAllSkillsButton }    from './RunAllSkillsButton';
export { default as ProfileCompletenessAlert } from './ProfileCompletenessAlert';
export { default as SkillButton }           from './SkillButton';

// ── Legacy specific panels (kept for backward compat during migration) ────────
export { default as EvaluationPanel }       from './EvaluationPanel';
export { default as TailorCvPanel }         from './TailorCvPanel';
export { default as ResearchPanel }         from './ResearchPanel';
export { default as OutreachPanel }         from './OutreachPanel';
export { default as ApplyAssistantPanel }   from './ApplyAssistantPanel';
export { default as PrepInterviewPanel }    from './PrepInterviewPanel';
export { default as ComparePanel }          from './ComparePanel';
export { default as TriagePanel }           from './TriagePanel';

// ── Hook (co-located legacy version — prefer @/hooks/useSkill for new code) ──
export { useSkill }                         from './useSkill';

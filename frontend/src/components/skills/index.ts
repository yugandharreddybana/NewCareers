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

// ── Hooks ────────────────────────────────────────────────────────────────────
// Pass 6 #6.014 — the simple fire-once panel hook lives at `useQuickSkill`.
// The richer state-machine hook lives at `@/hooks/useSkill` (used by SkillPanel).
export { useQuickSkill, useSkill } from './useQuickSkill';

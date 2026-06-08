/**
 * useQuickSkill — fire-once skill execution with toggleable panel.
 *
 * Pass 6 #6.014 — renamed from `useSkill` to break the name collision with
 * `@/hooks/useSkill` (the open-ended state-machine variant used by SkillPanel).
 *
 * Differs from @/hooks/useSkill:
 *   - Single `fetcher` argument; no question/answer state machine.
 *   - Caller passes a memoised function; result is cached and the panel
 *     toggles on subsequent invocations.
 *   - Used for the Dashboard's quick "Compare" / "Triage" buttons which
 *     don't have an interactive Q/A loop.
 */
import { useState, useCallback } from 'react';
import { type SkillState } from '@/types';
import toast from 'react-hot-toast';
import { getUserFacingErrorMessage } from '@/lib/userFacingError';

export function useQuickSkill<T>(fetcher: () => Promise<T>) {
  const [state, setState] = useState<SkillState>('idle');
  const [data, setData]   = useState<T | null>(null);
  const [open, setOpen]   = useState(false);

  const run = useCallback(async () => {
    if (state === 'done' && data) { setOpen(o => !o); return; }
    setState('loading');
    try {
      const result = await fetcher();
      setData(result);
      setState('done');
      setOpen(true);
    } catch (err: unknown) {
      setState('error');
      toast.error(getUserFacingErrorMessage(err, 'Skill failed — try again.'));
      // Reset to idle after a moment so user can retry.
      setTimeout(() => setState('idle'), 3000);
    }
  }, [fetcher, state, data]);

  return {
    state, data, open, setOpen, run,
    reset: () => { setState('idle'); setData(null); setOpen(false); },
  };
}

// Pass 6 #6.014 — kept for one release as a deprecated alias so any
// missed consumer still resolves. Remove after the next release cycle.
/** @deprecated import `useQuickSkill` instead. */
export const useSkill = useQuickSkill;

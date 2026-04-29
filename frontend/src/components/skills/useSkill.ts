import { useState, useCallback } from 'react';
import { SkillState } from '@/types';
import toast from 'react-hot-toast';

export function useSkill<T>(fetcher: () => Promise<T>) {
  const [state, setState] = useState<SkillState>('idle');
  const [data, setData]   = useState<T | null>(null);
  const [open, setOpen]   = useState(false);

  const run = useCallback(async () => {
    // If already done, just toggle the panel
    if (state === 'done' && data) { setOpen(o => !o); return; }
    setState('loading');
    try {
      const result = await fetcher();
      setData(result);
      setState('done');
      setOpen(true);
    } catch (err: any) {
      setState('error');
      toast.error(err.normalizedMessage || 'Skill failed — try again');
      // Reset to idle after a moment so user can retry
      setTimeout(() => setState('idle'), 3000);
    }
  }, [fetcher, state, data]);

  return { state, data, open, setOpen, run, reset: () => { setState('idle'); setData(null); setOpen(false); } };
}

import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CareersHomeDashboard,
  readWelcomePendingFlag,
} from '@/components/dashboard/CareersHomeDashboard';

/**
 * Main dashboard — NewCareers home layout (hero, top matches, fast-track).
 * Legacy pipeline UI lives at /pipeline.
 */
export default function Dashboard() {
  const [searchParams] = useSearchParams();

  const celebrate = useMemo(() => {
    if (searchParams.get('welcome') === '1') return true;
    return readWelcomePendingFlag();
  }, [searchParams]);

  return <CareersHomeDashboard celebrate={celebrate} />;
}

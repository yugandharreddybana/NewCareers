import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  CareersHomeDashboard,
  readWelcomePendingFlag,
} from '@/components/dashboard/CareersHomeDashboard';
import { DomainPermitWidget } from '@/components/analytics/DomainPermitWidget';
import { TrialBanner } from '@/components/TrialBanner';
import { profileApi } from '@/services/api';
import { queryKeys } from '@/lib/queryKeys';
import { resolveProfileDomainKey } from '@/utils/domainResolver';

/**
 * Main dashboard — NewCareers home layout (hero, top matches, user analytics).
 * Legacy pipeline UI lives at /pipeline.
 */
export default function Dashboard() {
  const [searchParams] = useSearchParams();

  const celebrate = useMemo(() => {
    if (searchParams.get('welcome') === '1') return true;
    return readWelcomePendingFlag();
  }, [searchParams]);

  const { data: profile } = useQuery({
    queryKey: queryKeys.profile.current(),
    queryFn: () => profileApi.get(),
  });

  const domainKey = resolveProfileDomainKey(profile);

  const permitSection = (
    <section className="mb-12" aria-labelledby="permit-intelligence-heading">
      <h2
        id="permit-intelligence-heading"
        className="font-headline-md text-headline-md text-on-surface mb-4"
      >
        🇮🇪 Permit Intelligence
      </h2>
      <DomainPermitWidget domainKey={domainKey} />
    </section>
  );

  return (
    <>
      <TrialBanner />
      <div className="pt-14">
        <CareersHomeDashboard celebrate={celebrate} beforeFastTrack={permitSection} />
      </div>
    </>
  );
}

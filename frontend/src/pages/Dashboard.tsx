import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CareersHomeDashboard,
  readWelcomePendingFlag,
} from '@/components/dashboard/CareersHomeDashboard';
import { DomainPermitWidget } from '@/components/analytics/DomainPermitWidget';
import { useProfileQuery } from '@/hooks/queries';
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

  const { data: profile } = useProfileQuery();

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
    <CareersHomeDashboard
      celebrate={celebrate}
      beforeFastTrack={permitSection}
      profile={profile ?? null}
    />
  );
}

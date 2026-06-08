import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { securityApi } from '@/services/securityApi';
import { SectionHeader } from '../accountSettingsShared';
import { formatSecurityDate } from './securityFormat';
import { SecurityAuditModal } from './SecurityAuditModal';

export function RecentActivityCard() {
  const [modalOpen, setModalOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['account', 'security', 'activity', 0],
    queryFn: () => securityApi.getActivity(0, 5),
  });

  const entries = data?.entries ?? [];

  return (
    <>
      <section className="glass-panel rounded p-gutter">
        <SectionHeader
          icon="history"
          title="Recent Activity"
          description="Security-related events on your account."
        />

        {isLoading ? (
          <p className="text-sm text-on-surface-variant">Loading activity…</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-on-surface-variant">No recent security activity.</p>
        ) : (
          <ul className="list-none p-0 m-0">
            {entries.map(row => (
              <li key={row.id} className="security-activity-row">
                <div>
                  <p className="security-activity-title">{row.title}</p>
                  <p className="security-activity-subtitle">{row.subtitle}</p>
                </div>
                <time className="security-activity-time" dateTime={row.createdAt}>
                  {formatSecurityDate(row.createdAt)}
                </time>
              </li>
            ))}
          </ul>
        )}

        <button type="button" className="security-link-muted" onClick={() => setModalOpen(true)}>
          View Full Audit Log →
        </button>
      </section>

      <SecurityAuditModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}

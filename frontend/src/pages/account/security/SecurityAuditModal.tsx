import { useQuery } from '@tanstack/react-query';
import { securityApi } from '@/services/securityApi';
import { formatSecurityDate } from './securityFormat';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SecurityAuditModal({ open, onClose }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['account', 'security', 'activity', 'full'],
    queryFn: () => securityApi.getActivity(0, 50),
    enabled: open,
  });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="audit-log-title"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col border border-outline-variant"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-outline-variant">
          <h2 id="audit-log-title" className="font-label-lg text-on-surface">
            Security audit log
          </h2>
          <button
            type="button"
            className="text-on-surface-variant hover:text-on-surface"
            onClick={onClose}
            aria-label="Close"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="overflow-y-auto p-4 flex-1">
          {isLoading ? (
            <p className="text-sm text-on-surface-variant">Loading…</p>
          ) : (
            <ul className="list-none p-0 m-0 account-settings-page">
              {(data?.entries ?? []).map(row => (
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
        </div>
      </div>
    </div>
  );
}

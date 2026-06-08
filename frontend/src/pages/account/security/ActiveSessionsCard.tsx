import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { getUserFacingErrorMessage } from '@/lib/userFacingError';
import { securityApi } from '@/services/securityApi';
import { SectionHeader } from '../accountSettingsShared';
import { formatRelativeActive, isMobileUserAgent } from './securityFormat';

const SESSIONS_KEY = ['account', 'security', 'sessions'] as const;

export function ActiveSessionsCard() {
  const qc = useQueryClient();
  const { data: sessions = [], isLoading } = useQuery({
    queryKey: SESSIONS_KEY,
    queryFn: securityApi.listSessions,
  });

  const revokeOthers = useMutation({
    mutationFn: securityApi.revokeOtherSessions,
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: SESSIONS_KEY });
      toast.success(
        res.revoked > 0
          ? `Ended ${res.revoked} other session${res.revoked === 1 ? '' : 's'}.`
          : 'No other active sessions.',
      );
    },
    onError: err => toast.error(getUserFacingErrorMessage(err, 'Could not end sessions.')),
  });

  function handleEndAll() {
    if (!window.confirm('Sign out all other devices? This keeps your current session.')) return;
    revokeOthers.mutate();
  }

  return (
    <section className="glass-panel rounded p-gutter">
      <div className="security-card-header">
        <SectionHeader
          icon="devices"
          title="Active Sessions"
          description="Devices currently signed in to your account."
        />
        <button
          type="button"
          className="security-link-danger"
          onClick={handleEndAll}
          disabled={revokeOthers.isPending || sessions.length <= 1}
        >
          End All
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-on-surface-variant">Loading sessions…</p>
      ) : sessions.length === 0 ? (
        <p className="text-sm text-on-surface-variant">No active sessions.</p>
      ) : (
        <ul className="list-none p-0 m-0">
          {sessions.map(session => {
            const mobile = isMobileUserAgent(session.userAgent);
            return (
              <li key={session.id} className="security-session-row">
                <div className="security-session-icon" aria-hidden="true">
                  <span className="material-symbols-outlined text-xl">
                    {mobile ? 'smartphone' : 'computer'}
                  </span>
                </div>
                <div className="security-session-body">
                  <div className="security-session-title">
                    <span>{session.deviceInfo}</span>
                    {session.current && (
                      <span className="security-status-badge security-status-badge--current">
                        Current
                      </span>
                    )}
                  </div>
                  <p className="security-session-meta">
                    {session.ipAddress ? `IP: ${session.ipAddress}` : 'IP: unknown'}
                    {' · '}
                    {formatRelativeActive(session.lastActiveAt, session.current)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

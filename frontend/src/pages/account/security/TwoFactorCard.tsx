import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import QRCode from 'qrcode';
import { OtpInput } from '@/components/auth/OtpInput';
import { getUserFacingErrorMessage } from '@/lib/userFacingError';
import { securityApi } from '@/services/securityApi';
import { SectionHeader } from '../accountSettingsShared';

const STATUS_KEY = ['account', 'security', 'two-factor'] as const;

export function TwoFactorCard() {
  const qc = useQueryClient();
  const { data: status, isLoading } = useQuery({
    queryKey: STATUS_KEY,
    queryFn: securityApi.getTwoFactorStatus,
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [setupSecret, setSetupSecret] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [disableOpen, setDisableOpen] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');

  const setupMutation = useMutation({
    mutationFn: securityApi.setupTwoFactor,
    onSuccess: async data => {
      setSetupSecret(data.secretBase32);
      setVerifyCode('');
      setBackupCodes(null);
      setModalOpen(true);
      try {
        const url = await QRCode.toDataURL(data.otpauthUri, { width: 200, margin: 1 });
        setQrDataUrl(url);
      } catch {
        setQrDataUrl('');
      }
    },
    onError: err => toast.error(getUserFacingErrorMessage(err, 'Could not start 2FA setup.')),
  });

  const enableMutation = useMutation({
    mutationFn: (code: string) => securityApi.enableTwoFactor(code),
    onSuccess: data => {
      setBackupCodes(data.backupCodes);
      void qc.invalidateQueries({ queryKey: STATUS_KEY });
      toast.success('Two-factor authentication enabled.');
    },
    onError: err => toast.error(getUserFacingErrorMessage(err, 'Invalid verification code.')),
  });

  const disableMutation = useMutation({
    mutationFn: securityApi.disableTwoFactor,
    onSuccess: () => {
      setDisableOpen(false);
      setDisablePassword('');
      void qc.invalidateQueries({ queryKey: STATUS_KEY });
      toast.success('Two-factor authentication disabled.');
    },
    onError: err => toast.error(getUserFacingErrorMessage(err, 'Could not disable 2FA.')),
  });

  useEffect(() => {
    if (!modalOpen) {
      setVerifyCode('');
      setBackupCodes(null);
    }
  }, [modalOpen]);

  const enabled = status?.enabled ?? false;
  const rolloutEnabled = status?.rolloutEnabled ?? false;
  const canEnroll = rolloutEnabled && !enabled;

  return (
    <>
      <section className="glass-panel rounded p-gutter">
        <div className="security-card-header">
          <SectionHeader
            icon="verified_user"
            title="Two-Factor Authentication"
          />
          {!isLoading && (
            <span
              className={`security-status-badge${enabled ? ' security-status-badge--enabled' : ''}`}
            >
              {enabled ? 'Enabled' : 'Disabled'}
            </span>
          )}
        </div>

        <p className="font-body-sm text-on-surface-variant mb-1">
          Add an extra layer of security to your account by requiring a verification code
          in addition to your password.
        </p>
        <p className="text-xs text-on-surface-variant mb-0">
          Supports Authenticator apps (Google Authenticator, Authy). SMS coming later.
        </p>

        <div className="security-twofa-footer">
          <span />
          {enabled ? (
            <button
              type="button"
              className="security-btn-outline"
              onClick={() => setDisableOpen(true)}
            >
              Disable 2FA
            </button>
          ) : (
            <button
              type="button"
              className="security-btn-primary"
              disabled={!canEnroll || setupMutation.isPending}
              title={!rolloutEnabled ? 'Two-factor authentication is rolling out soon.' : undefined}
              onClick={() => setupMutation.mutate()}
            >
              {setupMutation.isPending ? 'Starting…' : 'Enable 2FA'}
            </button>
          )}
        </div>
      </section>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          role="dialog"
          aria-modal="true"
          onClick={() => !enableMutation.isPending && setModalOpen(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 border border-outline-variant"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="font-label-lg text-on-surface mb-2">Set up authenticator app</h3>
            {backupCodes ? (
              <div>
                <p className="text-sm text-on-surface-variant mb-3">
                  Save these backup codes in a safe place. Each can be used once if you lose
                  access to your authenticator.
                </p>
                <ul className="grid grid-cols-2 gap-2 font-mono text-sm mb-4">
                  {backupCodes.map(code => (
                    <li key={code} className="bg-surface-container-high px-2 py-1 rounded">
                      {code}
                    </li>
                  ))}
                </ul>
                <button type="button" className="security-btn-primary w-full" onClick={() => setModalOpen(false)}>
                  Done
                </button>
              </div>
            ) : (
              <>
                {qrDataUrl && (
                  <img src={qrDataUrl} alt="QR code for authenticator setup" className="mx-auto mb-3" />
                )}
                <p className="text-xs text-on-surface-variant break-all mb-3">
                  Manual key: <code>{setupSecret}</code>
                </p>
                <p className="text-sm text-on-surface-variant mb-2">
                  Enter the 6-digit code from your app to confirm.
                </p>
                <OtpInput
                  value={verifyCode}
                  onChange={setVerifyCode}
                  length={6}
                  disabled={enableMutation.isPending}
                />
                <button
                  type="button"
                  className="security-btn-primary w-full mt-4"
                  disabled={verifyCode.length !== 6 || enableMutation.isPending}
                  onClick={() => enableMutation.mutate(verifyCode)}
                >
                  {enableMutation.isPending ? 'Verifying…' : 'Confirm & enable'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {disableOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          role="dialog"
          aria-modal="true"
          onClick={() => !disableMutation.isPending && setDisableOpen(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 border border-outline-variant"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="font-label-lg text-on-surface mb-2">Disable two-factor authentication</h3>
            <p className="text-sm text-on-surface-variant mb-3">
              Enter your current password to confirm.
            </p>
            <input
              type="password"
              className="settings-input mb-4"
              value={disablePassword}
              onChange={e => setDisablePassword(e.target.value)}
              autoComplete="current-password"
            />
            <button
              type="button"
              className="security-btn-outline w-full"
              disabled={!disablePassword || disableMutation.isPending}
              onClick={() => disableMutation.mutate(disablePassword)}
            >
              {disableMutation.isPending ? 'Disabling…' : 'Disable 2FA'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

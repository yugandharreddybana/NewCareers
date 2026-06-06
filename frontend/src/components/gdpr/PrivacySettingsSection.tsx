import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { consentApi, type ConsentStatusResponse } from '@/services/consentApi';
import { accountApi } from '@/services/accountApi';
import { legalPaths } from '@/lib/brand';
import { writeAnalyticsConsent } from '@/lib/cookieConsent';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { GOOGLE_AUTH_ENABLED } from '@/lib/env';
import { useAuth } from '@/context/AuthContext';

export function PrivacySettingsSection() {
  const { user, signOut } = useAuth();
  const [status, setStatus] = useState<ConsentStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [googleDeleting, setGoogleDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      setStatus(await consentApi.getConsents());
    } catch {
      toast.error('Could not load privacy settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const toggle = async (
    type: 'AI_PROCESSING' | 'MARKETING' | 'ANALYTICS',
    accepted: boolean,
  ) => {
    try {
      await consentApi.updateConsent(type, accepted);
      if (type === 'ANALYTICS') writeAnalyticsConsent(accepted);
      await load();
      toast.success('Preference saved');
    } catch {
      toast.error('Could not save preference');
    }
  };

  const downloadExport = async () => {
    try {
      const { blob, filename } = await accountApi.exportData();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Export failed');
    }
  };

  const deleteAccount = async (body: { password?: string; idToken?: string }) => {
    if (!window.confirm('Permanently delete your account? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await accountApi.deleteAccount(body);
      await signOut();
      toast.success('Account deleted');
      window.location.href = '/login';
    } catch {
      toast.error('Could not delete account');
    } finally {
      setDeleting(false);
      setGoogleDeleting(false);
    }
  };

  const handlePasswordDelete = () => {
    if (!deletePassword.trim()) {
      toast.error('Enter your password to confirm deletion');
      return;
    }
    void deleteAccount({ password: deletePassword });
  };

  const handleGoogleDelete = async (idToken: string) => {
    setGoogleDeleting(true);
    await deleteAccount({ idToken });
  };

  const isGoogleOnly = user?.email && !deletePassword;

  if (loading) {
    return <p className="text-sm text-on-surface-variant">Loading privacy settings…</p>;
  }

  return (
    <div id="privacy" className="space-y-6">
      <div className="flex flex-col gap-3">
        <ToggleRow
          label="AI processing"
          description="Allow CV and job data to be processed by AI providers for skills and matching."
          checked={status?.aiProcessing.accepted ?? false}
          onChange={v => void toggle('AI_PROCESSING', v)}
        />
        <ToggleRow
          label="Marketing emails"
          description="Job digests and career tips."
          checked={status?.marketing.accepted ?? false}
          onChange={v => void toggle('MARKETING', v)}
        />
        <ToggleRow
          label="Analytics"
          description="Anonymous usage data to improve the product."
          checked={status?.analytics.accepted ?? false}
          onChange={v => void toggle('ANALYTICS', v)}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="button" className="onboarding-btn-outline" onClick={() => void downloadExport()}>
          Download my data
        </button>
        <Link to={legalPaths.privacy} className="onboarding-btn-outline text-center">Privacy Policy</Link>
        <Link to={legalPaths.terms} className="onboarding-btn-outline text-center">Terms</Link>
      </div>

      <div className="border border-error/30 rounded-lg p-4 space-y-3">
        <p className="text-sm font-medium text-error">Delete account</p>
        <p className="text-xs text-on-surface-variant">
          Your account will be anonymized immediately. All personal data is scrubbed; some pseudonymous records may be retained where legally required.
        </p>
        <input
          type="password"
          className="settings-input max-w-xs"
          placeholder="Password (email accounts)"
          value={deletePassword}
          onChange={e => setDeletePassword(e.target.value)}
          autoComplete="current-password"
        />
        <div className="flex flex-wrap gap-3 items-center">
          <button
            type="button"
            className="onboarding-btn-outline border-error text-error hover:bg-error-container"
            disabled={deleting}
            onClick={handlePasswordDelete}
          >
            {deleting && !googleDeleting ? 'Deleting…' : 'Delete with password'}
          </button>
          {GOOGLE_AUTH_ENABLED && (
            <GoogleSignInButton
              mode="signin"
              disabled={deleting}
              loading={googleDeleting}
              onCredential={handleGoogleDelete}
              onError={msg => toast.error(msg)}
            />
          )}
        </div>
        {isGoogleOnly && (
          <p className="text-xs text-on-surface-variant">
            Google-only account? Use &quot;Sign in with Google&quot; above to re-authenticate, or set a password first.
          </p>
        )}
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-4 cursor-pointer">
      <span>
        <span className="block text-sm font-medium text-on-surface">{label}</span>
        <span className="block text-xs text-on-surface-variant mt-0.5">{description}</span>
      </span>
      <input
        type="checkbox"
        className="mt-1 h-4 w-4"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
      />
    </label>
  );
}

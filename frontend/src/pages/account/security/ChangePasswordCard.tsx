import { useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/authCtx';
import { getUserFacingErrorMessage } from '@/lib/userFacingError';
import {
  evaluatePasswordStrength,
  isPasswordComplexityValid,
  passwordComplexityHint,
} from '@/lib/passwordRules';
import { securityApi } from '@/services/securityApi';
import { SectionHeader } from '../accountSettingsShared';

export function ChangePasswordCard() {
  const { user, setUser } = useAuth();
  const passwordLoginEnabled = user?.passwordLoginEnabled !== false;

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const strength = evaluatePasswordStrength(newPassword);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isPasswordComplexityValid(newPassword)) {
      toast.error(passwordComplexityHint());
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const data = await securityApi.changePassword({ currentPassword, newPassword });
      setUser(data.user);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Password updated. Other sessions were signed out.');
    } catch (err) {
      toast.error(getUserFacingErrorMessage(err, 'Could not update password.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="glass-panel rounded p-gutter">
      <SectionHeader
        icon="key"
        title="Change Password"
        description="Update your password regularly to keep your account secure."
      />

      {!passwordLoginEnabled ? (
        <p className="settings-banner">
          This account uses Google Sign-In and has no password to change.
        </p>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="settings-label" htmlFor="sec-current-pw">Current Password</label>
            <input
              id="sec-current-pw"
              type="password"
              autoComplete="current-password"
              className="settings-input"
              placeholder="Enter current password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-2">
            <div>
              <label className="settings-label" htmlFor="sec-new-pw">New Password</label>
              <input
                id="sec-new-pw"
                type="password"
                autoComplete="new-password"
                className="settings-input"
                placeholder="Create new password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="settings-label" htmlFor="sec-confirm-pw">Confirm Password</label>
              <input
                id="sec-confirm-pw"
                type="password"
                autoComplete="new-password"
                className="settings-input"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
              />
            </div>
          </div>
          {newPassword && (
            <p className="text-xs text-on-surface-variant mb-2">
              Strength: {strength.label || '—'}
            </p>
          )}
          <div className="security-password-footer">
            <p className="security-hint">
              Password must be at least 12 characters and include a number and symbol.
              We also require upper and lower case letters (minimum 8).
            </p>
            <button type="submit" className="security-btn-outline" disabled={loading}>
              {loading ? 'Updating…' : 'Update Password'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

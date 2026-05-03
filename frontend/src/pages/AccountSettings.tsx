import React, { useState } from 'react';
import { PageMeta } from '@/components/PageMeta';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/services/api';
import toast from 'react-hot-toast';
import {
  User, Lock, Bell, Trash2, CheckCircle,
  Eye, EyeOff, AlertTriangle, Shield,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────
interface NotifPrefs {
  emailJobAlerts: boolean;
  emailWeeklyDigest: boolean;
  emailProductUpdates: boolean;
  inAppJobAlerts: boolean;
  inAppSkillReminders: boolean;
}

// ── Section wrapper ────────────────────────────────────────────────────────────────
const Section: React.FC<{ title: string; icon: React.ReactNode; description?: string; children: React.ReactNode; danger?: boolean }> = ({
  title, icon, description, children, danger,
}) => (
  <div className={`bg-white border rounded-xl p-5 space-y-4 ${ danger ? 'border-red-200' : 'border-gray-200'}`}>
    <div>
      <div className="flex items-center gap-2">
        <span className={danger ? 'text-red-400' : 'text-gray-400'}>{icon}</span>
        <h2 className={`text-sm font-semibold ${ danger ? 'text-red-700' : 'text-gray-900'}`}>{title}</h2>
      </div>
      {description && <p className="text-xs text-gray-400 mt-1 ml-6">{description}</p>}
    </div>
    {children}
  </div>
);

// ── Toggle ────────────────────────────────────────────────────────────────────────
const Toggle: React.FC<{ label: string; sublabel?: string; checked: boolean; onChange: (v: boolean) => void }> = ({
  label, sublabel, checked, onChange,
}) => (
  <div className="flex items-center justify-between gap-4">
    <div>
      <p className="text-sm text-gray-700">{label}</p>
      {sublabel && <p className="text-xs text-gray-400 mt-0.5">{sublabel}</p>}
    </div>
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${ checked ? 'bg-indigo-500' : 'bg-gray-200'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${ checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  </div>
);

// ── Password strength ───────────────────────────────────────────────────────────────
function passwordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8)  score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { score, label: 'Weak',   color: 'bg-red-400' };
  if (score <= 3) return { score, label: 'Fair',   color: 'bg-yellow-400' };
  if (score === 4) return { score, label: 'Good',  color: 'bg-blue-400' };
  return                { score, label: 'Strong', color: 'bg-emerald-500' };
}

// ── Main page ──────────────────────────────────────────────────────────────────
const AccountSettingsPage: React.FC = () => {
  const { user, signOut } = useAuth();

  // ── Account info ─────────────────────────────────────────────────────────────
  const [name, setName]   = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [savingInfo, setSavingInfo] = useState(false);
  const [savedInfo, setSavedInfo]   = useState(false);

  const handleSaveInfo = async () => {
    setSavingInfo(true);
    try {
      await api.put('/profile', { name, email });
      setSavedInfo(true);
      setTimeout(() => setSavedInfo(false), 2500);
      toast.success('Account info updated!');
    } catch { toast.error('Failed to update account info.'); }
    finally { setSavingInfo(false); }
  };

  // ── Password change ──────────────────────────────────────────────────────────
  const [currentPw, setCurrentPw]   = useState('');
  const [newPw, setNewPw]           = useState('');
  const [confirmPw, setConfirmPw]   = useState('');
  const [showPw, setShowPw]         = useState(false);
  const [savingPw, setSavingPw]     = useState(false);
  const pwStrength = passwordStrength(newPw);

  const handleChangePassword = async () => {
    if (newPw !== confirmPw) { toast.error('Passwords do not match.'); return; }
    if (newPw.length < 8)   { toast.error('Password must be at least 8 characters.'); return; }
    setSavingPw(true);
    try {
      await api.put('/auth/change-password', { currentPassword: currentPw, newPassword: newPw });
      toast.success('Password changed successfully!');
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch { toast.error('Failed to change password. Check your current password is correct.'); }
    finally { setSavingPw(false); }
  };

  // ── Notification prefs ─────────────────────────────────────────────────────────
  const [notifs, setNotifs] = useState<NotifPrefs>({
    emailJobAlerts: true,
    emailWeeklyDigest: true,
    emailProductUpdates: false,
    inAppJobAlerts: true,
    inAppSkillReminders: true,
  });
  const [savingNotifs, setSavingNotifs] = useState(false);

  const handleSaveNotifs = async () => {
    setSavingNotifs(true);
    try {
      await api.put('/profile/notifications', notifs);
      toast.success('Notification preferences saved!');
    } catch { toast.error('Failed to save notification preferences.'); }
    finally { setSavingNotifs(false); }
  };

  // ── Danger zone ───────────────────────────────────────────────────────────────────
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'DELETE') { toast.error('Type DELETE to confirm account deletion.'); return; }
    setDeleting(true);
    try {
      await api.delete('/auth/account');
      toast.success('Account deleted. Goodbye!');
      await signOut();
    } catch { toast.error('Failed to delete account. Please contact support.'); }
    finally { setDeleting(false); }
  };

  return (
    <>
      <PageMeta title="Account Settings — CareerOps" />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Account Settings</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your login details, password and notification preferences.</p>
        </div>

        {/* Account Info */}
        <Section title="Account Information" icon={<User size={16} />}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Display Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Username</label>
            <input
              type="text"
              readOnly
              value={user?.username ?? ''}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-400"
            />
            <p className="text-[10px] text-gray-400 mt-1">Username cannot be changed.</p>
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleSaveInfo}
              disabled={savingInfo}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {savedInfo && <CheckCircle size={14} />}
              {savingInfo ? 'Saving…' : savedInfo ? 'Saved!' : 'Save Changes'}
            </button>
          </div>
        </Section>

        {/* Password */}
        <Section
          title="Change Password"
          icon={<Lock size={16} />}
          description="Choose a strong password with uppercase letters, numbers and symbols."
        >
          <div className="space-y-3">
            <div className="relative">
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Current Password</label>
              <input
                type={showPw ? 'text' : 'password'}
                value={currentPw}
                onChange={e => setCurrentPw(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 pr-10"
              />
              <button type="button" onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-8 text-gray-400 hover:text-gray-600">
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">New Password</label>
              <input
                type={showPw ? 'text' : 'password'}
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              {newPw.length > 0 && (
                <div className="mt-2 space-y-1">
                  <div className="flex gap-1">
                    {[1,2,3,4,5].map(i => (
                      <div key={i} className={`flex-1 h-1 rounded-full transition-all ${
                        i <= pwStrength.score ? pwStrength.color : 'bg-gray-200'
                      }`} />
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-500">{pwStrength.label}</p>
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Confirm New Password</label>
              <input
                type={showPw ? 'text' : 'password'}
                value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)}
                placeholder="••••••••"
                className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                  confirmPw && confirmPw !== newPw ? 'border-red-300' : 'border-gray-300'
                }`}
              />
              {confirmPw && confirmPw !== newPw && (
                <p className="text-[10px] text-red-500 mt-1">Passwords don't match.</p>
              )}
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleChangePassword}
              disabled={savingPw || !currentPw || !newPw || newPw !== confirmPw}
              className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {savingPw ? 'Updating…' : 'Update Password'}
            </button>
          </div>
        </Section>

        {/* Notifications */}
        <Section
          title="Notification Preferences"
          icon={<Bell size={16} />}
          description="Control which emails and in-app alerts you receive."
        >
          <div className="space-y-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Email</p>
            <Toggle label="Job Alerts" sublabel="New matched jobs delivered to your inbox" checked={notifs.emailJobAlerts} onChange={v => setNotifs(n => ({ ...n, emailJobAlerts: v }))} />
            <Toggle label="Weekly Digest" sublabel="Your weekly career performance summary" checked={notifs.emailWeeklyDigest} onChange={v => setNotifs(n => ({ ...n, emailWeeklyDigest: v }))} />
            <Toggle label="Product Updates" sublabel="New features and announcements" checked={notifs.emailProductUpdates} onChange={v => setNotifs(n => ({ ...n, emailProductUpdates: v }))} />
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-2">In-App</p>
            <Toggle label="Job Alerts" sublabel="Banner notifications for new matches" checked={notifs.inAppJobAlerts} onChange={v => setNotifs(n => ({ ...n, inAppJobAlerts: v }))} />
            <Toggle label="Skill Reminders" sublabel="Nudges to run AI skills on saved jobs" checked={notifs.inAppSkillReminders} onChange={v => setNotifs(n => ({ ...n, inAppSkillReminders: v }))} />
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleSaveNotifs}
              disabled={savingNotifs}
              className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {savingNotifs ? 'Saving…' : 'Save Preferences'}
            </button>
          </div>
        </Section>

        {/* 2FA placeholder */}
        <Section title="Two-Factor Authentication" icon={<Shield size={16} />} description="Add an extra layer of security to your account.">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-700">Authenticator App</p>
              <p className="text-xs text-gray-400 mt-0.5">Use an app like Google Authenticator or Authy.</p>
            </div>
            <span className="px-2 py-1 bg-gray-100 text-gray-400 text-[10px] font-bold rounded-lg">Coming Soon</span>
          </div>
        </Section>

        {/* Danger zone */}
        <Section title="Danger Zone" icon={<Trash2 size={16} />} danger description="Permanent actions that cannot be undone.">
          <div className="space-y-3">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-start gap-2 mb-3">
                <AlertTriangle size={15} className="text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-700">Delete Account</p>
                  <p className="text-xs text-red-500 mt-0.5">This will permanently delete your account, all job data, CV versions, and cancel any active subscription. This action cannot be reversed.</p>
                </div>
              </div>
              <label className="block text-xs font-medium text-red-600 mb-1.5">Type <strong>DELETE</strong> to confirm</label>
              <input
                type="text"
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                placeholder="DELETE"
                className="w-full px-3 py-2 border border-red-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400 mb-3"
              />
              <button
                onClick={handleDeleteAccount}
                disabled={deleting || deleteConfirm !== 'DELETE'}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                {deleting ? 'Deleting…' : 'Delete My Account'}
              </button>
            </div>
          </div>
        </Section>

      </div>
    </>
  );
};

export default AccountSettingsPage;

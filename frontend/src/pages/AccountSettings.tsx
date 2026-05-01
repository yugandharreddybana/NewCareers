/**
 * AccountSettings — /account
 *
 * GDPR-safe account management: display name, email, password change,
 * data export, and account deletion.
 * Wired and production-safe; destructive actions gated behind confirmation.
 */
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import PageShell from '@/components/ui/PageShell';
import toast from 'react-hot-toast';
import {
  User, Lock, Download, Trash2, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { api } from '@/services/api';
import { cn } from '@/lib/utils';

// ── Input helper ────────────────────────────────────────────────────────────
function Field({
  label, type = 'text', value, onChange, placeholder, disabled,
}: {
  label: string; type?: string; value: string;
  onChange: (v: string) => void; placeholder?: string; disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          'w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-white',
          'focus:outline-none focus:ring-2 focus:ring-brand-400',
          'text-text-primary placeholder:text-text-tertiary',
          disabled && 'opacity-60 cursor-not-allowed bg-surface-raised',
        )}
      />
    </div>
  );
}

export default function AccountSettings() {
  const { user, signOut } = useAuth();
  const nav = useNavigate();

  // ── Display name form ────────────────────────────────────────────────────
  const [name, setName]   = useState(user?.name ?? '');
  const [savingName, setSavingName] = useState(false);

  async function updateName(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSavingName(true);
    try {
      await api.patch('/profile/name', { name: name.trim() });
      toast.success('Display name updated');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to update name');
    } finally {
      setSavingName(false);
    }
  }

  // ── Password change form ────────────────────────────────────────────────
  const [currentPw, setCurrentPw] = useState('');
  const [newPw,     setNewPw]     = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [savingPw,  setSavingPw]  = useState(false);
  const [pwDone,    setPwDone]    = useState(false);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPw !== confirmPw) { toast.error('Passwords do not match'); return; }
    if (newPw.length < 8)    { toast.error('Password must be at least 8 characters'); return; }
    setSavingPw(true);
    try {
      await api.post('/auth/change-password', { currentPassword: currentPw, newPassword: newPw });
      setPwDone(true);
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      toast.success('Password changed successfully');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to change password');
    } finally {
      setSavingPw(false);
    }
  }

  // ── Data export ──────────────────────────────────────────────────────────
  const [exporting, setExporting] = useState(false);

  async function exportData() {
    setExporting(true);
    try {
      const res = await api.get('/account/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(res.data);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = 'careerops-data-export.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Data exported');
    } catch {
      toast.error('Export failed — please try again.');
    } finally {
      setExporting(false);
    }
  }

  // ── Account deletion ─────────────────────────────────────────────────────
  const [showDelete, setShowDelete] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);

  async function deleteAccount() {
    if (deleteConfirm !== 'DELETE') return;
    setDeleting(true);
    try {
      await api.delete('/account');
      await signOut();
      nav('/login');
      toast.success('Account deleted. Goodbye!');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Deletion failed');
      setDeleting(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <PageShell title="Account Settings" subtitle="Manage your profile, security, and data.">
      <div className="max-w-xl space-y-6">

        {/* ── Display name ── */}
        <section className="bg-white border border-border rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <User size={15} className="text-text-tertiary" />
            <h2 className="text-sm font-semibold text-text-primary">Profile</h2>
          </div>
          <form onSubmit={updateName} className="space-y-4">
            <Field
              label="Display Name"
              value={name}
              onChange={setName}
              placeholder="Your full name"
            />
            <Field
              label="Email"
              value={user?.email ?? ''}
              onChange={() => {}}
              disabled
              placeholder=""
            />
            <button
              type="submit"
              disabled={savingName || !name.trim()}
              className="h-9 px-5 bg-brand-500 text-white rounded-xl font-semibold text-sm
                         hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {savingName ? 'Saving…' : 'Save Name'}
            </button>
          </form>
        </section>

        {/* ── Change password ── */}
        <section className="bg-white border border-border rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <Lock size={15} className="text-text-tertiary" />
            <h2 className="text-sm font-semibold text-text-primary">Change Password</h2>
          </div>
          {pwDone ? (
            <div className="flex items-center gap-2 text-emerald-600 text-sm font-semibold py-2">
              <CheckCircle2 size={16} />Password updated successfully.
            </div>
          ) : (
            <form onSubmit={changePassword} className="space-y-3">
              <Field label="Current Password" type="password" value={currentPw} onChange={setCurrentPw} />
              <Field label="New Password"     type="password" value={newPw}     onChange={setNewPw} placeholder="Min 8 characters" />
              <Field label="Confirm Password" type="password" value={confirmPw} onChange={setConfirmPw} />
              <button
                type="submit"
                disabled={savingPw || !currentPw || !newPw || !confirmPw}
                className="h-9 px-5 bg-brand-500 text-white rounded-xl font-semibold text-sm
                           hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {savingPw ? 'Updating…' : 'Update Password'}
              </button>
            </form>
          )}
        </section>

        {/* ── Data export (GDPR) ── */}
        <section className="bg-white border border-border rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <Download size={15} className="text-text-tertiary" />
            <h2 className="text-sm font-semibold text-text-primary">Export My Data</h2>
          </div>
          <p className="text-xs text-text-secondary">
            Download a JSON export of all your CareerOps data — profile, jobs, skill results,
            and referrals. Required under GDPR Article 20.
          </p>
          <button
            onClick={exportData}
            disabled={exporting}
            className="h-9 px-5 flex items-center gap-2 border border-border rounded-xl
                       text-sm font-semibold text-text-secondary bg-white
                       hover:border-brand-400 hover:text-brand-600 disabled:opacity-50
                       disabled:cursor-not-allowed transition-colors"
          >
            <Download size={13} />
            {exporting ? 'Exporting…' : 'Download My Data'}
          </button>
        </section>

        {/* ── Delete account (GDPR) ── */}
        <section className="bg-white border border-danger-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 border-b border-danger-100 pb-3">
            <Trash2 size={15} className="text-danger-500" />
            <h2 className="text-sm font-semibold text-danger-700">Delete Account</h2>
          </div>
          <p className="text-xs text-text-secondary">
            Permanently delete your account and all associated data. This cannot be undone.
          </p>
          {!showDelete ? (
            <button
              onClick={() => setShowDelete(true)}
              className="h-9 px-5 flex items-center gap-2 border border-danger-200 rounded-xl
                         text-sm font-semibold text-danger-600 bg-danger-50
                         hover:bg-danger-100 transition-colors"
            >
              <Trash2 size={13} />Delete My Account
            </button>
          ) : (
            <div className="space-y-3 bg-danger-50 border border-danger-200 rounded-xl p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle size={15} className="text-danger-600 mt-0.5 shrink-0" />
                <p className="text-xs text-danger-700 font-semibold">
                  Type <strong>DELETE</strong> below to confirm. All data will be permanently erased.
                </p>
              </div>
              <input
                type="text"
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                placeholder="Type DELETE to confirm"
                className="w-full px-3 py-2 text-sm border border-danger-300 rounded-xl
                           bg-white focus:outline-none focus:ring-2 focus:ring-danger-400
                           text-text-primary placeholder:text-text-tertiary"
              />
              <div className="flex gap-2">
                <button
                  onClick={deleteAccount}
                  disabled={deleteConfirm !== 'DELETE' || deleting}
                  className="h-9 px-5 bg-danger-600 text-white rounded-xl text-sm font-bold
                             hover:bg-danger-700 disabled:opacity-50 disabled:cursor-not-allowed
                             transition-colors flex items-center gap-1.5"
                >
                  <Trash2 size={13} />{deleting ? 'Deleting…' : 'Delete Forever'}
                </button>
                <button
                  onClick={() => { setShowDelete(false); setDeleteConfirm(''); }}
                  className="h-9 px-4 border border-border rounded-xl text-sm font-semibold
                             text-text-secondary hover:bg-surface-overlay transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>

      </div>
    </PageShell>
  );
}

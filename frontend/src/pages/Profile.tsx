import React, { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { PageMeta } from '@/components/PageMeta';
import { PageLoader } from '@/components/LoadingSpinner';
import { useAuth } from '@/context/authCtx';
import { profileApi } from '@/services/api';
import { useProfileQuery } from '@/hooks/queries';
import { queryKeys } from '@/lib/queryKeys';
import type { Profile as ProfileType, PortfolioItem } from '@/types';
import toast from 'react-hot-toast';
import { User, Upload, Briefcase, MapPin, DollarSign, Tag, Plus, Trash2, ExternalLink, CheckCircle } from 'lucide-react';

// ─── Section wrapper ──────────────────────────────────────────────────────────
const Section: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
    <div className="flex items-center gap-2">
      <span className="text-gray-400">{icon}</span>
      <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
    </div>
    {children}
  </div>
);

// ─── Tag input ────────────────────────────────────────────────────────────────
const TagInput: React.FC<{
  label: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}> = ({ label, tags, onChange, placeholder }) => {
  const [input, setInput] = useState('');

  const add = () => {
    const v = input.trim();
    if (v && !tags.includes(v)) onChange([...tags, v]);
    setInput('');
  };

  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1.5">{label}</label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {tags.map(t => (
          <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded-full">
            {t}
            <button aria-label={`Remove tag ${t}`} onClick={() => onChange(tags.filter(x => x !== t))} className="hover:text-red-500 transition-colors">&times;</button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder={placeholder ?? 'Type and press Enter'}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <button aria-label="Add tag" onClick={add} className="px-3 py-2 bg-brand-500 hover:bg-brand-600 text-white text-xs rounded-lg transition-colors">
          <Plus size={13} />
        </button>
      </div>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
const ProfilePage: React.FC = () => {
  const { user, updateProfile } = useAuth();
  const queryClient = useQueryClient();
  const { data: profileFromServer, isLoading: loading } = useProfileQuery();

  const [profile, setProfile] = useState<ProfileType | null>(null);
  const [saving, setSaving] = useState(false);
  const [cvUploading, setCvUploading] = useState(false);
  const [saved, setSaved] = useState(false);

  // Portfolio modal state
  const [addingPortfolio, setAddingPortfolio] = useState(false);
  const [newItem, setNewItem] = useState({ title: '', url: '', description: '', location: '' });

  const cvInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profileFromServer) {
      setProfile(profileFromServer);
    }
  }, [profileFromServer]);

  useEffect(() => {
    if (!loading && !profileFromServer) {
      toast.error('Failed to load profile.');
    }
  }, [loading, profileFromServer]);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const savedProfile = await updateProfile(profile as Record<string, unknown>);
      setProfile(savedProfile);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      toast.success('Profile saved!');
    } catch {
      toast.error('Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleCvUpload = async (file: File) => {
    setCvUploading(true);
    try {
      await profileApi.uploadCv(file);
      await queryClient.invalidateQueries({ queryKey: queryKeys.profile.current() });
      toast.success('CV uploaded!');
    } catch {
      toast.error('CV upload failed.');
    } finally {
      setCvUploading(false);
    }
  };

  const addPortfolioItem = async () => {
    if (!newItem.title.trim()) return;
    try {
      const updated = await profileApi.addPortfolioItem(newItem);
      setProfile(updated);
      queryClient.setQueryData(queryKeys.profile.current(), updated);
      setNewItem({ title: '', url: '', description: '', location: '' });
      setAddingPortfolio(false);
      toast.success('Portfolio item added!');
    } catch {
      toast.error('Failed to add portfolio item.');
    }
  };

  const removePortfolioItem = async (itemId: string) => {
    try {
      await profileApi.deletePortfolioItem(itemId);
      setProfile(p => p ? { ...p, portfolioItems: (p.portfolioItems ?? []).filter(i => i.id !== itemId) } : p);
      toast.success('Item removed.');
    } catch {
      toast.error('Failed to remove item.');
    }
  };

  const completeness = profile?.completenessScore ?? 0;

  if (loading) {
    return <PageLoader />;
  }

  return (
    <>
      <PageMeta title="My Profile — NewCareers" />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">My Profile</h1>
            <p className="text-sm text-gray-500 mt-1">Keep your profile complete so AI skills produce the best results.</p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {saved ? <CheckCircle size={15} /> : null}
            {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>

        {/* Completeness bar */}
        <div className="mb-6 bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-600">Profile Completeness</span>
            <span className={`text-xs font-bold ${
              completeness >= 80 ? 'text-emerald-600' : completeness >= 50 ? 'text-yellow-600' : 'text-red-500'
            }`}>{completeness}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                completeness >= 80 ? 'bg-emerald-500' : completeness >= 50 ? 'bg-yellow-400' : 'bg-red-400'
              }`}
              style={{ width: `${completeness}%` }}
            />
          </div>
        </div>

        <div className="space-y-5">

          {/* Identity */}
          <Section title="Identity" icon={<User size={16} />}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Full Name</label>
                <input
                  type="text"
                  readOnly
                  value={user?.name ?? ''}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Email</label>
                <input
                  aria-label="User Email"
                  type="email"
                  readOnly
                  value={user?.email ?? ''}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-500"
                />
              </div>
            </div>
          </Section>

          {/* Location & Availability */}
          <Section title="Location & Preferences" icon={<MapPin size={16} />}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Location</label>
                <input
                  type="text"
                  value={profile?.location ?? ''}
                  onChange={e => setProfile(p => p ? { ...p, location: e.target.value } : p)}
                  placeholder="e.g. Dublin, Ireland"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              <div className="flex items-center gap-3 pt-6">
                <input
                  type="checkbox"
                  id="remote"
                  checked={profile?.openToRemote ?? false}
                  onChange={e => setProfile(p => p ? { ...p, openToRemote: e.target.checked } : p)}
                  className="w-4 h-4 text-indigo-500 rounded"
                />
                <label htmlFor="remote" className="text-sm text-gray-700">Open to remote</label>
              </div>
            </div>
          </Section>

          {/* Career Goal */}
          <Section title="Career Goal" icon={<Briefcase size={16} />}>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Target Job Title</label>
              <input
                type="text"
                value={profile?.goalTitle ?? ''}
                onChange={e => setProfile(p => p ? { ...p, goalTitle: e.target.value } : p)}
                placeholder="e.g. Senior Full Stack Engineer"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <TagInput
              label="Target Roles"
              tags={profile?.targetRoles ?? []}
              onChange={v => setProfile(p => p ? { ...p, targetRoles: v } : p)}
              placeholder="Add a target role and press Enter"
            />
            <TagInput
              label="Sectors"
              tags={profile?.sectors ?? []}
              onChange={v => setProfile(p => p ? { ...p, sectors: v } : p)}
              placeholder="e.g. Fintech, SaaS"
            />
            <TagInput
              label="Work Types"
              tags={profile?.workTypes ?? []}
              onChange={v => setProfile(p => p ? { ...p, workTypes: v } : p)}
              placeholder="e.g. Full-time, Contract"
            />
          </Section>

          {/* Salary */}
          <Section title="Salary Expectations" icon={<DollarSign size={16} />}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Min (£/yr)</label>
                <input
                  type="number"
                  value={profile?.salaryMin ?? ''}
                  onChange={e => setProfile(p => p ? { ...p, salaryMin: Number(e.target.value) } : p)}
                  placeholder="60000"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Max (£/yr)</label>
                <input
                  type="number"
                  value={profile?.salaryMax ?? ''}
                  onChange={e => setProfile(p => p ? { ...p, salaryMax: Number(e.target.value) } : p)}
                  placeholder="90000"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="sponsorship"
                checked={profile?.sponsorshipRequired ?? false}
                onChange={e => setProfile(p => p ? { ...p, sponsorshipRequired: e.target.checked } : p)}
                className="w-4 h-4 text-indigo-500 rounded"
              />
              <label htmlFor="sponsorship" className="text-sm text-gray-700">Requires visa sponsorship</label>
            </div>
          </Section>

          {/* Tech Stack */}
          <Section title="Skills & Tech Stack" icon={<Tag size={16} />}>
            <TagInput
              label="Tech Stack"
              tags={profile?.techStack ?? []}
              onChange={v => setProfile(p => p ? { ...p, techStack: v } : p)}
              placeholder="e.g. React, Node.js, TypeScript"
            />
          </Section>

          {/* CV Upload */}
          <Section title="Active CV" icon={<Upload size={16} />}>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                {profile?.activeCvFileName ? (
                  <p className="text-sm text-gray-700 font-medium">📎 {profile.activeCvFileName}</p>
                ) : (
                  <p className="text-sm text-gray-400">No CV uploaded yet.</p>
                )}
              </div>
              <input
                aria-label='File Type'
                ref={cvInputRef}
                type="file"
                accept=".pdf,.docx"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleCvUpload(f); }}
              />
              <button
                onClick={() => cvInputRef.current?.click()}
                disabled={cvUploading}
                className="px-4 py-2 border border-gray-300 hover:bg-gray-50 text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
              >
                {cvUploading ? 'Uploading…' : 'Upload CV'}
              </button>
            </div>
          </Section>

          {/* Portfolio */}
          <Section title="Portfolio" icon={<ExternalLink size={16} />}>
            <div className="space-y-3">
              {(profile?.portfolioItems ?? []).map((item: PortfolioItem) => (
                <div key={item.id} className="flex items-start justify-between gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                    {item.url && (
                      <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-500 hover:underline truncate block">
                        {item.url}
                      </a>
                    )}
                    {item.location && <p className="text-xs text-gray-500 mt-0.5">{item.location}</p>}
                    {item.description && <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>}
                  </div>
                  <button  aria-label={`Remove portfolio item ${item.title}`} onClick={() => removePortfolioItem(item.id)} className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}

              {addingPortfolio ? (
                <div className="p-4 border border-gray-200 rounded-xl space-y-3 bg-gray-50">
                  <input
                    placeholder="Project title *"
                    value={newItem.title}
                    onChange={e => setNewItem(i => ({ ...i, title: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  <input
                    placeholder="URL (optional)"
                    value={newItem.url}
                    onChange={e => setNewItem(i => ({ ...i, url: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  <input
                    placeholder="Location (optional)"
                    value={newItem.location}
                    onChange={e => setNewItem(i => ({ ...i, location: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  <textarea
                    placeholder="Short description (optional)"
                    value={newItem.description}
                    onChange={e => setNewItem(i => ({ ...i, description: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                  />
                  <div className="flex gap-2">
                    <button onClick={addPortfolioItem} className="flex-1 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors">
                      Add Item
                    </button>
                    <button onClick={() => setAddingPortfolio(false)} className="flex-1 py-2 border border-gray-300 text-gray-600 text-sm font-semibold rounded-lg hover:bg-gray-50 transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setAddingPortfolio(true)}
                  className="w-full py-2.5 border-2 border-dashed border-gray-300 text-gray-400 text-sm rounded-xl hover:border-indigo-300 hover:text-indigo-500 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus size={15} /> Add Portfolio Item
                </button>
              )}
            </div>
          </Section>

        </div>

        {/* Bottom save */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>

      </div>
    </>
  );
};

export default ProfilePage;

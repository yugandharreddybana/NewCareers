import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { PageMeta } from '@/components/PageMeta';
import { DashboardTopNav } from '@/components/dashboard/DashboardTopNav';
import { useAuth } from '@/context/AuthContext';
import type { OnboardingEducationEntry, OnboardingWorkEntry } from '@/context/AuthContext';
import { profileApi } from '@/services/api';
import {
  AVAILABILITY_OPTIONS,
  SUGGESTED_ROLES,
  SUGGESTED_TECH,
  WORK_TYPE_OPTIONS,
  type WorkSettings,
} from '@/components/onboarding/PreferencesStep';
import { MinMatchPercentField } from '@/components/onboarding/MinMatchPercentField';
import {
  defaultSettingsForm,
  emptyEducationEntry,
  emptyWorkEntry,
  profileToSettingsForm,
  settingsFormToPayload,
  type SettingsFormState,
} from '@/lib/settingsProfileForm';
import { MonthYearField } from '@/components/onboarding/MonthYearField';
import { isApiError } from '@/types';
import { useFiltersMutation } from '@/hooks/queries';
import '@/styles/onboarding.css';
import '@/styles/settings.css';

const EXPERIENCE_OPTIONS = [
  { value: '0-2', label: '0–2 years' },
  { value: '3-5', label: '3–5 years' },
  { value: '6-10', label: '6–10 years' },
  { value: '10+', label: '10+ years' },
] as const;

function SectionHeader({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-4">
      <div className="onboarding-section__heading">
        <span className="material-symbols-outlined" aria-hidden="true">{icon}</span>
        <h2>{title}</h2>
      </div>
      {description && <p className="onboarding-pref-hint onboarding-pref-hint--tight">{description}</p>}
    </div>
  );
}

function SettingsSavedSnapshot({ form }: { form: SettingsFormState }) {
  const workRows = form.workExperience.filter(w => w.jobTitle.trim() || w.companyName.trim());
  const eduRows  = form.education.filter(e => e.schoolName.trim());
  const workSettingLabel = [
    form.workSettings.remote && 'Remote',
    form.workSettings.onsite && 'On-site',
    form.workSettings.hybrid && 'Hybrid',
  ].filter(Boolean).join(', ');

  const items: { label: string; value: string }[] = [
    { label: 'Name',                      value: form.name || '—' },
    { label: 'Headline',                  value: form.goalTitle || '—' },
    { label: 'Location',                  value: form.location || '—' },
    { label: 'Preferred job location',    value: form.goalLocation || '—' },
    { label: 'Experience',                value: form.experienceYears || '—' },
    { label: 'Target roles',              value: form.selectedRoles.length ? form.selectedRoles.join(', ') : '—' },
    { label: 'Tech stack',                value: form.selectedTech.length ? form.selectedTech.join(', ') : '—' },
    { label: 'Work types',                value: form.workTypes.join(', ') || '—' },
    { label: 'Work setting',              value: workSettingLabel || '—' },
    { label: 'Salary',                    value: `${form.salaryCurrency} ${form.salaryMinK}k – ${form.salaryMaxK}k` },
    { label: 'Availability',              value: form.availability || '—' },
    { label: 'Visa sponsorship',          value: form.sponsorship ? 'Required' : 'Not required' },
    { label: 'Minimum match to show jobs',value: `${form.minMatchPercent}%` },
    { label: 'CV on file',                value: form.activeCvFileName ?? 'None uploaded' },
    { label: 'Work history',              value: workRows.length ? workRows.map(w => `${w.jobTitle} @ ${w.companyName}`.trim()).join(' · ') : '—' },
    { label: 'Education',                 value: eduRows.length ? eduRows.map(e => `${e.degree} — ${e.schoolName}`.trim()).join(' · ') : '—' },
  ];

  return (
    <section className="settings-section settings-snapshot" aria-label="Saved profile summary">
      <SectionHeader icon="fact_check" title="Your saved profile" description="Everything currently stored for job matching and AI skills." />
      <dl className="settings-snapshot-grid">
        {items.map(row => (
          <div key={row.label} className="settings-snapshot-row">
            <dt className="settings-label mb-0">{row.label}</dt>
            <dd className="font-body-sm text-on-surface mt-1 break-words">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ChipToggle({
  label, selected, tone = 'default', onToggle,
}: {
  label: string; selected: boolean; tone?: 'default' | 'gap'; onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={`onboarding-chip${selected ? ' onboarding-chip--selected' : ''}${tone === 'gap' ? ' onboarding-chip--gap' : ''}`}
    >
      {label}
      <span className="material-symbols-outlined" aria-hidden="true">{selected ? 'check' : 'add'}</span>
    </button>
  );
}

function WorkEntryCard({ entry, index, onChange, onRemove, canRemove }: {
  entry: OnboardingWorkEntry; index: number;
  onChange: (index: number, patch: Partial<OnboardingWorkEntry>) => void;
  onRemove: () => void; canRemove: boolean;
}) {
  const id = (field: string) => `settings-work-${index}-${field}`;
  return (
    <div className="onboarding-panel">
      {canRemove && (
        <div className="onboarding-panel__delete-row">
          <button type="button" onClick={onRemove} className="onboarding-panel__delete" aria-label={`Remove role ${index + 1}`}>
            <span className="material-symbols-outlined" aria-hidden="true">delete</span>
          </button>
        </div>
      )}
      <div className="onboarding-grid-2">
        <div>
          <label className="settings-label" htmlFor={id('jobTitle')}>Job title</label>
          <input id={id('jobTitle')} className="settings-input" value={entry.jobTitle} onChange={e => onChange(index, { jobTitle: e.target.value })} placeholder="Software Engineer" />
        </div>
        <div>
          <label className="settings-label" htmlFor={id('company')}>Company</label>
          <input id={id('company')} className="settings-input" value={entry.companyName} onChange={e => onChange(index, { companyName: e.target.value })} placeholder="Acme Corp" />
        </div>
      </div>
      <div className="onboarding-grid-2" style={{ marginTop: '1.5rem' }}>
        <MonthYearField label="Start date" idPrefix={id('start')} value={entry.startDate} onChange={v => onChange(index, { startDate: v })} />
        <MonthYearField label="End date" idPrefix={id('end')} value={entry.endDate} disabled={entry.current} onChange={v => onChange(index, { endDate: v })} {...(entry.current ? { hint: 'Leave blank while you still work here' } : {})} />
      </div>
      <div className="onboarding-checkbox-row" style={{ marginTop: '1rem' }}>
        <input id={id('current')} type="checkbox" checked={entry.current} onChange={e => onChange(index, { current: e.target.checked, endDate: e.target.checked ? '' : entry.endDate })} />
        <label htmlFor={id('current')}>I currently work here</label>
      </div>
      <div className="onboarding-field onboarding-field--muted">
        <label htmlFor={id('desc')}>Description</label>
        <textarea id={id('desc')} rows={3} className="onboarding-input-sm" style={{ resize: 'none' }} value={entry.description} onChange={e => onChange(index, { description: e.target.value })} placeholder="Describe your responsibilities and achievements..." />
      </div>
    </div>
  );
}

function EducationEntryCard({ entry, index, onChange, onRemove, canRemove }: {
  entry: OnboardingEducationEntry; index: number;
  onChange: (index: number, patch: Partial<OnboardingEducationEntry>) => void;
  onRemove: () => void; canRemove: boolean;
}) {
  const id = (field: string) => `settings-edu-${index}-${field}`;
  return (
    <div className="onboarding-panel">
      {canRemove && (
        <div className="onboarding-panel__delete-row">
          <button type="button" onClick={onRemove} className="onboarding-panel__delete" aria-label={`Remove education ${index + 1}`}>
            <span className="material-symbols-outlined" aria-hidden="true">delete</span>
          </button>
        </div>
      )}
      <div className="onboarding-grid-2">
        <div className="sm:col-span-2">
          <label className="settings-label" htmlFor={id('school')}>School / university</label>
          <input id={id('school')} className="settings-input" value={entry.schoolName} onChange={e => onChange(index, { schoolName: e.target.value })} />
        </div>
        <div>
          <label className="settings-label" htmlFor={id('degree')}>Degree</label>
          <input id={id('degree')} className="settings-input" value={entry.degree} onChange={e => onChange(index, { degree: e.target.value })} />
        </div>
        <div>
          <label className="settings-label" htmlFor={id('field')}>Field of study</label>
          <input id={id('field')} className="settings-input" value={entry.fieldOfStudy} onChange={e => onChange(index, { fieldOfStudy: e.target.value })} />
        </div>
        <div>
          <label className="settings-label" htmlFor={id('year')}>Graduation year</label>
          <input id={id('year')} className="settings-input" value={entry.graduationYear} onChange={e => onChange(index, { graduationYear: e.target.value })} placeholder="2024" />
        </div>
      </div>
    </div>
  );
}

function SettingsPreferencesSection({ form, patch }: { form: SettingsFormState; patch: (p: Partial<SettingsFormState>) => void; }) {
  const [customRole, setCustomRole] = useState('');
  const [customTech, setCustomTech] = useState('');
  const roleInputId = useId();
  const techInputId = useId();
  const toggleList = (list: string[], value: string) => list.includes(value) ? list.filter(v => v !== value) : [...list, value];
  const salaryLabel = useMemo(() => {
    const sym = form.salaryCurrency === 'USD' ? '$' : form.salaryCurrency === 'GBP' ? '£' : '€';
    return `${sym}${form.salaryMinK}k – ${sym}${form.salaryMaxK}k`;
  }, [form.salaryCurrency, form.salaryMinK, form.salaryMaxK]);
  const patchWorkSettings = (patchWs: Partial<WorkSettings>) => patch({ workSettings: { ...form.workSettings, ...patchWs } });

  return (
    <div className="space-y-6">
      <div>
        <h3 className="onboarding-pref-section__label">Desired roles</h3>
        <div className="onboarding-chip-row">
          {SUGGESTED_ROLES.map(role => (
            <ChipToggle key={role} label={role} selected={form.selectedRoles.includes(role)} onToggle={() => patch({ selectedRoles: toggleList(form.selectedRoles, role) })} />
          ))}
          {form.selectedRoles
            .filter(r => !SUGGESTED_ROLES.includes(r as (typeof SUGGESTED_ROLES)[number]))
            .map(role => (
              <span key={role} className="settings-chip">
                {role}
                <button type="button" aria-label={`Remove ${role}`} onClick={() => patch({ selectedRoles: form.selectedRoles.filter(r => r !== role) })}>×</button>
              </span>
            ))}
        </div>
        <div className="flex gap-2 mt-3">
          <input id={roleInputId} className="settings-input flex-1" value={customRole} onChange={e => setCustomRole(e.target.value)} placeholder="Add custom role…"
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                const v = customRole.trim();
                if (v && !form.selectedRoles.some(r => r.toLowerCase() === v.toLowerCase())) { patch({ selectedRoles: [...form.selectedRoles, v] }); setCustomRole(''); }
              }
            }}
          />
          <button type="button" className="px-4 py-2 rounded-lg border border-outline-variant text-primary font-label-md hover:bg-primary-fixed/20 transition-colors shrink-0"
            onClick={() => { const v = customRole.trim(); if (!v) return; if (!form.selectedRoles.some(r => r.toLowerCase() === v.toLowerCase())) patch({ selectedRoles: [...form.selectedRoles, v] }); setCustomRole(''); }}
          >Add</button>
        </div>
      </div>
      <div>
        <h3 className="onboarding-pref-section__label">Core tech stack</h3>
        <div className="onboarding-chip-row">
          {SUGGESTED_TECH.map(tech => (<ChipToggle key={tech} label={tech} selected={form.selectedTech.includes(tech)} tone="gap" onToggle={() => patch({ selectedTech: toggleList(form.selectedTech, tech) })} />))}
        </div>
        <div className="flex gap-2 mt-3">
          <input id={techInputId} className="settings-input flex-1" value={customTech} onChange={e => setCustomTech(e.target.value)} placeholder="Add technology…" />
          <button type="button" className="px-4 py-2 rounded-lg border border-outline-variant text-primary font-label-md hover:bg-primary-fixed/20 transition-colors shrink-0"
            onClick={() => { const v = customTech.trim(); if (!v) return; if (!form.selectedTech.some(t => t.toLowerCase() === v.toLowerCase())) patch({ selectedTech: [...form.selectedTech, v] }); setCustomTech(''); }}
          >Add</button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="onboarding-pref-section__label">Work type</h3>
          <div className="onboarding-chip-row">
            {WORK_TYPE_OPTIONS.map(type => (<ChipToggle key={type} label={type} selected={form.workTypes.includes(type)} onToggle={() => patch({ workTypes: toggleList(form.workTypes, type) })} />))}
          </div>
        </div>
        <div>
          <h3 className="onboarding-pref-section__label">Work setting</h3>
          <div className="onboarding-chip-row">
            <ChipToggle label="Remote" selected={form.workSettings.remote} onToggle={() => patchWorkSettings({ remote: !form.workSettings.remote })} />
            <ChipToggle label="On-site" selected={form.workSettings.onsite} onToggle={() => patchWorkSettings({ onsite: !form.workSettings.onsite })} />
            <ChipToggle label="Hybrid" selected={form.workSettings.hybrid} onToggle={() => patchWorkSettings({ hybrid: !form.workSettings.hybrid })} />
          </div>
        </div>
      </div>
      <MinMatchPercentField id="settings-min-match" value={form.minMatchPercent} onChange={minMatchPercent => patch({ minMatchPercent })} />
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <p className="settings-label mb-0">Salary expectations (annual)</p>
          <span className="font-body-md text-body-md text-primary font-medium">{salaryLabel}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="settings-label" htmlFor="settings-salary-min">Minimum (k)</label>
            <input id="settings-salary-min" type="number" min={20} max={500} className="settings-input" value={form.salaryMinK} onChange={e => patch({ salaryMinK: Math.min(Number(e.target.value) || 0, form.salaryMaxK) })} />
          </div>
          <div>
            <label className="settings-label" htmlFor="settings-salary-max">Maximum (k)</label>
            <input id="settings-salary-max" type="number" min={20} max={500} className="settings-input" value={form.salaryMaxK} onChange={e => patch({ salaryMaxK: Math.max(Number(e.target.value) || 0, form.salaryMinK) })} />
          </div>
          <div>
            <label className="settings-label" htmlFor="settings-currency">Currency</label>
            <select id="settings-currency" className="settings-input" value={form.salaryCurrency} onChange={e => patch({ salaryCurrency: e.target.value })}>
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
            </select>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="settings-label" htmlFor="settings-availability">Availability</label>
          <select id="settings-availability" className="settings-input" value={form.availability} onChange={e => patch({ availability: e.target.value })}>
            {AVAILABILITY_OPTIONS.map(opt => (<option key={opt} value={opt}>{opt}</option>))}
          </select>
        </div>
        <label className="flex items-center gap-3 cursor-pointer pt-6 sm:pt-8">
          <input type="checkbox" checked={form.sponsorship} onChange={e => patch({ sponsorship: e.target.checked })} className="rounded border-outline-variant text-primary focus:ring-primary h-4 w-4" />
          <span className="font-body-md text-body-md text-on-surface">I require visa sponsorship</span>
        </label>
      </div>
    </div>
  );
}

export default function AccountSettingsPage() {
  const { user, updateProfile } = useAuth();
  const [form, setForm] = useState<SettingsFormState>(() => defaultSettingsForm(user));
  const [profileLoadFailed, setProfileLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cvUploading, setCvUploading] = useState(false);
  const cvInputRef = useRef<HTMLInputElement>(null);

  // ── Batch 5: optimistic filter save ───────────────────────────────────────
  const filtersMutation = useFiltersMutation();

  const patch = useCallback((p: Partial<SettingsFormState>) => {
    setForm(prev => ({ ...prev, ...p }));
  }, []);

  useEffect(() => {
    setForm(prev => ({
      ...prev,
      name:  user?.name  ?? prev.name,
      email: user?.email ?? prev.email,
    }));
  }, [user?.name, user?.email]);

  useEffect(() => {
    let cancelled = false;
    setProfileLoadFailed(false);
    profileApi.get()
      .then(profile => { if (!cancelled) setForm(profileToSettingsForm(profile, user)); })
      .catch(() => {
        if (!cancelled) {
          setProfileLoadFailed(true);
          setForm(defaultSettingsForm(user));
          toast.error("Couldn't fetch your profile data.");
        }
      });
    return () => { cancelled = true; };
  }, [user]);

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Please enter your name.'); return; }
    const hasWorkSetting = form.workSettings.remote || form.workSettings.onsite || form.workSettings.hybrid;
    if (form.workTypes.length === 0 || !hasWorkSetting) {
      toast.error('Select at least one work type and work setting.');
      return;
    }
    setSaving(true);
    try {
      // Optimistic filter update — profile cache updated instantly before await
      const payload = settingsFormToPayload(form);
      await filtersMutation.mutateAsync(payload);
      await updateProfile(payload);
      toast.success('Settings saved.');
    } catch (err) {
      toast.error(isApiError(err) ? err.normalizedMessage : "Couldn't save your settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleCvUpload = async (file: File) => {
    setCvUploading(true);
    try {
      await profileApi.uploadCv(file);
      const profile = await profileApi.get();
      setForm(profileToSettingsForm(profile, user));
      toast.success('CV uploaded.');
    } catch { toast.error('CV upload failed.'); }
    finally { setCvUploading(false); }
  };

  const handleCvDownload = async () => {
    try {
      const { url } = await profileApi.cvDownload();
      await profileApi.openCvDownload(url, form.activeCvFileName);
    } catch { toast.error('Could not download CV.'); }
  };

  const updateWork = (index: number, p: Partial<OnboardingWorkEntry>) => {
    const next = [...form.workExperience]; next[index] = { ...next[index]!, ...p }; patch({ workExperience: next });
  };
  const updateEducation = (index: number, p: Partial<OnboardingEducationEntry>) => {
    const next = [...form.education]; next[index] = { ...next[index]!, ...p }; patch({ education: next });
  };

  return (
    <div className="settings-page bg-background font-body-md text-on-background min-h-screen flex flex-col">
      <PageMeta title="Settings | NewCareers" />
      <DashboardTopNav />
      <main className="flex-grow px-margin-mobile md:px-margin-desktop py-8 md:py-12 max-w-3xl mx-auto w-full">
        <header className="mb-8">
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Settings</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-2">Manage your profile, CV, experience, and job preferences.</p>
          {profileLoadFailed && (
            <p className="settings-banner" role="status">We couldn&apos;t fetch your profile data. Fields below may be empty until you save.</p>
          )}
        </header>

        {!profileLoadFailed && <SettingsSavedSnapshot form={form} />}

        <form className="space-y-6" onSubmit={e => { e.preventDefault(); void handleSave(); }}>
          {/* Account */}
          <section className="settings-section">
            <SectionHeader icon="person" title="Account" description="Your sign-in details. Email cannot be changed here." />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="settings-label" htmlFor="settings-name">Full name</label>
                <input id="settings-name" className="settings-input" value={form.name} onChange={e => patch({ name: e.target.value })} autoComplete="name" />
              </div>
              <div>
                <label className="settings-label" htmlFor="settings-email">Email</label>
                <input id="settings-email" type="email" className="settings-input" value={form.email} disabled readOnly />
              </div>
            </div>
            {user?.username && (
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Username: <span className="text-on-surface">{user.username}</span>
              </p>
            )}
          </section>

          {/* Security */}
          <section className="settings-section">
            <SectionHeader icon="lock" title="Password" description="Reset your password via a secure link sent to your email." />
            <Link to="/forgot-password" state={{ email: form.email }} className="inline-flex items-center gap-2 text-primary font-label-md hover:underline">
              <span className="material-symbols-outlined text-xl" aria-hidden="true">mail</span>
              Forgot password? Reset via email
            </Link>
          </section>

          {/* CV */}
          <section className="settings-section">
            <SectionHeader icon="description" title="CV / résumé" description="The file used for applications and AI matching." />
            <input ref={cvInputRef} type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden"
              onChange={e => { const file = e.target.files?.[0]; if (file) void handleCvUpload(file); e.target.value = ''; }}
            />
            <div className="flex flex-wrap items-center gap-3">
              <span className="material-symbols-outlined text-secondary text-3xl" aria-hidden="true">draft</span>
              <div className="flex-1 min-w-0">
                <p className="font-body-md text-body-md text-on-surface truncate">{form.activeCvFileName ?? 'No CV uploaded yet'}</p>
                <p className="font-body-sm text-body-sm text-on-surface-variant">PDF or Word (.docx)</p>
              </div>
              <button type="button" disabled={cvUploading} onClick={() => cvInputRef.current?.click()}
                className="px-4 py-2 rounded-lg bg-primary text-on-primary font-label-md hover:opacity-90 disabled:opacity-50 transition-opacity">
                {cvUploading ? 'Uploading…' : form.activeCvFileName ? 'Replace CV' : 'Upload CV'}
              </button>
              {form.activeCvFileName && (
                <button type="button" onClick={() => void handleCvDownload()}
                  className="px-4 py-2 rounded-lg border border-outline-variant text-primary font-label-md hover:bg-surface-container-high transition-colors">
                  Download
                </button>
              )}
            </div>
          </section>

          {/* Professional summary */}
          <section className="settings-section">
            <SectionHeader icon="work" title="Professional summary" description="Headline and location used for job matching." />
            <div className="space-y-4">
              <div>
                <label className="settings-label" htmlFor="settings-headline">Professional headline</label>
                <input id="settings-headline" className="settings-input" value={form.goalTitle} onChange={e => patch({ goalTitle: e.target.value })} placeholder="Senior Software Engineer" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="settings-label" htmlFor="settings-location">Location</label>
                  <input id="settings-location" className="settings-input" value={form.location} onChange={e => patch({ location: e.target.value })} placeholder="Dublin, Ireland" />
                </div>
                <div>
                  <label className="settings-label" htmlFor="settings-goal-location">Preferred job location</label>
                  <input id="settings-goal-location" className="settings-input" value={form.goalLocation} onChange={e => patch({ goalLocation: e.target.value })} placeholder="Dublin, Cork, Remote in Ireland" />
                </div>
                <div>
                  <label className="settings-label" htmlFor="settings-exp">Years of experience</label>
                  <select id="settings-exp" className="settings-input" value={form.experienceYears} onChange={e => patch({ experienceYears: e.target.value })}>
                    {EXPERIENCE_OPTIONS.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                  </select>
                </div>
              </div>
            </div>
          </section>

          {/* Work experience */}
          <section className="settings-section">
            <SectionHeader icon="business_center" title="Work experience" />
            <div className="space-y-4">
              {form.workExperience.map((entry, i) => (
                <WorkEntryCard key={i} entry={entry} index={i} onChange={updateWork} canRemove={form.workExperience.length > 1}
                  onRemove={() => patch({ workExperience: form.workExperience.filter((_, j) => j !== i) })} />
              ))}
            </div>
            <button type="button" onClick={() => patch({ workExperience: [...form.workExperience, emptyWorkEntry()] })} className="onboarding-btn-text-add mt-4">
              <span className="material-symbols-outlined" aria-hidden="true">add</span>
              Add another role
            </button>
          </section>

          {/* Education */}
          <section className="settings-section">
            <SectionHeader icon="school" title="Education" />
            <div className="space-y-4">
              {form.education.map((entry, i) => (
                <EducationEntryCard key={i} entry={entry} index={i} onChange={updateEducation} canRemove={form.education.length > 1}
                  onRemove={() => patch({ education: form.education.filter((_, j) => j !== i) })} />
              ))}
            </div>
            <button type="button" onClick={() => patch({ education: [...form.education, emptyEducationEntry()] })} className="onboarding-btn-text-add mt-4">
              <span className="material-symbols-outlined" aria-hidden="true">add</span>
              Add education
            </button>
          </section>

          {/* Preferences */}
          <section className="settings-section">
            <SectionHeader icon="tune" title="Job preferences" description="Roles, tech stack, and preferences from onboarding — edit anytime." />
            <SettingsPreferencesSection form={form} patch={patch} />
          </section>

          <div className="flex flex-col sm:flex-row gap-3 sm:justify-end pt-2 pb-12">
            <Link to="/dashboard" className="onboarding-btn-outline text-center">Cancel</Link>
            <button type="submit" disabled={saving || filtersMutation.isPending} className="onboarding-btn-primary disabled:opacity-50">
              {saving ? 'Saving…' : 'Save all changes'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

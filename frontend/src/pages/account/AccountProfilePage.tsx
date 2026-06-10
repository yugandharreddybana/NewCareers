import { useRef, useState } from 'react';
import { emptyEducationEntry, emptyWorkEntry, type SettingsFormState } from '@/lib/settingsProfileForm';
import { CvPreviewModal } from '@/components/account/CvPreviewModal';
import { AccountSettingsPageHeader } from './AccountSettingsPageHeader';
import { useAccountSettingsForm } from './useAccountSettingsForm';
import {
  EXPERIENCE_OPTIONS,
  EducationEntryCard,
  PortfolioSettingsSection,
  SectionHeader,
  SettingsPreferencesSection,
  SettingsSavedSnapshot,
  WorkEntryCard,
} from './accountSettingsShared';

export default function AccountProfilePage() {
  const cvInputRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [cvPreviewOpen, setCvPreviewOpen] = useState(false);
  const [formBaseline, setFormBaseline] = useState<SettingsFormState | null>(null);

  const {
    user,
    form,
    patch,
    profileLoadFailed,
    saving,
    cvUploading,
    filtersMutation,
    handleSave,
    restoreForm,
    reloadProfile,
    handleCvUpload,
    handleCvDownload,
    updateWork,
    updateEducation,
    portfolioBusy,
    addPortfolioItem,
    updatePortfolioItem,
    removePortfolioItem,
  } = useAccountSettingsForm();

  const showForm = isEditing || profileLoadFailed;

  const handleEdit = () => {
    setFormBaseline(structuredClone(form));
    setIsEditing(true);
  };

  const handleCancel = async () => {
    if (formBaseline) {
      restoreForm(formBaseline);
    } else {
      await reloadProfile();
    }
    setIsEditing(false);
    setFormBaseline(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await handleSave();
    if (ok) {
      setIsEditing(false);
      setFormBaseline(null);
    }
  };

  return (
    <main className="flex-1 flex flex-col gap-stack-lg min-w-0">
      <AccountSettingsPageHeader
        title="Profile"
        subtitle="Manage your profile, CV, experience, and job preferences."
        className={showForm ? 'mb-stack-lg' : 'mb-stack-md'}
        actionsClassName="sm:mr-3"
        banner={
          profileLoadFailed ? (
            <p className="settings-banner" role="status">
              We couldn&apos;t fetch your profile data. Fields below may be empty until you save.
            </p>
          ) : undefined
        }
        actions={
          !showForm && !profileLoadFailed ? (
            <button
              type="button"
              onClick={handleEdit}
              className="inline-flex items-center gap-2 px-4 py-2 rounded bg-primary text-on-primary font-label-md hover:opacity-90 transition-opacity"
            >
              <span className="material-symbols-outlined text-lg" aria-hidden="true">
                edit
              </span>
              Edit profile
            </button>
          ) : undefined
        }
      />

      {!showForm && (
        <SettingsSavedSnapshot
          form={form}
          onViewCv={form.activeCvFileName ? () => setCvPreviewOpen(true) : undefined}
        />
      )}

      <CvPreviewModal
        open={cvPreviewOpen}
        fileName={form.activeCvFileName}
        onClose={() => setCvPreviewOpen(false)}
        onDownload={() => void handleCvDownload()}
      />

      {showForm && (
        <form
          className="account-settings-form flex flex-col gap-gutter pb-2"
          onSubmit={e => void handleSubmit(e)}
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-gutter">
            <section className="glass-panel rounded p-gutter">
              <SectionHeader
                icon="person"
                title="Account"
                description="Your sign-in details. Email cannot be changed here."
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="settings-label" htmlFor="settings-name">Full name</label>
                  <input
                    id="settings-name"
                    className="settings-input"
                    value={form.name}
                    onChange={e => patch({ name: e.target.value })}
                    autoComplete="name"
                  />
                </div>
                <div>
                  <label className="settings-label" htmlFor="settings-email">Email</label>
                  <input
                    id="settings-email"
                    type="email"
                    className="settings-input"
                    value={form.email}
                    disabled
                    readOnly
                  />
                </div>
              </div>
              {user?.username && (
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-4">
                  Username: <span className="text-on-surface">{user.username}</span>
                </p>
              )}
            </section>

            <section className="glass-panel rounded p-gutter">
              <SectionHeader
                icon="work"
                title="Professional summary"
                description="Headline and location used for job matching."
              />
              <div className="space-y-4">
                <div>
                  <label className="settings-label" htmlFor="settings-headline">Professional headline</label>
                  <input
                    id="settings-headline"
                    className="settings-input"
                    value={form.goalTitle}
                    onChange={e => patch({ goalTitle: e.target.value })}
                    placeholder="Senior Software Engineer"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="settings-label" htmlFor="settings-location">Location</label>
                    <input
                      id="settings-location"
                      className="settings-input"
                      value={form.location}
                      onChange={e => patch({ location: e.target.value })}
                      placeholder="Dublin, Ireland"
                    />
                  </div>
                  <div>
                    <label className="settings-label" htmlFor="settings-goal-location">Preferred job location</label>
                    <input
                      id="settings-goal-location"
                      className="settings-input"
                      value={form.goalLocation}
                      onChange={e => patch({ goalLocation: e.target.value })}
                      placeholder="Dublin, Cork, Remote in Ireland"
                    />
                  </div>
                  <div>
                    <label className="settings-label" htmlFor="settings-exp">Years of experience</label>
                    <select
                      id="settings-exp"
                      className="settings-input"
                      value={form.experienceYears}
                      onChange={e => patch({ experienceYears: e.target.value })}
                    >
                      {EXPERIENCE_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <section className="glass-panel rounded p-gutter">
            <SectionHeader
              icon="description"
              title="CV / résumé"
              description="The file used for applications and AI matching."
            />
            <input
              ref={cvInputRef}
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) void handleCvUpload(file);
                e.target.value = '';
              }}
            />
            <div className="flex flex-wrap items-center gap-3">
              <span className="material-symbols-outlined text-secondary text-3xl" aria-hidden="true">
                draft
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-body-md text-body-md text-on-surface truncate">
                  {form.activeCvFileName ?? 'No CV uploaded yet'}
                </p>
                <p className="font-body-sm text-body-sm text-on-surface-variant">PDF or Word (.docx)</p>
              </div>
              <button
                type="button"
                disabled={cvUploading}
                onClick={() => cvInputRef.current?.click()}
                className="px-4 py-2 rounded bg-primary text-on-primary font-label-md hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {cvUploading ? 'Uploading…' : form.activeCvFileName ? 'Replace CV' : 'Upload CV'}
              </button>
              {form.activeCvFileName && (
                <>
                  <button
                    type="button"
                    onClick={() => setCvPreviewOpen(true)}
                    className="px-4 py-2 rounded border border-outline-variant text-primary font-label-md hover:bg-surface-container-high transition-colors"
                  >
                    View current CV
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCvDownload()}
                    className="px-4 py-2 rounded border border-outline-variant text-primary font-label-md hover:bg-surface-container-high transition-colors"
                  >
                    Download
                  </button>
                </>
              )}
            </div>
          </section>

          <section className="glass-panel rounded p-gutter">
            <SectionHeader icon="business_center" title="Work experience" />
            <div className="space-y-4">
              {form.workExperience.map((entry, i) => (
                <WorkEntryCard
                  key={i}
                  entry={entry}
                  index={i}
                  onChange={updateWork}
                  canRemove={form.workExperience.length > 1}
                  onRemove={() =>
                    patch({ workExperience: form.workExperience.filter((_, j) => j !== i) })
                  }
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => patch({ workExperience: [...form.workExperience, emptyWorkEntry()] })}
              className="onboarding-btn-text-add mt-4"
            >
              <span className="material-symbols-outlined" aria-hidden="true">add</span>
              Add another role
            </button>
          </section>

          <section className="glass-panel rounded p-gutter">
            <SectionHeader
              icon="folder_special"
              title="Projects"
              description="Portfolio projects from onboarding and your profile."
            />
            <PortfolioSettingsSection
              items={form.portfolioItems}
              busy={portfolioBusy}
              onAdd={addPortfolioItem}
              onUpdate={updatePortfolioItem}
              onRemove={removePortfolioItem}
            />
          </section>

          <section className="glass-panel rounded p-gutter">
            <SectionHeader icon="school" title="Education" />
            <div className="space-y-4">
              {form.education.map((entry, i) => (
                <EducationEntryCard
                  key={i}
                  entry={entry}
                  index={i}
                  onChange={updateEducation}
                  canRemove={form.education.length > 1}
                  onRemove={() => patch({ education: form.education.filter((_, j) => j !== i) })}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => patch({ education: [...form.education, emptyEducationEntry()] })}
              className="onboarding-btn-text-add mt-4"
            >
              <span className="material-symbols-outlined" aria-hidden="true">add</span>
              Add education
            </button>
          </section>

          <section className="glass-panel rounded p-gutter">
            <SectionHeader
              icon="tune"
              title="Job preferences"
              description="Roles, tech stack, and preferences from onboarding — edit anytime."
            />
            <SettingsPreferencesSection form={form} patch={patch} />
          </section>

          <footer className="account-settings-form-actions" aria-label="Profile form actions">
            <button
              type="button"
              onClick={() => void handleCancel()}
              className="settings-btn-outline w-full sm:w-auto"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || filtersMutation.isPending}
              className="settings-btn-primary w-full sm:w-auto"
            >
              {saving ? 'Saving…' : 'Save all changes'}
            </button>
          </footer>
        </form>
      )}
    </main>
  );
}

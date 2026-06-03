import { Fragment, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { useNavigate } from 'react-router-dom';

import { useAuth } from '@/context/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';

import {
  authApi,
  onboardingApi,
  profileApi,
  type OnboardingDeliveryStatus,
} from '@/services/api';
import { tokenStore } from '@/lib/tokenStore';

import { PageMeta } from '@/components/PageMeta';

import {
  PreferencesStep,
  type PreferencesStepValues,
} from '@/components/onboarding/PreferencesStep';
import { FieldLabel } from '@/components/onboarding/RequiredLabel';
import { MonthYearField } from '@/components/onboarding/MonthYearField';
import { buildOnboardingProfilePayload } from '@/lib/buildOnboardingProfilePayload';
import { JobSearchRadarLoader } from '@/components/onboarding/JobSearchRadarLoader';
import {
  readWelcomePendingFlag,
  setWelcomePendingFlag,
} from '@/components/dashboard/CareersHomeDashboard';

const DELIVERY_POLL_MS = 1500;
const DELIVERY_TIMEOUT_MS = 5 * 60 * 1000;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

import toast from 'react-hot-toast';

import '@/styles/onboarding.css';



const STEPS = ['Basic Info', 'Experience', 'Preferences'] as const;

function defaultPreferences(): PreferencesStepValues {
  return {
    selectedRoles: [],
    selectedTech: [],
    workTypes: ['Full-time'],
    workSettings: { remote: true, onsite: false, hybrid: false },
    salaryMinK: 0,
    salaryMaxK: 80,
    salaryCurrency: 'EUR',
    availability: '2 weeks notice',
    cvFile: null,
    sponsorship: false,
    minMatchPercent: 60,
  };
}

type WorkEntry = {

  jobTitle: string;

  companyName: string;

  startDate: string;

  endDate: string;

  current: boolean;

  description: string;

};



type EducationEntry = {

  schoolName: string;

  degree: string;

  fieldOfStudy: string;

  graduationYear: string;

};



function emptyWork(): WorkEntry {

  return {

    jobTitle: '',

    companyName: '',

    startDate: '',

    endDate: '',

    current: false,

    description: '',

  };

}



function emptyEducation(): EducationEntry {

  return {

    schoolName: '',

    degree: '',

    fieldOfStudy: '',

    graduationYear: '',

  };

}



function OnboardingStepper({ activeStep }: { activeStep: number }) {

  return (

    <nav className="onboarding-stepper" aria-label="Onboarding progress">

      <div className="onboarding-stepper__row">

        {STEPS.map((label, index) => (

          <Fragment key={label}>

            {index > 0 && (

              <div

                className={`onboarding-stepper__connector ${activeStep >= index ? 'onboarding-stepper__connector--done' : ''}`}

                aria-hidden="true"

              />

            )}

            <div className="onboarding-stepper__col">

              <div

                className={`onboarding-stepper__dot ${

                  index < activeStep

                    ? 'onboarding-stepper__dot--completed'

                    : index === activeStep

                      ? 'onboarding-stepper__dot--active'

                      : 'onboarding-stepper__dot--upcoming'

                }`}

              >

                {index < activeStep ? (

                  <span className="material-symbols-outlined" aria-hidden="true">

                    check

                  </span>

                ) : (

                  index + 1

                )}

              </div>

              <span

                className={`onboarding-stepper__label ${

                  index < activeStep

                    ? 'onboarding-stepper__label--completed'

                    : index === activeStep

                      ? 'onboarding-stepper__label--active'

                      : 'onboarding-stepper__label--upcoming'

                }`}

              >

                {label}

              </span>

            </div>

          </Fragment>

        ))}

      </div>

    </nav>

  );

}



function WorkPanel({

  entry,

  index,

  onChange,

  onRemove,

}: {

  entry: WorkEntry;

  index: number;

  onChange: (index: number, patch: Partial<WorkEntry>) => void;

  onRemove?: () => void;

}) {

  const id = (field: string) => `work-${index}-${field}`;

  return (

    <div className="onboarding-panel">

      <div className="onboarding-grid-2">

        <div className="onboarding-field onboarding-field--muted">

          <label htmlFor={id('jobTitle')}>Job Title</label>

          <input

            className="onboarding-input-sm"

            id={id('jobTitle')}

            placeholder="e.g. Software Engineer"

            type="text"

            value={entry.jobTitle}

            onChange={e => onChange(index, { jobTitle: e.target.value })}

          />

        </div>

        <div className="onboarding-field onboarding-field--muted">

          <label htmlFor={id('companyName')}>Company Name</label>

          <input

            className="onboarding-input-sm"

            id={id('companyName')}

            placeholder="e.g. Acme Corp"

            type="text"

            value={entry.companyName}

            onChange={e => onChange(index, { companyName: e.target.value })}

          />

        </div>

      </div>

      <div className="onboarding-grid-2" style={{ marginTop: '1.5rem' }}>

        <MonthYearField
          label="Start Date"
          idPrefix={id('start')}
          value={entry.startDate}
          onChange={next => onChange(index, { startDate: next })}
        />

        <MonthYearField
          label="End Date"
          idPrefix={id('end')}
          value={entry.endDate}
          disabled={entry.current}
          onChange={next => onChange(index, { endDate: next })}
          {...(entry.current ? { hint: 'Leave blank while you still work here' } : {})}
        />

      </div>

      <div className="onboarding-checkbox-row" style={{ marginTop: '1rem' }}>

        <input

          id={id('current')}

          type="checkbox"

          checked={entry.current}

          onChange={e =>

            onChange(index, { current: e.target.checked, endDate: e.target.checked ? '' : entry.endDate })

          }

        />

        <label htmlFor={id('current')}>I currently work here</label>

      </div>

      <div className="onboarding-field onboarding-field--muted">

        <label htmlFor={id('description')}>Description</label>

        <textarea

          className="onboarding-input-sm"

          id={id('description')}

          rows={3}

          placeholder="Describe your responsibilities and achievements..."

          value={entry.description}

          onChange={e => onChange(index, { description: e.target.value })}

          style={{ resize: 'none' }}

        />

      </div>

      {onRemove && (
        <div className="onboarding-panel__delete-row">
          <button
            type="button"
            className="onboarding-panel__delete"
            onClick={onRemove}
            aria-label="Remove position"
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              delete
            </span>
          </button>
        </div>
      )}

    </div>

  );

}



function EducationPanel({

  entry,

  index,

  onChange,

  onRemove,

}: {

  entry: EducationEntry;

  index: number;

  onChange: (index: number, patch: Partial<EducationEntry>) => void;

  onRemove?: () => void;

}) {

  const id = (field: string) => `edu-${index}-${field}`;

  return (

    <div className="onboarding-panel">

      <div className="onboarding-field onboarding-field--muted" style={{ marginBottom: '1.5rem' }}>

        <label htmlFor={id('schoolName')}>School / University</label>

        <input

          className="onboarding-input-sm"

          id={id('schoolName')}

          placeholder="e.g. State University"

          type="text"

          value={entry.schoolName}

          onChange={e => onChange(index, { schoolName: e.target.value })}

        />

      </div>

      <div className="onboarding-grid-3">

        <div className="onboarding-field onboarding-field--muted">

          <label htmlFor={id('degree')}>Degree</label>

          <select

            className="onboarding-select-sm"

            id={id('degree')}

            value={entry.degree}

            onChange={e => onChange(index, { degree: e.target.value })}

          >

            <option value="">Select degree</option>

            <option value="bachelors">Bachelor&apos;s</option>

            <option value="masters">Master&apos;s</option>

            <option value="phd">Ph.D.</option>

            <option value="other">Other</option>

          </select>

        </div>

        <div className="onboarding-field onboarding-field--muted">

          <label htmlFor={id('fieldOfStudy')}>Field of Study</label>

          <input

            className="onboarding-input-sm"

            id={id('fieldOfStudy')}

            placeholder="e.g. Computer Science"

            type="text"

            value={entry.fieldOfStudy}

            onChange={e => onChange(index, { fieldOfStudy: e.target.value })}

          />

        </div>

        <div className="onboarding-field onboarding-field--muted">

          <label htmlFor={id('graduationYear')}>Graduation Year</label>

          <input

            className="onboarding-input-sm"

            id={id('graduationYear')}

            type="number"

            min={1950}

            max={2030}

            placeholder="YYYY"

            value={entry.graduationYear}

            onChange={e => onChange(index, { graduationYear: e.target.value })}

          />

        </div>

      </div>

      {onRemove && (
        <div className="onboarding-panel__delete-row">
          <button
            type="button"
            className="onboarding-panel__delete"
            onClick={onRemove}
            aria-label="Remove school"
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              delete
            </span>
          </button>
        </div>
      )}

    </div>

  );

}



export default function Onboarding() {

  const { updateProfile, user } = useAuth();
  const queryClient = useQueryClient();

  const nav = useNavigate();



  useEffect(() => {

    document.documentElement.classList.add('light');

    document.documentElement.classList.remove('dark');

    const root = document.getElementById('root');

    document.body.style.overflow = 'hidden';

    if (root) root.style.overflow = 'hidden';

    return () => {

      document.documentElement.classList.remove('light');

      document.body.style.overflow = '';

      if (root) root.style.overflow = '';

    };

  }, []);



  useEffect(() => {

    if (user?.onboarded) {
      const pending = readWelcomePendingFlag();
      nav(pending ? '/dashboard?welcome=1' : '/dashboard', { replace: true });
    }

  }, [user, nav]);



  const [step, setStep] = useState(0);

  const [saving, setSaving] = useState(false);
  const [matchingOverlay, setMatchingOverlay] = useState(false);
  const [deliveryStatus, setDeliveryStatus] = useState<OnboardingDeliveryStatus | null>(null);
  const [deliveryFailed, setDeliveryFailed] = useState<string | null>(null);

  const [fullName, setFullName] = useState(user?.name || '');

  const [headline, setHeadline] = useState('');

  const [experienceYears, setExperienceYears] = useState('');

  const [location, setLocation] = useState('Dublin, Ireland');



  const [workEntries, setWorkEntries] = useState<WorkEntry[]>([emptyWork()]);

  const [educationEntries, setEducationEntries] = useState<EducationEntry[]>([emptyEducation()]);



  const [preferences, setPreferences] = useState<PreferencesStepValues>(defaultPreferences);

  function patchPreferences(patch: Partial<PreferencesStepValues>) {
    setPreferences(prev => ({ ...prev, ...patch }));
  }



  function updateWork(index: number, patch: Partial<WorkEntry>) {

    setWorkEntries(prev => prev.map((w, i) => (i === index ? { ...w, ...patch } : w)));

  }



  function updateEducation(index: number, patch: Partial<EducationEntry>) {

    setEducationEntries(prev => prev.map((e, i) => (i === index ? { ...e, ...patch } : e)));

  }



  async function ensureFreshSession(): Promise<void> {
    const refresh = tokenStore.getRefresh();
    if (!refresh) return;
    try {
      await authApi.refresh(refresh);
    } catch {
      // Interceptor handles redirect; save handler surfaces the error.
    }
  }

  async function pollDeliveryUntilReady(): Promise<void> {
    const deadline = Date.now() + DELIVERY_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const status = await onboardingApi.deliveryStatus();
      setDeliveryStatus(status);
      if (status.ready || status.readyPartial) return;
      if (status.stage === 'failed') {
        throw new Error(
          status.error ??
            status.message ??
            'Matching could not complete. Your profile is saved — try again or open the dashboard to use any roles already found.',
        );
      }
      await sleep(DELIVERY_POLL_MS);
    }
    throw new Error(
      'Matching is taking longer than expected. You can open the dashboard — more roles will load in the background.',
    );
  }

  function finishToDashboard() {
    setWelcomePendingFlag();
    setDeliveryFailed(null);
    setDeliveryStatus(null);
    setMatchingOverlay(false);
    setSaving(false);
    void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.discovery.all });
    nav('/dashboard?welcome=1', { replace: true });
  }

  async function handleFinish() {
    setSaving(true);
    setMatchingOverlay(true);
    setDeliveryFailed(null);
    setDeliveryStatus({
      stage: 'reading_cv',
      message: 'Saving your profile…',
      evaluatedCount: 0,
      targetCount: 10,
      minRequired: 3,
      jobsDiscovered: 0,
      readyPartial: false,
      ready: false,
    });
    let keepDeliveryOverlay = false;

    try {
      await ensureFreshSession();

      const p = preferences;
      if (!p.cvFile) {
        toast.error('Upload your CV to finish onboarding.');
        setMatchingOverlay(false);
        return;
      }

      const payload = buildOnboardingProfilePayload(
        { fullName, headline, experienceYears, location },
        workEntries,
        educationEntries,
        p,
      );

      await updateProfile(payload);
      await profileApi.uploadCv(p.cvFile);

      setDeliveryStatus({
        stage: 'reading_cv',
        message: 'Starting AI job matching…',
        evaluatedCount: 0,
        targetCount: 10,
        minRequired: 3,
        jobsDiscovered: 0,
        readyPartial: false,
        ready: false,
      });

      await onboardingApi.startDelivery();
      try {
        await pollDeliveryUntilReady();
      } catch (pollErr: unknown) {
        const pollMsg = pollErr instanceof Error ? pollErr.message : undefined;
        if (pollMsg?.includes('longer than expected')) {
          toast.error(pollMsg, { duration: 8000 });
          setDeliveryStatus(prev => ({
            stage: 'evaluating_jobs',
            message:
              prev?.message ??
              'Matching is still running in the background. Continue to the dashboard or wait here.',
            evaluatedCount: prev?.evaluatedCount ?? 0,
            targetCount: prev?.targetCount ?? 10,
            minRequired: prev?.minRequired ?? 3,
            jobsDiscovered: prev?.jobsDiscovered ?? 0,
            readyPartial: prev?.readyPartial ?? false,
            ready: prev?.ready ?? false,
          }));
          keepDeliveryOverlay = true;
          return;
        }
        setDeliveryFailed(
          pollMsg ??
            'Matching could not complete. Your profile is saved — try again or continue to the dashboard.',
        );
        keepDeliveryOverlay = true;
        return;
      }

      finishToDashboard();
      return;
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string; error?: string } } }).response?.data
              ?.message ??
            (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : err instanceof Error
            ? err.message
            : undefined;

      toast.error(message ?? 'Could not save your profile — please try again.');
    } finally {
      if (!keepDeliveryOverlay) {
        setSaving(false);
        setMatchingOverlay(false);
        setDeliveryStatus(null);
      }
    }
  }



  function handleBasicInfoSubmit(e: React.FormEvent) {

    e.preventDefault();

    if (fullName && location && experienceYears) {

      setStep(1);

    }

  }



  const cardClass = `onboarding-card${
    step === 1 ? ' onboarding-card--wide' : step === 2 ? ' onboarding-card--preferences' : ''
  }`;



  return (
    <>
      {(matchingOverlay || deliveryFailed) &&
        createPortal(
          <JobSearchRadarLoader
            locationHint={location.trim() || 'Dublin, Ireland'}
            status={deliveryStatus}
            failedMessage={deliveryFailed}
            onRetry={() => void handleFinish()}
            onContinue={finishToDashboard}
          />,
          document.body,
        )}

    <div className="onboarding-page">

      <PageMeta title="Candidate Onboarding - NewCareers" />



      <header className="onboarding-header">

        <div className="onboarding-header__inner">

          <a

            className="onboarding-logo"

            href="/"

            onClick={e => {

              e.preventDefault();

              nav('/');

            }}

          >

            NewCareers

          </a>

        </div>

      </header>



      <main className="onboarding-main">

        <div className={cardClass}>

          <OnboardingStepper activeStep={step} />



          <div className="onboarding-card__scroll">

            {step === 0 && (

              <>

                <div className="onboarding-card__title">

                  <h1>Let&apos;s build your professional profile</h1>

                  <p>Tell us a bit about yourself to help us find the perfect match.</p>

                </div>



                <form className="onboarding-form" onSubmit={handleBasicInfoSubmit}>

                  <div className="onboarding-field">

                    <FieldLabel htmlFor="fullName" required>
                      Full Name
                    </FieldLabel>

                    <input

                      className="onboarding-input"

                      id="fullName"

                      name="fullName"

                      placeholder="Jane Doe"

                      type="text"

                      value={fullName}

                      required

                      onChange={e => setFullName(e.target.value)}

                    />

                  </div>



                  <div className="onboarding-field">

                    <label htmlFor="headline">Professional Headline</label>

                    <input

                      className="onboarding-input"

                      id="headline"

                      name="headline"

                      placeholder="e.g. Senior Product Designer"

                      type="text"

                      value={headline}

                      onChange={e => setHeadline(e.target.value)}

                    />

                    <p className="hint">This will be the first thing employers see.</p>

                  </div>



                  <div className="onboarding-grid-2">

                    <div className="onboarding-field">

                      <FieldLabel htmlFor="experience" required>
                        Years of Experience
                      </FieldLabel>

                      <div className="onboarding-field__relative">

                        <select

                          className="onboarding-select"

                          id="experience"

                          name="experience"

                          value={experienceYears}

                          required

                          onChange={e => setExperienceYears(e.target.value)}

                        >

                          <option disabled value="">

                            Select years

                          </option>

                          <option value="0-2">0-2 years</option>

                          <option value="3-5">3-5 years</option>

                          <option value="6-10">6-10 years</option>

                          <option value="10+">10+ years</option>

                        </select>

                        <span className="material-symbols-outlined onboarding-field__icon onboarding-field__icon--right">

                          expand_more

                        </span>

                      </div>

                    </div>



                    <div className="onboarding-field">

                      <FieldLabel htmlFor="location" required>
                        Current Location
                      </FieldLabel>

                      <div className="onboarding-field__relative">

                        <span className="material-symbols-outlined onboarding-field__icon onboarding-field__icon--left">

                          location_on

                        </span>

                        <input

                          className="onboarding-input onboarding-input--with-icon-left"

                          id="location"

                          name="location"

                          placeholder="City, Country"

                          type="text"

                          value={location}

                          required

                          onChange={e => setLocation(e.target.value)}

                        />

                      </div>

                    </div>

                  </div>



                  <div className="onboarding-actions onboarding-actions--end">

                    <button className="onboarding-btn-primary" type="submit">

                      Continue

                      <span className="material-symbols-outlined" aria-hidden="true">

                        arrow_forward

                      </span>

                    </button>

                  </div>

                </form>

              </>

            )}



            {step === 1 && (

              <>

                <div className="onboarding-card__title onboarding-card__title--experience">

                  <h1>Tell us about your background</h1>

                  <p>Add your work experience and education to help us find the best roles for you.</p>

                </div>



                <form

                  className="onboarding-form"

                  onSubmit={e => {

                    e.preventDefault();

                    setStep(2);

                  }}

                >

                  <section className="onboarding-section">

                    <div className="onboarding-section__heading">

                      <span className="material-symbols-outlined" aria-hidden="true">

                        work

                      </span>

                      <h2>Work Experience</h2>

                    </div>

                    {workEntries.map((entry, i) => (

                      <WorkPanel
                        key={i}
                        entry={entry}
                        index={i}
                        onChange={updateWork}
                        {...(i > 0 && {
                          onRemove: () => setWorkEntries(prev => prev.filter((_, idx) => idx !== i)),
                        })}
                      />

                    ))}

                    <button

                      type="button"

                      className="onboarding-btn-text-add"

                      onClick={() => setWorkEntries(prev => [...prev, emptyWork()])}

                    >

                      <span className="material-symbols-outlined" aria-hidden="true">

                        add

                      </span>

                      Add another position

                    </button>

                  </section>



                  <section className="onboarding-section">

                    <div className="onboarding-section__heading">

                      <span className="material-symbols-outlined" aria-hidden="true">

                        school

                      </span>

                      <h2>Education</h2>

                    </div>

                    {educationEntries.map((entry, i) => (

                      <EducationPanel
                        key={i}
                        entry={entry}
                        index={i}
                        onChange={updateEducation}
                        {...(i > 0 && {
                          onRemove: () => setEducationEntries(prev => prev.filter((_, idx) => idx !== i)),
                        })}
                      />

                    ))}

                    <button

                      type="button"

                      className="onboarding-btn-text-add"

                      onClick={() => setEducationEntries(prev => [...prev, emptyEducation()])}

                    >

                      <span className="material-symbols-outlined" aria-hidden="true">

                        add

                      </span>

                      Add another school

                    </button>

                  </section>



                  <div className="onboarding-actions">

                    <button className="onboarding-btn-outline" type="button" onClick={() => setStep(0)}>

                      Back

                    </button>

                    <button className="onboarding-btn-primary" type="submit">

                      Continue

                      <span className="material-symbols-outlined" aria-hidden="true">

                        arrow_forward

                      </span>

                    </button>

                  </div>

                </form>

              </>

            )}



            {step === 2 && (
              <PreferencesStep
                values={preferences}
                saving={saving}
                onChange={patchPreferences}
                onBack={() => setStep(1)}
                onComplete={handleFinish}
              />
            )}


          </div>

        </div>

      </main>

    </div>
    </>
  );

}


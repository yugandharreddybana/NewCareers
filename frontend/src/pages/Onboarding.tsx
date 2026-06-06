import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useNavigate } from 'react-router-dom';

import { useAuth } from '@/context/AuthContext';
import {
  readOnboardingVerification,
  writeOnboardingVerification,
} from '@/lib/onboardingVerification';
import {
  clearPendingSignup,
  readPendingSignup,
} from '@/lib/pendingSignup';
import { OnboardingEmailVerificationModal } from '@/components/onboarding/OnboardingEmailVerificationModal';
import {
  completeOnboardingFinish,
  messageForDeliveryStage,
  overlayStatusForPhase,
} from '@/lib/completeOnboardingFinish';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';

import {
  AUTH_LOGGED_OUT_EVENT,
  authApi,
  onboardingApi,
  profileApi,
  type OnboardingDeliveryStatus,
} from '@/services/api';
import { tokenStore } from '@/lib/tokenStore';
import {
  isAuthFailureError,
  isOnboardingPath,
  redirectOnSessionExpired,
} from '@/lib/onboardingSession';

import { PageMeta } from '@/components/PageMeta';

import {
  PreferencesStep,
  DEFAULT_WORK_SETTINGS,
  mergeWorkSettings,
  type PreferencesStepValues,
} from '@/components/onboarding/PreferencesStep';
import { MonthYearField } from '@/components/onboarding/MonthYearField';
import { buildOnboardingProfilePayload } from '@/lib/buildOnboardingProfilePayload';
import { mapCvParseToOnboarding } from '@/lib/mapCvParseToOnboarding';
import {
  readOnboardingCvDraft,
  writeOnboardingCvDraft,
  clearOnboardingCvDraft,
} from '@/lib/onboardingCvDraft';
import { OnboardingPageShell } from '@/components/onboarding/OnboardingPageShell';
import { OnboardingStepper } from '@/components/onboarding/OnboardingStepper';
import { BasicInfoStep } from '@/components/onboarding/BasicInfoStep';
import { JobSearchRadarLoader } from '@/components/onboarding/JobSearchRadarLoader';
import { JobEvaluationProgressModal } from '@/components/JobEvaluationProgressModal';
import { useJobEvaluationProgress } from '@/hooks/useJobEvaluationProgress';
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



function defaultPreferences(): PreferencesStepValues {
  return {
    selectedRoles: [],
    selectedTech: [],
    workTypes: ['Full-time'],
    workSettings: { ...DEFAULT_WORK_SETTINGS },
    salaryMinK: 40,
    salaryMaxK: 80,
    salaryCurrency: 'EUR',
    availability: '2 weeks notice',
    cvFile: null,
    sponsorship: false,
    minMatchPercent: 60,
    maxAgeDays: 7,
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

  const { updateProfile, signUp, user } = useAuth();
  const queryClient = useQueryClient();
  const { progress, progressPercent, connect } = useJobEvaluationProgress(user?.id ?? null);
  const [showModal, setShowModal] = useState(false);
  const navigatedAfterEvalRef = useRef(false);

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

  const handleSessionExpiredOnOnboarding = useCallback(() => {
    if (!isOnboardingPath()) return;
    toast.error('Your sign-up session expired. Please start again from the sign-up page.');
    redirectOnSessionExpired('/onboarding');
  }, []);

  useEffect(() => {
    const onLoggedOut = () => {
      if (!isOnboardingPath()) return;
      toast.error('Your sign-up session expired. Please start again from the sign-up page.');
    };
    window.addEventListener(AUTH_LOGGED_OUT_EVENT, onLoggedOut);
    return () => window.removeEventListener(AUTH_LOGGED_OUT_EVENT, onLoggedOut);
  }, []);

  const [step, setStep] = useState(0);
  const [step0Submitted, setStep0Submitted] = useState(false);
  const [parsingCv, setParsingCv] = useState(false);
  const [cvParseSummary, setCvParseSummary] = useState<{
    rolesFound: number;
    educationFound: number;
    projectsFound: number;
  } | null>(() => {
    const draft = readOnboardingCvDraft();
    return draft
      ? {
          rolesFound: draft.rolesFound,
          educationFound: draft.educationFound,
          projectsFound: draft.projectsFound,
        }
      : null;
  });
  const scrollRef = useRef<HTMLDivElement>(null);

  const [saving, setSaving] = useState(false);
  const [matchingOverlay, setMatchingOverlay] = useState(false);
  const [deliveryStatus, setDeliveryStatus] = useState<OnboardingDeliveryStatus | null>(null);
  const [deliveryFailed, setDeliveryFailed] = useState<string | null>(null);
  const [verificationModalOpen, setVerificationModalOpen] = useState(false);
  const [verificationResendsRemaining, setVerificationResendsRemaining] = useState(3);

  const [fullName, setFullName] = useState(
    () => user?.name || readPendingSignup()?.name || '',
  );

  const [headline, setHeadline] = useState('');

  const [experienceYears, setExperienceYears] = useState('');

  const [location, setLocation] = useState('Dublin, Ireland');

  const [workEntries, setWorkEntries] = useState<WorkEntry[]>([emptyWork()]);

  const [educationEntries, setEducationEntries] = useState<EducationEntry[]>([emptyEducation()]);



  const [preferences, setPreferences] = useState<PreferencesStepValues>(defaultPreferences);

  const patchPreferences = useCallback((patch: Partial<PreferencesStepValues>) => {
    setPreferences(prev => {
      const next = { ...prev, ...patch };
      next.workSettings = mergeWorkSettings(prev.workSettings, patch.workSettings);
      return next;
    });
  }, []);



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
      setDeliveryStatus({
        ...status,
        message: messageForDeliveryStage(status.stage, status.message),
      });
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
    clearOnboardingCvDraft();
    setWelcomePendingFlag();
    setDeliveryFailed(null);
    setDeliveryStatus(null);
    setMatchingOverlay(false);
    setSaving(false);
    setShowModal(false);
    void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.discovery.all });
    nav('/dashboard?welcome=1', { replace: true });
  }

  useEffect(() => {
    if (progress.status !== 'complete' || navigatedAfterEvalRef.current) return;
    navigatedAfterEvalRef.current = true;
    const t = window.setTimeout(() => finishToDashboard(), 1500);
    return () => window.clearTimeout(t);
  }, [progress.status]);

  async function proceedFinish() {
    navigatedAfterEvalRef.current = false;
    setSaving(true);
    setMatchingOverlay(true);
    setDeliveryFailed(null);
    setDeliveryStatus(overlayStatusForPhase('Preparing…'));
    let keepDeliveryOverlay = false;

    try {
      const pending = readPendingSignup();
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

      const registerName = fullName.trim() || pending?.name?.trim() || 'User';
      const finishResult = await completeOnboardingFinish(
        {
          existingUser: user,
          pending,
          registerName,
          profilePayload: payload,
          cvFile: p.cvFile,
        },
        {
          signUp,
          clearPendingSignup,
          ensureFreshSession,
          updateProfile,
          uploadCv: async file => { await profileApi.uploadCv(file); },
          startDelivery: () => onboardingApi.startDelivery(),
          onPhase: setDeliveryStatus,
        },
      );

      if (!finishResult.ok) {
        if (finishResult.reason === 'session_expired') {
          handleSessionExpiredOnOnboarding();
          return;
        }
        if (finishResult.reason === 'signup_failed') {
          toast.error(finishResult.message ?? 'Could not create your account. Please try again.');
          return;
        }
        if (finishResult.reason === 'missing_user_id') {
          handleSessionExpiredOnOnboarding();
          return;
        }
        if (finishResult.reason === 'missing_cv') {
          toast.error('Upload your CV to finish onboarding.');
          setMatchingOverlay(false);
          return;
        }
      }

      const evaluationUserId = finishResult.ok ? finishResult.evaluationUserId : '';

      setShowModal(true);
      connect(evaluationUserId);
      try {
        await pollDeliveryUntilReady();
      } catch (pollErr: unknown) {
        if (isAuthFailureError(pollErr)) {
          handleSessionExpiredOnOnboarding();
          return;
        }
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
      if (isAuthFailureError(err)) {
        handleSessionExpiredOnOnboarding();
        return;
      }
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

  async function handleFinish() {
    const pending = readPendingSignup();
    const p = preferences;

    if (!p.cvFile) {
      toast.error('Upload your CV to finish onboarding.');
      return;
    }

    if (pending && !readOnboardingVerification(pending.email)) {
      setSaving(true);
      try {
        const registerName = fullName.trim() || pending.name?.trim() || 'User';
        const firstName = registerName.split(/\s+/)[0];
        const sendBody: { email: string; firstName?: string } = { email: pending.email };
        if (firstName) sendBody.firstName = firstName;
        const sent = await authApi.sendOnboardingVerificationOtp(sendBody);
        setVerificationResendsRemaining(sent.resendsRemaining);
        setVerificationModalOpen(true);
      } catch (err: unknown) {
        if (isAuthFailureError(err)) {
          handleSessionExpiredOnOnboarding();
          return;
        }
        const message =
          err && typeof err === 'object' && 'normalizedMessage' in err
            ? String((err as { normalizedMessage: string }).normalizedMessage)
            : err instanceof Error
              ? err.message
              : 'Could not send verification code. Please try again.';
        toast.error(message);
      } finally {
        setSaving(false);
      }
      return;
    }

    await proceedFinish();
  }

  function handleVerificationComplete(verificationId: string) {
    const pending = readPendingSignup();
    if (pending) {
      writeOnboardingVerification(verificationId, pending.email);
    }
    setVerificationModalOpen(false);
    void proceedFinish();
  }



  async function handleBasicInfoSubmit() {
    if (!fullName.trim()) {
      toast.error('Please enter your full name.');
      return;
    }
    if (!preferences.cvFile) {
      toast.error('Upload your CV to continue.');
      return;
    }

    setParsingCv(true);
    try {
      const parsed = await authApi.parseOnboardingCv(preferences.cvFile);
      const mapped = mapCvParseToOnboarding(parsed);

      setWorkEntries(mapped.workEntries);
      setEducationEntries(mapped.educationEntries);

      if (!headline.trim() && parsed.headline?.trim()) {
        setHeadline(parsed.headline.trim());
      }

      writeOnboardingCvDraft({
        cvMarkdown: parsed.cvMarkdown,
        rolesFound: parsed.rolesFound,
        educationFound: parsed.educationFound,
        projectsFound: parsed.projectsFound ?? 0,
      });

      setCvParseSummary({
        rolesFound: parsed.rolesFound,
        educationFound: parsed.educationFound,
        projectsFound: parsed.projectsFound ?? 0,
      });

      if (parsed.rolesFound === 0) {
        toast.error('We could not detect work experience in your CV. Please add it manually.');
      }

      setStep0Submitted(true);
      setStep(1);
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      });
    } catch (err: unknown) {
      if (isAuthFailureError(err)) {
        handleSessionExpiredOnOnboarding();
        return;
      }
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string; error?: string } } }).response?.data
              ?.message ??
            (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : err instanceof Error
            ? err.message
            : undefined;
      toast.error(message ?? 'Could not read your CV. Try a different PDF or DOCX file.');
    } finally {
      setParsingCv(false);
    }
  }

  const basicIdentityComplete = useMemo(
    () => Boolean(fullName.trim() && experienceYears && location.trim()),
    [fullName, experienceYears, location],
  );

  const profileCompleteness = useMemo(() => {
    let pct = 0;
    if (step0Submitted || step > 0) pct += 100 / 3;
    if (step > 1) pct += 100 / 3;
    if (saving || matchingOverlay) pct += 100 / 3;
    return Math.min(100, Math.round(pct));
  }, [step, step0Submitted, saving, matchingOverlay]);

  function handleBasicInfoChange(patch: {
    fullName?: string;
    headline?: string;
    experienceYears?: string;
    location?: string;
    cvFile?: File | null;
  }) {
    if (patch.fullName !== undefined) setFullName(patch.fullName);
    if (patch.headline !== undefined) setHeadline(patch.headline);
    if (patch.experienceYears !== undefined) setExperienceYears(patch.experienceYears);
    if (patch.location !== undefined) setLocation(patch.location);
    if (patch.cvFile !== undefined) patchPreferences({ cvFile: patch.cvFile });
  }



  return (
    <>
      {showModal && (
        <JobEvaluationProgressModal
          progress={progress}
          progressPercent={progressPercent}
          onClose={() => {
            setShowModal(false);
            finishToDashboard();
          }}
        />
      )}

      {(matchingOverlay || deliveryFailed) && !showModal &&
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

      <PageMeta title="CareerOps - Profile Setup" />

      <OnboardingPageShell
        activeStep={step}
        profileCompleteness={profileCompleteness}
        experienceYears={experienceYears}
        step0Submitted={step0Submitted}
      >
        <div className="onboarding-shell__scroll" ref={scrollRef}>
          <OnboardingStepper activeStep={step} basicIdentityComplete={basicIdentityComplete} />

          {step === 0 && (
            <BasicInfoStep
              values={{
                fullName,
                headline,
                experienceYears,
                location,
                cvFile: preferences.cvFile,
              }}
              onChange={handleBasicInfoChange}
              onSubmit={() => void handleBasicInfoSubmit()}
              parsingCv={parsingCv}
            />
          )}



          {step === 1 && (
            <>
              <div className="onboarding-card__title onboarding-card__title--experience">
                <h1>Tell us about your background</h1>
                <p>Add your work experience and education to help us find the best roles for you.</p>
              </div>

              {cvParseSummary && (cvParseSummary.rolesFound > 0 || cvParseSummary.educationFound > 0) && (
                <div className="onboarding-parse-banner" role="status">
                  <span className="material-symbols-outlined" aria-hidden="true">
                    auto_awesome
                  </span>
                  <p>
                    We found{' '}
                    {cvParseSummary.rolesFound > 0
                      ? `${cvParseSummary.rolesFound} role${cvParseSummary.rolesFound === 1 ? '' : 's'}`
                      : 'no roles'}
                    {cvParseSummary.educationFound > 0
                      ? ` and ${cvParseSummary.educationFound} school${cvParseSummary.educationFound === 1 ? '' : 's'}`
                      : ''}{' '}
                    from your CV — review and edit below.
                  </p>
                </div>
              )}



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
                <button className="onboarding-btn-primary onboarding-btn-primary--full" type="submit">
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
            <>
              <div className="onboarding-card__title onboarding-card__title--preferences">
                <h1>Job preferences</h1>
                <p>
                  Choose roles, skills, and filters so we only surface jobs that fit your profile — not
                  random listings.
                </p>
              </div>
              <form className="onboarding-form onboarding-form--preferences" onSubmit={e => e.preventDefault()}>
                <PreferencesStep
                  values={preferences}
                  saving={saving}
                  onChange={patchPreferences}
                  onBack={() => setStep(1)}
                  onComplete={handleFinish}
                />
              </form>
            </>
          )}
        </div>
      </OnboardingPageShell>
    </div>

      <OnboardingEmailVerificationModal
        open={verificationModalOpen}
        email={readPendingSignup()?.email ?? ''}
        {...(fullName.trim()
          ? { firstName: fullName.trim().split(/\s+/)[0] }
          : {})}
        initialResendsRemaining={verificationResendsRemaining}
        onVerified={handleVerificationComplete}
        onCancel={() => setVerificationModalOpen(false)}
      />
    </>
  );

}


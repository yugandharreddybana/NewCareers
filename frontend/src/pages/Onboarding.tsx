import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useNavigate } from 'react-router-dom';

import { useAuth } from '@/context/authCtx';
import {
  readOnboardingVerification,
  writeOnboardingVerification,
} from '@/lib/onboardingVerification';
import {
  clearPendingSignup,
  readPendingSignup,
} from '@/lib/pendingSignup';
import { OnboardingEmailVerificationModal } from '@/components/onboarding/OnboardingEmailVerificationModal';
import { readableDisplayName } from '@/lib/readableDisplayName';
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
  ensureFreshSession,
  onboardingApi,
  profileApi,
  type OnboardingDeliveryStatus,
} from '@/services/api';
import {
  getSessionExpiredRedirectTarget,
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
import { ExperienceStep } from '@/components/onboarding/ExperienceStep';
import { buildOnboardingProfilePayload } from '@/lib/buildOnboardingProfilePayload';
import {
  emptyEducation,
  emptyProject,
  emptyWork,
  mapCvParseToOnboarding,
  type MappedEducationEntry,
  type MappedProjectEntry,
  type MappedWorkEntry,
} from '@/lib/mapCvParseToOnboarding';
import {
  readOnboardingCvDraft,
  writeOnboardingCvDraft,
  clearOnboardingCvDraft,
} from '@/lib/onboardingCvDraft';
import { mergeUniqueChipValues } from '@/lib/mergeUniqueChipValues';
import { OnboardingPageShell } from '@/components/onboarding/OnboardingPageShell';
import { OnboardingStepper } from '@/components/onboarding/OnboardingStepper';
import { BasicInfoStep } from '@/components/onboarding/BasicInfoStep';
import { CAPTCHA_ENABLED } from '@/components/auth/RecaptchaBlock';
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

import {
  GENERIC_CV_PARSE_ERROR,
  GENERIC_ONBOARDING_MATCH_ERROR,
  GENERIC_ONBOARDING_PROFILE_ERROR,
  GENERIC_ONBOARDING_SIGNUP_ERROR,
} from '@/lib/authErrors';
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
    const target = getSessionExpiredRedirectTarget('/onboarding', { user });
    if (!target) {
      toast.error('Your session expired. Sign in again to continue setup.');
      return;
    }
    toast.error('Your sign-up session expired. Please start again from the sign-up page.');
    redirectOnSessionExpired('/onboarding', { user });
  }, [user]);

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
  const [parseCaptchaToken, setParseCaptchaToken] = useState<string | null>(null);
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
  const [verificationResendsRemaining] = useState(3);
  const [fullName, setFullName] = useState(() => {
    const pendingName = readPendingSignup()?.name?.trim();
    if (pendingName) return pendingName;
    return readableDisplayName(user?.name);
  });

  useEffect(() => {
    const pendingName = readPendingSignup()?.name?.trim();
    if (pendingName) return;
    const readable = readableDisplayName(user?.name);
    if (!readable) return;
    setFullName(prev => (readableDisplayName(prev) ? prev : readable));
  }, [user?.name]);

  const [headline, setHeadline] = useState('');

  const [experienceYears, setExperienceYears] = useState('');

  const [location, setLocation] = useState('Dublin, Ireland');

  const [linkedInUrl, setLinkedInUrl] = useState('');
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [githubUrl, setGithubUrl] = useState('');

  const [workEntries, setWorkEntries] = useState<MappedWorkEntry[]>([emptyWork()]);

  const [educationEntries, setEducationEntries] = useState<MappedEducationEntry[]>([emptyEducation()]);

  const [projectEntries, setProjectEntries] = useState<MappedProjectEntry[]>([emptyProject()]);



  const [preferences, setPreferences] = useState<PreferencesStepValues>(() => {
    const draft = readOnboardingCvDraft();
    const base = defaultPreferences();
    if (!draft) return base;
    let next = base;
    if (draft.extractedTechStack?.length) {
      next = {
        ...next,
        selectedTech: mergeUniqueChipValues(next.selectedTech, draft.extractedTechStack),
      };
    }
    if (draft.extractedTargetRoles?.length) {
      next = {
        ...next,
        selectedRoles: mergeUniqueChipValues(next.selectedRoles, draft.extractedTargetRoles),
      };
    }
    return next;
  });
  const [parseSource, setParseSource] = useState<'ai' | 'regex' | null>(
    () => readOnboardingCvDraft()?.parseSource ?? null,
  );
  const [techAutoFilled, setTechAutoFilled] = useState(
    () => Boolean(readOnboardingCvDraft()?.extractedTechStack?.length),
  );
  const [rolesAutoFilled, setRolesAutoFilled] = useState(
    () => Boolean(readOnboardingCvDraft()?.extractedTargetRoles?.length),
  );
  const techPrefilledRef = useRef(techAutoFilled);
  const rolesPrefilledRef = useRef(rolesAutoFilled);

  const patchPreferences = useCallback((patch: Partial<PreferencesStepValues>) => {
    setPreferences(prev => {
      const next = { ...prev, ...patch };
      next.workSettings = mergeWorkSettings(prev.workSettings, patch.workSettings);
      return next;
    });
  }, []);



  function updateWork(index: number, patch: Partial<MappedWorkEntry>) {
    setWorkEntries(prev => prev.map((w, i) => (i === index ? { ...w, ...patch } : w)));
  }

  function updateEducation(index: number, patch: Partial<MappedEducationEntry>) {
    setEducationEntries(prev => prev.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  }

  function updateProject(index: number, patch: Partial<MappedProjectEntry>) {
    setProjectEntries(prev => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
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
            'Matching could not complete. Your profile is saved ? try again or open the dashboard to use any roles already found.',
        );
      }
      await sleep(DELIVERY_POLL_MS);
    }
    throw new Error(
      'Matching is taking longer than expected. You can open the dashboard ? more roles will load in the background.',
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
    setDeliveryStatus(overlayStatusForPhase('Preparing?'));
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
        {
          fullName,
          headline,
          experienceYears,
          location,
          linkedInUrl,
          portfolioUrl,
          githubUrl,
        },
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
          projectEntries,
        },
        {
          signUp,
          clearPendingSignup,
          ensureFreshSession,
          updateProfile,
          uploadCv: async file => { await profileApi.uploadCv(file); },
          addPortfolioItem: async body => { await profileApi.addPortfolioItem(body); },
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
          toast.error(finishResult.message ?? GENERIC_ONBOARDING_SIGNUP_ERROR);
          return;
        }
        if (finishResult.reason === 'plan_limit') {
          toast.error(finishResult.message ?? GENERIC_ONBOARDING_PROFILE_ERROR);
          setMatchingOverlay(false);
          navigate('/account/billing');
          return;
        }
        if (
          finishResult.reason === 'profile_failed' ||
          finishResult.reason === 'cv_failed' ||
          finishResult.reason === 'delivery_failed'
        ) {
          toast.error(finishResult.message ?? GENERIC_ONBOARDING_PROFILE_ERROR);
          return;
        }
        if (finishResult.reason === 'missing_user_id') {
          toast.error(finishResult.message ?? GENERIC_ONBOARDING_PROFILE_ERROR);
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
          const target = getSessionExpiredRedirectTarget('/onboarding', { user });
          if (target) {
            handleSessionExpiredOnOnboarding();
          } else {
            setDeliveryFailed('Your session expired. Sign in again to continue setup.');
            keepDeliveryOverlay = true;
          }
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
          pollMsg?.includes('longer than expected') ? pollMsg : GENERIC_ONBOARDING_MATCH_ERROR,
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
      toast.error(GENERIC_ONBOARDING_PROFILE_ERROR);
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
      setVerificationModalOpen(true);
      return;
    }

    await proceedFinish();
  }

  function handleVerificationComplete(verificationId: string) {
    const pending = readPendingSignup();
    if (pending) {
      writeOnboardingVerification(verificationId, pending.email, pending.signupIntentId);
    }
    setVerificationModalOpen(false);
    void proceedFinish();
  }



  async function handleBasicInfoSubmit() {
    if (!fullName.trim()) {
      toast.error('Please enter your full name.');
      return;
    }
    if (!headline.trim()) {
      toast.error('Please enter your professional headline.');
      return;
    }
    if (!experienceYears) {
      toast.error('Please select your years of experience.');
      return;
    }
    if (!preferences.cvFile) {
      toast.error('Upload your CV to continue.');
      return;
    }
    if (CAPTCHA_ENABLED && !parseCaptchaToken) {
      toast.error('Complete the security check below.');
      return;
    }

    setParsingCv(true);
    try {
      const pending = readPendingSignup();
      const parsed = await authApi.parseOnboardingCv(
        preferences.cvFile,
        pending?.signupIntentId,
        pending?.email,
        parseCaptchaToken ?? undefined,
      );
      const mapped = mapCvParseToOnboarding(parsed);

      setWorkEntries(mapped.workEntries);
      setEducationEntries(mapped.educationEntries);
      setProjectEntries(mapped.projectEntries);

      if (!headline.trim() && parsed.headline?.trim()) {
        setHeadline(parsed.headline.trim());
      }

      if (!linkedInUrl.trim() && parsed.linkedInUrl?.trim()) {
        setLinkedInUrl(parsed.linkedInUrl.trim());
      }
      if (!portfolioUrl.trim() && parsed.websiteUrl?.trim()) {
        setPortfolioUrl(parsed.websiteUrl.trim());
      }
      if (!githubUrl.trim() && parsed.githubUrl?.trim()) {
        setGithubUrl(parsed.githubUrl.trim());
      }

      const extractedTech = parsed.extractedTechStack ?? [];
      if (!techPrefilledRef.current && extractedTech.length > 0) {
        setPreferences(p => ({
          ...p,
          selectedTech: mergeUniqueChipValues(p.selectedTech, extractedTech),
        }));
        setTechAutoFilled(true);
        techPrefilledRef.current = true;
      }

      const extractedRoles = parsed.extractedTargetRoles ?? [];
      if (!rolesPrefilledRef.current && extractedRoles.length > 0) {
        setPreferences(p => ({
          ...p,
          selectedRoles: mergeUniqueChipValues(p.selectedRoles, extractedRoles),
        }));
        setRolesAutoFilled(true);
        rolesPrefilledRef.current = true;
      }

      setParseSource(parsed.parseSource ?? 'regex');

      writeOnboardingCvDraft({
        cvMarkdown: parsed.cvMarkdown,
        rolesFound: parsed.rolesFound,
        educationFound: parsed.educationFound,
        projectsFound: parsed.projectsFound ?? 0,
        extractedTechStack: extractedTech.length > 0 ? extractedTech : undefined,
        extractedTargetRoles: extractedRoles.length > 0 ? extractedRoles : undefined,
        parseSource: parsed.parseSource,
      });

      setCvParseSummary({
        rolesFound: parsed.rolesFound,
        educationFound: parsed.educationFound,
        projectsFound: parsed.projectsFound ?? 0,
      });

      if (parsed.parseSource === 'ai' && (parsed.rolesFound > 0 || parsed.educationFound > 0)) {
        toast.success('Imported details from your CV — review the next steps.');
      } else if (parsed.parseWarnings?.length) {
        toast(parsed.parseWarnings[0], { icon: '??' });
      }

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
        err instanceof Error && err.message.trim()
          ? err.message
          : GENERIC_CV_PARSE_ERROR;
      toast.error(message);
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
    linkedInUrl?: string;
    portfolioUrl?: string;
    githubUrl?: string;
    cvFile?: File | null;
  }) {
    if (patch.fullName !== undefined) setFullName(patch.fullName);
    if (patch.headline !== undefined) setHeadline(patch.headline);
    if (patch.experienceYears !== undefined) setExperienceYears(patch.experienceYears);
    if (patch.location !== undefined) setLocation(patch.location);
    if (patch.linkedInUrl !== undefined) setLinkedInUrl(patch.linkedInUrl);
    if (patch.portfolioUrl !== undefined) setPortfolioUrl(patch.portfolioUrl);
    if (patch.githubUrl !== undefined) setGithubUrl(patch.githubUrl);
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
          <>
          <OnboardingStepper activeStep={step} basicIdentityComplete={basicIdentityComplete} />

          {step === 0 && (
            <BasicInfoStep
              values={{
                fullName,
                headline,
                experienceYears,
                location,
                linkedInUrl,
                portfolioUrl,
                githubUrl,
                cvFile: preferences.cvFile,
              }}
              onChange={handleBasicInfoChange}
              onSubmit={() => void handleBasicInfoSubmit()}
              parsingCv={parsingCv}
              parseCaptchaToken={parseCaptchaToken}
              onParseCaptchaChange={setParseCaptchaToken}
            />
          )}



          {step === 1 && (
            <ExperienceStep
              workEntries={workEntries}
              educationEntries={educationEntries}
              projectEntries={projectEntries}
              cvParseSummary={cvParseSummary}
              parseSource={parseSource}
              onWorkChange={updateWork}
              onEducationChange={updateEducation}
              onProjectChange={updateProject}
              onWorkEntries={setWorkEntries}
              onEducationEntries={setEducationEntries}
              onProjectEntries={setProjectEntries}
              onBack={() => setStep(0)}
              onContinue={() => setStep(2)}
            />
          )}

          {step === 2 && (
            <>
              <div className="onboarding-card__title onboarding-card__title--preferences">
                <h1>Job preferences</h1>
                <p>
                  Choose roles, skills, and filters so we only surface jobs that fit your profile ? not
                  random listings.
                </p>
              </div>
              <form className="onboarding-form onboarding-form--preferences" onSubmit={e => e.preventDefault()}>
                <PreferencesStep
                  values={preferences}
                  saving={saving}
                  techAutoFilled={techAutoFilled}
                  rolesAutoFilled={rolesAutoFilled}
                  onChange={patchPreferences}
                  onBack={() => setStep(1)}
                  onComplete={handleFinish}
                />
              </form>
            </>
          )}
            </>
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
        awaitingInitialSend
        onVerified={handleVerificationComplete}
        onCancel={() => setVerificationModalOpen(false)}
      />
    </>
  );

}


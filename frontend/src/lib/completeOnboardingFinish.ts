/**
 * Ordered steps for onboarding "Complete profile":
 * register (if deferred) → save profile + CV → start job delivery.
 */
import type { User } from '@/types';
import type { UpdateProfilePayload } from '@/context/AuthContext';
import { clearOnboardingVerification, readOnboardingVerification } from '@/lib/onboardingVerification';
import type { PendingSignup, SignupConsents } from '@/lib/pendingSignup';
import type { OnboardingDeliveryStatus } from '@/services/api';
import { filterProjectEntries } from '@/lib/buildOnboardingProfilePayload';
import type { MappedProjectEntry } from '@/lib/mapCvParseToOnboarding';
import { normalizeUrl } from '@/lib/normalizeUrl';
import {
  GENERIC_ONBOARDING_MATCH_ERROR,
  GENERIC_ONBOARDING_PROFILE_ERROR,
  GENERIC_ONBOARDING_SIGNUP_ERROR,
} from '@/lib/authErrors';
import { emitPlanLimitExceeded, parsePlanLimitResponse } from '@/lib/planLimitEvents';
import { isApiError } from '@/types';

export const ONBOARDING_OVERLAY_CREATING_ACCOUNT =
  'Creating your account…' as const;
export const ONBOARDING_OVERLAY_SAVING_PROFILE =
  'Saving your profile…' as const;
export const ONBOARDING_OVERLAY_STARTING_MATCH =
  'Starting job search…' as const;

export function overlayStatusForPhase(
  message: string,
  partial?: Partial<OnboardingDeliveryStatus>,
): OnboardingDeliveryStatus {
  return {
    stage: partial?.stage ?? 'reading_cv',
    message,
    evaluatedCount: partial?.evaluatedCount ?? 0,
    targetCount: partial?.targetCount ?? 10,
    minRequired: partial?.minRequired ?? 3,
    jobsDiscovered: partial?.jobsDiscovered ?? 0,
    readyPartial: partial?.readyPartial ?? false,
    ready: partial?.ready ?? false,
    error: partial?.error ?? null,
  };
}

/** User-facing message from backend delivery poll stage. */
export function messageForDeliveryStage(
  stage: string,
  backendMessage?: string,
): string {
  switch (stage) {
    case 'reading_cv':
      return backendMessage ?? 'Reading your CV…';
    case 'normalizing_cv':
      return backendMessage ?? 'Preparing your profile for matching…';
    case 'fetching_jobs':
      return backendMessage ?? 'Searching job boards in your area…';
    case 'evaluating_jobs':
      return backendMessage ?? 'Evaluating role fit with AI…';
    case 'ready':
    case 'ready_partial':
      return backendMessage ?? 'Your job matches are ready';
    case 'failed':
      return backendMessage ?? 'Matching could not complete';
    default:
      return backendMessage ?? 'Finding your best matches…';
  }
}


export type CompleteOnboardingFinishInput = {
  existingUser: User | null;
  pending: PendingSignup | null;
  registerName: string;
  profilePayload: UpdateProfilePayload;
  cvFile: File | null | undefined;
  projectEntries?: MappedProjectEntry[];
};

export type CompleteOnboardingFinishDeps = {
  signUp: (input: {
    name: string;
    email: string;
    signupIntentId: string;
    consents: SignupConsents;
    emailVerificationId?: string;
  }) => Promise<User>;
  clearPendingSignup: () => void;
  ensureFreshSession: () => Promise<void>;
  updateProfile: (data: UpdateProfilePayload) => Promise<unknown>;
  uploadCv: (file: File) => Promise<void>;
  addPortfolioItem: (body: {
    title: string;
    url?: string;
    description?: string;
    techTags?: string[];
    location?: string;
  }) => Promise<void>;
  startDelivery: () => Promise<{ stage: string; message: string }>;
  onPhase: (status: OnboardingDeliveryStatus) => void;
};

export type CompleteOnboardingFinishResult =
  | { ok: true; evaluationUserId: string }
  | {
      ok: false;
      reason:
        | 'session_expired'
        | 'signup_failed'
        | 'profile_failed'
        | 'cv_failed'
        | 'delivery_failed'
        | 'plan_limit'
        | 'missing_user_id'
        | 'missing_cv';
      message?: string;
    };

function planLimitFailure(err: unknown): CompleteOnboardingFinishResult | null {
  if (!isApiError(err) || err.status !== 402) return null;
  const body = err.response?.data as Record<string, unknown> | undefined;
  const planLimit = parsePlanLimitResponse(body ?? {});
  if (planLimit) emitPlanLimitExceeded(planLimit);
  return {
    ok: false,
    reason: 'plan_limit',
    message: err.normalizedMessage ?? GENERIC_ONBOARDING_MATCH_ERROR,
  };
}

/**
 * Runs register → profile → CV → startDelivery in strict order.
 * Does not poll delivery status (caller handles that).
 */
export async function completeOnboardingFinish(
  input: CompleteOnboardingFinishInput,
  deps: CompleteOnboardingFinishDeps,
): Promise<CompleteOnboardingFinishResult> {
  const { existingUser, pending, registerName, profilePayload, cvFile, projectEntries } = input;

  if (!existingUser && !pending) {
    return { ok: false, reason: 'session_expired' };
  }

  let evaluationUserId = existingUser?.id;

  if (pending) {
    const verification = readOnboardingVerification(
      pending.email,
      pending.signupIntentId,
    );
    if (!verification?.verificationId) {
      return { ok: false, reason: 'signup_failed', message: 'Email verification required.' };
    }

    deps.onPhase(overlayStatusForPhase(ONBOARDING_OVERLAY_CREATING_ACCOUNT));
    try {
      const created = await deps.signUp({
        name: registerName,
        email: pending.email,
        signupIntentId: pending.signupIntentId,
        consents: pending.consents,
        emailVerificationId: verification.verificationId,
      });
      evaluationUserId = created.id;
    } catch {
      return { ok: false, reason: 'signup_failed', message: GENERIC_ONBOARDING_SIGNUP_ERROR };
    }
  } else {
    await deps.ensureFreshSession();
  }

  if (!evaluationUserId?.trim()) {
    return { ok: false, reason: 'missing_user_id', message: GENERIC_ONBOARDING_PROFILE_ERROR };
  }

  if (!cvFile) {
    return { ok: false, reason: 'missing_cv' };
  }

  deps.onPhase(overlayStatusForPhase(ONBOARDING_OVERLAY_SAVING_PROFILE));
  try {
    await deps.updateProfile(profilePayload);
  } catch {
    return {
      ok: false,
      reason: 'profile_failed',
      message: GENERIC_ONBOARDING_PROFILE_ERROR,
    };
  }

  try {
    await deps.uploadCv(cvFile);
    for (const project of filterProjectEntries(projectEntries ?? [])) {
      const title = project.projectName.trim();
      if (!title) continue;
      const link = project.projectLink.trim();
      const details = project.projectDetails.trim();
      const loc = project.location.trim();
      const techTags = project.techStack
        .split(/[,;|/]/)
        .map(t => t.trim())
        .filter(Boolean);
      await deps.addPortfolioItem({
        title,
        ...(link ? { url: normalizeUrl(link) } : {}),
        ...(details ? { description: details } : {}),
        ...(techTags.length > 0 ? { techTags } : {}),
        ...(loc ? { location: loc } : {}),
      });
    }
  } catch {
    return {
      ok: false,
      reason: 'cv_failed',
      message: GENERIC_ONBOARDING_PROFILE_ERROR,
    };
  }

  deps.onPhase(
    overlayStatusForPhase(ONBOARDING_OVERLAY_STARTING_MATCH, { stage: 'fetching_jobs' }),
  );
  try {
    await deps.startDelivery();
  } catch (err) {
    const planLimit = planLimitFailure(err);
    if (planLimit) return planLimit;
    return {
      ok: false,
      reason: 'delivery_failed',
      message: GENERIC_ONBOARDING_MATCH_ERROR,
    };
  }

  if (pending) {
    deps.clearPendingSignup();
    clearOnboardingVerification();
  }

  return { ok: true, evaluationUserId };
}

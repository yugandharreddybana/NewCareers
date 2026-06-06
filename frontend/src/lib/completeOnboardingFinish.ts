/**
 * Ordered steps for onboarding "Complete profile":
 * register (if deferred) → save profile + CV → start job delivery.
 */
import type { User } from '@/types';
import type { UpdateProfilePayload } from '@/context/AuthContext';
import { clearOnboardingVerification, readOnboardingVerification } from '@/lib/onboardingVerification';
import type { PendingSignup, SignupConsents } from '@/lib/pendingSignup';
import type { OnboardingDeliveryStatus } from '@/services/api';

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
  cvFile: File;
};

export type CompleteOnboardingFinishDeps = {
  signUp: (input: {
    name: string;
    email: string;
    password: string;
    consents: SignupConsents;
    emailVerificationId?: string;
  }) => Promise<User>;
  clearPendingSignup: () => void;
  ensureFreshSession: () => Promise<void>;
  updateProfile: (data: UpdateProfilePayload) => Promise<void>;
  uploadCv: (file: File) => Promise<void>;
  startDelivery: () => Promise<{ stage: string; message: string }>;
  onPhase: (status: OnboardingDeliveryStatus) => void;
};

export type CompleteOnboardingFinishResult =
  | { ok: true; evaluationUserId: string }
  | { ok: false; reason: 'session_expired' | 'signup_failed' | 'missing_user_id' | 'missing_cv'; message?: string };

/**
 * Runs register → profile → CV → startDelivery in strict order.
 * Does not poll delivery status (caller handles that).
 */
export async function completeOnboardingFinish(
  input: CompleteOnboardingFinishInput,
  deps: CompleteOnboardingFinishDeps,
): Promise<CompleteOnboardingFinishResult> {
  const { existingUser, pending, registerName, profilePayload, cvFile } = input;

  if (!existingUser && !pending) {
    return { ok: false, reason: 'session_expired' };
  }

  let evaluationUserId = existingUser?.id;

  if (pending) {
    const verification = readOnboardingVerification(pending.email);
    if (!verification?.verificationId) {
      return { ok: false, reason: 'signup_failed', message: 'Email verification required.' };
    }

    deps.onPhase(overlayStatusForPhase(ONBOARDING_OVERLAY_CREATING_ACCOUNT));
    try {
      const created = await deps.signUp({
        name: registerName,
        email: pending.email,
        password: pending.password,
        consents: pending.consents,
        emailVerificationId: verification.verificationId,
      });
      evaluationUserId = created.id;
      deps.clearPendingSignup();
      clearOnboardingVerification();
    } catch (err: unknown) {
      const rawMessage =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string; error?: string } } }).response?.data
              ?.message ??
            (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : err instanceof Error
            ? err.message
            : undefined;
      return rawMessage
        ? { ok: false, reason: 'signup_failed', message: rawMessage }
        : { ok: false, reason: 'signup_failed' };
    }
  } else {
    await deps.ensureFreshSession();
  }

  if (!evaluationUserId?.trim()) {
    return { ok: false, reason: 'missing_user_id' };
  }

  if (!cvFile) {
    return { ok: false, reason: 'missing_cv' };
  }

  deps.onPhase(overlayStatusForPhase(ONBOARDING_OVERLAY_SAVING_PROFILE));
  await deps.updateProfile(profilePayload);
  await deps.uploadCv(cvFile);

  deps.onPhase(
    overlayStatusForPhase(ONBOARDING_OVERLAY_STARTING_MATCH, { stage: 'fetching_jobs' }),
  );
  await deps.startDelivery();

  return { ok: true, evaluationUserId };
}

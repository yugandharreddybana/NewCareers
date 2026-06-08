import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  completeOnboardingFinish,
  messageForDeliveryStage,
  ONBOARDING_OVERLAY_CREATING_ACCOUNT,
  ONBOARDING_OVERLAY_SAVING_PROFILE,
} from './completeOnboardingFinish';
import { writeOnboardingVerification } from './onboardingVerification';
import type { User } from '@/types';
import { GENERIC_ONBOARDING_SIGNUP_ERROR } from '@/lib/authErrors';

const baseUser: User = {
  id: 'existing-user-id',
  email: 'exists@test.ie',
  name: 'Existing',
  username: 'exists',
  onboarded: false,
  role: 'USER',
};

const pending = {
  signupIntentId: '33333333-3333-4333-8333-333333333333',
  email: 'new@test.ie',
  name: 'New User',
  consents: {
    termsAccepted: true,
    aiProcessingAccepted: true,
    marketingAccepted: false,
    analyticsAccepted: false,
  },
};

const cvFile = new File(['cv'], 'cv.pdf', { type: 'application/pdf' });

describe('completeOnboardingFinish', () => {
  const signUp = vi.fn();
  const clearPendingSignup = vi.fn();
  const ensureFreshSession = vi.fn();
  const updateProfile = vi.fn();
  const uploadCv = vi.fn();
  const addPortfolioItem = vi.fn();
  const startDelivery = vi.fn();
  const onPhase = vi.fn();

  const deps = () => ({
    signUp,
    clearPendingSignup,
    ensureFreshSession,
    updateProfile,
    uploadCv,
    addPortfolioItem,
    startDelivery,
    onPhase,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    writeOnboardingVerification('verification-id-1', pending.email, pending.signupIntentId);
    signUp.mockResolvedValue({ ...baseUser, id: 'new-user-id', email: pending.email });
    ensureFreshSession.mockResolvedValue(undefined);
    updateProfile.mockResolvedValue(undefined);
    uploadCv.mockResolvedValue(undefined);
    addPortfolioItem.mockResolvedValue(undefined);
    startDelivery.mockResolvedValue({ stage: 'reading_cv', message: 'Reading your CV…' });
  });

  it('calls signUp before profile, CV, and startDelivery for deferred signup', async () => {
    const order: string[] = [];
    signUp.mockImplementation(async () => {
      order.push('signUp');
      return { ...baseUser, id: 'new-user-id' };
    });
    updateProfile.mockImplementation(async () => { order.push('updateProfile'); });
    uploadCv.mockImplementation(async () => { order.push('uploadCv'); });
    startDelivery.mockImplementation(async () => { order.push('startDelivery'); return { stage: 'fetching_jobs', message: 'x' }; });

    const result = await completeOnboardingFinish(
      {
        existingUser: null,
        pending,
        registerName: 'New User',
        profilePayload: { onboarded: true, name: 'New User' },
        cvFile,
      },
      deps(),
    );

    expect(result).toEqual({ ok: true, evaluationUserId: 'new-user-id' });
    expect(order).toEqual(['signUp', 'updateProfile', 'uploadCv', 'startDelivery']);
    expect(clearPendingSignup).toHaveBeenCalledOnce();
    expect(ensureFreshSession).not.toHaveBeenCalled();
    expect(onPhase).toHaveBeenCalledWith(
      expect.objectContaining({ message: ONBOARDING_OVERLAY_CREATING_ACCOUNT }),
    );
    expect(onPhase).toHaveBeenCalledWith(
      expect.objectContaining({ message: ONBOARDING_OVERLAY_SAVING_PROFILE }),
    );
  });

  it('skips signUp for logged-in user but still saves profile before startDelivery', async () => {
    const order: string[] = [];
    updateProfile.mockImplementation(async () => { order.push('updateProfile'); });
    uploadCv.mockImplementation(async () => { order.push('uploadCv'); });
    startDelivery.mockImplementation(async () => { order.push('startDelivery'); return { stage: 'fetching_jobs', message: 'x' }; });

    const result = await completeOnboardingFinish(
      {
        existingUser: baseUser,
        pending: null,
        registerName: 'Existing',
        profilePayload: { onboarded: true },
        cvFile,
      },
      deps(),
    );

    expect(result).toEqual({ ok: true, evaluationUserId: 'existing-user-id' });
    expect(order).toEqual(['updateProfile', 'uploadCv', 'startDelivery']);
    expect(signUp).not.toHaveBeenCalled();
    expect(ensureFreshSession).toHaveBeenCalledOnce();
  });

  it('fails deferred signup when email verification session is missing', async () => {
    sessionStorage.clear();

    const result = await completeOnboardingFinish(
      {
        existingUser: null,
        pending,
        registerName: 'New User',
        profilePayload: { onboarded: true },
        cvFile,
      },
      deps(),
    );

    expect(result).toEqual({
      ok: false,
      reason: 'signup_failed',
      message: 'Email verification required.',
    });
    expect(signUp).not.toHaveBeenCalled();
  });

  it('does not call startDelivery when signUp fails', async () => {
    signUp.mockRejectedValue(new Error('Email already in use'));

    const result = await completeOnboardingFinish(
      {
        existingUser: null,
        pending,
        registerName: 'New User',
        profilePayload: { onboarded: true },
        cvFile,
      },
      deps(),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('signup_failed');
    expect(updateProfile).not.toHaveBeenCalled();
    expect(startDelivery).not.toHaveBeenCalled();
  });

  it('returns missing_cv before profile save when cvFile is absent', async () => {
    const result = await completeOnboardingFinish(
      {
        existingUser: baseUser,
        pending: null,
        registerName: 'Existing',
        profilePayload: { onboarded: true },
        cvFile: null,
      },
      deps(),
    );

    expect(result).toEqual({ ok: false, reason: 'missing_cv' });
    expect(updateProfile).not.toHaveBeenCalled();
    expect(uploadCv).not.toHaveBeenCalled();
    expect(startDelivery).not.toHaveBeenCalled();
  });

  it('returns structured failure when uploadCv throws', async () => {
    uploadCv.mockRejectedValue(new Error('Upload failed'));

    const result = await completeOnboardingFinish(
      {
        existingUser: baseUser,
        pending: null,
        registerName: 'Existing',
        profilePayload: { onboarded: true },
        cvFile,
      },
      deps(),
    );

    expect(result).toEqual({
      ok: false,
      reason: 'signup_failed',
      message: GENERIC_ONBOARDING_SIGNUP_ERROR,
    });
    expect(updateProfile).toHaveBeenCalledOnce();
    expect(startDelivery).not.toHaveBeenCalled();
  });

  it('returns structured failure when startDelivery throws', async () => {
    startDelivery.mockRejectedValue(new Error('Delivery unavailable'));

    const result = await completeOnboardingFinish(
      {
        existingUser: baseUser,
        pending: null,
        registerName: 'Existing',
        profilePayload: { onboarded: true },
        cvFile,
      },
      deps(),
    );

    expect(result).toEqual({
      ok: false,
      reason: 'signup_failed',
      message: GENERIC_ONBOARDING_SIGNUP_ERROR,
    });
    expect(uploadCv).toHaveBeenCalledOnce();
  });

  it('returns session_expired when no user and no pending signup', async () => {
    const result = await completeOnboardingFinish(
      {
        existingUser: null,
        pending: null,
        registerName: 'X',
        profilePayload: { onboarded: true },
        cvFile,
      },
      deps(),
    );

    expect(result).toEqual({ ok: false, reason: 'session_expired' });
    expect(signUp).not.toHaveBeenCalled();
    expect(startDelivery).not.toHaveBeenCalled();
  });
});

describe('messageForDeliveryStage', () => {
  it('maps fetching_jobs to a search message', () => {
    expect(messageForDeliveryStage('fetching_jobs')).toMatch(/Searching job boards/i);
  });
});

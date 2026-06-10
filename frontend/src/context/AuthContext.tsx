/**
 * AuthContext.tsx — single source of truth for authentication state.
 */
import {
  useState, useEffect,
  useCallback, useRef, type ReactNode,
} from 'react';
import {
  AuthCtx,
  type SignUpInput,
  type UpdateProfilePayload,
} from '@/context/authCtx';
import type { User } from '@/types';
import {
  authApi,
  profileApi,
  ensureFreshSession,
  AUTH_REFRESHED_EVENT,
  AUTH_LOGGED_OUT_EVENT,
  shouldSkipInitialSessionProbe,
  shouldRedirectOnAuthFailure,
} from '@/services/api';
import { redirectOnSessionExpired, markSessionExpired } from '@/lib/onboardingSession';
import { tokenStore } from '@/lib/tokenStore';
import { clearOnboardingVerification } from '@/lib/onboardingVerification';
import { clearPendingSignup, type SignupConsents } from '@/lib/pendingSignup';
import {
  clearPendingGoogleConsents,
  resolveGoogleSignInConsents,
} from '@/lib/pendingGoogleConsents';
import { clearPendingGoogleLink } from '@/lib/pendingGoogleLink';
import { syncLocalAnalyticsConsentToBackend } from '@/lib/cookieConsent';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';
import { SUBSCRIPTION_QUERY_KEY } from '@/lib/subscriptionUtils';
import { payloadAffectsPipelineMatch } from '@/lib/profileMerge';
import { invalidatePipelineAfterProfileChange, resetPipelineSkillsSync } from '@/hooks/queries/useJobs';
import type { Profile } from '@/types';

export type {
  OnboardingWorkEntry,
  OnboardingEducationEntry,
  UpdateProfilePayload,
} from '@/context/authCtx';

const usernameFromEmail = (email: string): string => {
  const local = email.split('@')[0] ?? '';
  return local.toLowerCase().replace(/[^a-z0-9._-]/g, '') || 'user';
};

const isUsernameTakenError = (err: unknown): boolean => {
  if (!err || typeof err !== 'object') return false;
  const maybe = err as {
    response?: { status?: number; data?: { error?: string } };
    normalizedMessage?: string;
  };
  if (maybe.response?.status === 409) return true;
  const msg = (maybe.normalizedMessage ?? maybe.response?.data?.error ?? '').toLowerCase();
  return msg.includes('username');
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const setUser = useCallback((u: User | null) => {
    setUserState(u);
    if (!u) tokenStore.clear();
  }, []);

  const inFlightMe = useRef<Promise<User | null> | null>(null);

  const refresh = useCallback(async (): Promise<User | null> => {
    if (inFlightMe.current) return inFlightMe.current;

    const promise = (async (): Promise<User | null> => {
      if (shouldSkipInitialSessionProbe()) {
        setUser(null);
        return null;
      }

      try {
        await ensureFreshSession();
      } catch {
        const hadSession = tokenStore.hasRefreshOrCookie() || tokenStore.hasAccess();
        tokenStore.clear();
        setUser(null);
        queryClient.removeQueries({ queryKey: SUBSCRIPTION_QUERY_KEY });
        if (hadSession && typeof window !== 'undefined') {
          const path = window.location.pathname;
          if (shouldRedirectOnAuthFailure(path, false)) {
            markSessionExpired();
            redirectOnSessionExpired(path);
          }
        }
        return null;
      }

      if (!tokenStore.hasAccess() && !tokenStore.hasRefreshOrCookie()) {
        setUser(null);
        return null;
      }

      try {
        const fresh = await authApi.me();
        setUser(fresh);
        if (fresh) void syncLocalAnalyticsConsentToBackend();
        return fresh;
      } catch {
        tokenStore.clear();
        setUser(null);
        queryClient.removeQueries({ queryKey: SUBSCRIPTION_QUERY_KEY });
        if (typeof window !== 'undefined') {
          const path = window.location.pathname;
          if (shouldRedirectOnAuthFailure(path, false)) {
            markSessionExpired();
            redirectOnSessionExpired(path);
          }
        }
        return null;
      }
    })().finally(() => { inFlightMe.current = null; });

    inFlightMe.current = promise;
    return promise;
  }, [setUser]);

  useEffect(() => {
    refresh().finally(() => setSessionLoading(false));
  }, [refresh]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onRefreshed = () => {
      if (inFlightMe.current) return;
      void refresh();
    };
    const onLoggedOut = () => {
      setUser(null);
      queryClient.removeQueries({ queryKey: SUBSCRIPTION_QUERY_KEY });
    };

    window.addEventListener(AUTH_REFRESHED_EVENT, onRefreshed);
    window.addEventListener(AUTH_LOGGED_OUT_EVENT, onLoggedOut);
    return () => {
      window.removeEventListener(AUTH_REFRESHED_EVENT, onRefreshed);
      window.removeEventListener(AUTH_LOGGED_OUT_EVENT, onLoggedOut);
    };
  }, [refresh, setUser]);

  const signIn = useCallback(async (
    email: string,
    password: string,
    options?: { rememberMe?: boolean; captchaToken?: string },
  ): Promise<User> => {
    setActionLoading(true);
    try {
      const loginBody: Parameters<typeof authApi.login>[0] = {
        email: email.trim(),
        password,
      };
      if (options?.rememberMe) loginBody.rememberMe = true;
      if (options?.captchaToken) loginBody.captchaToken = options.captchaToken;
      const data = await authApi.login(loginBody);
      if (data.requiresTwoFactor) {
        const err = new Error('TWO_FACTOR_REQUIRED') as Error & { challengeToken: string };
        err.challengeToken = data.challengeToken;
        throw err;
      }
      clearPendingSignup();
      clearOnboardingVerification();
      setUser(data.user);
      void syncLocalAnalyticsConsentToBackend();
      return data.user;
    } finally {
      setActionLoading(false);
    }
  }, [setUser]);

  const signUp = useCallback(async (input: SignUpInput): Promise<User> => {
    setActionLoading(true);
    try {
      const baseUsername = usernameFromEmail(input.email);
      const attempts: string[] = [baseUsername];
      const usedSuffixes = new Set<number>();
      while (attempts.length < 5) {
        const suffix = Math.floor(Math.random() * 9000 + 1000);
        if (usedSuffixes.has(suffix)) continue;
        usedSuffixes.add(suffix);
        attempts.push(`${baseUsername}${suffix}`);
      }

      let lastError: unknown;
      for (const username of attempts) {
        try {
          const data = await authApi.signup({
            name: input.name,
            email: input.email,
            signupIntentId: input.signupIntentId,
            username,
            consents: input.consents,
            ...(input.emailVerificationId ? { emailVerificationId: input.emailVerificationId } : {}),
          });
          setUser(data.user);
          void syncLocalAnalyticsConsentToBackend();
          return data.user;
        } catch (err) {
          lastError = err;
          if (!isUsernameTakenError(err)) throw err;
        }
      }
      throw lastError instanceof Error
        ? new Error(
            'Could not create your account. Please try again or contact support.',
            { cause: lastError },
          )
        : new Error('Could not create your account. Please try again or contact support.');
    } finally {
      setActionLoading(false);
    }
  }, [setUser]);

  const completeTwoFactor = useCallback(async (
    challengeToken: string,
    code: string,
    rememberMe?: boolean,
  ): Promise<User> => {
    setActionLoading(true);
    try {
      const data = await authApi.verifyTwoFactor(challengeToken, code, rememberMe);
      clearPendingSignup();
      clearOnboardingVerification();
      setUser(data.user);
      void syncLocalAnalyticsConsentToBackend();
      return data.user;
    } finally {
      setActionLoading(false);
    }
  }, [setUser]);

  const signInWithGoogle = useCallback(async (
    idToken: string,
    rememberMe?: boolean,
    consents?: SignupConsents,
    captchaToken?: string,
  ): Promise<User> => {
    setActionLoading(true);
    try {
      const resolvedConsents = resolveGoogleSignInConsents(consents);
      const data = await authApi.google(idToken, rememberMe, resolvedConsents, captchaToken);
      clearPendingGoogleConsents();
      clearPendingSignup();
      clearOnboardingVerification();
      setUser(data.user);
      void syncLocalAnalyticsConsentToBackend();
      return data.user;
    } finally {
      setActionLoading(false);
    }
  }, [setUser]);

  const signOut = useCallback(async (): Promise<void> => {
    setActionLoading(true);
    try { await authApi.logout(); }
    finally {
      setUser(null);
      clearPendingSignup();
      clearPendingGoogleConsents();
      clearPendingGoogleLink();
      clearOnboardingVerification();
      try {
        queryClient.clear();
        resetPipelineSkillsSync();
      } catch {
        // Cache clear best-effort — user already signed out above
      }
      setActionLoading(false);
    }
  }, [setUser]);

  const updateProfile = useCallback(async (data: UpdateProfilePayload): Promise<Profile> => {
    const cached = queryClient.getQueryData<Profile>(queryKeys.profile.current());
    const serverProfile = await profileApi.update(data, cached?.version);
    queryClient.setQueryData(queryKeys.profile.current(), serverProfile);
    if (payloadAffectsPipelineMatch(data)) {
      invalidatePipelineAfterProfileChange();
    }
    if (data.onboarded === true || data.name?.trim()) {
      setUserState(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          ...(data.onboarded === true ? { onboarded: true } : {}),
          ...(data.name?.trim() ? { name: data.name.trim() } : {}),
        };
      });
    }
    return serverProfile;
  }, []);

  const forgotPassword = useCallback(async (email: string): Promise<void> => {
    await authApi.forgotPassword(email);
  }, []);

  const resetPassword = useCallback(
    async (email: string, otp: string, newPassword: string): Promise<void> => {
      const accessToken = tokenStore.getAccess();
      await authApi.resetPassword({
        email,
        otp,
        newPassword,
        ...(accessToken ? { accessToken } : {}),
      });
    },
    [],
  );

  return (
    <AuthCtx.Provider value={{
      user,
      isAdmin: user?.role === 'ADMIN',
      loading: sessionLoading,
      actionLoading,
      setUser,
      refresh,
      signOut, signIn, completeTwoFactor, signInWithGoogle, signUp, updateProfile,
      forgotPassword, resetPassword,
    }}>
      {children}
    </AuthCtx.Provider>
  );
}

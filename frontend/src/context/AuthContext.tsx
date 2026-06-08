/**
 * AuthContext.tsx — single source of truth for authentication state.
 */
import {
  createContext, useContext, useState, useEffect,
  useCallback, useRef, type ReactNode,
} from 'react';
import type { User } from '@/types';
import {
  authApi,
  profileApi,
  ensureFreshSession,
  AUTH_REFRESHED_EVENT,
  AUTH_LOGGED_OUT_EVENT,
  shouldSkipInitialSessionProbe,
} from '@/services/api';
import { tokenStore } from '@/lib/tokenStore';
import { clearOnboardingVerification } from '@/lib/onboardingVerification';
import { clearPendingSignup, type SignupConsents } from '@/lib/pendingSignup';
import {
  clearPendingGoogleConsents,
  readPendingGoogleConsents,
} from '@/lib/pendingGoogleConsents';
import { syncLocalAnalyticsConsentToBackend } from '@/lib/cookieConsent';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';
import { payloadAffectsPipelineMatch } from '@/lib/profileMerge';
import { invalidatePipelineAfterProfileChange, resetPipelineSkillsSync } from '@/hooks/queries/useJobs';
import type { Profile } from '@/types';
export interface OnboardingWorkEntry {
  jobTitle: string;
  companyName: string;
  startDate: string;
  endDate: string;
  current: boolean;
  description: string;
  location?: string;
}

export interface OnboardingEducationEntry {
  schoolName: string;
  degree: string;
  degreeLevel?: string;
  degreeTitle?: string;
  fieldOfStudy: string;
  graduationYear: string;
  location?: string;
}

export interface UpdateProfilePayload {
  name?: string;
  goalTitle?: string;
  targetRoles?: string[];
  techStack?: string[];
  sectors?: string[];
  location?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  availability?: string;
  experienceLevel?: string;
  sponsorshipRequired?: boolean;
  openToRemote?: boolean;
  remotePolicy?: string;
  hybridOnsiteDays?: string;
  workExperience?: OnboardingWorkEntry[];
  education?: OnboardingEducationEntry[];
  onboarded?: boolean;
  workTypes?: string[];
  goalLocation?: string;
  minMatchPercent?: number;
  freshnessHours?: number;
  jobDomain?: string;
  linkedInUrl?: string;
  githubUrl?: string;
  websiteUrl?: string;
}

interface SignUpInput {
  name: string;
  email: string;
  signupIntentId: string;
  consents: {
    termsAccepted: boolean;
    aiProcessingAccepted: boolean;
    marketingAccepted: boolean;
    analyticsAccepted: boolean;
  };
  emailVerificationId?: string;
}

interface AuthCtxValue {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  actionLoading: boolean;
  setUser: (u: User | null) => void;
  refresh: () => Promise<User | null>;
  signOut: () => Promise<void>;
  signIn: (
    email: string,
    password: string,
    options?: { rememberMe?: boolean; captchaToken?: string },
  ) => Promise<User>;
  signInWithGoogle: (
    idToken: string,
    rememberMe?: boolean,
    consents?: SignupConsents,
    captchaToken?: string,
  ) => Promise<User>;
  signUp: (input: SignUpInput) => Promise<User>;
  updateProfile: (data: UpdateProfilePayload) => Promise<Profile>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (email: string, otp: string, newPassword: string) => Promise<void>;
}

const AuthCtx = createContext<AuthCtxValue | null>(null);

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
  const userRef = useRef<User | null>(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

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
        if (!tokenStore.hasAccess() && !tokenStore.hasRefreshOrCookie()) {
          setUser(null);
          return null;
        }
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

    const onRefreshed = () => { void refresh(); };
    const onLoggedOut = () => { setUser(null); };

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

  const signInWithGoogle = useCallback(async (
    idToken: string,
    rememberMe?: boolean,
    consents?: SignupConsents,
    captchaToken?: string,
  ): Promise<User> => {
    setActionLoading(true);
    try {
      const resolvedConsents = consents ?? readPendingGoogleConsents() ?? undefined;
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
    const serverProfile = await profileApi.update(data);
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
      signOut, signIn, signInWithGoogle, signUp, updateProfile,
      forgotPassword, resetPassword,
    }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth(): AuthCtxValue {
  const v = useContext(AuthCtx);
  if (!v) throw new Error('useAuth must be inside <AuthProvider>');
  return v;
}

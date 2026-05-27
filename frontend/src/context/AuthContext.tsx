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
  AUTH_REFRESHED_EVENT,
  AUTH_LOGGED_OUT_EVENT,
} from '@/services/api';
import { tokenStore } from '@/lib/tokenStore';
export interface OnboardingWorkEntry {
  jobTitle: string;
  companyName: string;
  startDate: string;
  endDate: string;
  current: boolean;
  description: string;
}

export interface OnboardingEducationEntry {
  schoolName: string;
  degree: string;
  fieldOfStudy: string;
  graduationYear: string;
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
  goalSalaryMin?: number;
  goalSalaryMax?: number;
  goalLocation?: string;
  minMatchPercent?: number;
}

interface SignUpInput {
  name: string;
  email: string;
  password: string;
}

interface AuthCtxValue {
  user: User | null;
  loading: boolean;
  actionLoading: boolean;
  setUser: (u: User | null) => void;
  refresh: () => Promise<User | null>;
  signOut: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<User>;
  signInWithGoogle: (idToken: string) => Promise<User>;
  signUp: (input: SignUpInput) => Promise<User>;
  updateProfile: (data: UpdateProfilePayload) => Promise<void>;
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

  const refresh = useCallback(async (): Promise<User | null> => {
    if (inFlightMe.current) return inFlightMe.current;

    const promise = authApi.me()
      .then(fresh => {
        setUser(fresh);
        return fresh;
      })
      .catch(() => {
        setUser(null);
        return null;
      })
      .finally(() => { inFlightMe.current = null; });

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

  const signIn = useCallback(async (email: string, password: string): Promise<User> => {
    setActionLoading(true);
    try {
      const data = await authApi.login({ email, password });
      setUser(data.user);
      return data.user;
    } finally {
      setActionLoading(false);
    }
  }, [setUser]);

  const signUp = useCallback(async (input: SignUpInput): Promise<User> => {
    setActionLoading(true);
    try {
      const baseUsername = usernameFromEmail(input.email);
      const attempts = [
        baseUsername,
        `${baseUsername}${Math.floor(Math.random() * 9000 + 1000)}`,
      ];

      let lastError: unknown;
      for (const username of attempts) {
        try {
          const data = await authApi.signup({
            name: input.name,
            email: input.email,
            password: input.password,
            username,
          });
          setUser(data.user);
          return data.user;
        } catch (err) {
          lastError = err;
          if (!isUsernameTakenError(err)) throw err;
        }
      }
      throw lastError;
    } finally {
      setActionLoading(false);
    }
  }, [setUser]);

  const signInWithGoogle = useCallback(async (idToken: string): Promise<User> => {
    setActionLoading(true);
    try {
      const data = await authApi.google(idToken);
      setUser(data.user);
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
      setActionLoading(false);
      const { queryClient } = await import('@/lib/queryClient');
      queryClient.clear(); // dynamic import avoids circular deps with api layer
    }
  }, [setUser]);

  const updateProfile = useCallback(async (data: UpdateProfilePayload): Promise<void> => {
    await profileApi.update(data);
    if (data.onboarded === true) {
      setUserState(prev =>
        prev
          ? {
              ...prev,
              onboarded: true,
              ...(data.name ? { name: data.name } : {}),
            }
          : prev,
      );
      return;
    }
    await refresh();
  }, [refresh]);

  const forgotPassword = useCallback(async (email: string): Promise<void> => {
    await authApi.forgotPassword(email);
  }, []);

  const resetPassword = useCallback(
    async (email: string, otp: string, newPassword: string): Promise<void> => {
      await authApi.resetPassword({ email, otp, newPassword });
    },
    [],
  );

  return (
    <AuthCtx.Provider value={{
      user,
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

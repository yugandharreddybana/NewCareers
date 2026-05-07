/**
 * AuthContext.tsx — single source of truth for authentication state.
 *
 * Pass 6 fixes folded in:
 *   #6.001 / #6.007 — `signUp` accepts a typed object `{ name, email, password }`,
 *                    eliminating positional-argument bugs. Username derivation
 *                    handles backend collision (409) by appending a numeric
 *                    suffix and retrying once.
 *   #6.004 / #6.037 — DEV_BYPASS / USE_MOCKS read from `lib/env.ts` (single
 *                    source of truth shared with ProtectedRoute and api.ts).
 *   #6.005          — User now exposes `role`; AdminRoute can branch on it.
 *   #6.006          — `useEffect` dep array is honest; no eslint-disable.
 *   #6.008          — `updateProfile` re-fetches user via `/auth/me` (not
 *                    `/profile`) so the User shape is correct.
 *   #6.009 / #6.046 — User is held in memory only. No more `localStorage('co_user')`.
 *                    On hard reload, `/auth/me` re-hydrates from the cookie/refresh.
 *   #6.027          — Listens for `AUTH_REFRESHED_EVENT` so a silent refresh
 *                    triggers a /me re-fetch (refresh may have changed onboarded/role).
 *   #6.045          — Backend now exposes `/auth/me` (added in this pass).
 */
import {
  createContext, useContext, useState, useEffect,
  useCallback, useRef, type ReactNode,
} from 'react';
import * as mocks from '@/services/mockApi';
import type { User } from '@/types';
import {
  authApi,
  profileApi,
  AUTH_REFRESHED_EVENT,
  AUTH_LOGGED_OUT_EVENT,
} from '@/services/api';
import { tokenStore } from '@/lib/tokenStore';
import { DEV_BYPASS, USE_MOCKS } from '@/lib/env';

interface UpdateProfilePayload {
  location?: string;
  targetRole?: string;
  skills?: string[];
  experienceLevel?: string;
  desiredSalaryMin?: number;
  onboardingCompleted?: boolean;
  [key: string]: unknown;
}

interface SignUpInput {
  name: string;
  email: string;
  password: string;
}

interface AuthCtxValue {
  user: User | null;
  /** True only during the initial `/auth/me` check on mount. */
  loading: boolean;
  /** True only while a login/logout/signup action is in-flight. */
  actionLoading: boolean;
  setUser: (u: User | null) => void;
  /** Refresh the user from the server. Returns the latest user or null. */
  refresh: () => Promise<User | null>;
  signOut: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<User>;
  signUp: (input: SignUpInput) => Promise<User>;
  updateProfile: (data: UpdateProfilePayload) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (token: string, newPassword: string) => Promise<void>;
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
  // Memory-only user state. Pass 6 #6.009.
  const [user, setUserState] = useState<User | null>(() => {
    if (DEV_BYPASS || USE_MOCKS) return mocks.MOCK_USER;
    return null;
  });

  const [sessionLoading, setSessionLoading] = useState<boolean>(
    !(DEV_BYPASS || USE_MOCKS),
  );
  const [actionLoading, setActionLoading] = useState(false);

  // Stable setter — useCallback with empty deps is fine because state setters are stable.
  const setUser = useCallback((u: User | null) => {
    setUserState(u);
    if (!u) tokenStore.clear();
  }, []);

  // Single in-flight /me promise. Prevents StrictMode double-effect calling
  // /auth/me twice in development. Pass 6 #6.018.
  const inFlightMe = useRef<Promise<User | null> | null>(null);

  const refresh = useCallback(async (): Promise<User | null> => {
    if (DEV_BYPASS || USE_MOCKS) {
      setUser(mocks.MOCK_USER);
      return mocks.MOCK_USER;
    }
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

  // Initial session check on mount.
  useEffect(() => {
    if (DEV_BYPASS || USE_MOCKS) {
      setSessionLoading(false);
      return;
    }
    refresh().finally(() => setSessionLoading(false));
  }, [refresh]);

  // Pass 6 #6.027 — react to silent-refresh events from the axios interceptor.
  useEffect(() => {
    if (DEV_BYPASS || USE_MOCKS) return;
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
    if (DEV_BYPASS) { setUser(mocks.MOCK_USER); return mocks.MOCK_USER; }
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
    if (DEV_BYPASS) { setUser(mocks.MOCK_USER); return mocks.MOCK_USER; }
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

  const signOut = useCallback(async (): Promise<void> => {
    if (DEV_BYPASS) { setUser(null); return; }
    setActionLoading(true);
    try { await authApi.logout(); }
    finally {
      setUser(null);
      setActionLoading(false);
    }
  }, [setUser]);

  const updateProfile = useCallback(async (data: UpdateProfilePayload): Promise<void> => {
    await profileApi.update(data);
    // Pass 6 #6.008 — refresh user via /auth/me (not /profile) so the shape
    // and `onboarded` flag are authoritative from the server.
    const fresh = await refresh();
    if (!fresh && data.onboardingCompleted && user) {
      // Defensive fallback: if /me failed, at least flip onboarded locally so
      // the ProtectedRoute does not loop the user back to /onboarding.
      setUser({ ...user, onboarded: true });
    }
  }, [refresh, setUser, user]);

  const forgotPassword = useCallback(async (email: string): Promise<void> => {
    await authApi.forgotPassword(email);
  }, []);

  const resetPassword = useCallback(async (token: string, newPassword: string): Promise<void> => {
    await authApi.resetPassword({ token, password: newPassword });
  }, []);

  return (
    <AuthCtx.Provider value={{
      user,
      loading: sessionLoading,
      actionLoading,
      setUser,
      refresh,
      signOut, signIn, signUp, updateProfile,
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

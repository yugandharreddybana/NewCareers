/**
 * AuthContext — single source of truth for auth state.
 *
 * B2 fix: loading now starts as `true` and is set to `false` only after the
 *   session check on mount completes. This prevents ProtectedRoute from
 *   briefly rendering its children before we know if the user is authenticated
 *   (flash of protected content / layout shift).
 *
 *   On DEV_BYPASS / USE_MOCKS the session check is skipped and loading is
 *   immediately false (no network call needed).
 *
 * A2 fix (carried over from Batch 1): DEV_BYPASS requires MODE !== production.
 * B3 fix (carried over from Batch 1): resetPassword arg order corrected.
 */
import {
  createContext, useContext, useState, useEffect,
  useCallback, ReactNode,
} from 'react';
import * as mocks from '@/services/mockApi';
import { User } from '@/types';
import { authApi, profileApi } from '@/services/api';
import { tokenStore } from '@/lib/tokenStore';

interface UpdateProfilePayload {
  location?: string;
  targetRole?: string;
  skills?: string[];
  experienceLevel?: string;
  desiredSalaryMin?: number;
  onboardingCompleted?: boolean;
  [key: string]: unknown;
}

interface Ctx {
  user: User | null;
  /** True while the initial session check is in-flight — gates ProtectedRoute */
  loading: boolean;
  setUser: (u: User | null) => void;
  signOut: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<User>;
  signUp: (name: string, email: string, password: string) => Promise<User>;
  updateProfile: (data: UpdateProfilePayload) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (token: string, newPassword: string) => Promise<void>;
}

const AuthCtx = createContext<Ctx | null>(null);

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';
const DEV_BYPASS =
  import.meta.env.MODE !== 'production' &&
  import.meta.env.VITE_DEV_BYPASS_GUARDS === 'true';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(() => {
    if (DEV_BYPASS || USE_MOCKS) return mocks.MOCK_USER;
    try { return JSON.parse(localStorage.getItem('co_user') || 'null'); } catch { return null; }
  });

  /**
   * B2 fix: start loading=true so ProtectedRoute waits for the session
   * check before deciding whether to render or redirect.
   * Skip directly to false for mock/bypass modes — no network needed.
   */
  const [loading, setLoading] = useState<boolean>(
    DEV_BYPASS || USE_MOCKS ? false : true,
  );

  // Persist user to localStorage whenever it changes
  const setUser = useCallback((u: User | null) => {
    setUserState(u);
    if (u) localStorage.setItem('co_user', JSON.stringify(u));
    else {
      localStorage.removeItem('co_user');
      tokenStore.clear();
    }
  }, []);

  /**
   * B2 fix: on mount, verify the session cookie is still valid.
   * If /auth/me returns 401 the interceptor in api.ts will attempt a
   * silent refresh; if that also fails the user is cleared and
   * ProtectedRoute redirects to /login.
   */
  useEffect(() => {
    if (DEV_BYPASS || USE_MOCKS) return;

    authApi.me()
      .then(() => { /* session still valid — user already hydrated from localStorage */ })
      .catch(() => setUser(null)) // clear stale user if session is invalid
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const signIn = async (email: string, password: string): Promise<User> => {
    if (DEV_BYPASS) { setUser(mocks.MOCK_USER); return mocks.MOCK_USER; }
    setLoading(true);
    try {
      const data = await authApi.login({ email, password });
      setUser(data.user);
      return data.user;
    } finally { setLoading(false); }
  };

  const signUp = async (name: string, email: string, password: string): Promise<User> => {
    if (DEV_BYPASS) { setUser(mocks.MOCK_USER); return mocks.MOCK_USER; }
    setLoading(true);
    try {
      const username = email.split('@')[0].toLowerCase().replace(/[^a-z0-9._-]/g, '');
      const data = await authApi.signup({ name, username, email, password });
      setUser(data.user);
      return data.user;
    } finally { setLoading(false); }
  };

  const signOut = async () => {
    if (DEV_BYPASS) { setUser(null); return; }
    setLoading(true);
    try { await authApi.logout(); }
    finally { setUser(null); setLoading(false); }
  };

  const updateProfile = async (data: UpdateProfilePayload) => {
    await profileApi.update(data);
    if (data.onboardingCompleted && user) setUser({ ...user, onboarded: true });
  };

  const forgotPassword = async (email: string) => { await authApi.forgotPassword(email); };

  // B3 fix: args are (token, newPassword) — matches Ctx interface + authApi contract
  const resetPassword = async (token: string, newPassword: string) => {
    await authApi.resetPassword({ token, password: newPassword });
  };

  return (
    <AuthCtx.Provider value={{
      user, loading, setUser,
      signOut, signIn, signUp, updateProfile,
      forgotPassword, resetPassword,
    }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const v = useContext(AuthCtx);
  if (!v) throw new Error('useAuth must be inside AuthProvider');
  return v;
}

/**
 * AuthContext — single source of truth for auth state.
 *
 * B2 fix: loading now starts as `true` and is set to `false` only after the
 *   session check on mount completes.
 *
 * A2 fix: DEV_BYPASS requires MODE !== production.
 * B3 fix: resetPassword arg order corrected.
 *
 * G5 fix (Batch 7a): updateProfile now re-fetches the full user object from
 *   the server after a successful update so that all fields (not just
 *   onboardingCompleted) are kept in sync with the backend.
 *
 * G8 fix (Batch 7a): split `loading` into two separate flags:
 *   - sessionLoading: true only during the initial /auth/me check on mount.
 *     ProtectedRoute uses this flag to decide whether to render or redirect.
 *   - actionLoading: true only while a login/logout/signup action is in-flight.
 *     UI spinners on forms should use this flag instead.
 *   Previously both shared one `loading` state, causing ProtectedRoute to
 *   flash the PageLoader every time a user submitted the login form.
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
  /** True while a login/logout/signup action is in-flight — use for form spinners */
  actionLoading: boolean;
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

  // G8 fix: sessionLoading gates ProtectedRoute; actionLoading gates form spinners.
  const [sessionLoading, setSessionLoading] = useState<boolean>(
    DEV_BYPASS || USE_MOCKS ? false : true,
  );
  const [actionLoading, setActionLoading] = useState(false);

  // Persist user to localStorage whenever it changes
  const setUser = useCallback((u: User | null) => {
    setUserState(u);
    if (u) localStorage.setItem('co_user', JSON.stringify(u));
    else {
      localStorage.removeItem('co_user');
      tokenStore.clear();
    }
  }, []);

  // B2 fix: verify session on mount
  useEffect(() => {
    if (DEV_BYPASS || USE_MOCKS) return;

    authApi.me()
      .then(() => { /* session still valid */ })
      .catch(() => setUser(null))
      .finally(() => setSessionLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const signIn = async (email: string, password: string): Promise<User> => {
    if (DEV_BYPASS) { setUser(mocks.MOCK_USER); return mocks.MOCK_USER; }
    setActionLoading(true);
    try {
      const data = await authApi.login({ email, password });
      setUser(data.user);
      return data.user;
    } finally { setActionLoading(false); }
  };

  const signUp = async (name: string, email: string, password: string): Promise<User> => {
    if (DEV_BYPASS) { setUser(mocks.MOCK_USER); return mocks.MOCK_USER; }
    setActionLoading(true);
    try {
      const username = email.split('@')[0].toLowerCase().replace(/[^a-z0-9._-]/g, '');
      const data = await authApi.signup({ name, username, email, password });
      setUser(data.user);
      return data.user;
    } finally { setActionLoading(false); }
  };

  const signOut = async () => {
    if (DEV_BYPASS) { setUser(null); return; }
    setActionLoading(true);
    try { await authApi.logout(); }
    finally { setUser(null); setActionLoading(false); }
  };

  // G5 fix: after updating the profile on the server, re-fetch the full user
  // object so all fields stay in sync — not just onboardingCompleted.
  const updateProfile = async (data: UpdateProfilePayload) => {
    await profileApi.update(data);
    try {
      const freshUser = await profileApi.get();
      setUser(freshUser);
    } catch {
      // Fallback: if the re-fetch fails, at least patch onboardingCompleted
      // so ProtectedRoute doesn't redirect back to /onboarding.
      if (data.onboardingCompleted && user) setUser({ ...user, onboarded: true });
    }
  };

  const forgotPassword = async (email: string) => { await authApi.forgotPassword(email); };

  // B3 fix: args are (token, newPassword)
  const resetPassword = async (token: string, newPassword: string) => {
    await authApi.resetPassword({ token, password: newPassword });
  };

  return (
    <AuthCtx.Provider value={{
      user,
      loading: sessionLoading,   // ProtectedRoute still reads `loading` — no breaking change
      actionLoading,
      setUser,
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

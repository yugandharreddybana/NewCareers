/**
 * AuthContext — single source of truth for auth state.
 *
 * Provides: user, loading, signIn, signUp, signOut, updateProfile,
 *           forgotPassword, resetPassword
 *
 * DEV_BYPASS: only active when VITE_DEV_BYPASS_GUARDS=true is explicitly set.
 */
import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
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
  loading: boolean;
  setUser: (u: User | null) => void;
  signOut: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<User>;
  signUp: (name: string, email: string, password: string) => Promise<User>;
  updateProfile: (data: UpdateProfilePayload) => Promise<void>;
  /** Send a password-reset email. Resolves when the request is accepted. */
  forgotPassword: (email: string) => Promise<void>;
  /** Complete a password reset using the token from the email link. */
  resetPassword: (newPassword: string, token: string) => Promise<void>;
}

const AuthCtx = createContext<Ctx | null>(null);

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';
// Only bypass when EXPLICITLY set — never auto-activate on DEV or MODE.
const DEV_BYPASS = import.meta.env.VITE_DEV_BYPASS_GUARDS === 'true';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    if (DEV_BYPASS) return mocks.MOCK_USER;
    if (USE_MOCKS) return mocks.MOCK_USER;
    try { return JSON.parse(localStorage.getItem('co_user') || 'null'); } catch { return null; }
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (DEV_BYPASS) return;
    if (user) localStorage.setItem('co_user', JSON.stringify(user));
    else {
      localStorage.removeItem('co_user');
      tokenStore.clear();
    }
  }, [user]);

  const signIn = async (email: string, password: string): Promise<User> => {
    if (DEV_BYPASS) { setUser(mocks.MOCK_USER); return mocks.MOCK_USER; }
    setLoading(true);
    try {
      const data = await authApi.login({ email, password });
      const u: User = data.user;
      setUser(u);
      return u;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (name: string, email: string, password: string): Promise<User> => {
    if (DEV_BYPASS) { setUser(mocks.MOCK_USER); return mocks.MOCK_USER; }
    setLoading(true);
    try {
      const username = email.split('@')[0].toLowerCase().replace(/[^a-z0-9._-]/g, '');
      const data = await authApi.signup({ name, username, email, password });
      const u: User = data.user;
      setUser(u);
      return u;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    if (DEV_BYPASS) { setUser(null); return; }
    setLoading(true);
    try {
      await authApi.logout();
    } finally {
      setUser(null);
      setLoading(false);
    }
  };

  const updateProfile = async (data: UpdateProfilePayload) => {
    await profileApi.update(data);
    if (data.onboardingCompleted && user) {
      setUser({ ...user, onboarded: true });
    }
  };

  const forgotPassword = async (email: string): Promise<void> => {
    await authApi.forgotPassword(email);
  };

  const resetPassword = async (newPassword: string, token: string): Promise<void> => {
    await authApi.resetPassword(newPassword, token);
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

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from '@/types';
import { authApi, profileApi } from '@/services/api';

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
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  updateProfile: (data: UpdateProfilePayload) => Promise<void>;
}

const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try { return JSON.parse(localStorage.getItem('co_user') || 'null'); } catch { return null; }
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) localStorage.setItem('co_user', JSON.stringify(user));
    else localStorage.removeItem('co_user');
  }, [user]);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      const { user: u } = await authApi.login({ email, password });
      setUser(u);
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (name: string, email: string, password: string) => {
    setLoading(true);
    try {
      const { user: u } = await authApi.signup({ name, email, password });
      setUser(u);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    try { await authApi.logout(); } finally {
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

  return (
    <AuthCtx.Provider value={{ user, loading, setUser, signOut, signIn, signUp, updateProfile }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const v = useContext(AuthCtx);
  if (!v) throw new Error('useAuth must be inside AuthProvider');
  return v;
}

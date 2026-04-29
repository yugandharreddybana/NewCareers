import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from '@/types';
import { authApi } from '@/services/api';

interface Ctx {
  user: User | null;
  loading: boolean;
  setUser: (u: User | null) => void;
  signOut: () => Promise<void>;
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

  const signOut = async () => {
    setLoading(true);
    try { await authApi.logout(); } finally {
      setUser(null);
      setLoading(false);
    }
  };

  return <AuthCtx.Provider value={{ user, loading, setUser, signOut }}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const v = useContext(AuthCtx);
  if (!v) throw new Error('useAuth must be inside AuthProvider');
  return v;
}

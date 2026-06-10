/**
 * ExperimentContext — A/B experiment variant loader
 *
 * B1 fix: was importing from '../api/axiosInstance' (a separate Axios instance
 * that has NO interceptors). This meant:
 *   - 401s on experiment fetches were never caught and silently swallowed
 *   - The silent-refresh interceptor in api.ts was bypassed
 *   - No X-CSRF-Token header was attached
 *
 * Now imports { api } from '@/services/api' — the same configured Axios
 * instance used everywhere else, with the full interceptor chain.
 */
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/context/authCtx';
import { experimentsApi } from '@/services/experimentsApi';

type VariantMap = Record<string, string>;

interface ExperimentContextValue {
  variants: VariantMap;
  getVariant: (key: string, fallback?: string) => string;
  loading: boolean;
}

const ExperimentContext = createContext<ExperimentContextValue>({
  variants: {},
  getVariant: (_key, fallback = 'control') => fallback,
  loading: true,
});

export const ExperimentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const [variants, setVariants] = useState<VariantMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setVariants({});
      setLoading(false);
      return;
    }

    setLoading(true);
    experimentsApi
      .getAllVariants()
      .then(data => {
        const map: VariantMap = {};
        data.forEach(v => { map[v.key] = v.variant; });
        setVariants(map);
      })
      .catch(() => {}) // non-fatal — defaults to 'control' for all keys
      .finally(() => setLoading(false));
  }, [user, authLoading]);

  const getVariant = (key: string, fallback = 'control'): string =>
    variants[key] ?? fallback;

  return (
    <ExperimentContext.Provider value={{ variants, getVariant, loading }}>
      {children}
    </ExperimentContext.Provider>
  );
};

export const useExperiment = () => useContext(ExperimentContext);

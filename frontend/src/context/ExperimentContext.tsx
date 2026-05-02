// Section 3.6 Task 76 — AB test context provider
// Loads all experiment variant assignments on app boot from /experiments/variants
// and makes them available via useExperiment() hook throughout the app.
import React, { createContext, useContext, useEffect, useState } from 'react';
import axios from '../api/axiosInstance';

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
  const [variants, setVariants] = useState<VariantMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get<VariantMap>('/experiments/variants')
      .then(r => setVariants(r.data))
      .catch(() => {}) // non-fatal — defaults to control
      .finally(() => setLoading(false));
  }, []);

  const getVariant = (key: string, fallback = 'control'): string =>
    variants[key] ?? fallback;

  return (
    <ExperimentContext.Provider value={{ variants, getVariant, loading }}>
      {children}
    </ExperimentContext.Provider>
  );
};

export const useExperiment = () => useContext(ExperimentContext);

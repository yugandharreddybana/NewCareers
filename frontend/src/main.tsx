/**
 * main.tsx — application entry point.
 *
 * Pass 6 fixes folded in:
 *   #6.028 / #6.031 — wraps the app in a `QueryClientProvider` so pages can
 *                    incrementally migrate to React Query (the dep is already
 *                    installed). Existing `useEffect`/`setState` patterns
 *                    continue to work; new code prefers `useQuery`.
 *   #6.035 / #8.019 / #8.020 — monitoring boot now lazily wires Sentry
 *                    and web-vitals when a DSN is configured for production.
 *                    Telemetry remains opt-in and redacts sensitive fields.
 *
 * NOTE: BrowserRouter lives in App.tsx — do NOT add another one here.
 * AuthProvider is also inside App.tsx, inside the router, so useNavigate works.
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import { MotionConfig } from 'framer-motion';
import { Toaster } from 'react-hot-toast';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { ThemeProvider } from './context/ThemeContext';
import { initializeMonitoring } from './lib/monitoring';
import './styles/index.css';

// React Query defaults tuned for a job-search app:
// - staleTime 30s: most lists are fine to reuse for half a minute.
// - gcTime 5 minutes: keeps a small pre-warm cache after unmount.
// - retry on transient network errors, but NOT on 4xx (the axios interceptor
//   already handles 401 with silent refresh).
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        const status = (error as { response?: { status?: number } } | null)?.response?.status;
        if (typeof status === 'number' && status >= 400 && status < 500) return false;
        return failureCount < 2;
      },
    },
    mutations: {
      retry: false,
    },
  },
});

void initializeMonitoring();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <MotionConfig reducedMotion="user">
          <App />
          <Toaster
            position="top-right"
            toastOptions={{
              // Subtle defaults that match the Tailwind / Slate palette used app-wide.
              style: { borderRadius: '12px', fontSize: '0.875rem' },
            }}
          />
        </MotionConfig>
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);

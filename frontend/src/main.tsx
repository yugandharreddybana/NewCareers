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
import { QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { queryClient } from './lib/queryClient';
import { ThemeProvider } from './context/ThemeContext';
import { hasAnalyticsConsent } from './lib/cookieConsent';
import { initializeMonitoring } from './lib/monitoring';
import './styles/index.css';

if (hasAnalyticsConsent()) {
  void initializeMonitoring();
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <MotionConfig reducedMotion="user">
          <App />
          <Toaster
            position="top-right"
            containerStyle={{ zIndex: 20000 }}
            toastOptions={{
              style: { borderRadius: '12px', fontSize: '0.875rem', zIndex: 20000 },
            }}
          />
        </MotionConfig>
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);

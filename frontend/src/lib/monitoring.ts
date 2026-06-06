import { IS_PROD, SENTRY_DSN } from './env';
import { resolveAnalyticsConsent } from './cookieConsent';
import { setErrorReporter, type ReportableError } from './telemetry';
import type { Metric } from 'web-vitals';

const REDACTED_CONTEXT_KEYS = /(authorization|cookie|email|password|secret|token)/i;

let initialized = false;

function sanitizeContext(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeContext);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      REDACTED_CONTEXT_KEYS.test(key) ? '[REDACTED]' : sanitizeContext(entry),
    ]),
  );
}

function toError(event: ReportableError): Error {
  const error = new Error(event.message);
  error.name = event.source ? `${event.source}-error` : 'app-error';
  if (event.stack) error.stack = event.stack;
  return error;
}

export async function initializeMonitoring(): Promise<void> {
  if (initialized || !IS_PROD || !SENTRY_DSN) return;

  if (!(await resolveAnalyticsConsent())) return;
  initialized = true;

  try {
    const [Sentry, webVitals] = await Promise.all([
      import('@sentry/react'),
      import('web-vitals'),
    ]);

    Sentry.init({
      dsn: SENTRY_DSN,
      environment: import.meta.env.MODE,
      enabled: true,
      sendDefaultPii: false,
      tracesSampleRate: 0,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,
    });

    setErrorReporter((event) => {
      Sentry.withScope((scope) => {
        if (event.source) scope.setTag('source', event.source);
        if (event.componentStack) {
          scope.setContext('react', { componentStack: event.componentStack });
        }
        if (event.context) {
          scope.setContext(
            'app',
            sanitizeContext(event.context) as Record<string, unknown>,
          );
        }
        if (event.stack) scope.setExtra('stack', event.stack);
        Sentry.captureException(toError(event));
      });
    });

    const reportWebVital = (metric: Metric) => {
      Sentry.captureMessage(`web-vital:${metric.name}`, {
        level: 'info',
        tags: {
          metric: metric.name,
          rating: metric.rating,
        },
        extra: {
          id: metric.id,
          value: metric.value,
          delta: metric.delta,
          navigationType: metric.navigationType,
        },
      });
    };

    webVitals.onCLS(reportWebVital);
    webVitals.onINP(reportWebVital);
    webVitals.onLCP(reportWebVital);
  } catch (error) {
    console.error('[monitoring] failed to initialize', error);
  }
}
/**
 * telemetry.ts — single hook used by ErrorBoundary + axios + any future
 * unhandled-error sink to ship error events to a remote aggregator.
 *
 * Pass 6 #6.035 — replaces the previous `(window as any).__last_error`
 * pollution. Defaults to `console.error` when no remote sink is configured;
 * production deployments can mount Sentry / LogRocket / Datadog by calling
 * `setErrorReporter(...)` exactly once at app boot.
 *
 * Why a thin abstraction (vs. importing Sentry directly):
 *   - Keeps the bundle slim until a real reporter is wired up.
 *   - Lets us redact PII in one place before send.
 *   - Avoids vendor lock-in.
 */

export interface ReportableError {
  message: string;
  stack?: string;
  componentStack?: string;
  source?: 'render' | 'axios' | 'window' | 'manual';
  context?: Record<string, unknown>;
}

type Reporter = (err: ReportableError) => void;

const defaultReporter: Reporter = (err) => {
  // eslint-disable-next-line no-console
  console.error('[telemetry]', err.source ?? 'manual', err.message, {
    stack: err.stack,
    componentStack: err.componentStack,
    context: err.context,
  });
};

let reporter: Reporter = defaultReporter;

export function setErrorReporter(custom: Reporter): void {
  reporter = custom;
}

export function reportError(input: Error | ReportableError, context?: Record<string, unknown>): void {
  const event: ReportableError = input instanceof Error
    ? {
        message: input.message,
        source: 'manual',
        ...(input.stack ? { stack: input.stack } : {}),
        ...(context ? { context } : {}),
      }
    : {
        ...input,
        ...((input.context || context)
          ? { context: { ...(input.context ?? {}), ...(context ?? {}) } }
          : {}),
      };
  try { reporter(event); } catch { /* never let telemetry crash the app */ }
}

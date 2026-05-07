/**
 * ErrorBoundary — global React error boundary.
 *
 * Pass 6 fixes folded in:
 *   #6.034          — `RouteFallback` link is now context-aware (avoids the
 *                    Dashboard→Dashboard loop when Dashboard itself crashes).
 *   #6.035          — every caught error is forwarded to `lib/telemetry`.
 *                    Wire a real reporter (Sentry, LogRocket, …) in main.tsx.
 *   #7.001          — production builds NEVER show the raw error message to
 *                    the user; dev builds keep the inline detail.
 *   #7.002          — removed `(window as any).__last_error` global pollution.
 *   #7.003          — "Try again" performs a hard re-render via key bump
 *                    instead of leaving the same children mounted with stale
 *                    state, so a transient render error has a real chance to
 *                    recover instead of immediately re-throwing.
 */
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { reportError } from '@/lib/telemetry';
import { IS_DEV } from '@/lib/env';

interface Props {
  children: ReactNode;
  /** Optional custom fallback UI. */
  fallback?: ReactNode;
  /** Render-prop fallback that receives the error + reset handler. */
  fallbackRender?: (state: { error: Error; reset: () => void }) => ReactNode;
  /** Optional callback for additional error reporting. */
  onError?: (error: Error, info: ErrorInfo) => void;
  /** Optional callback invoked after a user-triggered reset. */
  onReset?: () => void;
  /** Optional component name for telemetry context. */
  label?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  /** Bumped to force a fresh subtree mount on reset. */
  resetKey: number;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, resetKey: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info.componentStack);
    reportError({
      message: error.message,
      source: 'render',
      context: { label: this.props.label ?? null },
      ...(error.stack ? { stack: error.stack } : {}),
      ...(info.componentStack ? { componentStack: info.componentStack } : {}),
    });
    this.props.onError?.(error, info);
  }

  private handleReset = () => {
    // Pass 6 #7.003 — bump key + clear error so children remount cleanly.
    this.setState(
      s => ({ hasError: false, error: null, resetKey: s.resetKey + 1 }),
      () => {
        try {
          this.props.onReset?.();
        } catch (error) {
          reportError({
            message: error instanceof Error ? error.message : 'ErrorBoundary onReset failed',
            source: 'render',
            context: {
              label: this.props.label ?? null,
              phase: 'reset',
            },
            ...(error instanceof Error && error.stack ? { stack: error.stack } : {}),
          });
        }
      },
    );
  };

  override render(): ReactNode {
    if (!this.state.hasError || !this.state.error) {
      // Wrap children in a key so handleReset can remount on demand.
      return <React.Fragment key={this.state.resetKey}>{this.props.children}</React.Fragment>;
    }

    if (this.props.fallbackRender) {
      return this.props.fallbackRender({ error: this.state.error, reset: this.handleReset });
    }
    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-8" role="alert" aria-live="assertive">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="text-5xl mb-4" aria-hidden="true">⚠️</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Something went wrong
          </h1>
          <p className="text-gray-500 text-sm mb-6">
            An unexpected error occurred. You can try again or head back to the dashboard.
          </p>
          {IS_DEV && (
            <pre className="text-left text-xs bg-gray-100 rounded-lg p-3 mb-6 overflow-auto max-h-32 text-red-600">
              {this.state.error.message}
            </pre>
          )}
          <div className="flex gap-3 justify-center">
            <button
              type="button"
              onClick={this.handleReset}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700 transition"
            >
              Try again
            </button>
            <a
              href="/dashboard"
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm hover:bg-gray-50 transition"
            >
              Go to Dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }
}

/**
 * RouteFallback — compact, route-aware fallback used by App.tsx per-route
 * boundaries. Avoids the loop where the Dashboard route fails and links to
 * itself (Pass 6 #6.034).
 */
export function RouteFallback({ label }: { label: string }) {
  const path = typeof window !== 'undefined' ? window.location.pathname : '';
  const safeHref =
    path === '/dashboard' ? '/login' :
    path === '/login'     ? '/'      :
    '/dashboard';
  const safeLabel =
    safeHref === '/login' ? 'Go to Sign in' :
    safeHref === '/'      ? 'Reload home'   :
    'Go to Dashboard';

  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 text-gray-500 px-6 text-center">
      <span className="text-3xl" aria-hidden="true">⚠️</span>
      <p className="text-sm">
        {label} failed to load.{' '}
        <a href={safeHref} className="underline text-indigo-500">{safeLabel}</a>.
      </p>
    </div>
  );
}

export default ErrorBoundary;

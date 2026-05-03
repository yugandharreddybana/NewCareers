/**
 * ErrorBoundary — global React error boundary
 *
 * B4 fix: without this, any unhandled render error anywhere in the tree
 * causes a completely blank white screen with no way to recover.
 *
 * Usage in App.tsx:
 *   <ErrorBoundary>
 *     <BrowserRouter>...</BrowserRouter>
 *   </ErrorBoundary>
 *
 * Or per-section for isolated failures:
 *   <ErrorBoundary fallback={<p>This section failed to load.</p>}>
 *     <ExpensivePage />
 *   </ErrorBoundary>
 */
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Optional custom fallback UI — defaults to a full-page error message */
  fallback?: ReactNode;
  /** Optional callback for error reporting (e.g. Sentry) */
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
    this.props.onError?.(error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-8">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Something went wrong
          </h1>
          <p className="text-gray-500 text-sm mb-6">
            An unexpected error occurred. You can try reloading the page or
            going back to the dashboard.
          </p>
          {this.state.error && (
            <pre className="text-left text-xs bg-gray-100 rounded-lg p-3 mb-6 overflow-auto max-h-32 text-red-600">
              {this.state.error.message}
            </pre>
          )}
          <div className="flex gap-3 justify-center">
            <button
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

export default ErrorBoundary;

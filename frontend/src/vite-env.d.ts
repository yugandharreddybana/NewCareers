/// <reference types="vite/client" />

/**
 * G10 fix (Batch 7c): all VITE_ env vars are now declared so TypeScript
 * catches typos at compile time rather than silently resolving to `undefined`.
 */
interface ImportMetaEnv {
  // Core
  readonly VITE_API_URL: string
  readonly VITE_MIDDLEWARE_URL: string
  readonly VITE_DEV_BYPASS_GUARDS: string

  // Feature flags
  readonly VITE_FEATURE_AGENT_MEMORY: string
  readonly VITE_FEATURE_AUTO_APPLY: string
  readonly VITE_FEATURE_OUTREACH: string
  readonly VITE_FEATURE_WATCHLISTS: string
  readonly VITE_FEATURE_RESUME_VERSIONS: string

  // Analytics / monitoring
  readonly VITE_POSTHOG_KEY: string
  readonly VITE_POSTHOG_HOST: string
  readonly VITE_SENTRY_DSN: string

  // Stripe
  readonly VITE_STRIPE_PUBLIC_KEY: string

  // Google Sign-In
  readonly VITE_GOOGLE_CLIENT_ID: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

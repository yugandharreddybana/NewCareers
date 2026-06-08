/**
 * App.tsx — single BrowserRouter; AuthProvider lives inside so it can use
 * useNavigate.
 *
 * Pass 6 fixes folded in:
 *   #6.002 / #6.010 — `/signup` is canonical; `/register` retained as a
 *                     redirect so old emails / search results still work.
 *   #6.034          — RouteFallback is now context-aware (extracted to
 *                     ErrorBoundary.tsx).
 *   #6.036          — `withPreload(...)` helper exposes `.preload()` on each
 *                     lazy chunk so the AppShell sidebar can pre-warm chunks
 *                     on hover. Routes still lazy-load by default.
 *   #6.038 / #6.044 — `/forgot-password` and `/reset-password` route to
 *                     dedicated pages.
 *   #6.043          — replaced the 25× ErrorBoundary+Suspense duplication with
 *                     a single `<RouteWithBoundary>` wrapper.
 *   #6.045 (server) — backend `/auth/me` now exists; frontend session check
 *                     resolves cleanly on cold load.
 */
import { Suspense, lazy, type ComponentType, type LazyExoticComponent, type ReactNode } from 'react';
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from './context/AuthContext';
import { GOOGLE_CLIENT_ID } from './lib/env';
import { ProtectedRoute, AdminRoute, GuestRoute, OnboardingRoute } from './components/ProtectedRoute';
import { PageLoader } from './components/LoadingSpinner';
import { ApiLoadingOverlay } from './components/ApiLoadingOverlay';
import { ExperimentProvider } from './context/ExperimentContext';
import { ErrorBoundary, RouteFallback } from './components/ErrorBoundary';
import { CookieConsentBanner } from './components/gdpr/CookieConsentBanner';
import { StatusBannerStack } from './components/StatusBannerStack';

// ── lazy() with a `.preload()` method for hover-warming chunks ─────────────
type Importable<T extends ComponentType<any>> = () => Promise<{ default: T }>;
type Preloadable<T extends ComponentType<any>> =
  LazyExoticComponent<T> & { preload: () => Promise<{ default: T }> };

function withPreload<T extends ComponentType<any>>(loader: Importable<T>): Preloadable<T> {
  const Lazy = lazy(loader) as Preloadable<T>;
  Lazy.preload = loader;
  return Lazy;
}

// ── Public pages ───────────────────────────────────────────────────────────
const Home               = withPreload(() => import('./pages/Home'));
const Login              = withPreload(() => import('./pages/Login'));
const NotFound           = withPreload(() => import('./pages/NotFound'));
const Signup             = withPreload(() => import('./pages/Signup'));
const ForgotPasswordPage = withPreload(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage  = withPreload(() => import('./pages/ResetPasswordPage'));
const Onboarding         = withPreload(() => import('./pages/Onboarding'));
const GetStarted         = withPreload(() => import('./pages/GetStarted'));
const PrivacyPolicyPage  = withPreload(() => import('./pages/legal/PrivacyPolicyPage'));
const TermsOfServicePage = withPreload(() => import('./pages/legal/TermsOfServicePage'));
const HelpPage           = withPreload(() => import('./pages/legal/HelpPage'));
const AccessibilityPage  = withPreload(() => import('./pages/legal/AccessibilityPage'));

// ── Protected pages ────────────────────────────────────────────────────────
const Dashboard            = withPreload(() => import('./pages/Dashboard'));
const WelcomeDashboard     = withPreload(() => import('./pages/WelcomeDashboard'));
const PipelineDashboard    = withPreload(() => import('./pages/PipelineDashboard'));
const JobDetail            = withPreload(() => import('./pages/JobDetail'));
const Profile              = withPreload(() => import('./pages/Profile'));
const AccountSettingsLayout   = withPreload(() => import('./pages/account/AccountSettingsLayout'));
const AccountProfilePage      = withPreload(() => import('./pages/account/AccountProfilePage'));
const AccountSecurityPage     = withPreload(() => import('./pages/account/AccountSecurityPage'));
const AccountNotificationsPage = withPreload(() => import('./pages/account/AccountNotificationsPage'));
const AccountBillingPage      = withPreload(() => import('./pages/account/AccountBillingPage'));
const BillingCheckoutSuccessPage = withPreload(() =>
  import('./pages/account/BillingCheckoutResultPage').then(m => ({
    default: () => <m.default variant="success" />,
  })));
const BillingCheckoutCancelPage = withPreload(() =>
  import('./pages/account/BillingCheckoutResultPage').then(m => ({
    default: () => <m.default variant="cancel" />,
  })));
const AccountTeamPage         = withPreload(() => import('./pages/account/AccountTeamPage'));
const InterviewHistoryPage = withPreload(() => import('./pages/InterviewHistoryPage'));
const InterviewPage        = withPreload(() => import('./pages/InterviewPage'));
const NetworkingPage       = withPreload(() => import('./pages/NetworkingPage'));
const WorkspacePage        = withPreload(() => import('./pages/WorkspacePage'));
const ProgressPage         = withPreload(() => import('./pages/ProgressPage'));
const ExperimentDashboard  = withPreload(() => import('./pages/ExperimentDashboardPage'));
const SaasDashboard        = withPreload(() => import('./pages/admin/SaasDashboard'));
const Kanban               = withPreload(() => import('./pages/Kanban'));
const CvManager            = withPreload(() => import('./pages/CvManager'));
const Skills               = withPreload(() => import('./pages/Skills'));
const Analytics            = withPreload(() => import('./pages/Analytics'));
const BillingPage          = withPreload(() => import('./pages/BillingPage'));
const Refer                = withPreload(() => import('./pages/Refer'));
const PlannerPage          = withPreload(() => import('./pages/PlannerPage'));
const WatchlistsPage       = withPreload(() => import('./pages/WatchlistsPage'));
const AutoApplyPage        = withPreload(() => import('./pages/AutoApplyPage'));
const OutreachPage         = withPreload(() => import('./pages/OutreachPage'));
const AgentMemoryPage      = withPreload(() => import('./pages/AgentMemoryPage'));
const ResumeVersionsPage   = withPreload(() => import('./pages/ResumeVersionsPage'));

// ── Pass 6 #6.043 — route boundary helper to remove ~250 lines of duplication.
function RouteWithBoundary(props: { label: string; children: React.ReactNode }) {
  return (
    <ErrorBoundary
      label={props.label}
      fallbackRender={({ error, reset }) => (
        <RouteFallback label={props.label} error={error} onRetry={reset} />
      )}
    >
      <Suspense fallback={<PageLoader />}>{props.children}</Suspense>
    </ErrorBoundary>
  );
}

function OAuthProviders({ children }: { children: ReactNode }) {
  if (!GOOGLE_CLIENT_ID) return <>{children}</>;
  return <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>{children}</GoogleOAuthProvider>;
}

export const App: React.FC = () => (
  <ErrorBoundary>
    <HelmetProvider>
      <OAuthProviders>
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <AuthProvider>
          <ExperimentProvider>
            <ApiLoadingOverlay />
            <StatusBannerStack />
            <CookieConsentBanner />
            {/* Top-level Suspense catches the very first paint. */}
            <Suspense fallback={<PageLoader />}>
              <Routes>

                {/* ── Public routes ───────────────────────────────────────── */}
                <Route path="/"                 element={<RouteWithBoundary label="Home"><Home /></RouteWithBoundary>} />

                <Route element={<GuestRoute />}>
                  <Route path="/login"            element={<RouteWithBoundary label="Login"><Login /></RouteWithBoundary>} />
                  <Route path="/signup"           element={<RouteWithBoundary label="Sign up"><Signup /></RouteWithBoundary>} />
                  <Route path="/forgot-password"  element={<RouteWithBoundary label="Forgot password"><ForgotPasswordPage /></RouteWithBoundary>} />
                  <Route path="/reset-password"   element={<RouteWithBoundary label="Reset password"><ResetPasswordPage /></RouteWithBoundary>} />
                </Route>
                {/* Legacy /register → /signup so old emails still work. */}
                <Route path="/register"         element={<Navigate to="/signup" replace />} />
                <Route path="/get-started"      element={<RouteWithBoundary label="Get started"><GetStarted /></RouteWithBoundary>} />
                <Route path="/privacy"          element={<RouteWithBoundary label="Privacy policy"><PrivacyPolicyPage /></RouteWithBoundary>} />
                <Route path="/terms"            element={<RouteWithBoundary label="Terms of service"><TermsOfServicePage /></RouteWithBoundary>} />
                <Route path="/help"             element={<RouteWithBoundary label="Help"><HelpPage /></RouteWithBoundary>} />
                <Route path="/accessibility"    element={<RouteWithBoundary label="Accessibility"><AccessibilityPage /></RouteWithBoundary>} />
                <Route path="/billing"          element={<RouteWithBoundary label="Pricing"><BillingPage /></RouteWithBoundary>} />
                <Route path="/pricing"          element={<Navigate to="/billing" replace />} />
                <Route path="/legal/privacy"    element={<Navigate to="/privacy" replace />} />
                <Route path="/legal/terms"      element={<Navigate to="/terms" replace />} />
                <Route path="/legal/help"       element={<Navigate to="/help" replace />} />
                <Route path="/legal/accessibility" element={<Navigate to="/accessibility" replace />} />

                {/* Onboarding — account created on finish; guests need deferred signup */}
                <Route element={<OnboardingRoute />}>
                  <Route path="/onboarding"       element={<RouteWithBoundary label="Onboarding"><Onboarding /></RouteWithBoundary>} />
                </Route>

                {/* ── Protected routes ────────────────────────────────────── */}
                <Route element={<ProtectedRoute />}>
                  <Route path="/welcome"          element={<RouteWithBoundary label="Welcome"><WelcomeDashboard /></RouteWithBoundary>} />
                  <Route path="/dashboard"        element={<RouteWithBoundary label="Dashboard"><Dashboard /></RouteWithBoundary>} />
                  <Route path="/pipeline"        element={<RouteWithBoundary label="Job pipeline"><PipelineDashboard /></RouteWithBoundary>} />
                  <Route path="/jobs/:id"         element={<RouteWithBoundary label="Job detail"><JobDetail /></RouteWithBoundary>} />
                  <Route path="/profile"          element={<RouteWithBoundary label="Profile"><Profile /></RouteWithBoundary>} />
                  <Route path="/billing/success" element={<RouteWithBoundary label="Checkout complete"><BillingCheckoutSuccessPage /></RouteWithBoundary>} />
                  <Route path="/billing/cancel"  element={<RouteWithBoundary label="Checkout cancelled"><BillingCheckoutCancelPage /></RouteWithBoundary>} />
                  <Route path="/account" element={<RouteWithBoundary label="Account settings"><AccountSettingsLayout /></RouteWithBoundary>}>
                    <Route index element={<Navigate to="profile" replace />} />
                    <Route path="profile"       element={<RouteWithBoundary label="Profile settings"><AccountProfilePage /></RouteWithBoundary>} />
                    <Route path="security"      element={<RouteWithBoundary label="Security settings"><AccountSecurityPage /></RouteWithBoundary>} />
                    <Route path="notifications" element={<RouteWithBoundary label="Notification settings"><AccountNotificationsPage /></RouteWithBoundary>} />
                    <Route path="billing"       element={<RouteWithBoundary label="Billing settings"><AccountBillingPage /></RouteWithBoundary>} />
                    <Route path="team"          element={<RouteWithBoundary label="Team settings"><AccountTeamPage /></RouteWithBoundary>} />
                  </Route>
                  <Route path="/interviews"       element={<RouteWithBoundary label="Interview history"><InterviewHistoryPage /></RouteWithBoundary>} />
                  <Route path="/interview"        element={<RouteWithBoundary label="Interview"><InterviewPage /></RouteWithBoundary>} />
                  <Route path="/networking"       element={<RouteWithBoundary label="Networking"><NetworkingPage /></RouteWithBoundary>} />
                  <Route path="/workspaces"       element={<RouteWithBoundary label="Workspaces"><WorkspacePage /></RouteWithBoundary>} />
                  <Route path="/progress"         element={<RouteWithBoundary label="Progress"><ProgressPage /></RouteWithBoundary>} />
                  <Route path="/jobs"             element={<RouteWithBoundary label="Jobs"><Kanban /></RouteWithBoundary>} />
                  <Route path="/kanban"           element={<Navigate to="/jobs" replace />} />
                  <Route path="/cv"               element={<RouteWithBoundary label="CV manager"><CvManager /></RouteWithBoundary>} />
                  <Route path="/skills"           element={<RouteWithBoundary label="Skills"><Skills /></RouteWithBoundary>} />
                  <Route path="/analytics"        element={<RouteWithBoundary label="Analytics"><Analytics /></RouteWithBoundary>} />
                  <Route path="/refer"            element={<RouteWithBoundary label="Refer"><Refer /></RouteWithBoundary>} />
                  <Route path="/planner"          element={<RouteWithBoundary label="Planner"><PlannerPage /></RouteWithBoundary>} />
                  <Route path="/auto-apply"       element={<RouteWithBoundary label="Auto apply"><AutoApplyPage /></RouteWithBoundary>} />
                  <Route path="/watchlists"       element={<RouteWithBoundary label="Watchlists"><WatchlistsPage /></RouteWithBoundary>} />
                  <Route path="/outreach"         element={<RouteWithBoundary label="Outreach"><OutreachPage /></RouteWithBoundary>} />
                  <Route path="/agent-memory"     element={<RouteWithBoundary label="Agent memory"><AgentMemoryPage /></RouteWithBoundary>} />
                  <Route path="/resume-versions"  element={<RouteWithBoundary label="Resume versions"><ResumeVersionsPage /></RouteWithBoundary>} />
                </Route>

                {/* ── Admin-only routes ───────────────────────────────────── */}
                <Route element={<AdminRoute />}>
                  <Route path="/admin/saas" element={<RouteWithBoundary label="SaaS Admin"><SaasDashboard /></RouteWithBoundary>} />
                  <Route path="/admin/experiments" element={<RouteWithBoundary label="Experiments"><ExperimentDashboard /></RouteWithBoundary>} />
                </Route>

                {/* ── Catch-all 404 (standalone — no AppShell / dashboard header) ─ */}
                <Route
                  path="*"
                  element={
                    <RouteWithBoundary label="Page not found">
                      <NotFound />
                    </RouteWithBoundary>
                  }
                />

              </Routes>
            </Suspense>
          </ExperimentProvider>
        </AuthProvider>
      </BrowserRouter>
      </OAuthProviders>
    </HelmetProvider>
  </ErrorBoundary>
);

// Pass 6 #6.036 — exposed for sidebars / nav links to call `.preload()` on hover.
export const lazyPages = {
  Home, Login, Signup, ForgotPasswordPage, ResetPasswordPage, Onboarding,
  Dashboard, WelcomeDashboard, PipelineDashboard, JobDetail, Profile,
  AccountSettingsLayout, AccountProfilePage, AccountSecurityPage, AccountNotificationsPage,
  AccountBillingPage, AccountTeamPage,
  InterviewHistoryPage, InterviewPage, NetworkingPage, WorkspacePage,
  ProgressPage, ExperimentDashboard, SaasDashboard, Kanban, CvManager, Skills, Analytics,
  BillingPage, Refer, PlannerPage, WatchlistsPage, AutoApplyPage, OutreachPage,
  AgentMemoryPage, ResumeVersionsPage, GetStarted,
};

export default App;

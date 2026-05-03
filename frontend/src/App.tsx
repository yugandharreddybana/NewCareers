// App.tsx — single BrowserRouter owns all routing
// AuthProvider lives inside BrowserRouter so it can use useNavigate
//
// G12 fix (Batch 7d): each route group is now wrapped in its own
// <ErrorBoundary> + <Suspense> pair so a single lazy-chunk failure
// (network error, parse error) only breaks that section of the app,
// not the entire page. The top-level <Suspense> is retained as a
// catch-all for the very first paint.
import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute, AdminRoute } from './components/ProtectedRoute';
import { PageLoader } from './components/LoadingSpinner';
import { ExperimentProvider } from './context/ExperimentContext';
import { ErrorBoundary } from './components/ErrorBoundary';

// ── Public pages (lazy-loaded) ──────────────────────────────────────────────
const Login            = lazy(() => import('./pages/Login'));
const NotFound         = lazy(() => import('./pages/NotFound'));
const Signup           = lazy(() => import('./pages/Signup'));
const PasswordRecovery = lazy(() => import('./pages/PasswordRecovery'));
const Onboarding       = lazy(() => import('./pages/Onboarding'));

// ── Protected pages ───────────────────────────────────────────────────────────
const Dashboard          = lazy(() => import('./pages/Dashboard'));
const JobDetail          = lazy(() => import('./pages/JobDetail'));
const Profile            = lazy(() => import('./pages/Profile'));
const AccountSettings    = lazy(() => import('./pages/AccountSettings'));
const InterviewHistoryPage = lazy(() => import('./pages/InterviewHistoryPage'));
const InterviewPage      = lazy(() => import('./pages/InterviewPage'));
const NetworkingPage     = lazy(() => import('./pages/NetworkingPage'));
const WorkspacePage      = lazy(() => import('./pages/WorkspacePage'));
const ProgressPage       = lazy(() => import('./pages/ProgressPage'));
const ExperimentDashboard = lazy(() => import('./pages/ExperimentDashboardPage'));
const Kanban             = lazy(() => import('./pages/Kanban'));
const CvManager          = lazy(() => import('./pages/CvManager'));
const Skills             = lazy(() => import('./pages/Skills'));
const Analytics          = lazy(() => import('./pages/Analytics'));
const BillingPage        = lazy(() => import('./pages/BillingPage'));
const Refer              = lazy(() => import('./pages/Refer'));
const PlannerPage        = lazy(() => import('./pages/PlannerPage'));
const WatchlistsPage     = lazy(() => import('./pages/WatchlistsPage'));
const AutoApplyPage      = lazy(() => import('./pages/AutoApplyPage'));
const OutreachPage       = lazy(() => import('./pages/OutreachPage'));
const AgentMemoryPage    = lazy(() => import('./pages/AgentMemoryPage'));
const ResumeVersionsPage = lazy(() => import('./pages/ResumeVersionsPage'));

/** Inline fallback used by per-route error boundaries — compact, non-intrusive. */
const RouteFallback = ({ label }: { label: string }) => (
  <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 text-gray-500">
    <span className="text-3xl">⚠️</span>
    <p className="text-sm">{label} failed to load. <a href="/dashboard" className="underline text-indigo-500">Go to Dashboard</a></p>
  </div>
);

export const App: React.FC = () => (
  // B4 fix: top-level ErrorBoundary catches any unhandled render crash.
  <ErrorBoundary>
    <HelmetProvider>
      <BrowserRouter>
        <AuthProvider>
          <ExperimentProvider>
            {/* Top-level Suspense: catch-all for very first paint */}
            <Suspense fallback={<PageLoader />}>
              <Routes>

                {/* ── Public routes ─────────────────────────────────────────────── */}
                <Route path="/" element={<Navigate to="/dashboard" replace />} />

                <Route path="/login" element={
                  <ErrorBoundary fallback={<RouteFallback label="Login" />}>
                    <Suspense fallback={<PageLoader />}><Login /></Suspense>
                  </ErrorBoundary>
                } />

                <Route path="/register" element={
                  <ErrorBoundary fallback={<RouteFallback label="Signup" />}>
                    <Suspense fallback={<PageLoader />}><Signup /></Suspense>
                  </ErrorBoundary>
                } />

                <Route path="/forgot-password" element={
                  <ErrorBoundary fallback={<RouteFallback label="Password Recovery" />}>
                    <Suspense fallback={<PageLoader />}><PasswordRecovery /></Suspense>
                  </ErrorBoundary>
                } />

                <Route path="/reset-password" element={
                  <ErrorBoundary fallback={<RouteFallback label="Password Reset" />}>
                    <Suspense fallback={<PageLoader />}><PasswordRecovery /></Suspense>
                  </ErrorBoundary>
                } />

                {/* ── Protected routes ──────────────────────────────────────────── */}
                <Route element={<ProtectedRoute />}>
                  <Route path="/onboarding" element={
                    <ErrorBoundary fallback={<RouteFallback label="Onboarding" />}>
                      <Suspense fallback={<PageLoader />}><Onboarding /></Suspense>
                    </ErrorBoundary>
                  } />
                  <Route path="/dashboard" element={
                    <ErrorBoundary fallback={<RouteFallback label="Dashboard" />}>
                      <Suspense fallback={<PageLoader />}><Dashboard /></Suspense>
                    </ErrorBoundary>
                  } />
                  <Route path="/jobs/:id" element={
                    <ErrorBoundary fallback={<RouteFallback label="Job Detail" />}>
                      <Suspense fallback={<PageLoader />}><JobDetail /></Suspense>
                    </ErrorBoundary>
                  } />
                  <Route path="/profile" element={
                    <ErrorBoundary fallback={<RouteFallback label="Profile" />}>
                      <Suspense fallback={<PageLoader />}><Profile /></Suspense>
                    </ErrorBoundary>
                  } />
                  <Route path="/account" element={
                    <ErrorBoundary fallback={<RouteFallback label="Account Settings" />}>
                      <Suspense fallback={<PageLoader />}><AccountSettings /></Suspense>
                    </ErrorBoundary>
                  } />
                  <Route path="/interviews" element={
                    <ErrorBoundary fallback={<RouteFallback label="Interview History" />}>
                      <Suspense fallback={<PageLoader />}><InterviewHistoryPage /></Suspense>
                    </ErrorBoundary>
                  } />
                  <Route path="/interview" element={
                    <ErrorBoundary fallback={<RouteFallback label="Interview" />}>
                      <Suspense fallback={<PageLoader />}><InterviewPage /></Suspense>
                    </ErrorBoundary>
                  } />
                  <Route path="/networking" element={
                    <ErrorBoundary fallback={<RouteFallback label="Networking" />}>
                      <Suspense fallback={<PageLoader />}><NetworkingPage /></Suspense>
                    </ErrorBoundary>
                  } />
                  <Route path="/workspaces" element={
                    <ErrorBoundary fallback={<RouteFallback label="Workspaces" />}>
                      <Suspense fallback={<PageLoader />}><WorkspacePage /></Suspense>
                    </ErrorBoundary>
                  } />
                  <Route path="/progress" element={
                    <ErrorBoundary fallback={<RouteFallback label="Progress" />}>
                      <Suspense fallback={<PageLoader />}><ProgressPage /></Suspense>
                    </ErrorBoundary>
                  } />
                  <Route path="/kanban" element={
                    <ErrorBoundary fallback={<RouteFallback label="Kanban" />}>
                      <Suspense fallback={<PageLoader />}><Kanban /></Suspense>
                    </ErrorBoundary>
                  } />
                  <Route path="/cv" element={
                    <ErrorBoundary fallback={<RouteFallback label="CV Manager" />}>
                      <Suspense fallback={<PageLoader />}><CvManager /></Suspense>
                    </ErrorBoundary>
                  } />
                  <Route path="/skills" element={
                    <ErrorBoundary fallback={<RouteFallback label="Skills" />}>
                      <Suspense fallback={<PageLoader />}><Skills /></Suspense>
                    </ErrorBoundary>
                  } />
                  <Route path="/analytics" element={
                    <ErrorBoundary fallback={<RouteFallback label="Analytics" />}>
                      <Suspense fallback={<PageLoader />}><Analytics /></Suspense>
                    </ErrorBoundary>
                  } />
                  <Route path="/billing" element={
                    <ErrorBoundary fallback={<RouteFallback label="Billing" />}>
                      <Suspense fallback={<PageLoader />}><BillingPage /></Suspense>
                    </ErrorBoundary>
                  } />
                  <Route path="/refer" element={
                    <ErrorBoundary fallback={<RouteFallback label="Refer" />}>
                      <Suspense fallback={<PageLoader />}><Refer /></Suspense>
                    </ErrorBoundary>
                  } />
                  <Route path="/planner" element={
                    <ErrorBoundary fallback={<RouteFallback label="Planner" />}>
                      <Suspense fallback={<PageLoader />}><PlannerPage /></Suspense>
                    </ErrorBoundary>
                  } />
                  <Route path="/auto-apply" element={
                    <ErrorBoundary fallback={<RouteFallback label="Auto Apply" />}>
                      <Suspense fallback={<PageLoader />}><AutoApplyPage /></Suspense>
                    </ErrorBoundary>
                  } />
                  <Route path="/watchlists" element={
                    <ErrorBoundary fallback={<RouteFallback label="Watchlists" />}>
                      <Suspense fallback={<PageLoader />}><WatchlistsPage /></Suspense>
                    </ErrorBoundary>
                  } />
                  <Route path="/outreach" element={
                    <ErrorBoundary fallback={<RouteFallback label="Outreach" />}>
                      <Suspense fallback={<PageLoader />}><OutreachPage /></Suspense>
                    </ErrorBoundary>
                  } />
                  <Route path="/agent-memory" element={
                    <ErrorBoundary fallback={<RouteFallback label="Agent Memory" />}>
                      <Suspense fallback={<PageLoader />}><AgentMemoryPage /></Suspense>
                    </ErrorBoundary>
                  } />
                  <Route path="/resume-versions" element={
                    <ErrorBoundary fallback={<RouteFallback label="Resume Versions" />}>
                      <Suspense fallback={<PageLoader />}><ResumeVersionsPage /></Suspense>
                    </ErrorBoundary>
                  } />
                </Route>

                {/* ── Admin-only routes ─────────────────────────────────────────── */}
                <Route element={<AdminRoute />}>
                  <Route path="/admin/experiments" element={
                    <ErrorBoundary fallback={<RouteFallback label="Experiments" />}>
                      <Suspense fallback={<PageLoader />}><ExperimentDashboard /></Suspense>
                    </ErrorBoundary>
                  } />
                </Route>

                {/* ── Catch-all 404 ────────────────────────────────────────────── */}
                <Route path="*" element={<NotFound />} />

              </Routes>
            </Suspense>
          </ExperimentProvider>
        </AuthProvider>
      </BrowserRouter>
    </HelmetProvider>
  </ErrorBoundary>
);

export default App;

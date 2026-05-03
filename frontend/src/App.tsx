// App.tsx — single BrowserRouter owns all routing
// AuthProvider lives inside BrowserRouter so it can use useNavigate
import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PageLoader } from './components/LoadingSpinner';
import { ExperimentProvider } from './context/ExperimentContext';

// ── Public pages ──────────────────────────────────────────────────────────
import Login from './pages/Login';
const Signup = lazy(() => import('./pages/Signup'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const NotFound = lazy(() => import('./pages/NotFound'));

// ── Protected pages ───────────────────────────────────────────────────────
const Dashboard = lazy(() => import('./pages/Dashboard'));
const JobDetail = lazy(() => import('./pages/JobDetail'));
const Profile = lazy(() => import('./pages/Profile'));
const AccountSettings = lazy(() => import('./pages/AccountSettings'));
const InterviewHistoryPage = lazy(() => import('./pages/InterviewHistoryPage'));

const InterviewPage = lazy(() => import('./pages/InterviewPage'));
const NetworkingPage = lazy(() => import('./pages/NetworkingPage'));
const WorkspacePage = lazy(() => import('./pages/WorkspacePage'));
const ProgressPage = lazy(() => import('./pages/ProgressPage'));
const ExperimentDashboard = lazy(() => import('./pages/ExperimentDashboardPage'));
const Kanban = lazy(() => import('./pages/Kanban'));
const CvManager = lazy(() => import('./pages/CvManager'));
const Skills = lazy(() => import('./pages/Skills'));
const Analytics = lazy(() => import('./pages/Analytics'));
const BillingPage = lazy(() => import('./pages/BillingPage'));
const Refer = lazy(() => import('./pages/Refer'));
const PlannerPage = lazy(() => import('./pages/PlannerPage'));

const WatchlistsPage = lazy(() => import('./pages/WatchlistsPage'));
const AutoApplyPage = lazy(() => import('./pages/AutoApplyPage'));
const OutreachPage = lazy(() => import('./pages/OutreachPage'));
const AgentMemoryPage = lazy(() => import('./pages/AgentMemoryPage'));
const ResumeVersionsPage = lazy(() => import('./pages/ResumeVersionsPage'));

const Spinner = <PageLoader />;

export const App: React.FC = () => (
  <BrowserRouter>
    <AuthProvider>
      <ExperimentProvider>
        <Suspense fallback={Spinner}>
          <Routes>

            {/* ── Public routes — no shell ── */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* ── Protected routes ── */}
            <Route element={<ProtectedRoute />}>
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/jobs/:id" element={<JobDetail />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/account" element={<AccountSettings />} />
              <Route path="/interviews" element={<InterviewHistoryPage />} />
              <Route path="/interview" element={<InterviewPage />} />
              <Route path="/networking" element={<NetworkingPage />} />
              <Route path="/workspaces" element={<WorkspacePage />} />
              <Route path="/progress" element={<ProgressPage />} />
              <Route path="/kanban" element={<Kanban />} />
              <Route path="/cv" element={<CvManager />} />
              <Route path="/skills" element={<Skills />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/billing" element={<BillingPage />} />
              <Route path="/refer" element={<Refer />} />
              <Route path="/planner" element={<PlannerPage />} />
              <Route path="/auto-apply" element={<AutoApplyPage />} />
              <Route path="/watchlists" element={<WatchlistsPage />} />
              <Route path="/outreach" element={<OutreachPage />} />
              <Route path="/agent-memory" element={<AgentMemoryPage />} />
              <Route path="/resume-versions" element={<ResumeVersionsPage />} />
              <Route path="/admin/experiments" element={<ExperimentDashboard />} />
            </Route>

            {/* ── Catch-all 404 ── */}
            <Route path="*" element={<NotFound />} />

          </Routes>
        </Suspense>
      </ExperimentProvider>
    </AuthProvider>
  </BrowserRouter>
);

export default App;

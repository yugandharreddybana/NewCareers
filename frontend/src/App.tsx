// App.tsx — single BrowserRouter owns all routing
// AuthProvider lives inside BrowserRouter so it can use useNavigate
import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoadingSpinner } from './components/LoadingSpinner';
import { ExperimentProvider } from './context/ExperimentContext';

// Public pages
const Login    = lazy(() => import('./pages/Login'));
const Signup   = lazy(() => import('./pages/Signup'));

// Protected pages (rendered inside AppShell via ProtectedRoute > Outlet)
const Dashboard            = lazy(() => import('./pages/Dashboard'));
const JobDetail            = lazy(() => import('./pages/JobDetail'));
const Profile              = lazy(() => import('./pages/Profile'));
const InterviewHistoryPage = lazy(() => import('./pages/InterviewHistoryPage'));
const NetworkingPage       = lazy(() => import('./pages/NetworkingPage'));
const WorkspacePage        = lazy(() => import('./pages/WorkspacePage'));
const ProgressPage         = lazy(() => import('./pages/ProgressPage'));
const ExperimentDashboard  = lazy(() => import('./pages/ExperimentDashboardPage'));
const Kanban               = lazy(() => import('./pages/Kanban'));
const CvManager            = lazy(() => import('./pages/CvManager'));
const Skills               = lazy(() => import('./pages/Skills'));
const Analytics            = lazy(() => import('./pages/Analytics'));
const InterviewPage        = lazy(() => import('./pages/InterviewPage'));

export const App: React.FC = () => (
  <BrowserRouter>
    <AuthProvider>
      <ExperimentProvider>
        <Suspense fallback={
          <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <LoadingSpinner />
          </div>
        }>
          <Routes>
            {/* Public routes — no shell */}
            <Route path="/login"    element={<Login />} />
            <Route path="/register" element={<Signup />} />

            {/* Protected routes — ProtectedRoute renders AppShell which renders <Outlet /> */}
            <Route element={<ProtectedRoute />}>
              <Route path="/"                   element={<Dashboard />} />
              <Route path="/jobs/:id"           element={<JobDetail />} />
              <Route path="/profile"            element={<Profile />} />
              <Route path="/interviews"         element={<InterviewHistoryPage />} />
              <Route path="/interview"          element={<InterviewPage />} />
              <Route path="/networking"         element={<NetworkingPage />} />
              <Route path="/workspaces"         element={<WorkspacePage />} />
              <Route path="/progress"           element={<ProgressPage />} />
              <Route path="/kanban"             element={<Kanban />} />
              <Route path="/cv"                 element={<CvManager />} />
              <Route path="/skills"             element={<Skills />} />
              <Route path="/analytics"          element={<Analytics />} />
              <Route path="/admin/experiments"  element={<ExperimentDashboard />} />
            </Route>
          </Routes>
        </Suspense>
      </ExperimentProvider>
    </AuthProvider>
  </BrowserRouter>
);

export default App;

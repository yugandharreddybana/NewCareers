// App.tsx — Phase 3 complete: all routes + ExperimentProvider + OnboardingProvider
import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoadingSpinner } from './components/LoadingSpinner';
import { ExperimentProvider } from './context/ExperimentContext';

const DashboardPage          = lazy(() => import('./pages/DashboardPage'));
const JobDetailPage          = lazy(() => import('./pages/JobDetailPage'));
const ProfilePage            = lazy(() => import('./pages/ProfilePage'));
const LoginPage              = lazy(() => import('./pages/LoginPage'));
const RegisterPage           = lazy(() => import('./pages/RegisterPage'));
const InterviewHistoryPage   = lazy(() => import('./pages/InterviewHistoryPage'));
const NetworkingPage         = lazy(() => import('./pages/NetworkingPage'));
const WorkspacePage          = lazy(() => import('./pages/WorkspacePage'));
const ProgressPage           = lazy(() => import('./pages/ProgressPage'));
const ExperimentDashboard    = lazy(() => import('./pages/ExperimentDashboardPage')); // Task 80

export const App: React.FC = () => (
  <ExperimentProvider>
    <BrowserRouter>
      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          <Route path="/login"    element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/"                    element={<DashboardPage />} />
            <Route path="/jobs/:id"            element={<JobDetailPage />} />
            <Route path="/profile"             element={<ProfilePage />} />
            <Route path="/interviews"          element={<InterviewHistoryPage />} />
            <Route path="/networking"          element={<NetworkingPage />} />
            <Route path="/workspaces"          element={<WorkspacePage />} />
            <Route path="/progress"            element={<ProgressPage />} />
            <Route path="/admin/experiments"   element={<ExperimentDashboard />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  </ExperimentProvider>
);

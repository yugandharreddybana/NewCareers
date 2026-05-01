// App.tsx — updated with /workspaces route (Section 3.4)
import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoadingSpinner } from './components/LoadingSpinner';

const DashboardPage       = lazy(() => import('./pages/DashboardPage'));
const JobDetailPage       = lazy(() => import('./pages/JobDetailPage'));
const ProfilePage         = lazy(() => import('./pages/ProfilePage'));
const LoginPage           = lazy(() => import('./pages/LoginPage'));
const RegisterPage        = lazy(() => import('./pages/RegisterPage'));
const InterviewHistoryPage = lazy(() => import('./pages/InterviewHistoryPage'));
const NetworkingPage      = lazy(() => import('./pages/NetworkingPage'));
const WorkspacePage       = lazy(() => import('./pages/WorkspacePage'));

export const App: React.FC = () => (
  <BrowserRouter>
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route path="/login"    element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/"              element={<DashboardPage />} />
          <Route path="/jobs/:id"      element={<JobDetailPage />} />
          <Route path="/profile"       element={<ProfilePage />} />
          <Route path="/interviews"    element={<InterviewHistoryPage />} />
          <Route path="/networking"    element={<NetworkingPage />} />
          <Route path="/workspaces"    element={<WorkspacePage />} />
        </Route>
      </Routes>
    </Suspense>
  </BrowserRouter>
);

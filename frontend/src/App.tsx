// App.tsx — routes wired to real page components
import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoadingSpinner } from './components/LoadingSpinner';
import { ExperimentProvider } from './context/ExperimentContext';

// Real page components (matched to actual filenames in /pages)
const Dashboard               = lazy(() => import('./pages/Dashboard'));
const JobDetail               = lazy(() => import('./pages/JobDetail'));
const Profile                 = lazy(() => import('./pages/Profile'));
const Login                   = lazy(() => import('./pages/Login'));
const Signup                  = lazy(() => import('./pages/Signup'));
const InterviewHistoryPage    = lazy(() => import('./pages/InterviewHistoryPage'));
const NetworkingPage          = lazy(() => import('./pages/NetworkingPage'));
const WorkspacePage           = lazy(() => import('./pages/WorkspacePage'));
const ProgressPage            = lazy(() => import('./pages/ProgressPage'));
const ExperimentDashboard     = lazy(() => import('./pages/ExperimentDashboardPage'));

export const App: React.FC = () => (
  <ExperimentProvider>
    <BrowserRouter>
      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          <Route path="/login"    element={<Login />} />
          <Route path="/register" element={<Signup />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/"                    element={<Dashboard />} />
            <Route path="/jobs/:id"            element={<JobDetail />} />
            <Route path="/profile"             element={<Profile />} />
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

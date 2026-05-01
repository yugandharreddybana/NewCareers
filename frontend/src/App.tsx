/**
 * App.tsx — root router
 *
 * Section 3.3 fixes:
 *  - Register import corrected to Signup (file is Signup.tsx, export is Signup)
 *  - /jobs/:id route added → JobDetail page
 *  - /onboarding, /refer, /interviews, /interview/:id routes added
 *  - ResetPassword shim added (redirects to /login if page not yet created)
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { Suspense, lazy } from 'react';

// Pages
const Login                = lazy(() => import('@/pages/Login'));
const Signup               = lazy(() => import('@/pages/Signup'));
const ForgotPassword       = lazy(() => import('@/pages/ForgotPassword'));
const Dashboard            = lazy(() => import('@/pages/Dashboard'));
const Kanban               = lazy(() => import('@/pages/Kanban'));
const Analytics            = lazy(() => import('@/pages/Analytics'));
const Skills               = lazy(() => import('@/pages/Skills'));
const CvManager            = lazy(() => import('@/pages/CvManager'));
const Profile              = lazy(() => import('@/pages/Profile'));
const AccountSettings      = lazy(() => import('@/pages/AccountSettings'));
const BillingPage          = lazy(() => import('@/pages/BillingPage'));
const Onboarding           = lazy(() => import('@/pages/Onboarding'));
const JobDetail            = lazy(() => import('@/pages/JobDetail'));
const Refer                = lazy(() => import('@/pages/Refer'));
const InterviewHistoryPage = lazy(() => import('@/pages/InterviewHistoryPage'));
const InterviewPage        = lazy(() => import('@/pages/InterviewPage'));
const NotFound             = lazy(() => import('@/pages/NotFound'));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user)   return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<div className="min-h-screen bg-bg" />}>
          <Routes>
            {/* Public routes */}
            <Route path="/login"           element={<Login />} />
            <Route path="/register"        element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            {/* Reset password — redirect to login until page is built */}
            <Route path="/reset-password"  element={<Navigate to="/login" replace />} />

            {/* Onboarding (protected but pre-dashboard) */}
            <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />

            {/* Core protected routes */}
            <Route path="/dashboard"  element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/kanban"     element={<ProtectedRoute><Kanban /></ProtectedRoute>} />
            <Route path="/analytics"  element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
            <Route path="/skills"     element={<ProtectedRoute><Skills /></ProtectedRoute>} />
            <Route path="/cv"         element={<ProtectedRoute><CvManager /></ProtectedRoute>} />
            <Route path="/profile"    element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/account"    element={<ProtectedRoute><AccountSettings /></ProtectedRoute>} />
            <Route path="/billing"    element={<ProtectedRoute><BillingPage /></ProtectedRoute>} />
            <Route path="/refer"      element={<ProtectedRoute><Refer /></ProtectedRoute>} />

            {/* Section 3.3 — Job Detail route (was missing, caused 404 on JobCard click) */}
            <Route path="/jobs/:id" element={<ProtectedRoute><JobDetail /></ProtectedRoute>} />

            {/* Interview routes */}
            <Route path="/interviews"       element={<ProtectedRoute><InterviewHistoryPage /></ProtectedRoute>} />
            <Route path="/interview/:id"    element={<ProtectedRoute><InterviewPage /></ProtectedRoute>} />

            {/* Root redirect */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />

            {/* 404 catch-all — must be last */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}

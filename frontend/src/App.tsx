import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import AppShell from '@/components/layout/AppShell';

// Eagerly loaded (core auth flow — no delay acceptable)
import Login          from '@/pages/Login';
import Signup         from '@/pages/Signup';
import ForgotPassword from '@/pages/ForgotPassword';
import Onboarding     from '@/pages/Onboarding';
import NotFound       from '@/pages/NotFound';

// Route-level code splitting for all authenticated pages
const Dashboard      = lazy(() => import('@/pages/Dashboard'));
const JobDetail      = lazy(() => import('@/pages/JobDetail'));
const Kanban         = lazy(() => import('@/pages/Kanban'));
const Profile        = lazy(() => import('@/pages/Profile'));
const Analytics      = lazy(() => import('@/pages/Analytics'));
const Refer          = lazy(() => import('@/pages/Refer'));
const Skills         = lazy(() => import('@/pages/Skills'));
const CvManager      = lazy(() => import('@/pages/CvManager'));
const Billing        = lazy(() => import('@/pages/BillingPage'));
const AccountSettings= lazy(() => import('@/pages/AccountSettings'));
const InterviewPage  = lazy(() => import('@/pages/InterviewPage'));

// Skeleton fallback for Suspense boundaries
function PageFallback() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
    </div>
  );
}

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';

function Protected({ children }: { children: JSX.Element }) {
  const { user } = useAuth();
  if (USE_MOCKS) return children;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.onboarded && window.location.pathname !== '/onboarding')
    return <Navigate to="/onboarding" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      {/* ── Public routes ── */}
      <Route path="/login"           element={<Login />} />
      <Route path="/signup"          element={<Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/onboarding"      element={<Protected><Onboarding /></Protected>} />

      {/* ── Protected app shell ── */}
      <Route element={<Protected><AppShell /></Protected>}>
        <Route path="/dashboard" element={<Suspense fallback={<PageFallback />}><Dashboard /></Suspense>} />
        <Route path="/jobs/:id"  element={<Suspense fallback={<PageFallback />}><JobDetail /></Suspense>} />
        <Route path="/kanban"    element={<Suspense fallback={<PageFallback />}><Kanban /></Suspense>} />
        <Route path="/profile"   element={<Suspense fallback={<PageFallback />}><Profile /></Suspense>} />
        <Route path="/analytics" element={<Suspense fallback={<PageFallback />}><Analytics /></Suspense>} />
        <Route path="/refer"     element={<Suspense fallback={<PageFallback />}><Refer /></Suspense>} />
        <Route path="/skills"    element={<Suspense fallback={<PageFallback />}><Skills /></Suspense>} />
        <Route path="/cv"        element={<Suspense fallback={<PageFallback />}><CvManager /></Suspense>} />
        <Route path="/billing"   element={<Suspense fallback={<PageFallback />}><Billing /></Suspense>} />
        <Route path="/account"   element={<Suspense fallback={<PageFallback />}><AccountSettings /></Suspense>} />
        <Route path="/interview" element={<Suspense fallback={<PageFallback />}><InterviewPage /></Suspense>} />
      </Route>

      {/* Root redirect */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {/* 404 — anything else shows the NotFound page */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

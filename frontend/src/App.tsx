import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import Login from '@/pages/Login';
import Signup from '@/pages/Signup';
import ForgotPassword from '@/pages/ForgotPassword';
import Onboarding from '@/pages/Onboarding';
import Dashboard from '@/pages/Dashboard';
import JobDetail from '@/pages/JobDetail';
import Kanban from '@/pages/Kanban';
import Profile from '@/pages/Profile';
import Analytics from '@/pages/Analytics';
import Refer from '@/pages/Refer';
import AppShell from '@/components/layout/AppShell';

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
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/onboarding" element={<Protected><Onboarding /></Protected>} />

      <Route element={<Protected><AppShell /></Protected>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/jobs/:id" element={<JobDetail />} />
        <Route path="/kanban" element={<Kanban />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/refer"     element={<Refer />} />  {/* Section 9 — Task 101 */}
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

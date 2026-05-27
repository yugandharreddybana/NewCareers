import { Navigate } from 'react-router-dom';

/** @deprecated Use /dashboard?welcome=1 — kept for bookmarks */
export default function WelcomeDashboard() {
  return <Navigate to="/dashboard?welcome=1" replace />;
}

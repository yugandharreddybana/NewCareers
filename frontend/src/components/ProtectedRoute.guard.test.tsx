import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AdminRoute, GuestRoute, ProtectedRoute } from '@/components/ProtectedRoute';

function LocationEcho() {
  const { pathname, search } = useLocation();
  return <div data-testid="location">{`${pathname}${search}`}</div>;
}

const useAuth = vi.hoisted(() => vi.fn());

vi.mock('@/context/authCtx', () => ({
  useAuth,
}));

vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: () => <div data-testid="dashboard-layout" />,
}));

describe('ProtectedRoute guards', () => {
  it('keeps / public without redirecting unauthenticated visitors', () => {
    useAuth.mockReturnValue({ user: null, loading: false });

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<div>Public home</div>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<div>Dashboard</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Public home')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });

  it('redirects unauthenticated /dashboard visitors to plain login', () => {
    useAuth.mockReturnValue({ user: null, loading: false });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/" element={<div>Public home</div>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<div>Dashboard</div>} />
          </Route>
          <Route
            path="/login"
            element={(
              <>
                <div>Login page</div>
                <LocationEcho />
              </>
            )}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Login page')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/login');
  });

  it('GuestRoute redirects authenticated onboarded users to dashboard', () => {
    useAuth.mockReturnValue({
      user: { onboarded: true, role: 'USER' },
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route element={<GuestRoute />}>
            <Route path="/login" element={<div>Login form</div>} />
          </Route>
          <Route path="/dashboard" element={<div>Dashboard home</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Dashboard home')).toBeInTheDocument();
  });

  it('AdminRoute redirects unauthenticated users to plain login', () => {
    useAuth.mockReturnValue({ user: null, loading: false });

    render(
      <MemoryRouter initialEntries={['/admin/saas']}>
        <Routes>
          <Route element={<AdminRoute />}>
            <Route path="/admin/saas" element={<div>Admin SaaS</div>} />
          </Route>
          <Route
            path="/login"
            element={(
              <>
                <div>Login page</div>
                <LocationEcho />
              </>
            )}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Login page')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/login');
  });

  it('AdminRoute redirects non-admin users to dashboard', () => {
    useAuth.mockReturnValue({
      user: { onboarded: true, role: 'USER' },
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={['/admin/saas']}>
        <Routes>
          <Route element={<AdminRoute />}>
            <Route path="/admin/saas" element={<div>Admin SaaS</div>} />
          </Route>
          <Route path="/dashboard" element={<div>Dashboard home</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Dashboard home')).toBeInTheDocument();
  });
});

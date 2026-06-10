import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';

vi.mock('@/context/authCtx', () => ({
  useAuth: () => ({ user: null, loading: false }),
}));

vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: () => <div data-testid="dashboard-layout" />,
}));

describe('ProtectedRoute guards', () => {
  it('redirects unauthenticated users to plain login without session_expired query', () => {
    const router = createMemoryRouter(
      [
        {
          element: <ProtectedRoute />,
          children: [{ path: '/dashboard', element: <div>Dashboard</div> }],
        },
        { path: '/login', element: <div>Login</div> },
      ],
      { initialEntries: ['/dashboard'] },
    );

    render(<RouterProvider router={router} />);

    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toBe('');
  });
});

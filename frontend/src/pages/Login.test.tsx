import { fireEvent, render, screen } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import Login from './Login';

const signIn = vi.hoisted(() => vi.fn());

vi.mock('@/context/authCtx', () => ({
  useAuth: () => ({
    signIn,
    signInWithGoogle: vi.fn(),
    completeTwoFactor: vi.fn(),
    setUser: vi.fn(),
    actionLoading: false,
  }),
}));

describe('Login', () => {
  it('validates email before submitting credentials', () => {
    render(
      <HelmetProvider>
        <MemoryRouter>
          <Login />
        </MemoryRouter>
      </HelmetProvider>,
    );

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'bad-email' } });
    fireEvent.change(screen.getByLabelText(/^password$/i, { selector: 'input' }), {
      target: { value: 'GoodPass123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/email or password/i);
    expect(signIn).not.toHaveBeenCalled();
  });

  it('rejects passwords shorter than 8 characters before submit', () => {
    render(
      <HelmetProvider>
        <MemoryRouter>
          <Login />
        </MemoryRouter>
      </HelmetProvider>,
    );

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'good@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i, { selector: 'input' }), {
      target: { value: 'short' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/email or password/i);
    expect(signIn).not.toHaveBeenCalled();
  });
});

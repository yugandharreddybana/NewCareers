import { fireEvent, render, screen } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import Signup from './Signup';

const createSignupIntent = vi.hoisted(() => vi.fn());

vi.mock('@/services/api', () => ({
  authApi: {
    createSignupIntent,
    logout: vi.fn(),
  },
}));

describe('Signup', () => {
  it('validates email before creating a signup intent', () => {
    render(
      <HelmetProvider>
        <MemoryRouter>
          <Signup />
        </MemoryRouter>
      </HelmetProvider>,
    );

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Jane Doe' } });
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'not-an-email' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'GoodPass123' } });
    fireEvent.click(screen.getByLabelText(/terms of service/i));
    fireEvent.click(screen.getByLabelText(/ai processing/i));
    fireEvent.click(screen.getByRole('button', { name: /continue to profile/i }));

    expect(screen.getByText(/valid email address/i)).toBeInTheDocument();
    expect(createSignupIntent).not.toHaveBeenCalled();
  });
});

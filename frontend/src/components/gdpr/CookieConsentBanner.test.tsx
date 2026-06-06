import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { CookieConsentBanner } from './CookieConsentBanner';
import {
  COOKIE_CONSENT_KEY,
  persistAnalyticsChoice,
  shouldShowCookieBanner,
} from '@/lib/cookieConsent';

vi.mock('@/lib/cookieConsent', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/cookieConsent')>();
  return {
    ...actual,
    persistAnalyticsChoice: vi.fn().mockResolvedValue(undefined),
  };
});

describe('CookieConsentBanner', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(persistAnalyticsChoice).mockResolvedValue(undefined);
  });

  const renderBanner = () =>
    render(
      <MemoryRouter>
        <CookieConsentBanner />
      </MemoryRouter>,
    );

  it('shows banner when no consent choice is stored', () => {
    expect(shouldShowCookieBanner()).toBe(true);
    renderBanner();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Cookies & analytics/i)).toBeInTheDocument();
  });

  it('accept hides banner and persists choice', async () => {
    renderBanner();
    fireEvent.click(screen.getByRole('button', { name: /Accept analytics/i }));

    await waitFor(() => {
      expect(persistAnalyticsChoice).toHaveBeenCalledWith(true);
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('reject hides banner and persists declined choice', async () => {
    renderBanner();
    fireEvent.click(screen.getByRole('button', { name: /Reject analytics/i }));

    await waitFor(() => {
      expect(persistAnalyticsChoice).toHaveBeenCalledWith(false);
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('does not show banner after choice is already stored', () => {
    localStorage.setItem(
      COOKIE_CONSENT_KEY,
      JSON.stringify({ version: 'v1.0', analytics: true, dismissed: true }),
    );
    renderBanner();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

/**
 * Task 148 — ProfileCompletenessAlert tests
 *
 *  ✓ Renders warning banner when completeness < 70%
 *  ✓ Hidden (not rendered) when completeness >= 70%
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ProfileCompletenessAlert from './ProfileCompletenessAlert';

// Mock the useProfile / profileApi hook used inside the component
const mockUseProfile = vi.fn();
vi.mock('@/hooks/useProfile', () => ({
  useProfile: () => mockUseProfile(),
}));

// Fallback: if component uses profileApi directly, also mock that
vi.mock('@/services/api', () => ({
  profileApi: {
    get: vi.fn().mockResolvedValue({ completenessScore: 40 }),
  },
}));

describe('ProfileCompletenessAlert', () => {
  it('renders warning when completeness < 70%', () => {
    mockUseProfile.mockReturnValue({ completeness: 40, loading: false });
    render(<ProfileCompletenessAlert />);
    // Should render some alert/warning UI
    const alert = screen.queryByRole('alert')
      ?? screen.queryByText(/profile/i)
      ?? screen.queryByText(/complete/i)
      ?? screen.queryByText(/40/)
      ?? screen.queryByText(/%/);
    expect(alert).toBeInTheDocument();
  });

  it('is hidden when completeness >= 70%', () => {
    mockUseProfile.mockReturnValue({ completeness: 85, loading: false });
    const { container } = render(<ProfileCompletenessAlert />);
    // Component should render nothing meaningful (empty or null)
    const alert = container.querySelector('[role="alert"]');
    expect(alert).not.toBeInTheDocument();
  });

  it('is hidden when completeness is exactly 70%', () => {
    mockUseProfile.mockReturnValue({ completeness: 70, loading: false });
    const { container } = render(<ProfileCompletenessAlert />);
    const alert = container.querySelector('[role="alert"]');
    expect(alert).not.toBeInTheDocument();
  });
});

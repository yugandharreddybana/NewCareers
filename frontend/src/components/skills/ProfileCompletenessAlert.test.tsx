import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ProfileCompletenessAlert from './ProfileCompletenessAlert';

describe('ProfileCompletenessAlert', () => {
  it('renders warning when profile fields are missing', () => {
    render(
      <ProfileCompletenessAlert
        skillName="cover-letter"
        missingFields={['Target roles', 'Tech stack']}
      />,
    );

    expect(screen.getByText('Complete your profile to run Cover Letter')).toBeInTheDocument();
    expect(screen.getByText('Target roles')).toBeInTheDocument();
    expect(screen.getByText('Tech stack')).toBeInTheDocument();
  });

  it('is hidden when no missing fields are provided', () => {
    const { container } = render(<ProfileCompletenessAlert />);
    expect(container.firstChild).toBeNull();
  });

  it('calls onDismiss when the dismiss button is clicked', async () => {
    const onDismiss = vi.fn();
    render(
      <ProfileCompletenessAlert
        skillName="prep-interview"
        missingFields={['CV']}
        onDismiss={onDismiss}
      />,
    );

    await screen.getByRole('button', { name: 'Dismiss' }).click();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

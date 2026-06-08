import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_WORK_SETTINGS,
  PreferencesStep,
  mergeWorkSettings,
  type PreferencesStepValues,
} from './PreferencesStep';

function baseValues(overrides?: Partial<PreferencesStepValues>): PreferencesStepValues {
  return {
    selectedRoles: ['Software Engineer'],
    selectedTech: [],
    workTypes: ['Full-time'],
    workSettings: { ...DEFAULT_WORK_SETTINGS },
    salaryMinK: 40,
    salaryMaxK: 80,
    salaryCurrency: 'EUR',
    availability: '2 weeks notice',
    cvFile: new File(['cv'], 'resume.pdf', { type: 'application/pdf' }),
    sponsorship: false,
    minMatchPercent: 60,
    maxAgeDays: 7,
    ...overrides,
  };
}

describe('PreferencesStep work settings', () => {
  it('toggles Remote, On-site, and Hybrid without unmounting the step', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <PreferencesStep
        values={baseValues()}
        saving={false}
        onChange={onChange}
        onBack={vi.fn()}
        onComplete={vi.fn()}
      />,
    );

    expect(screen.getByText('Work setting')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Remote' }));
    expect(onChange).toHaveBeenLastCalledWith({
      workSettings: { remote: false, onsite: false, hybrid: false },
    });

    let workSettings = mergeWorkSettings(DEFAULT_WORK_SETTINGS, { remote: false });
    rerender(
      <PreferencesStep
        values={baseValues({ workSettings })}
        saving={false}
        onChange={onChange}
        onBack={vi.fn()}
        onComplete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'On-site' }));
    expect(onChange).toHaveBeenLastCalledWith({
      workSettings: { remote: false, onsite: true, hybrid: false },
    });

    workSettings = mergeWorkSettings(workSettings, { onsite: true });
    rerender(
      <PreferencesStep
        values={baseValues({ workSettings })}
        saving={false}
        onChange={onChange}
        onBack={vi.fn()}
        onComplete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Hybrid' }));
    expect(onChange).toHaveBeenLastCalledWith({
      workSettings: { remote: false, onsite: true, hybrid: true },
    });

    expect(screen.getByText('Work setting')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Complete profile' })).toBeInTheDocument();
  });

  it('survives partial workSettings in values (merge on render)', () => {
    render(
      <PreferencesStep
        values={baseValues({ workSettings: { remote: true } as PreferencesStepValues['workSettings'] })}
        saving={false}
        onChange={vi.fn()}
        onBack={vi.fn()}
        onComplete={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Remote' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'On-site' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Hybrid' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('blocks complete when no work setting is selected', () => {
    const onComplete = vi.fn();
    render(
      <PreferencesStep
        values={baseValues({
          workSettings: { remote: false, onsite: false, hybrid: false },
        })}
        saving={false}
        onChange={vi.fn()}
        onBack={vi.fn()}
        onComplete={onComplete}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Complete profile' }));
    expect(onComplete).not.toHaveBeenCalled();
  });
});

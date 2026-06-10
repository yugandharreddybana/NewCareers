import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { GoogleConsentSheet } from './GoogleConsentSheet';

describe('GoogleConsentSheet', () => {
  it('requires AI processing consent before submitting', () => {
    const submit = vi.fn();
    render(
      <MemoryRouter>
        <GoogleConsentSheet open onCancel={() => undefined} onSubmit={submit} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByLabelText(/terms of service/i));
    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }));

    expect(submit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/ai processing consent/i);
  });
});

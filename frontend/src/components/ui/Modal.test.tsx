import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { axe } from '@/test/axe';
import { describe, expect, it, vi } from 'vitest';
import { Modal } from './Modal';

describe('Modal', () => {
  it('renders an accessible dialog when open', () => {
    render(
      <Modal open onClose={vi.fn()} title="Edit profile" description="Update your details">
        <p>Dialog body</p>
      </Modal>,
    );

    expect(screen.getByRole('dialog', { name: /edit profile/i })).toBeInTheDocument();
    expect(screen.getByText('Dialog body')).toBeInTheDocument();
  });

  it('has no obvious accessibility violations when open', async () => {
    const { container } = render(
      <Modal open onClose={vi.fn()} title="Edit profile" description="Update your details">
        <p>Dialog body</p>
      </Modal>,
    );

    expect(await axe(container)).toHaveNoViolations();
  });

  it('calls onClose when the user presses Escape', async () => {
    const onClose = vi.fn();

    render(
      <Modal open onClose={onClose} title="Edit profile">
        <p>Dialog body</p>
      </Modal>,
    );

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
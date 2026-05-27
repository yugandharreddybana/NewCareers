import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { ThemeProvider } from './ThemeContext';

describe('ThemeProvider', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.add('dark');
    document.documentElement.dataset.theme = 'dark';
  });

  it('always applies light mode and clears any stored dark preference', async () => {
    window.localStorage.setItem('careerops-theme', 'dark');

    render(
      <ThemeProvider>
        <div>content</div>
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(window.localStorage.getItem('careerops-theme')).toBe('light');
  });
});

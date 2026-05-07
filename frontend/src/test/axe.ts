import { configureAxe } from 'vitest-axe';

// jsdom does not implement layout and pseudo-element contrast calculations,
// so axe's color-contrast rule emits false-positive runtime warnings in tests.
export const axe = configureAxe({
  rules: {
    'color-contrast': { enabled: false },
  },
});
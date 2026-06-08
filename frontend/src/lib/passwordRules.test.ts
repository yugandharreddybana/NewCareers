import { describe, expect, it } from 'vitest';
import {
  evaluatePasswordStrength,
  isPasswordComplexityValid,
  PASSWORD_PATTERN,
} from './passwordRules';

describe('passwordRules', () => {
  it('matches backend signup password pattern', () => {
    expect(PASSWORD_PATTERN.test('Secure1Pass')).toBe(true);
    expect(PASSWORD_PATTERN.test('short1A')).toBe(false);
    expect(PASSWORD_PATTERN.test('nouppercase1')).toBe(false);
  });

  it('evaluatePasswordStrength requires complexity', () => {
    expect(evaluatePasswordStrength('Secure1Pass').acceptable).toBe(true);
    expect(evaluatePasswordStrength('password').acceptable).toBe(false);
    expect(isPasswordComplexityValid('Secure1Pass')).toBe(true);
  });
});

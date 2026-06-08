import { describe, expect, it } from 'vitest';
import { WORD_CAPTCHA_CODE_LENGTH, wordCaptchaSvgDataUrl } from './wordCaptcha';

describe('wordCaptcha', () => {
  it('matches backend code length', () => {
    expect(WORD_CAPTCHA_CODE_LENGTH).toBe(5);
  });

  it('builds a safe svg data url', () => {
    const url = wordCaptchaSvgDataUrl('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    expect(url.startsWith('data:image/svg+xml,')).toBe(true);
    expect(url).not.toContain('<script');
  });
});

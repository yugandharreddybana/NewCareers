/** Mirrors backend {@code WordCaptchaService.CODE_LENGTH}. */
export const WORD_CAPTCHA_CODE_LENGTH = 5;

export function wordCaptchaSvgDataUrl(svg: string): string {
  const encoded = encodeURIComponent(svg)
    .replace(/'/g, '%27')
    .replace(/"/g, '%22');
  return `data:image/svg+xml,${encoded}`;
}

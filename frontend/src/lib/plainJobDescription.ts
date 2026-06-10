import { cleanJobDescriptionText, preprocessJobDescription } from '@/lib/jobDescriptionFormat';

/** Strip HTML and normalize whitespace for job posting display. */
export function plainJobDescription(raw: string | undefined | null): string {
  if (!raw?.trim()) return '';
  let text = raw;
  if (/<[a-z][\s\S]*>/i.test(text)) {
    const doc = new DOMParser().parseFromString(text, 'text/html');
    doc.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
    doc.querySelectorAll('p, li, h1, h2, h3, h4, div').forEach(el => {
      el.insertAdjacentText('beforebegin', '\n');
    });
    text = doc.body?.textContent ?? text;
  }
  return preprocessJobDescription(cleanJobDescriptionText(text));
}

export function hasUsableJobDescription(raw: string | undefined | null): boolean {
  return plainJobDescription(raw).length >= 80;
}

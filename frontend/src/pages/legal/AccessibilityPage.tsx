import { LegalPageShell } from './LegalPageShell';
import { SUPPORT_EMAIL } from '@/lib/brand';

export default function AccessibilityPage() {
  return (
    <LegalPageShell title="Accessibility">
      <p>
        NewCareers aims to meet WCAG 2.1 Level AA where practicable. We use semantic HTML,
        keyboard-navigable forms, and sufficient colour contrast in our design system.
      </p>
      <p>
        If you encounter accessibility barriers, please contact{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary underline">{SUPPORT_EMAIL}</a>{' '}
        and we will work to address them.
      </p>
    </LegalPageShell>
  );
}

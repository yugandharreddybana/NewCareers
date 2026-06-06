import { LegalPageShell } from './LegalPageShell';
import { SUPPORT_EMAIL } from '@/lib/brand';

export default function HelpPage() {
  return (
    <LegalPageShell title="Help">
      <p>Need assistance with NewCareers?</p>
      <ul className="list-disc pl-5 space-y-1">
        <li>Account and privacy controls: Account settings → Privacy &amp; data</li>
        <li>Password reset: use Forgot password on the login page</li>
        <li>Google accounts: re-authenticate with Google to delete your account</li>
      </ul>
      <p>Email us at <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary underline">{SUPPORT_EMAIL}</a></p>
    </LegalPageShell>
  );
}

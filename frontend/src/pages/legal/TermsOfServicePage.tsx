import { LegalPageShell } from './LegalPageShell';

export default function TermsOfServicePage() {
  return (
    <LegalPageShell title="Terms of Service">
      <p><strong>Last updated:</strong> June 2026</p>
      <p>
        By creating a NewCareers account you agree to these terms. Essential processing
        (account, security, core job-matching infrastructure) is necessary to provide the service.
      </p>
      <h2 className="text-on-surface font-semibold text-lg mt-6">AI features</h2>
      <p>
        AI-powered skills (resume tailoring, job evaluation, interview prep) require separate
        explicit consent. You may use non-AI features without opting in to AI processing.
      </p>
      <h2 className="text-on-surface font-semibold text-lg mt-6">Acceptable use</h2>
      <p>
        Do not misuse the platform, attempt unauthorized access, or upload unlawful content.
        We may suspend accounts that violate these terms.
      </p>
    </LegalPageShell>
  );
}

import { LegalPageShell } from './LegalPageShell';
import { SUPPORT_EMAIL } from '@/lib/brand';

export default function PrivacyPolicyPage() {
  return (
    <LegalPageShell title="Privacy Policy">
      <p><strong>Last updated:</strong> June 2026</p>
      <p>
        NewCareers processes personal data to provide career intelligence services for job seekers in Ireland.
        This policy explains what we collect, why, and your rights under GDPR.
      </p>
      <h2 className="text-on-surface font-semibold text-lg mt-6">What we collect</h2>
      <ul className="list-disc pl-5 space-y-1">
        <li>Account details (name, email, username)</li>
        <li>CV and profile data you upload</li>
        <li>Job search activity and application pipeline data</li>
        <li>Consent records (type, version, timestamp, IP, user agent)</li>
      </ul>
      <h2 className="text-on-surface font-semibold text-lg mt-6">Processors</h2>
      <p>We use third-party processors only with appropriate safeguards:</p>
      <ul className="list-disc pl-5 space-y-1">
        <li><strong>Anthropic, Google (Gemini), NVIDIA</strong> — AI inference when you opt in to AI processing</li>
        <li><strong>Resend</strong> — transactional and marketing email (marketing only with your consent)</li>
        <li><strong>Supabase</strong> — secure file storage for CVs</li>
      </ul>
      <h2 className="text-on-surface font-semibold text-lg mt-6">Your rights</h2>
      <ul className="list-disc pl-5 space-y-1">
        <li>Access and export your data from Account settings</li>
        <li>Withdraw marketing, analytics, or AI processing consent at any time</li>
        <li>Request erasure — we anonymize your account immediately on delete</li>
      </ul>
      <p>Contact: <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary underline">{SUPPORT_EMAIL}</a></p>
    </LegalPageShell>
  );
}

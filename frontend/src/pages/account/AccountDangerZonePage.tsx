import { PrivacySettingsSection } from '@/components/gdpr/PrivacySettingsSection';
import { AccountSettingsPageHeader } from './AccountSettingsPageHeader';
import { SectionHeader } from './accountSettingsShared';

export default function AccountDangerZonePage() {
  return (
    <main className="flex-1 flex flex-col gap-stack-lg min-w-0">
      <AccountSettingsPageHeader
        title="Danger Zone"
        subtitle="Manage consent, export your data, or permanently delete your account."
      />

      <section className="border border-error/30 bg-error-container rounded p-gutter">
        <SectionHeader
          icon="shield"
          title="Privacy & data"
          description="These actions are irreversible or affect how we process your data."
        />
        <PrivacySettingsSection />
      </section>
    </main>
  );
}

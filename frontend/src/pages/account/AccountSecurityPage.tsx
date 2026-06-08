import '@/styles/account-settings.css';
import { AccountSettingsPageHeader } from './AccountSettingsPageHeader';
import { ChangePasswordCard } from './security/ChangePasswordCard';
import { TwoFactorCard } from './security/TwoFactorCard';
import { ActiveSessionsCard } from './security/ActiveSessionsCard';
import { RecentActivityCard } from './security/RecentActivityCard';

export default function AccountSecurityPage() {
  return (
    <main className="flex-1 flex flex-col gap-stack-lg min-w-0">
      <AccountSettingsPageHeader
        title="Security Settings"
        subtitle="Manage your password, two-factor authentication, and active sessions."
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-stack-lg items-start">
        <div className="flex flex-col gap-stack-lg min-w-0">
          <ChangePasswordCard />
          <TwoFactorCard />
        </div>
        <div className="flex flex-col gap-stack-lg min-w-0">
          <ActiveSessionsCard />
          <RecentActivityCard />
        </div>
      </div>
    </main>
  );
}

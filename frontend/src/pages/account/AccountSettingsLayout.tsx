import { Outlet } from 'react-router-dom';
import { PageMeta } from '@/components/PageMeta';
import { DashboardTopNav } from '@/components/dashboard/DashboardTopNav';
import { AccountSettingsNav } from './AccountSettingsNav';
import '@/styles/onboarding.css';
import '@/styles/account-settings.css';

export default function AccountSettingsLayout() {
  return (
    <div className="account-settings-page settings-page bg-background font-body-md text-on-background min-h-screen flex flex-col">
      <PageMeta title="Settings | NewCareers" />
      <DashboardTopNav />
      <div className="flex-1 px-margin-mobile md:px-margin-desktop py-8 md:py-12 max-w-container-max mx-auto w-full flex flex-col md:flex-row gap-stack-xl">
        <AccountSettingsNav />
        <div className="flex-1 min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

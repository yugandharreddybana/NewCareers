import { Outlet } from 'react-router-dom';
import { PageMeta } from '@/components/PageMeta';
import { AccountSettingsNav } from './AccountSettingsNav';
import '@/styles/onboarding.css';
import '@/styles/account-settings.css';

export default function AccountSettingsLayout() {
  return (
    <div className="account-settings-page settings-page bg-background font-body-md text-on-background h-screen flex flex-col overflow-hidden">
      <PageMeta title="Settings | NewCareers" />
      <div className="account-settings-shell flex-1 min-h-0 app-shell w-full gap-stack-xl">
        <AccountSettingsNav />
        <div className="account-settings-content py-8 md:py-12">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

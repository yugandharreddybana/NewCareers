import { Outlet } from 'react-router-dom';
import { DashboardTopNav } from '@/components/dashboard/DashboardTopNav';

export function DashboardLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <DashboardTopNav />
      <div className="flex-1 flex flex-col min-h-0">
        <Outlet />
      </div>
    </div>
  );
}

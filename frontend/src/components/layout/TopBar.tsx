import { useLocation, Link } from 'react-router-dom';
import { Bell, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';

const BREADCRUMBS: Record<string, { label: string; parent?: string; parentPath?: string }> = {
  '/dashboard':     { label: 'Dashboard' },
  '/kanban':        { label: 'Job Tracker' },
  '/profile':       { label: 'Profile' },
  '/jobs':          { label: 'Job Detail', parent: 'Dashboard', parentPath: '/dashboard' },
  '/onboarding':    { label: 'Onboarding' },
};

export default function TopBar() {
  const { pathname } = useLocation();
  const base = '/' + pathname.split('/')[1];
  const crumb = BREADCRUMBS[base] ?? { label: '' };

  return (
    <header
      className={cn(
        'fixed top-0 right-0 z-20 flex items-center justify-between',
        'h-[60px] px-6 bg-white/90 backdrop-blur-sm border-b border-border',
        'transition-all duration-200',
      )}
      style={{ left: 'var(--sidebar-width, 240px)' }}
    >
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        {crumb.parent && (
          <>
            <Link to={crumb.parentPath!} className="text-text-tertiary hover:text-text-secondary transition-colors">
              {crumb.parent}
            </Link>
            <span className="text-text-tertiary">/</span>
          </>
        )}
        <span className="font-semibold text-text-primary">{crumb.label}</span>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="text-text-tertiary hover:text-text-primary" aria-label="Search">
          <Search size={17} />
        </Button>
        <Button variant="ghost" size="icon" className="text-text-tertiary hover:text-text-primary relative" aria-label="Notifications">
          <Bell size={17} />
          {/* Notification dot — will be wired up in Phase 2 notifications section */}
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-brand-500 rounded-full" />
        </Button>
      </div>
    </header>
  );
}

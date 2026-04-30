import { Bell, Search } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/Avatar';
import { greeting } from '@/lib/utils';

const BREADCRUMBS: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/kanban':    'Job Tracker',
  '/profile':   'Profile',
};

interface TopBarProps {
  sidebarCollapsed: boolean;
}

export default function TopBar({ sidebarCollapsed }: TopBarProps) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const page = BREADCRUMBS[pathname] ?? 'NewCareers';

  return (
    <header className={cn(
      'h-[60px] flex items-center justify-between px-6 bg-white border-b border-border shrink-0 transition-all duration-300',
    )}>
      {/* Left: page title */}
      <div>
        <h1 className="text-sm font-semibold text-text-primary">{page}</h1>
        <p className="text-2xs text-text-tertiary hidden sm:block">
          {greeting()}, {user?.name?.split(' ')[0]}
        </p>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <button className="hidden md:flex items-center gap-2 px-3 h-8 rounded-lg border border-border bg-ink-50 text-text-tertiary text-xs hover:border-border-strong hover:bg-white transition-all">
          <Search size={13} />
          <span>Search jobs…</span>
          <kbd className="ml-2 text-2xs bg-ink-100 text-ink-500 px-1.5 py-0.5 rounded border border-ink-200 font-mono">⌘K</kbd>
        </button>

        {/* Notifications */}
        <button className="relative w-9 h-9 flex items-center justify-center rounded-lg border border-border bg-white text-text-secondary hover:bg-ink-50 hover:border-border-strong transition-colors">
          <Bell size={16} />
          <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-danger" />
        </button>

        {/* Avatar */}
        <Avatar name={user?.name} size="sm" className="ring-2 ring-white border border-border" />
      </div>
    </header>
  );
}

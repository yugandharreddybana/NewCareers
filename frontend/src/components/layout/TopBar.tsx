import { Link, useLocation } from 'react-router-dom';
import { Bell, Search, Zap } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { motion } from 'framer-motion';
import { cn, greeting } from '@/lib/utils';
import Avatar from '@/components/ui/Avatar';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useNavigate } from 'react-router-dom';

interface TopBarProps {
  sidebarCollapsed: boolean;
}

const BREADCRUMB_MAP: Record<string, string> = {
  dashboard: 'Dashboard',
  kanban:    'Job Tracker',
  profile:   'Profile',
  jobs:      'Job Detail',
};

export default function TopBar({ sidebarCollapsed }: TopBarProps) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const nav = useNavigate();

  const segment = location.pathname.split('/').filter(Boolean)[0] ?? 'dashboard';
  const pageTitle = BREADCRUMB_MAP[segment] ?? segment;

  const handleSignOut = async () => { await signOut(); nav('/login'); };

  return (
    <header
      className={cn(
        'fixed top-0 right-0 z-20 flex items-center justify-between h-14 px-6',
        'bg-surface/95 backdrop-blur-sm border-b border-border',
        'transition-all duration-300',
        sidebarCollapsed ? 'left-16' : 'left-60'
      )}
    >
      {/* Left: breadcrumb */}
      <div className="flex items-center gap-2">
        {/* Mobile logo */}
        <Link to="/dashboard" className="md:hidden flex items-center gap-2 mr-2">
          <div className="w-7 h-7 bg-brand rounded-lg flex items-center justify-center">
            <Zap size={14} className="text-white" fill="white" />
          </div>
          <span className="font-bold text-sm">Career<span className="text-brand">Ops</span></span>
        </Link>

        <div className="hidden md:flex items-center gap-1.5 text-sm">
          <span className="text-text-muted font-medium">CareerOps</span>
          <span className="text-text-muted">/</span>
          <span className="font-semibold text-text-primary">{pageTitle}</span>
        </div>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-1.5">
        {/* Greeting — desktop only */}
        <div className="hidden lg:flex flex-col items-end mr-3">
          <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">{greeting()}</span>
          <span className="text-xs font-bold text-text-primary">{user?.name?.split(' ')[0]}</span>
        </div>

        {/* Notifications */}
        <button className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:bg-surface-3 hover:text-text-primary transition-colors relative">
          <Bell size={17} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-brand" />
        </button>

        {/* Avatar dropdown */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-brand/40 ml-1">
              <Avatar src={user?.avatarUrl} name={user?.name} size="sm" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={8}
              className={cn(
                'z-50 min-w-[200px] bg-surface border border-border rounded-xl shadow-lg p-1',
                'animate-scale-in origin-top-right',
              )}
            >
              <div className="px-3 py-2.5 border-b border-border mb-1">
                <p className="text-sm font-semibold text-text-primary">{user?.name}</p>
                <p className="text-xs text-text-muted truncate">{user?.email}</p>
              </div>
              <DropdownMenu.Item
                onSelect={() => nav('/profile')}
                className="flex items-center gap-2 px-3 py-2 text-sm text-text-secondary rounded-lg hover:bg-surface-3 cursor-pointer outline-none"
              >
                Profile settings
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="my-1 border-t border-border" />
              <DropdownMenu.Item
                onSelect={handleSignOut}
                className="flex items-center gap-2 px-3 py-2 text-sm text-danger-600 rounded-lg hover:bg-danger-50 cursor-pointer outline-none"
              >
                Sign out
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  );
}

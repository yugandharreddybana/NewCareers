import { Link, useLocation } from 'react-router-dom';

type NavItem = {
  to: string;
  label: string;
  icon: string;
  filled?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { to: '/account/profile', label: 'Profile', icon: 'person' },
  { to: '/account/security', label: 'Security', icon: 'lock' },
  { to: '/account/notifications', label: 'Notifications', icon: 'notifications' },
  { to: '/account/billing', label: 'Subscription & Billing', icon: 'credit_card', filled: true },
  { to: '/account/team', label: 'Team', icon: 'group' },
];

function isActive(pathname: string, to: string): boolean {
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function AccountSettingsNav() {
  const { pathname } = useLocation();
  const dangerActive = isActive(pathname, '/account/danger-zone');

  return (
    <aside className="account-settings-nav w-full md:w-64 shrink-0 flex flex-col gap-stack-sm py-8 md:py-12">
      <h2 className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mb-stack-sm px-3">
        Account Settings
      </h2>

      {NAV_ITEMS.map(item => {
        const active = isActive(pathname, item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            className={
              active
                ? 'flex items-center gap-stack-md px-3 py-2 rounded bg-primary-container text-on-primary-container font-label-md text-label-md'
                : 'flex items-center gap-stack-md px-3 py-2 rounded text-on-surface hover:bg-surface-container transition-colors group'
            }
            aria-current={active ? 'page' : undefined}
          >
            <span
              className={`material-symbols-outlined ${active ? 'text-primary' : 'text-outline group-hover:text-primary transition-colors'}`}
              style={active && item.filled ? { fontVariationSettings: "'FILL' 1" } : undefined}
              aria-hidden="true"
            >
              {item.icon}
            </span>
            <span>{item.label}</span>
          </Link>
        );
      })}

      <div className="h-px bg-outline-variant my-stack-sm" />

      <Link
        to="/account/danger-zone"
        className={
          dangerActive
            ? 'flex items-center gap-stack-md px-3 py-2 rounded bg-error-container text-on-error-container font-label-md text-label-md'
            : 'flex items-center gap-stack-md px-3 py-2 rounded text-error hover:bg-error-container hover:text-on-error-container transition-colors group'
        }
        aria-current={dangerActive ? 'page' : undefined}
      >
        <span className="material-symbols-outlined" aria-hidden="true">warning</span>
        <span className="font-label-md text-label-md">Danger Zone</span>
      </Link>
    </aside>
  );
}

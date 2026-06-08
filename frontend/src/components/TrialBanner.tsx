import { Link } from 'react-router-dom';
import { useSubscription } from '@/hooks/useSubscription';

export function TrialBanner() {
  const { status, daysRemaining, isLoading } = useSubscription();

  if (isLoading) return null;

  const isTrialing =
    status?.toUpperCase() === 'TRIALING' && daysRemaining > 0;

  if (!isTrialing) return null;

  const dayLabel = daysRemaining === 1 ? 'day' : 'days';

  return (
    <div
      className="w-full bg-primary/10 border-b border-primary/20 text-on-surface shadow-sm"
      role="status"
    >
      <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-3 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <p className="font-body-md text-body-md flex-1">
          {daysRemaining} {dayLabel} left in your Pro trial —{' '}
          <Link
            to="/pricing"
            className="font-label-md text-label-md text-primary underline underline-offset-2 hover:text-primary/80"
          >
            upgrade now
          </Link>{' '}
          to keep access.
        </p>
      </div>
    </div>
  );
}

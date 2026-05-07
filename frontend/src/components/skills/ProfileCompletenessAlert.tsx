interface Props {
  missingFields?: string[];
  skillName?: string;
  onDismiss?: () => void;
  userJobId?: string;
}

/**
 * Shown when the user tries to run a skill but their profile is incomplete.
 * Lists exactly what is missing and links directly to the relevant settings section.
 */
export function ProfileCompletenessAlert({ missingFields = [], skillName = '', onDismiss }: Props) {
  if (!missingFields || missingFields.length === 0) return null;

  const skillLabel = (skillName || '')
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950 p-4 mb-4">
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex-shrink-0 mt-0.5">
          <svg className="h-5 w-5 text-amber-500" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
            Complete your profile to run {skillLabel}
          </p>
          <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
            The following information is needed:
          </p>
          <ul className="mt-2 space-y-1">
            {missingFields.map((field, i) => (
              <li key={i} className="text-sm text-amber-700 dark:text-amber-300 flex items-start gap-1.5">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                <span>{field}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center gap-3">
            <a
              href="/settings"
              className="text-sm font-medium text-amber-800 dark:text-amber-200 underline hover:no-underline"
            >
              Go to Settings →
            </a>
          </div>
        </div>

        {/* Dismiss */}
        <button
          onClick={onDismiss}
          className="flex-shrink-0 text-amber-500 hover:text-amber-700 dark:hover:text-amber-300"
          aria-label="Dismiss"
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default ProfileCompletenessAlert;

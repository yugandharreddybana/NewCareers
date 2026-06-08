import { AccountSettingsPageHeader } from './AccountSettingsPageHeader';

export default function AccountNotificationsPage() {
  return (
    <main className="flex-1 flex flex-col gap-stack-lg min-w-0">
      <AccountSettingsPageHeader
        title="Notifications"
        subtitle="Control how and when CareerOps reaches you."
      />

      <section className="glass-panel rounded p-gutter flex flex-col items-center justify-center text-center py-stack-xl">
        <span className="material-symbols-outlined text-4xl text-outline mb-stack-md" aria-hidden="true">
          notifications
        </span>
        <h2 className="font-headline-md text-headline-md text-on-surface mb-2">Coming soon</h2>
        <p className="font-body-md text-body-md text-on-surface-variant max-w-md">
          Email and in-app notification preferences are on the way. You&apos;ll be able to tune job
          alerts, skill run updates, and marketing messages here.
        </p>
      </section>
    </main>
  );
}

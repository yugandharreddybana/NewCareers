import { AccountSettingsPageHeader } from './AccountSettingsPageHeader';

export default function AccountTeamPage() {
  return (
    <main className="flex-1 flex flex-col gap-stack-lg min-w-0">
      <AccountSettingsPageHeader
        title="Team"
        subtitle="Invite teammates and manage workspace access."
      />

      <section className="glass-panel rounded p-gutter flex flex-col items-center justify-center text-center py-stack-xl">
        <span className="material-symbols-outlined text-4xl text-outline mb-stack-md" aria-hidden="true">
          group
        </span>
        <h2 className="font-headline-md text-headline-md text-on-surface mb-2">Coming soon</h2>
        <p className="font-body-md text-body-md text-on-surface-variant max-w-md">
          Team seats and role management will live here. Upgrade to a plan with multiple members when
          you&apos;re ready to collaborate.
        </p>
      </section>
    </main>
  );
}

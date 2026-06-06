import { Link } from 'react-router-dom';
import { PageMeta } from '@/components/PageMeta';
import { BRAND_NAME, legalPaths } from '@/lib/brand';

export function LegalPageShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-surface-container-low text-on-surface antialiased">
      <PageMeta title={`${title} — ${BRAND_NAME}`} />
      <header className="border-b border-outline-variant bg-surface-container-lowest">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between gap-4">
          <Link to="/" className="font-headline-sm text-primary font-bold">{BRAND_NAME}</Link>
          <nav className="flex gap-4 text-sm text-on-surface-variant">
            <Link to={legalPaths.privacy} className="hover:text-primary">Privacy</Link>
            <Link to={legalPaths.terms} className="hover:text-primary">Terms</Link>
            <Link to={legalPaths.help} className="hover:text-primary">Help</Link>
            <Link to={legalPaths.accessibility} className="hover:text-primary">Accessibility</Link>
          </nav>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-10 prose prose-slate dark:prose-invert">
        <h1 className="font-headline-lg text-headline-lg mb-6">{title}</h1>
        <div className="font-body-md text-body-md space-y-4 text-on-surface-variant leading-relaxed">
          {children}
        </div>
      </main>
    </div>
  );
}

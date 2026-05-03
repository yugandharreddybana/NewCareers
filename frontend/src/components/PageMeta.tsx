/**
 * PageMeta — sets the document <title> and meta description for each page.
 * Wrap this component at the top of any page component.
 *
 * Usage:
 *   <PageMeta title="Dashboard" description="Your career overview" />
 *
 * The brand suffix " | CareerOps" is appended automatically.
 */
import { Helmet } from 'react-helmet-async';

interface PageMetaProps {
  title: string;
  description?: string;
}

const BRAND = 'CareerOps';

export function PageMeta({ title, description }: PageMetaProps) {
  const fullTitle = title === BRAND ? BRAND : `${title} | ${BRAND}`;
  return (
    <Helmet>
      <title>{fullTitle}</title>
      {description && <meta name="description" content={description} />}
    </Helmet>
  );
}

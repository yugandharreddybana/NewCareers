/**
 * PageMeta — sets the document <title> and meta description for each page.
 */
import { Helmet } from 'react-helmet-async';
import { BRAND_NAME } from '@/lib/brand';

interface PageMetaProps {
  title: string;
  description?: string;
}

export function PageMeta({ title, description }: PageMetaProps) {
  const alreadyBranded =
    title === BRAND_NAME || title.includes(BRAND_NAME);
  const fullTitle = alreadyBranded ? title : `${title} | ${BRAND_NAME}`;
  return (
    <Helmet>
      <title>{fullTitle}</title>
      {description && <meta name="description" content={description} />}
    </Helmet>
  );
}

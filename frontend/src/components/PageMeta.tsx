import { Helmet } from 'react-helmet-async';

interface PageMetaProps {
  title: string;
  description?: string;
}

export function PageMeta({ title, description = 'AI-powered job matching for the Irish market.' }: PageMetaProps) {
  return (
    <Helmet>
      <title>{`${title} | CareerOps`}</title>
      <meta name="description" content={description} />
    </Helmet>
  );
}

import React from 'react';
import { Link } from 'react-router-dom';
import { PageMeta } from '@/components/PageMeta';

const NotFound: React.FC = () => (
  <>
    <PageMeta title="404 — Page Not Found" />
    <div className="min-h-screen bg-[#F8F9FC] flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-md">
        <p className="text-8xl font-extrabold text-emerald-500 leading-none">404</p>
        <h1 className="mt-4 text-2xl font-semibold text-gray-900">Page not found</h1>
        <p className="mt-2 text-gray-500 text-sm">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          to="/dashboard"
          className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-500 text-white text-sm font-medium rounded-lg hover:bg-emerald-600 transition-colors"
        >
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  </>
);

export default NotFound;

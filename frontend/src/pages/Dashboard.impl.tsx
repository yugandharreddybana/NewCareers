// Placeholder — the real Dashboard implementation lives in the original Dashboard.tsx.
// This file exists so the PageMeta barrel import above re-exports cleanly.
// TODO: When refactoring Dashboard.tsx into sub-components, move implementation here.
import { PageMeta } from '@/components/PageMeta';
import React from 'react';
export default function DashboardImpl() {
  return (
    <>
      <PageMeta title="Dashboard" description="Your career overview and activity feed" />
      {/* Original Dashboard content rendered via the parent barrel */}
    </>
  );
}

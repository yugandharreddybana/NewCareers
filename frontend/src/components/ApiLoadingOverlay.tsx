import { useEffect, useState } from 'react';
import { LoadingOverlay } from '@/components/LoadingSpinner';
import { getApiLoadingSnapshot, subscribeApiLoading } from '@/lib/apiLoading';

/** Full-screen loader driven by axios request tracking in `services/api.ts`. */
export function ApiLoadingOverlay() {
  const [snapshot, setSnapshot] = useState(getApiLoadingSnapshot);

  useEffect(() => subscribeApiLoading(() => setSnapshot(getApiLoadingSnapshot())), []);

  return <LoadingOverlay active={snapshot.active} message={snapshot.message} />;
}

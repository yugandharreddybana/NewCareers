/**
 * Tracks in-flight axios requests and drives the global LoadingOverlay.
 */
import type { InternalAxiosRequestConfig } from 'axios';

declare module 'axios' {
  export interface AxiosRequestConfig {
    /** When true, this request does not show the global loader. */
    skipGlobalLoader?: boolean;
    /** Custom message shown in the global loader for this request. */
    loaderMessage?: string;
    /** @internal */
    __loaderTrackId?: string;
  }
}

type Listener = () => void;

const listeners = new Set<Listener>();
const inFlight = new Map<string, string>();
const loaderIds = new WeakMap<InternalAxiosRequestConfig, string>();
let seq = 0;

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

function pathOf(url?: string): string {
  if (!url) return '';
  return url.split('?')[0] ?? url;
}

/** Background / session calls that should not block the UI. */
function isSilentPath(url?: string): boolean {
  const path = pathOf(url);
  if (!path) return false;
  if (path === '/auth/me' || path === '/auth/refresh') return true;
  if (path === '/auth/login' || path === '/auth/google') return true;
  if (path === '/auth/forgot-password' || path === '/auth/reset-password') return true;
  if (path === '/experiments/variants' || path.startsWith('/experiments/')) return true;
  if (path === '/public/stats') return true;
  if (path === '/notifications' || path.startsWith('/notifications/')) return true;
  if (path.startsWith('/onboarding/delivery')) return true;
  return false;
}

function shouldTrack(config?: InternalAxiosRequestConfig): boolean {
  if (!config) return false;
  if (config.skipGlobalLoader) return false;
  return !isSilentPath(config.url);
}

function messageFor(config: InternalAxiosRequestConfig): string {
  if (config.loaderMessage) return config.loaderMessage;

  const path = pathOf(config.url);
  const method = (config.method ?? 'get').toLowerCase();

  if (path.includes('/jobs/fetch-live') || path.includes('/jobs/fetch-adzuna') || path.includes('/jobs/fetch-indeed')) {
    return 'Finding jobs that match your profile…';
  }
  if (path.includes('/jobs/fetch')) {
    return 'Scanning job boards for new roles…';
  }
  if (path.includes('/onboarding/delivery')) {
    return 'Preparing your career package…';
  }
  if (path.includes('/skills/apply/answer')) {
    return 'Writing your application answer…';
  }
  if (path.includes('/skills/') && method === 'post') {
    return 'Running AI skill…';
  }
  if (path.includes('/cv') && (method === 'post' || method === 'put')) {
    return 'Uploading your CV…';
  }
  if (method === 'get') return 'Loading…';
  return 'Processing your request…';
}

export type ApiLoadingSnapshot = {
  active: boolean;
  message: string;
};

export function getApiLoadingSnapshot(): ApiLoadingSnapshot {
  if (inFlight.size === 0) {
    return { active: false, message: 'Loading…' };
  }
  const values = Array.from(inFlight.values());
  const lastMessage = values.length ? values[values.length - 1]! : 'Loading…';
  return { active: true, message: lastMessage };
}

export function subscribeApiLoading(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function startApiLoading(config: InternalAxiosRequestConfig): void {
  if (!shouldTrack(config)) return;
  const id = `loader-${++seq}`;
  config.__loaderTrackId = id;
  loaderIds.set(config, id);
  inFlight.set(id, messageFor(config));
  notify();
}

export function endApiLoading(config?: InternalAxiosRequestConfig): void {
  if (!config) return;
  const id = config.__loaderTrackId ?? loaderIds.get(config);
  if (id) {
    loaderIds.delete(config);
    inFlight.delete(id);
    notify();
    return;
  }
  if (inFlight.size > 0) {
    const firstKey = inFlight.keys().next().value as string | undefined;
    if (firstKey) {
      inFlight.delete(firstKey);
      notify();
    }
  }
}

/** Clear stuck loader entries on logout or session reset. */
export function resetApiLoading(): void {
  if (inFlight.size === 0) return;
  inFlight.clear();
  notify();
}

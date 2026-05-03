/**
 * axiosInstance.ts — re-exports the shared `api` axios instance.
 *
 * G7 compatibility: the `api` instance from services/api.ts already attaches
 * X-CSRF-Token on every mutating request via its request interceptor (Batch 7a).
 * All modules in src/api/ import from here and therefore inherit that behaviour.
 *
 * G2/G3 note: new modules should be added directly to src/services/api.ts
 * rather than this directory. This file exists for backward compatibility only
 * while the migration is in progress.
 */
export { api as default } from '@/services/api';

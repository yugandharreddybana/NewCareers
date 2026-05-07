/**
 * services/index.ts — barrel export for the entire API layer.
 *
 * Pass 6 #6.011 — `src/api/` has been deleted; every typed client now lives
 * under `src/services/`. Import via either the barrel or the specific file:
 *
 *   import { jobsApi, authApi } from '@/services';
 *   import { workspaceApi }     from '@/services/workspaceApi';
 */

// Core
export * from './api';
export * from './mockApi';
export * from './skillsApi';

// Domain clients (alphabetical)
export * from './adminApi';
export * from './agentMemoryApi';
export * from './analyticsApi';
export * from './autoApplyApi';
export * from './billingApi';
export * from './cvApi';
export * from './discoveryApi';
export * from './experimentsApi';
export * from './interviewApi';
export * from './networkingApi';
export * from './notificationsApi';
export * from './outreachApi';
export * from './plannerApi';
export * from './progressApi';
export * from './referralsApi';
export * from './resumeVersionsApi';
export * from './watchlistsApi';
export * from './workspaceApi';

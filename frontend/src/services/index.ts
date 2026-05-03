/**
 * services/index.ts — central barrel export for all API service modules
 *
 * B6 fix: without this barrel, imports are verbose and inconsistent:
 *   import { billingApi } from '@/services/billingApi';
 *   import { progressApi } from '@/services/progressApi';
 *   import { outreachApi } from '@/services/outreachApi';
 *
 * With this barrel, it's one clean import:
 *   import { billingApi, progressApi, outreachApi } from '@/services';
 *
 * mockApi and the raw api/authApi/profileApi instances are intentionally
 * NOT re-exported here to avoid circular imports in AuthContext.
 */

// Core
export * from './api';            // authApi, profileApi, api (Axios instance)

// Domain services
export * from './adminApi';
export * from './agentMemoryApi';
export * from './analyticsApi';
export * from './autoApplyApi';
export * from './billingApi';
export * from './cvApi';
export * from './discoveryApi';
export * from './experimentsApi';
export * from './interviewApi';
export * from './notificationsApi';
export * from './outreachApi';
export * from './progressApi';
export * from './referralsApi';
export * from './resumeVersionsApi';
export * from './skillsApi';
export * from './watchlistsApi';

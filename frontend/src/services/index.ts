/**
 * services/index.ts — barrel export for all API modules.
 *
 * G2/G3 fix (Batch 7b): all API modules that previously lived only in
 * src/api/ are now re-exported from this barrel so pages can import
 * from a single, stable path: @/services or @/services/index.
 *
 * Old import pattern (still works, but deprecated):
 *   import { autoApplyApi } from '@/api/autoApplyApi';
 *
 * New import pattern (preferred):
 *   import { autoApplyApi } from '@/services';
 */

// Core services (already lived here)
export * from './api';
export * from './mockApi';

// Migrated from src/api/
export * from '../api/agentMemoryApi';
export * from '../api/autoApplyApi';
export * from '../api/networkingApi';
export * from '../api/outreachApi';
export * from '../api/plannerApi';
export * from '../api/progressApi';
export * from '../api/resumeVersionApi';
export * from '../api/watchlistApi';
export * from '../api/workspaceApi';

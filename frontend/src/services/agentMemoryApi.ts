/**
 * agentMemoryApi.ts — typed service layer for /api/agent-memory
 *
 * Agent memory stores persistent context facts the AI uses when
 * generating cover letters, outreach messages, and skill evaluations.
 */
import { api } from './api';

export type MemoryCategory =
  | 'skills'
  | 'experience'
  | 'preferences'
  | 'personal'
  | 'goals'
  | 'other';

export interface AgentMemory {
  id: string;
  content: string;
  category: MemoryCategory;
  isEnabled: boolean;
  source: 'manual' | 'auto' | 'cv';
  createdAt: string;
  updatedAt: string;
}

export const agentMemoryApi = {
  /** List all memories, optionally filtered by category */
  getAll: (category?: MemoryCategory) =>
    api.get<AgentMemory[]>('/agent-memory', { params: category ? { category } : {} }).then(r => r.data),

  /** Fetch a single memory entry by ID */
  getOne: (id: string) =>
    api.get<AgentMemory>(`/agent-memory/${id}`).then(r => r.data),

  /** Create or update a memory entry */
  upsert: (body: { content: string; category: MemoryCategory; id?: string }) =>
    api.post<AgentMemory>('/agent-memory', body).then(r => r.data),

  /** Update memory content */
  update: (id: string, body: { content?: string; category?: MemoryCategory }) =>
    api.put<AgentMemory>(`/agent-memory/${id}`, body).then(r => r.data),

  /** Toggle a memory entry enabled/disabled */
  toggle: (id: string) =>
    api.patch<AgentMemory>(`/agent-memory/${id}/toggle`).then(r => r.data),

  /** Permanently delete a memory entry */
  delete: (id: string) =>
    api.delete(`/agent-memory/${id}`).then(r => r.data),
};

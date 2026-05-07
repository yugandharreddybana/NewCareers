/**
 * agentMemoryApi.ts — typed client for /agent-memory.
 *
 * Pass 6 #6.011 — consolidated from src/api/agentMemoryApi.ts. The shape
 * preserved here is the one actually consumed by AgentMemoryPage.tsx
 * (CareerMemory). The earlier services/ duplicate (AgentMemory) was a
 * scaffolded stub; it is replaced by this canonical implementation.
 */
import { api } from './api';

export interface CareerMemory {
  id: string;
  category: string;
  key: string;
  value: string;
  source: string | null;
  whySuggested: string | null;
  confidence: number;
  memoryEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export type AgentMemorySearchResult = Record<string, unknown>;

export const agentMemoryApi = {
  list:     (category?: string) =>
    api.get<{ memories: CareerMemory[]; total: number }>('/agent-memory', {
      params: category ? { category } : {},
    }).then(r => r.data),
  upsert:   (body: Partial<CareerMemory>) =>
    api.post<CareerMemory>('/agent-memory', body).then(r => r.data),
  search:   (query: string) =>
    api.get<AgentMemorySearchResult[] | { results: AgentMemorySearchResult[] }>('/agent-memory/search', {
      params: { query },
    }).then(r => r.data),
  toggle:   (id: string, memoryEnabled: boolean) =>
    api.patch<CareerMemory>(`/agent-memory/${id}/toggle`, { memoryEnabled }).then(r => r.data),
  delete:   (id: string) =>
    api.delete(`/agent-memory/${id}`),
  resetAll: () =>
    api.delete('/agent-memory'),
};

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
  list: (category?: string): Promise<{ memories: CareerMemory[]; total: number }> =>
    api.get<{ memories: CareerMemory[]; total: number }>('/agent-memory', {
      params: category ? { category } : {},
    }).then(r => r.data),

  upsert: (body: Partial<CareerMemory>): Promise<CareerMemory> =>
    api.post<CareerMemory>('/agent-memory', body).then(r => r.data),

  search: (query: string): Promise<AgentMemorySearchResult[] | { results: AgentMemorySearchResult[] }> =>
    api.get<AgentMemorySearchResult[] | { results: AgentMemorySearchResult[] }>('/agent-memory/search', {
      params: { query },
    }).then(r => r.data),

  toggle: (id: string, memoryEnabled: boolean): Promise<CareerMemory> =>
    api.patch<CareerMemory>(`/agent-memory/${id}/toggle`, { memoryEnabled }).then(r => r.data),

  delete: (id: string): Promise<unknown> =>
    api.delete(`/agent-memory/${id}`).then(r => r.data),

  resetAll: (): Promise<unknown> =>
    api.delete('/agent-memory').then(r => r.data),
};

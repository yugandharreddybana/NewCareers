import axios from './axiosInstance';

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

export const agentMemoryApi = {
  list:     (category?: string) =>
    axios.get<{ memories: CareerMemory[]; total: number }>('/agent-memory', { params: category ? { category } : {} }).then(r => r.data),
  upsert:   (body: Partial<CareerMemory>) =>
    axios.post<CareerMemory>('/agent-memory', body).then(r => r.data),
  toggle:   (id: string, memoryEnabled: boolean) =>
    axios.patch<CareerMemory>(`/agent-memory/${id}/toggle`, { memoryEnabled }).then(r => r.data),
  delete:   (id: string) =>
    axios.delete(`/agent-memory/${id}`),
  resetAll: () =>
    axios.delete('/agent-memory'),
};

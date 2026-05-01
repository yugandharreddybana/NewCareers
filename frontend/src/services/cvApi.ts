/**
 * Task 138 — CV Manager API client.
 * Wired to /cv/** backend routes.
 */
import { api } from '@/services/api';

export type CvRecord = {
  id: string;
  name: string;
  originalName: string;
  url: string;
  isActive: boolean;
  sizeBytes: number;
  createdAt: string;
};

export const cvApi = {
  /** List all CVs for the authenticated user */
  list: (): Promise<CvRecord[]> =>
    api.get('/cv').then(r => r.data),

  /** Upload a new CV (multipart/form-data) */
  upload: (file: File): Promise<CvRecord> => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('/cv', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60_000,
    }).then(r => r.data);
  },

  /** Delete a CV by id */
  remove: (id: string): Promise<{ success: boolean }> =>
    api.delete(`/cv/${id}`).then(r => r.data),

  /** Set a CV as the active/default one used in skill runs */
  setActive: (id: string): Promise<CvRecord> =>
    api.post(`/cv/${id}/activate`).then(r => r.data),

  /** Download a CV as a blob */
  download: (id: string, fileName: string): Promise<void> =>
    api.get(`/cv/${id}/download`, { responseType: 'blob', timeout: 30_000 }).then(r => {
      const url = window.URL.createObjectURL(r.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    }),
};

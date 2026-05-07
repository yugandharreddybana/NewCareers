/**
 * Task 138 — CV Manager API client.
 * Wired to /cv/** backend routes.
 */
import { api } from '@/services/api';

type UserCvDto = {
  id: string;
  fileName: string;
  fileUrl: string;
  contentType: string;
  fileSize?: number;
  active: boolean;
  createdAt: string;
};

export type CvRecord = {
  id: string;
  name: string;
  url: string;
  contentType: string;
  isActive: boolean;
  sizeBytes: number | null;
  createdAt: string;
};

const toCvRecord = (cv: UserCvDto): CvRecord => ({
  id: cv.id,
  name: cv.fileName,
  url: cv.fileUrl,
  contentType: cv.contentType,
  isActive: cv.active,
  sizeBytes: cv.fileSize ?? null,
  createdAt: cv.createdAt,
});

export const cvApi = {
  /** List all CVs for the authenticated user */
  list: (): Promise<CvRecord[]> =>
    api.get<UserCvDto[]>('/cv').then(r => r.data.map(toCvRecord)),

  /** Upload a new CV (multipart/form-data) — no progress tracking */
  upload: (file: File): Promise<CvRecord> => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post<UserCvDto>('/cv/upload', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60_000,
    }).then(r => toCvRecord(r.data));
  },

  /**
   * Upload a new CV with progress reporting.
   * @param file         The file to upload.
   * @param onProgress   Called with a percentage (0-100) as the upload progresses.
   * @param signal       Optional AbortSignal; abort() cancels the request.
   */
  uploadWithProgress: (
    file: File,
    onProgress: (pct: number) => void,
    signal?: AbortSignal,
  ): Promise<CvRecord> => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post<UserCvDto>('/cv/upload', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60_000,
      ...(signal ? { signal } : {}),
      onUploadProgress: event => {
        if (!event.total) return;
        onProgress(Math.round((event.loaded / event.total) * 100));
      },
    }).then(r => toCvRecord(r.data));
  },

  /** Delete a CV by id */
  remove: (id: string): Promise<void> =>
    api.delete(`/cv/${id}`).then(() => undefined),

  /** Set a CV as the active/default one used in skill runs */
  setActive: async (id: string): Promise<CvRecord> => {
    const records = await api.patch<UserCvDto[]>(`/cv/${id}/activate`).then(r => r.data.map(toCvRecord));
    const activeCv = records.find(cv => cv.id === id && cv.isActive);
    if (!activeCv) {
      throw new Error('Activated CV was not returned by the server.');
    }
    return activeCv;
  },

  /** Download a CV as a blob */
  download: async (id: string, fileName: string): Promise<void> => {
    const { url } = await api.get<{ url: string }>(`/cv/${id}/download`, { timeout: 30_000 }).then(r => r.data);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Download failed with status ${response.status}.`);
    }
    const blob = await response.blob();
    const objectUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(objectUrl);
  },
};

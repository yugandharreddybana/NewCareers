/**
 * resumeVersionsApi.ts — typed client for /resume-versions.
 *
 * Pass 6 #6.011 — consolidated from src/api/resumeVersionApi.ts (singular).
 * The canonical filename (plural) matches the backend route. A re-export
 * under the singular name is kept below for any legacy import.
 */
import { api } from './api';

export interface ResumeVersion {
  id: string;
  name: string;
  versionNumber: number;
  source: string;
  roleTags: string[];
  isActive: boolean;
  isFavorite: boolean;
  outcomeAssociation: string | null;
  interviewCount: number;
  applicationCount: number;
  offerCount: number;
  bestForRoleType: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CompareResult {
  left: ResumeVersion;
  right: ResumeVersion;
  recommendation: string;
}

export interface RecommendResult {
  recommended: ResumeVersion;
  reason: string;
}

export interface ResumeVersionDownload {
  url: string;
  fileName: string;
}

export const resumeVersionsApi = {
  list:          ()                                                  => api.get<{ versions: ResumeVersion[]; total: number }>('/resume-versions').then(r => r.data),
  get:           (id: string)                                        => api.get<ResumeVersion>(`/resume-versions/${id}`).then(r => r.data),
  create:        (body: Partial<ResumeVersion>)                      => api.post<ResumeVersion>('/resume-versions', body).then(r => r.data),
  update:        (id: string, body: Partial<ResumeVersion>)          => api.put<ResumeVersion>(`/resume-versions/${id}`, body).then(r => r.data),
  uploadWithProgress: async (
    file: File,
    name: string,
    roleType: string | undefined,
    onProgress: (pct: number) => void,
    signal?: AbortSignal,
  ) => {
    const created = await api.post<ResumeVersion>('/resume-versions', {
      name,
      source: 'upload',
      roleTags: [],
      isActive: false,
      isFavorite: false,
      outcomeAssociation: null,
      bestForRoleType: roleType ?? null,
      notes: null,
    }).then(r => r.data);

    try {
      const form = new FormData();
      form.append('file', file);
      return await api.post<ResumeVersion>(`/resume-versions/${created.id}/upload`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        ...(signal ? { signal } : {}),
        onUploadProgress: event => {
          if (!event.total) return;
          onProgress((event.loaded / event.total) * 100);
        },
      }).then(r => r.data);
    } catch (error) {
      try {
        await api.delete(`/resume-versions/${created.id}`);
      } catch {
        // Best-effort cleanup if the file upload fails after metadata creation.
      }
      throw error;
    }
  },
  getDownloadUrl: (id: string)                                       => api.get<ResumeVersionDownload>(`/resume-versions/${id}/download`).then(r => r.data),
  deleteFile:     (id: string)                                       => api.delete(`/resume-versions/${id}/file`),
  recordOutcome: (id: string, outcome: string)                       => api.post<ResumeVersion>(`/resume-versions/${id}/outcome`, { outcome }).then(r => r.data),
  delete:        (id: string)                                        => api.delete(`/resume-versions/${id}`),
  compare:       (leftId: string, rightId: string)                   => api.get<CompareResult>(`/resume-versions/compare/${leftId}/${rightId}`).then(r => r.data),
  recommend:     (roleType?: string)                                 => api.get<RecommendResult>('/resume-versions/recommend', { params: roleType ? { roleType } : {} }).then(r => r.data),
};

/** Singular alias kept for any legacy import: `import { resumeVersionApi } from '...'` */
export const resumeVersionApi = resumeVersionsApi;

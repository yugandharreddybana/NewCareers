/**
 * resumeVersionsApi.ts — typed service layer for /api/resume-versions
 *
 * Handles version creation (text or file upload), diff comparison,
 * AI-powered best-version recommendation, and outcome tracking.
 */
import { api } from './api';

export interface ResumeVersion {
  id: string;
  label: string;
  targetRole: string | null;
  fileUrl: string | null;
  content: string | null;
  isActive: boolean;
  createdAt: string;
  outcome: 'unknown' | 'interview' | 'offer' | 'rejected' | null;
  applicationCount: number;
}

export interface ResumeVersionDiff {
  leftId: string;
  rightId: string;
  sections: {
    name: string;
    leftText: string;
    rightText: string;
    changeType: 'added' | 'removed' | 'modified' | 'unchanged';
  }[];
}

export const resumeVersionsApi = {
  getAll: () =>
    api.get<ResumeVersion[]>('/resume-versions').then(r => r.data),

  create: (body: { label: string; targetRole?: string; content?: string }) =>
    api.post<ResumeVersion>('/resume-versions', body).then(r => r.data),

  /** Upload a PDF/DOCX file as a new resume version */
  upload: (file: File, label: string, targetRole?: string) => {
    const fd = new FormData();
    fd.append('resume', file);
    fd.append('label', label);
    if (targetRole) fd.append('targetRole', targetRole);
    return api.post<ResumeVersion>('/resume-versions/upload', fd).then(r => r.data);
  },

  compare: (leftId: string, rightId: string) =>
    api.get<ResumeVersionDiff>(`/resume-versions/compare/${leftId}/${rightId}`).then(r => r.data),

  recommend: () =>
    api.get<{ recommendedId: string; reason: string }>('/resume-versions/recommend').then(r => r.data),

  getOne: (id: string) =>
    api.get<ResumeVersion>(`/resume-versions/${id}`).then(r => r.data),

  update: (id: string, body: Partial<Pick<ResumeVersion, 'label' | 'targetRole' | 'content'>>) =>
    api.put<ResumeVersion>(`/resume-versions/${id}`, body).then(r => r.data),

  recordOutcome: (id: string, outcome: ResumeVersion['outcome']) =>
    api.post(`/resume-versions/${id}/outcome`, { outcome }).then(r => r.data),

  delete: (id: string) =>
    api.delete(`/resume-versions/${id}`).then(r => r.data),
};

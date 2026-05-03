import axios from './axiosInstance';

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

export const resumeVersionApi = {
  list:          ()                              => axios.get<{ versions: ResumeVersion[]; total: number }>('/resume-versions').then(r => r.data),
  get:           (id: string)                    => axios.get<ResumeVersion>(`/resume-versions/${id}`).then(r => r.data),
  create:        (body: Partial<ResumeVersion>)  => axios.post<ResumeVersion>('/resume-versions', body).then(r => r.data),
  update:        (id: string, body: Partial<ResumeVersion>) => axios.put<ResumeVersion>(`/resume-versions/${id}`, body).then(r => r.data),
  recordOutcome: (id: string, outcome: string)   => axios.post<ResumeVersion>(`/resume-versions/${id}/outcome`, { outcome }).then(r => r.data),
  delete:        (id: string)                    => axios.delete(`/resume-versions/${id}`),
  compare:       (leftId: string, rightId: string) => axios.get<CompareResult>(`/resume-versions/compare/${leftId}/${rightId}`).then(r => r.data),
  recommend:     (roleType?: string)             => axios.get<RecommendResult>('/resume-versions/recommend', { params: roleType ? { roleType } : {} }).then(r => r.data),
};

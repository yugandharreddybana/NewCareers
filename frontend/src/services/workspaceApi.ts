/**
 * workspaceApi.ts — typed client for /workspaces.
 *
 * Pass 6 #6.011 — moved from src/api/. No previous services/ counterpart;
 * this is the single source of truth.
 */
import { api } from './api';

export interface WorkspaceMember {
  id: string;
  userId: string | null;
  invitedEmail: string | null;
  role: 'owner' | 'mentor' | 'reviewer';
  inviteStatus: 'pending' | 'accepted' | 'declined';
  joinedAt: string | null;
}

export interface WorkspaceNote {
  id: string;
  workspaceId: string;
  authorId: string;
  targetType: 'cover_letter' | 'cv_section' | 'job' | 'general' | null;
  targetId: string | null;
  content: string;
  parentNoteId: string | null;
  resolved: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Workspace {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  members: WorkspaceMember[];
}

export interface CreateWorkspacePayload {
  name: string;
  description?: string;
}

export interface InvitePayload {
  email: string;
  role: 'mentor' | 'reviewer';
}

export interface AddNotePayload {
  targetType?: string;
  targetId?: string;
  content: string;
  parentNoteId?: string;
}

export const workspaceApi = {
  create: (payload: CreateWorkspacePayload) =>
    api.post<Workspace>('/workspaces', payload).then(r => r.data),

  list: () =>
    api.get<Workspace[]>('/workspaces').then(r => r.data),

  get: (id: string) =>
    api.get<Workspace>(`/workspaces/${id}`).then(r => r.data),

  invite: (id: string, payload: InvitePayload) =>
    api.post<WorkspaceMember>(`/workspaces/${id}/invite`, payload).then(r => r.data),

  acceptInvite: (token: string) =>
    api.post<WorkspaceMember>(`/workspaces/invite/accept?token=${token}`).then(r => r.data),

  addNote: (id: string, payload: AddNotePayload) =>
    api.post<WorkspaceNote>(`/workspaces/${id}/notes`, payload).then(r => r.data),

  getNotes: (id: string) =>
    api.get<WorkspaceNote[]>(`/workspaces/${id}/notes`).then(r => r.data),
};

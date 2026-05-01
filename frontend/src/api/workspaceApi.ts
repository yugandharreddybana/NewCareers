// Section 3.4 — typed API client for workspace collaboration
import axios from './axiosInstance';

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
    axios.post<Workspace>('/workspaces', payload).then(r => r.data),

  list: () =>
    axios.get<Workspace[]>('/workspaces').then(r => r.data),

  get: (id: string) =>
    axios.get<Workspace>(`/workspaces/${id}`).then(r => r.data),

  invite: (id: string, payload: InvitePayload) =>
    axios.post<WorkspaceMember>(`/workspaces/${id}/invite`, payload).then(r => r.data),

  acceptInvite: (token: string) =>
    axios.post<WorkspaceMember>(`/workspaces/invite/accept?token=${token}`).then(r => r.data),

  addNote: (id: string, payload: AddNotePayload) =>
    axios.post<WorkspaceNote>(`/workspaces/${id}/notes`, payload).then(r => r.data),

  getNotes: (id: string) =>
    axios.get<WorkspaceNote[]>(`/workspaces/${id}/notes`).then(r => r.data),
};

import axios from '@/lib/axios';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ContactType = 'recruiter' | 'hiring_manager' | 'alumni' | 'referral';
export type RelationshipTemperature = 'cold' | 'warm' | 'hot';
export type ContactPipelineStage =
  | 'identified'
  | 'connected'
  | 'outreached'
  | 'replied'
  | 'meeting_scheduled'
  | 'closed';
export type InteractionType = 'linkedin_message' | 'email' | 'call' | 'meeting' | 'follow_up';
export type InteractionOutcome = 'no_response' | 'positive' | 'negative' | 'meeting_booked';

export interface InteractionSummary {
  id: string;
  interactionType: InteractionType;
  outcome: InteractionOutcome | null;
  nextStep: string | null;
  nextStepDueDate: string | null;
  createdAt: string;
}

export interface NetworkContact {
  id: string;
  name: string;
  email: string | null;
  linkedinUrl: string | null;
  company: string | null;
  roleTitle: string | null;
  contactType: ContactType;
  relationshipTemperature: RelationshipTemperature;
  pipelineStage: ContactPipelineStage;
  notes: string | null;
  linkedUserJobId: string | null;
  createdAt: string;
  updatedAt: string;
  lastInteraction: InteractionSummary | null;
}

export interface InteractionResponse {
  id: string;
  contactId: string;
  interactionType: InteractionType;
  outcome: InteractionOutcome | null;
  notes: string | null;
  nextStep: string | null;
  nextStepDueDate: string | null;
  createdAt: string;
}

export interface CreateContactPayload {
  name: string;
  email?: string;
  linkedinUrl?: string;
  company?: string;
  roleTitle?: string;
  contactType?: ContactType;
  relationshipTemperature?: RelationshipTemperature;
  pipelineStage?: ContactPipelineStage;
  notes?: string;
  linkedUserJobId?: string;
}

export interface LogInteractionPayload {
  interactionType: InteractionType;
  outcome?: InteractionOutcome;
  notes?: string;
  nextStep?: string;
  nextStepDueDate?: string;
}

// ─── API calls ────────────────────────────────────────────────────────────────

export const networkingApi = {
  createContact: (payload: CreateContactPayload) =>
    axios.post<NetworkContact>('/networking/contact', payload).then(r => r.data),

  getContacts: (type?: ContactType) =>
    axios
      .get<{ contacts: NetworkContact[]; total: number }>('/networking/contacts', {
        params: type ? { type } : {},
      })
      .then(r => r.data),

  getOverdue: () =>
    axios.get<InteractionResponse[]>('/networking/contacts/overdue').then(r => r.data),

  logInteraction: (contactId: string, payload: LogInteractionPayload) =>
    axios
      .post<InteractionResponse>(`/networking/contact/${contactId}/log-interaction`, payload)
      .then(r => r.data),

  deleteContact: (contactId: string) =>
    axios.delete(`/networking/contact/${contactId}`).then(r => r.data),
};

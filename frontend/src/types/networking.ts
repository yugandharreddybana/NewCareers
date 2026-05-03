/**
 * networking.ts — shared networking domain types
 *
 * D4 fix: networking had no shared type contracts.
 */

export type ContactRelationship =
  | 'recruiter'
  | 'hiring_manager'
  | 'peer'
  | 'mentor'
  | 'referral'
  | 'other';

export type ContactStatus =
  | 'new'
  | 'contacted'
  | 'in_conversation'
  | 'warm'
  | 'cold'
  | 'converted';

export interface NetworkContact {
  id: string;
  name: string;
  title?: string;
  company?: string;
  email?: string;
  linkedinUrl?: string;
  relationship: ContactRelationship;
  status: ContactStatus;
  notes?: string;
  lastContactedAt?: string | null;
  createdAt: string;
}

export interface NetworkingStats {
  totalContacts: number;
  contactedThisWeek: number;
  warmContacts: number;
  pendingFollowUps: number;
}

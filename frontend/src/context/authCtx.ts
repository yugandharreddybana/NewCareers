import { createContext, useContext } from 'react';
import type { User, Profile } from '@/types';
import type { SignupConsents } from '@/lib/pendingSignup';

export interface OnboardingWorkEntry {
  jobTitle: string;
  companyName: string;
  startDate: string;
  endDate: string;
  current: boolean;
  description: string;
  location?: string;
}

export interface OnboardingEducationEntry {
  schoolName: string;
  degree: string;
  degreeLevel?: string;
  degreeTitle?: string;
  fieldOfStudy: string;
  startYear: string;
  endYear: string;
  graduationYear: string;
  location?: string;
}

export interface UpdateProfilePayload {
  name?: string;
  goalTitle?: string;
  targetRoles?: string[];
  techStack?: string[];
  sectors?: string[];
  location?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  availability?: string;
  experienceLevel?: string;
  sponsorshipRequired?: boolean;
  openToRemote?: boolean;
  remotePolicy?: string;
  hybridOnsiteDays?: string;
  workExperience?: OnboardingWorkEntry[];
  education?: OnboardingEducationEntry[];
  onboarded?: boolean;
  workTypes?: string[];
  goalLocation?: string;
  minMatchPercent?: number;
  freshnessHours?: number;
  jobDomain?: string;
  linkedInUrl?: string;
  githubUrl?: string;
  websiteUrl?: string;
}

export interface SignUpInput {
  name: string;
  email: string;
  signupIntentId: string;
  consents: {
    termsAccepted: boolean;
    aiProcessingAccepted: boolean;
    marketingAccepted: boolean;
    analyticsAccepted: boolean;
  };
  emailVerificationId?: string;
}

export interface AuthCtxValue {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  actionLoading: boolean;
  setUser: (u: User | null) => void;
  refresh: () => Promise<User | null>;
  signOut: () => Promise<void>;
  signIn: (
    email: string,
    password: string,
    options?: { rememberMe?: boolean; captchaToken?: string },
  ) => Promise<User>;
  completeTwoFactor: (
    challengeToken: string,
    code: string,
    rememberMe?: boolean,
  ) => Promise<User>;
  signInWithGoogle: (
    idToken: string,
    rememberMe?: boolean,
    consents?: SignupConsents,
    captchaToken?: string,
  ) => Promise<User>;
  signUp: (input: SignUpInput) => Promise<User>;
  updateProfile: (data: UpdateProfilePayload) => Promise<Profile>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (email: string, otp: string, newPassword: string) => Promise<void>;
}

export const AuthCtx = createContext<AuthCtxValue | null>(null);

export function useAuth(): AuthCtxValue {
  const v = useContext(AuthCtx);
  if (!v) throw new Error('useAuth must be inside <AuthProvider>');
  return v;
}

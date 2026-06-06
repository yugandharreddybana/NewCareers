import { api } from './api';

export const CONSENT_VERSION = 'v1.0';

export type ConsentType = 'ESSENTIAL' | 'AI_PROCESSING' | 'MARKETING' | 'ANALYTICS';

export interface ConsentTypeStatus {
  accepted: boolean;
  version: string;
  acceptedAt: string | null;
}

export interface ConsentStatusResponse {
  essential: ConsentTypeStatus;
  aiProcessing: ConsentTypeStatus;
  marketing: ConsentTypeStatus;
  analytics: ConsentTypeStatus;
}

export interface UpdateConsentBody {
  consentType: ConsentType;
  version: string;
  accepted: boolean;
}

export const consentApi = {
  getConsents: (): Promise<ConsentStatusResponse> =>
    api.get<ConsentStatusResponse>('/consents').then(r => r.data),

  updateConsent: (type: ConsentType, accepted: boolean): Promise<void> =>
    api
      .post('/consents', {
        consentType: type,
        version: CONSENT_VERSION,
        accepted,
      } satisfies UpdateConsentBody)
      .then(() => undefined),
};

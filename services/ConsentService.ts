import { Capacitor } from '@capacitor/core';
import { auth } from '../firebase';
import {
  AdminConsentsOverviewResponse,
  ConsentPlatform,
  ConsentStatusResponse,
  OptionalConsents,
  UserConsentRecord,
} from '../types';

export const CLIENT_CONSENT_VERSION = '2026.1';
export const CLIENT_TERMS_VERSION = '2026.1';
export const CLIENT_PRIVACY_VERSION = '2026.1';

export function detectConsentPlatform(): ConsentPlatform {
  try {
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
      return 'android';
    }
  } catch {
    // Fallback to web when Capacitor bridge is not available
  }
  return 'web';
}

async function getAuthHeaders(json = true): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  if (json) {
    headers['Content-Type'] = 'application/json';
  }
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Authentification requise.');
  }
  const token = await currentUser.getIdToken();
  headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function parseJsonResponse<T>(resp: Response): Promise<T> {
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw Object.assign(
      new Error(data.error || `Erreur serveur (${resp.status})`),
      {
        status: resp.status,
        code: data.code,
      }
    );
  }
  return data as T;
}

export interface AdminUserConsentDetailResponse {
  status: ConsentStatusResponse;
  record: UserConsentRecord | null;
  email: string | null;
  displayName: string | null;
}

export const consentService = {
  async getConsentStatus(): Promise<ConsentStatusResponse> {
    const headers = await getAuthHeaders(false);
    const resp = await fetch('/api/user/consent-status', {
      method: 'GET',
      headers,
      cache: 'no-store',
    });
    const data = await parseJsonResponse<{ consent: ConsentStatusResponse }>(resp);
    return data.consent;
  },

  async acceptConsent(payload: {
    acceptedRequired: boolean;
    optionalConsents: OptionalConsents;
    consentVersion?: string;
    termsVersion?: string;
    privacyVersion?: string;
  }): Promise<{ accepted: boolean; alreadyAccepted: boolean; consent: ConsentStatusResponse }> {
    const headers = await getAuthHeaders(true);
    const platform = detectConsentPlatform();
    const resp = await fetch('/api/user/accept-consent', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        acceptedRequired: payload.acceptedRequired,
        platform,
        consentVersion: payload.consentVersion || CLIENT_CONSENT_VERSION,
        termsVersion: payload.termsVersion || CLIENT_TERMS_VERSION,
        privacyVersion: payload.privacyVersion || CLIENT_PRIVACY_VERSION,
        optionalConsents: payload.optionalConsents,
      }),
    });
    return parseJsonResponse<{
      accepted: boolean;
      alreadyAccepted: boolean;
      consent: ConsentStatusResponse;
    }>(resp);
  },

  async refuseConsent(): Promise<{ refused: boolean; consent: ConsentStatusResponse }> {
    const headers = await getAuthHeaders(true);
    const platform = detectConsentPlatform();
    const resp = await fetch('/api/user/refuse-consent', {
      method: 'POST',
      headers,
      body: JSON.stringify({ platform }),
    });
    return parseJsonResponse<{ refused: boolean; consent: ConsentStatusResponse }>(resp);
  },

  async updateOptionalConsents(
    optionalConsents: Partial<OptionalConsents>
  ): Promise<ConsentStatusResponse> {
    const headers = await getAuthHeaders(true);
    const platform = detectConsentPlatform();
    const resp = await fetch('/api/user/consent-preferences', {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        platform,
        optionalConsents,
      }),
    });
    const data = await parseJsonResponse<{ consent: ConsentStatusResponse }>(resp);
    return data.consent;
  },

  async withdrawConsent(): Promise<ConsentStatusResponse> {
    const headers = await getAuthHeaders(true);
    const platform = detectConsentPlatform();
    const resp = await fetch('/api/user/withdraw-consent', {
      method: 'POST',
      headers,
      body: JSON.stringify({ platform }),
    });
    const data = await parseJsonResponse<{ withdrawn: boolean; consent: ConsentStatusResponse }>(resp);
    return data.consent;
  },

  async adminGetConsents(params?: {
    status?: string;
    platform?: string;
    search?: string;
  }): Promise<AdminConsentsOverviewResponse> {
    const headers = await getAuthHeaders(false);
    const qs = new URLSearchParams();
    if (params?.status && params.status !== 'ALL') qs.set('status', params.status);
    if (params?.platform && params.platform !== 'ALL') qs.set('platform', params.platform);
    if (params?.search && params.search.trim()) qs.set('search', params.search.trim());
    const q = qs.toString();
    const resp = await fetch(`/api/super-admin/consents${q ? `?${q}` : ''}`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });
    return parseJsonResponse<AdminConsentsOverviewResponse>(resp);
  },

  async adminGetUserConsentDetail(uid: string): Promise<AdminUserConsentDetailResponse> {
    const headers = await getAuthHeaders(false);
    const resp = await fetch(`/api/super-admin/consents/${encodeURIComponent(uid)}`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });
    return parseJsonResponse<AdminUserConsentDetailResponse>(resp);
  },
};

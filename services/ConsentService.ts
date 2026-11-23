import { Capacitor } from '@capacitor/core';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import {
  AdminConsentsOverviewResponse,
  ConsentPlatform,
  ConsentStatus,
  ConsentStatusResponse,
  OptionalConsents,
  UserConsentRecord,
} from '../types';
import {
  ApiNonJsonResponseError,
  isBackendUnavailableError,
  isNativeMobilePlatform,
  markBackendApiUnavailable,
  parseStrictJsonResponse,
  resolveApiUrl,
} from '../utils/apiClient';

export const CLIENT_CONSENT_VERSION = '2026.1';
export const CLIENT_TERMS_VERSION = '2026.1';
export const CLIENT_PRIVACY_VERSION = '2026.1';

const CONSENT_CACHE_PREFIX = 'vruguard_consent_cache_';
const VALID_CONSENT_STATUSES: ConsentStatus[] = ['pending', 'accepted', 'refused', 'withdrawn'];

interface StoredConsentDoc {
  userId: string;
  email: string | null;
  status: ConsentStatus;
  consentVersion: string;
  termsVersion: string;
  privacyVersion: string;
  acceptedAt: number | null;
  refusedAt: number | null;
  withdrawnAt: number | null;
  platform: ConsentPlatform;
  optionalConsents: OptionalConsents;
  updatedAt: number;
}

interface CachedConsentEnvelope {
  uid: string;
  consent: ConsentStatusResponse;
}

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

export function isValidConsentStatusResponse(v: unknown): v is ConsentStatusResponse {
  if (!v || typeof v !== 'object') return false;
  const obj = v as Record<string, unknown>;
  if (typeof obj.accessAllowed !== 'boolean') return false;
  if (typeof obj.requiresConsent !== 'boolean') return false;
  if (typeof obj.consentStatus !== 'string' || !VALID_CONSENT_STATUSES.includes(obj.consentStatus as ConsentStatus)) {
    return false;
  }
  if (!obj.optionalConsents || typeof obj.optionalConsents !== 'object') return false;
  const opt = obj.optionalConsents as Record<string, unknown>;
  if (typeof opt.notifications !== 'boolean' || typeof opt.locationEnhancements !== 'boolean') {
    return false;
  }
  return true;
}

export function buildDefaultPendingConsent(platform: ConsentPlatform = detectConsentPlatform()): ConsentStatusResponse {
  return {
    consentStatus: 'pending',
    consentVersion: null,
    termsVersion: null,
    privacyVersion: null,
    currentConsentVersion: CLIENT_CONSENT_VERSION,
    currentTermsVersion: CLIENT_TERMS_VERSION,
    currentPrivacyVersion: CLIENT_PRIVACY_VERSION,
    acceptedAt: null,
    refusedAt: null,
    withdrawnAt: null,
    platform,
    accessAllowed: false,
    requiresConsent: true,
    optionalConsents: {
      notifications: false,
      locationEnhancements: false,
    },
    historyCount: 0,
    updatedAt: null,
  };
}

function normalizeOptionalConsents(input?: Partial<OptionalConsents> | null): OptionalConsents {
  return {
    notifications: Boolean(input?.notifications),
    locationEnhancements: Boolean(input?.locationEnhancements),
  };
}

function storedDocToConsentStatus(data: Partial<StoredConsentDoc> | null | undefined): ConsentStatusResponse {
  if (!data || typeof data !== 'object') {
    return buildDefaultPendingConsent();
  }
  const status: ConsentStatus = VALID_CONSENT_STATUSES.includes(data.status as ConsentStatus)
    ? (data.status as ConsentStatus)
    : 'pending';
  const consentVersion = typeof data.consentVersion === 'string' ? data.consentVersion : null;
  const termsVersion = typeof data.termsVersion === 'string' ? data.termsVersion : null;
  const privacyVersion = typeof data.privacyVersion === 'string' ? data.privacyVersion : null;
  const acceptedAt = typeof data.acceptedAt === 'number' && data.acceptedAt > 0 ? data.acceptedAt : null;
  const refusedAt = typeof data.refusedAt === 'number' && data.refusedAt > 0 ? data.refusedAt : null;
  const withdrawnAt = typeof data.withdrawnAt === 'number' && data.withdrawnAt > 0 ? data.withdrawnAt : null;
  const updatedAt = typeof data.updatedAt === 'number' && data.updatedAt > 0 ? data.updatedAt : null;
  const platform: ConsentPlatform = data.platform === 'android' ? 'android' : 'web';

  const matchesCurrentVersions =
    consentVersion === CLIENT_CONSENT_VERSION &&
    termsVersion === CLIENT_TERMS_VERSION &&
    privacyVersion === CLIENT_PRIVACY_VERSION;

  const accessAllowed =
    status === 'accepted' && matchesCurrentVersions && acceptedAt !== null;

  return {
    consentStatus: status,
    consentVersion,
    termsVersion,
    privacyVersion,
    currentConsentVersion: CLIENT_CONSENT_VERSION,
    currentTermsVersion: CLIENT_TERMS_VERSION,
    currentPrivacyVersion: CLIENT_PRIVACY_VERSION,
    acceptedAt,
    refusedAt,
    withdrawnAt,
    platform,
    accessAllowed,
    requiresConsent: !accessAllowed,
    optionalConsents: normalizeOptionalConsents(data.optionalConsents),
    historyCount: updatedAt ? 1 : 0,
    updatedAt,
  };
}

function readVerifiedCachedConsent(uid: string): ConsentStatusResponse | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(`${CONSENT_CACHE_PREFIX}${uid}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedConsentEnvelope;
    if (!parsed || parsed.uid !== uid || !isValidConsentStatusResponse(parsed.consent)) {
      return null;
    }
    const c = parsed.consent;
    if (c.consentStatus === 'accepted') {
      const validAccepted =
        c.accessAllowed === true &&
        c.requiresConsent === false &&
        c.consentVersion === CLIENT_CONSENT_VERSION &&
        c.termsVersion === CLIENT_TERMS_VERSION &&
        c.privacyVersion === CLIENT_PRIVACY_VERSION &&
        typeof c.acceptedAt === 'number' &&
        c.acceptedAt > 0;
      return validAccepted ? c : null;
    }
    if (c.consentStatus === 'refused' || c.consentStatus === 'withdrawn') {
      return {
        ...c,
        accessAllowed: false,
        requiresConsent: true,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function writeConsentCache(uid: string, consent: ConsentStatusResponse): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    if (!isValidConsentStatusResponse(consent)) return;
    if (consent.consentStatus === 'pending') {
      window.localStorage.removeItem(`${CONSENT_CACHE_PREFIX}${uid}`);
      return;
    }
    const payload: CachedConsentEnvelope = { uid, consent };
    window.localStorage.setItem(`${CONSENT_CACHE_PREFIX}${uid}`, JSON.stringify(payload));
  } catch {
    // ignore storage quota errors
  }
}

export function isOfflineOrNetworkError(err: unknown): boolean {
  const code = String((err as any)?.code || '').toLowerCase();
  const msg = String(err instanceof Error ? err.message : err || '').toLowerCase();
  return (
    code === 'unavailable' ||
    msg.includes('client is offline') ||
    msg.includes('offline') ||
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('load failed')
  );
}

async function mirrorConsentToFirestore(
  uid: string,
  email: string | null,
  status: ConsentStatusResponse
): Promise<void> {
  if (status.consentStatus === 'pending') return;
  const docPayload: StoredConsentDoc = {
    userId: uid,
    email,
    status: status.consentStatus,
    consentVersion: status.consentVersion || CLIENT_CONSENT_VERSION,
    termsVersion: status.termsVersion || CLIENT_TERMS_VERSION,
    privacyVersion: status.privacyVersion || CLIENT_PRIVACY_VERSION,
    acceptedAt: status.acceptedAt ?? null,
    refusedAt: status.refusedAt ?? null,
    withdrawnAt: status.withdrawnAt ?? null,
    platform: status.platform || detectConsentPlatform(),
    optionalConsents: normalizeOptionalConsents(status.optionalConsents),
    updatedAt: status.updatedAt || Date.now(),
  };
  await setDoc(doc(db, 'user_consents', uid), docPayload);
}

async function readConsentFromFirestore(uid: string): Promise<ConsentStatusResponse> {
  const snap = await getDoc(doc(db, 'user_consents', uid));
  if (!snap.exists()) {
    return buildDefaultPendingConsent();
  }
  const normalized = storedDocToConsentStatus(snap.data() as Partial<StoredConsentDoc>);
  writeConsentCache(uid, normalized);
  return normalized;
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

export interface AdminUserConsentDetailResponse {
  status: ConsentStatusResponse;
  record: UserConsentRecord | null;
  email: string | null;
  displayName: string | null;
}

export const consentService = {
  async getConsentStatus(): Promise<ConsentStatusResponse> {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('Authentification requise.');
    }

    const apiUrl = resolveApiUrl('/api/user/consent-status');
    if (apiUrl !== null) {
      try {
        const headers = await getAuthHeaders(false);
        const resp = await fetch(apiUrl, {
          method: 'GET',
          headers,
          cache: 'no-store',
        });
        const data = await parseStrictJsonResponse<{ consent?: unknown }>(resp);
        if (!isValidConsentStatusResponse(data.consent)) {
          throw new ApiNonJsonResponseError(
            'Structure de consentement invalide reçue du serveur.',
            resp.status,
            resp.headers.get('content-type') || ''
          );
        }
        writeConsentCache(currentUser.uid, data.consent);
        if (data.consent.consentStatus !== 'pending') {
          mirrorConsentToFirestore(currentUser.uid, currentUser.email, data.consent).catch(() => {});
        }
        return data.consent;
      } catch (err) {
        if ((err as any)?.status === 404 || err instanceof ApiNonJsonResponseError) {
          markBackendApiUnavailable();
        }
        const canFallbackToFirestore =
          isNativeMobilePlatform() || isBackendUnavailableError(err);
        if (!canFallbackToFirestore) {
          throw err;
        }
      }
    }

    // Native standalone APK or backend fallback: read Firestore proof first, then offline cache ONLY when offline
    try {
      const firestoreStatus = await readConsentFromFirestore(currentUser.uid);
      if (firestoreStatus.consentStatus !== 'pending') {
        return firestoreStatus;
      }
      const cached = readVerifiedCachedConsent(currentUser.uid);
      if (cached && cached.accessAllowed) {
        mirrorConsentToFirestore(currentUser.uid, currentUser.email, cached).catch(() => {});
        return cached;
      }
      return firestoreStatus;
    } catch (fsErr) {
      if (isOfflineOrNetworkError(fsErr)) {
        const cached = readVerifiedCachedConsent(currentUser.uid);
        if (cached) {
          return cached;
        }
      }
      return buildDefaultPendingConsent();
    }
  },

  async acceptConsent(payload: {
    acceptedRequired: boolean;
    optionalConsents: OptionalConsents;
    consentVersion?: string;
    termsVersion?: string;
    privacyVersion?: string;
  }): Promise<{ accepted: boolean; alreadyAccepted: boolean; consent: ConsentStatusResponse }> {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('Authentification requise.');
    }
    if (payload.acceptedRequired !== true) {
      throw new Error(
        'Vous devez accepter obligatoirement les Conditions Générales d’Utilisation et la Politique de Confidentialité.'
      );
    }

    const platform = detectConsentPlatform();
    const consentVersion = payload.consentVersion || CLIENT_CONSENT_VERSION;
    const termsVersion = payload.termsVersion || CLIENT_TERMS_VERSION;
    const privacyVersion = payload.privacyVersion || CLIENT_PRIVACY_VERSION;
    const optionalConsents = normalizeOptionalConsents(payload.optionalConsents);

    const apiUrl = resolveApiUrl('/api/user/accept-consent');
    if (apiUrl !== null) {
      try {
        const headers = await getAuthHeaders(true);
        const resp = await fetch(apiUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            acceptedRequired: true,
            platform,
            consentVersion,
            termsVersion,
            privacyVersion,
            optionalConsents,
          }),
        });
        const data = await parseStrictJsonResponse<{
          accepted?: boolean;
          alreadyAccepted?: boolean;
          consent?: unknown;
        }>(resp);

        if (!isValidConsentStatusResponse(data.consent) || data.consent.accessAllowed !== true) {
          throw new ApiNonJsonResponseError(
            'Réponse serveur incomplète : statut de consentement manquant.',
            resp.status,
            resp.headers.get('content-type') || ''
          );
        }

        writeConsentCache(currentUser.uid, data.consent);
        mirrorConsentToFirestore(currentUser.uid, currentUser.email, data.consent).catch(() => {});
        return {
          accepted: true,
          alreadyAccepted: Boolean(data.alreadyAccepted),
          consent: data.consent,
        };
      } catch (err) {
        if ((err as any)?.status === 404 || err instanceof ApiNonJsonResponseError) {
          markBackendApiUnavailable();
        }
        if (!isBackendUnavailableError(err)) {
          throw err;
        }
      }
    }

    // Standalone Android APK (or native API fallback): require live network & verified Firestore persistence
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new Error(
        'Connexion Internet requise pour enregistrer et horodater votre consentement.'
      );
    }

    const now = Date.now();
    const docPayload: StoredConsentDoc = {
      userId: currentUser.uid,
      email: currentUser.email || null,
      status: 'accepted',
      consentVersion,
      termsVersion,
      privacyVersion,
      acceptedAt: now,
      refusedAt: null,
      withdrawnAt: null,
      platform,
      optionalConsents,
      updatedAt: now,
    };

    try {
      await setDoc(doc(db, 'user_consents', currentUser.uid), docPayload);
    } catch (fsErr) {
      if (isOfflineOrNetworkError(fsErr)) {
        throw new Error(
          'Connexion Internet indisponible. Impossible de valider le consentement pour le moment.'
        );
      }
      throw new Error(
        'Échec de l’enregistrement sécurisé du consentement. Veuillez réessayer.'
      );
    }

    const verifiedConsent = storedDocToConsentStatus(docPayload);
    writeConsentCache(currentUser.uid, verifiedConsent);
    return {
      accepted: true,
      alreadyAccepted: false,
      consent: verifiedConsent,
    };
  },

  async refuseConsent(): Promise<{ refused: boolean; consent: ConsentStatusResponse }> {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('Authentification requise.');
    }

    const platform = detectConsentPlatform();
    const apiUrl = resolveApiUrl('/api/user/refuse-consent');
    if (apiUrl !== null) {
      try {
        const headers = await getAuthHeaders(true);
        const resp = await fetch(apiUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({ platform }),
        });
        const data = await parseStrictJsonResponse<{
          refused?: boolean;
          consent?: unknown;
        }>(resp);
        if (!isValidConsentStatusResponse(data.consent)) {
          throw new ApiNonJsonResponseError(
            'Réponse serveur invalide lors du refus de consentement.',
            resp.status,
            resp.headers.get('content-type') || ''
          );
        }
        writeConsentCache(currentUser.uid, data.consent);
        mirrorConsentToFirestore(currentUser.uid, currentUser.email, data.consent).catch(() => {});
        return { refused: true, consent: data.consent };
      } catch (err) {
        if ((err as any)?.status === 404 || err instanceof ApiNonJsonResponseError) {
          markBackendApiUnavailable();
        }
        if (!isBackendUnavailableError(err)) {
          throw err;
        }
      }
    }

    const now = Date.now();
    const docPayload: StoredConsentDoc = {
      userId: currentUser.uid,
      email: currentUser.email || null,
      status: 'refused',
      consentVersion: CLIENT_CONSENT_VERSION,
      termsVersion: CLIENT_TERMS_VERSION,
      privacyVersion: CLIENT_PRIVACY_VERSION,
      acceptedAt: null,
      refusedAt: now,
      withdrawnAt: null,
      platform,
      optionalConsents: {
        notifications: false,
        locationEnhancements: false,
      },
      updatedAt: now,
    };

    try {
      await setDoc(doc(db, 'user_consents', currentUser.uid), docPayload);
    } catch {
      // Even if offline during refusal, strictly lock access locally
    }

    const refusedConsent = storedDocToConsentStatus(docPayload);
    writeConsentCache(currentUser.uid, refusedConsent);
    return { refused: true, consent: refusedConsent };
  },

  async updateOptionalConsents(
    optionalConsents: Partial<OptionalConsents>
  ): Promise<ConsentStatusResponse> {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('Authentification requise.');
    }

    const platform = detectConsentPlatform();
    const apiUrl = resolveApiUrl('/api/user/consent-preferences');
    if (apiUrl !== null) {
      try {
        const headers = await getAuthHeaders(true);
        const resp = await fetch(apiUrl, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            platform,
            optionalConsents,
          }),
        });
        const data = await parseStrictJsonResponse<{ consent?: unknown }>(resp);
        if (!isValidConsentStatusResponse(data.consent)) {
          throw new ApiNonJsonResponseError(
            'Réponse serveur invalide lors de la mise à jour des préférences.',
            resp.status,
            resp.headers.get('content-type') || ''
          );
        }
        writeConsentCache(currentUser.uid, data.consent);
        mirrorConsentToFirestore(currentUser.uid, currentUser.email, data.consent).catch(() => {});
        return data.consent;
      } catch (err) {
        if ((err as any)?.status === 404 || err instanceof ApiNonJsonResponseError) {
          markBackendApiUnavailable();
        }
        if (!isBackendUnavailableError(err)) {
          throw err;
        }
      }
    }

    const current = await this.getConsentStatus();
    if (!current.accessAllowed) {
      throw new Error('Acceptez d’abord les conditions requises avant de modifier vos préférences.');
    }

    const now = Date.now();
    const mergedOptional: OptionalConsents = {
      notifications:
        typeof optionalConsents.notifications === 'boolean'
          ? optionalConsents.notifications
          : current.optionalConsents.notifications,
      locationEnhancements:
        typeof optionalConsents.locationEnhancements === 'boolean'
          ? optionalConsents.locationEnhancements
          : current.optionalConsents.locationEnhancements,
    };

    const docPayload: StoredConsentDoc = {
      userId: currentUser.uid,
      email: currentUser.email || null,
      status: 'accepted',
      consentVersion: current.consentVersion || CLIENT_CONSENT_VERSION,
      termsVersion: current.termsVersion || CLIENT_TERMS_VERSION,
      privacyVersion: current.privacyVersion || CLIENT_PRIVACY_VERSION,
      acceptedAt: current.acceptedAt || now,
      refusedAt: null,
      withdrawnAt: null,
      platform,
      optionalConsents: mergedOptional,
      updatedAt: now,
    };

    await setDoc(doc(db, 'user_consents', currentUser.uid), docPayload);
    const updated = storedDocToConsentStatus(docPayload);
    writeConsentCache(currentUser.uid, updated);
    return updated;
  },

  async withdrawConsent(): Promise<ConsentStatusResponse> {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('Authentification requise.');
    }

    const platform = detectConsentPlatform();
    const apiUrl = resolveApiUrl('/api/user/withdraw-consent');
    if (apiUrl !== null) {
      try {
        const headers = await getAuthHeaders(true);
        const resp = await fetch(apiUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({ platform }),
        });
        const data = await parseStrictJsonResponse<{ withdrawn?: boolean; consent?: unknown }>(resp);
        if (!isValidConsentStatusResponse(data.consent)) {
          throw new ApiNonJsonResponseError(
            'Réponse serveur invalide lors du retrait du consentement.',
            resp.status,
            resp.headers.get('content-type') || ''
          );
        }
        writeConsentCache(currentUser.uid, data.consent);
        mirrorConsentToFirestore(currentUser.uid, currentUser.email, data.consent).catch(() => {});
        return data.consent;
      } catch (err) {
        if ((err as any)?.status === 404 || err instanceof ApiNonJsonResponseError) {
          markBackendApiUnavailable();
        }
        if (!isBackendUnavailableError(err)) {
          throw err;
        }
      }
    }

    const now = Date.now();
    const docPayload: StoredConsentDoc = {
      userId: currentUser.uid,
      email: currentUser.email || null,
      status: 'withdrawn',
      consentVersion: CLIENT_CONSENT_VERSION,
      termsVersion: CLIENT_TERMS_VERSION,
      privacyVersion: CLIENT_PRIVACY_VERSION,
      acceptedAt: null,
      refusedAt: null,
      withdrawnAt: now,
      platform,
      optionalConsents: {
        notifications: false,
        locationEnhancements: false,
      },
      updatedAt: now,
    };

    await setDoc(doc(db, 'user_consents', currentUser.uid), docPayload);
    const withdrawn = storedDocToConsentStatus(docPayload);
    writeConsentCache(currentUser.uid, withdrawn);
    return withdrawn;
  },

  async adminGetConsents(params?: {
    status?: string;
    platform?: string;
    search?: string;
  }): Promise<AdminConsentsOverviewResponse> {
    const apiUrl = resolveApiUrl('/api/super-admin/consents');
    if (apiUrl === null) {
      throw new Error('Endpoint administrateur indisponible sans URL serveur configurée.');
    }
    const headers = await getAuthHeaders(false);
    const qs = new URLSearchParams();
    if (params?.status && params.status !== 'ALL') qs.set('status', params.status);
    if (params?.platform && params.platform !== 'ALL') qs.set('platform', params.platform);
    if (params?.search && params.search.trim()) qs.set('search', params.search.trim());
    const q = qs.toString();
    const resp = await fetch(`${apiUrl}${q ? `?${q}` : ''}`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });
    return parseStrictJsonResponse<AdminConsentsOverviewResponse>(resp);
  },

  async adminGetUserConsentDetail(uid: string): Promise<AdminUserConsentDetailResponse> {
    const apiUrl = resolveApiUrl(`/api/super-admin/consents/${encodeURIComponent(uid)}`);
    if (apiUrl === null) {
      throw new Error('Endpoint administrateur indisponible sans URL serveur configurée.');
    }
    const headers = await getAuthHeaders(false);
    const resp = await fetch(apiUrl, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });
    return parseStrictJsonResponse<AdminUserConsentDetailResponse>(resp);
  },
};

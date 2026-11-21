
import { Capacitor } from '@capacitor/core';

const API_BASE_STORAGE_KEY = 'vruguard_api_base_url';

let backendApiUnavailable = false;

/**
 * Normalise une URL API.
 */
function normalizeBaseUrl(raw?: string | null): string | null {
  if (!raw || typeof raw !== 'string') return null;

  const trimmed = raw.trim().replace(/\/+$/, '');

  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }

    return parsed.origin + parsed.pathname.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

/**
 * Vérifie si une URL pointe vers localhost.
 */
function isLoopbackHost(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    const host = url.hostname.toLowerCase();

    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host === '[::1]'
    );
  } catch {
    return true;
  }
}

/**
 * Vérifie si l'application fonctionne sur Android/iOS.
 */
export function isNativeMobilePlatform(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/**
 * Récupère une variable d'environnement.
 */
function getEnvironmentApiUrl(): string | null {
  try {
    const viteUrl = normalizeBaseUrl(
      (import.meta as any)?.env?.VITE_API_BASE_URL
    );

    if (viteUrl) return viteUrl;
  } catch {
    // Ignore les erreurs de configuration Vite.
  }

  try {
    const processUrl = normalizeBaseUrl(
      typeof process !== 'undefined'
        ? (process as any)?.env?.VITE_API_BASE_URL
        : null
    );

    if (processUrl) return processUrl;
  } catch {
    // Ignore les environnements sans process.
  }

  return null;
}

/**
 * Récupère une URL API personnalisée enregistrée.
 */
function getStoredApiUrl(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = normalizeBaseUrl(
      window.localStorage?.getItem(API_BASE_STORAGE_KEY)
    );

    if (stored && !isLoopbackHost(stored)) {
      return stored;
    }
  } catch {
    // Ignore les problèmes de stockage.
  }

  return null;
}

/**
 * Vérifie si une URL API correspond à l'origine actuelle.
 */
function isCurrentOrigin(url: string): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const parsed = new URL(url);

    return parsed.origin === window.location.origin;
  } catch {
    return false;
  }
}

/**
 * Résout l'URL du backend.
 *
 * WEB :
 * - Utilise une URL personnalisée si configurée.
 * - Sinon utilise automatiquement le même domaine que le frontend.
 *
 * ANDROID / IOS :
 * - Utilise VITE_API_BASE_URL.
 * - Sinon utilise l'URL personnalisée enregistrée.
 * - Ne retourne jamais localhost en production.
 */
export function getConfiguredApiBaseUrl(): string | null {
  const storedUrl = getStoredApiUrl();
  const environmentUrl = getEnvironmentApiUrl();

  // Application native Android / iOS.
  if (isNativeMobilePlatform()) {
    const configuredUrl = storedUrl || environmentUrl;

    if (!configuredUrl || isLoopbackHost(configuredUrl)) {
      return null;
    }

    return configuredUrl;
  }

  // Application Web.
  const configuredUrl = storedUrl || environmentUrl;

  if (configuredUrl) {
    if (isLoopbackHost(configuredUrl)) {
      return '';
    }

    if (isCurrentOrigin(configuredUrl)) {
      return '';
    }

    return configuredUrl;
  }

  // Même domaine pour le frontend et le backend.
  // Exemple : https://www.vruguard.me/api/subscriptions/redeem
  if (typeof window !== 'undefined' && window.location?.origin) {
    return '';
  }

  return null;
}

/**
 * Enregistre une URL API personnalisée.
 */
export function setApiBaseUrl(url: string): void {
  const normalized = normalizeBaseUrl(url);

  if (!normalized || isLoopbackHost(normalized)) {
    throw new Error('URL API invalide ou non autorisée.');
  }

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(API_BASE_STORAGE_KEY, normalized);
  }

  resetBackendApiAvailability();
}

/**
 * Supprime l'URL API personnalisée.
 */
export function clearApiBaseUrl(): void {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(API_BASE_STORAGE_KEY);
  }

  resetBackendApiAvailability();
}

/**
 * Signale une indisponibilité temporaire du backend.
 * Ne désactive plus la résolution de l'URL API.
 */
export function markBackendApiUnavailable(): void {
  backendApiUnavailable = true;
}

/**
 * Indique si une erreur backend a été détectée.
 */
export function isBackendApiUnavailable(): boolean {
  return backendApiUnavailable;
}

/**
 * Réinitialise l'état d'indisponibilité.
 */
export function resetBackendApiAvailability(): void {
  backendApiUnavailable = false;
}

/**
 * Construit l'URL complète d'un endpoint API.
 */
export function resolveApiUrl(path: string): string | null {
  const normalizedPath = path.startsWith('/')
    ? path
    : `/${path}`;

  const base = getConfiguredApiBaseUrl();

  if (base === null) {
    return null;
  }

  return `${base}${normalizedPath}`;
}

/**
 * Exige une URL API valide.
 */
export function requireApiUrl(path: string): string {
  const url = resolveApiUrl(path);

  if (!url) {
    throw new Error(
      'Connexion au serveur VruGuard requise. Configurez VITE_API_BASE_URL pour cette plateforme.'
    );
  }

  return url;
}

/**
 * Erreur de réponse non JSON.
 */
export class ApiNonJsonResponseError extends Error {
  public readonly status: number;
  public readonly contentType: string;

  constructor(
    message: string,
    status: number,
    contentType: string
  ) {
    super(message);
    this.name = 'ApiNonJsonResponseError';
    this.status = status;
    this.contentType = contentType;
  }
}

/**
 * Détecte une indisponibilité réseau ou serveur.
 */
export function isBackendUnavailableError(err: unknown): boolean {
  if (err instanceof ApiNonJsonResponseError) {
    return true;
  }

  const status = (err as any)?.status;

  if (status === 404 || status >= 500) {
    return true;
  }

  const code = String(
    (err as any)?.code || ''
  ).toLowerCase();

  const message = String(
    err instanceof Error ? err.message : err || ''
  ).toLowerCase();

  return (
    code === 'unavailable' ||
    message.includes('client is offline') ||
    message.includes('offline') ||
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('network request failed') ||
    message.includes('load failed')
  );
}

/**
 * Analyse une réponse JSON du backend.
 */
export async function parseStrictJsonResponse<T>(
  resp: Response
): Promise<T> {
  const contentType =
    resp.headers.get('content-type') || '';

  const rawText = await resp.text();

  let parsed: any = null;

  if (rawText.trim().length > 0) {
    try {
      parsed = JSON.parse(rawText);
    } catch {
      if (!resp.ok) {
        throw Object.assign(
          new Error(`Erreur serveur (${resp.status})`),
          { status: resp.status }
        );
      }

      throw new ApiNonJsonResponseError(
        'Réponse non-JSON reçue du serveur.',
        resp.status,
        contentType
      );
    }
  }

  if (!resp.ok) {
    throw Object.assign(
      new Error(
        parsed?.error || `Erreur serveur (${resp.status})`
      ),
      {
        status: resp.status,
        code: parsed?.code
      }
    );
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new ApiNonJsonResponseError(
      'Réponse serveur vide ou invalide.',
      resp.status,
      contentType
    );
  }

  return parsed as T;
}

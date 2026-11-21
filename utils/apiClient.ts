import { Capacitor } from '@capacitor/core';

const API_BASE_STORAGE_KEY = 'vruguard_api_base_url';

let staticHostBackendUnavailable = false;

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

function isLoopbackHost(urlStr: string): boolean {
  try {
    const u = new URL(urlStr);
    const host = u.hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  } catch {
    return true;
  }
}

export function isNativeMobilePlatform(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

function isSameOriginExpressHost(): boolean {
  if (typeof window === 'undefined' || !window.location?.hostname) return false;
  const host = window.location.hostname.toLowerCase();
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '[::1]' ||
    /^ais-(dev|pre)-[a-z0-9-]+(?:\.[a-z0-9-]+)*\.run\.app$/i.test(host)
  );
}

function getExplicitWebApiBaseUrl(): string | null {
  try {
    const stored = normalizeBaseUrl(window.localStorage?.getItem(API_BASE_STORAGE_KEY));
    if (stored && !isLoopbackHost(stored)) {
      return stored;
    }
  } catch {
    // ignore storage access issues
  }

  const envUrl =
    normalizeBaseUrl((import.meta as any)?.env?.VITE_API_BASE_URL) ||
    normalizeBaseUrl(typeof process !== 'undefined' ? (process as any)?.env?.VITE_API_BASE_URL : null);

  if (envUrl && !isLoopbackHost(envUrl)) {
    return envUrl;
  }
  return null;
}

export function markBackendApiUnavailable(): void {
  if (!getExplicitWebApiBaseUrl()) {
    staticHostBackendUnavailable = true;
  }
}

export function isBackendApiUnavailable(): boolean {
  return staticHostBackendUnavailable;
}

export function resetBackendApiAvailability(): void {
  staticHostBackendUnavailable = false;
}

/**
 * Resolves the API base URL for the current runtime.
 * - Web browser on co-hosted Express (localhost / AI Studio dev & pre): uses same-origin '' unless overridden in localStorage.
 * - Web browser on external static hosting (e.g. www.vruguard.me): uses explicit VITE_API_BASE_URL.
 * - Capacitor native (Android/iOS): returns the configured remote API base URL
 *   if non-loopback, or null if the APK was built standalone without a backend URL.
 */
export function getConfiguredApiBaseUrl(): string | null {
  if (!isNativeMobilePlatform()) {
    let storedOverride: string | null = null;
    try {
      const candidate = normalizeBaseUrl(window.localStorage?.getItem(API_BASE_STORAGE_KEY));
      if (candidate && !isLoopbackHost(candidate)) {
        storedOverride = candidate;
      }
    } catch {
      // ignore storage access issues
    }

    if (storedOverride) {
      if (typeof window !== 'undefined' && window.location?.origin === storedOverride) {
        return '';
      }
      return storedOverride;
    }

    if (isSameOriginExpressHost()) {
      return staticHostBackendUnavailable ? null : '';
    }

    const explicit = getExplicitWebApiBaseUrl();
    if (explicit) {
      if (typeof window !== 'undefined' && window.location?.origin === explicit) {
        return '';
      }
      return explicit;
    }
    if (staticHostBackendUnavailable) {
      return null;
    }
    return '';
  }

  const explicit = getExplicitWebApiBaseUrl();
  if (explicit) {
    return explicit;
  }

  const appUrl = normalizeBaseUrl(
    typeof process !== 'undefined' ? (process as any)?.env?.APP_URL : null
  );
  if (appUrl && !isLoopbackHost(appUrl)) {
    return appUrl;
  }

  return null;
}

/**
 * Resolves an `/api/...` path into a full fetch URL, or returns null when no
 * backend API server is available (preventing Capacitor `https://localhost` HTML
 * responses or repeated 404 requests on static web hosts like www.vruguard.me).
 */
export function resolveApiUrl(path: string): string | null {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const base = getConfiguredApiBaseUrl();
  if (base === null) {
    return null;
  }
  return `${base}${normalizedPath}`;
}

export function requireApiUrl(path: string): string {
  const url = resolveApiUrl(path);
  if (!url) {
    throw new Error(
      'Connexion au serveur VruGuard requise pour cette opération (URL API non configurée).'
    );
  }
  return url;
}

export class ApiNonJsonResponseError extends Error {
  public readonly status: number;
  public readonly contentType: string;

  constructor(message: string, status: number, contentType: string) {
    super(message);
    this.name = 'ApiNonJsonResponseError';
    this.status = status;
    this.contentType = contentType;
  }
}

export function isBackendUnavailableError(err: unknown): boolean {
  if (err instanceof ApiNonJsonResponseError) {
    return true;
  }
  const status = (err as any)?.status;
  if (status === 404) {
    return true;
  }
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

export async function parseStrictJsonResponse<T>(resp: Response): Promise<T> {
  const contentType = resp.headers.get('content-type') || '';
  const rawText = await resp.text();

  let parsed: any = null;
  if (rawText.trim().length > 0) {
    try {
      parsed = JSON.parse(rawText);
    } catch {
      if (!resp.ok) {
        throw Object.assign(new Error(`Erreur serveur (${resp.status})`), {
          status: resp.status,
        });
      }
      throw new ApiNonJsonResponseError(
        'Réponse non-JSON reçue du serveur (probablement une page HTML locale).',
        resp.status,
        contentType
      );
    }
  }

  if (!resp.ok) {
    throw Object.assign(
      new Error(parsed?.error || `Erreur serveur (${resp.status})`),
      {
        status: resp.status,
        code: parsed?.code,
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

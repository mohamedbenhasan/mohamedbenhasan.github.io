import { Capacitor } from '@capacitor/core';

const API_BASE_STORAGE_KEY = 'vruguard_api_base_url';

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

/**
 * Resolves the API base URL for the current runtime.
 * - Web browser: returns '' (relative `/api/...` same-origin).
 * - Capacitor native (Android/iOS): returns the configured remote API base URL
 *   if non-loopback, or null if the APK was built standalone without a backend URL.
 */
export function getConfiguredApiBaseUrl(): string | null {
  if (!isNativeMobilePlatform()) {
    return '';
  }

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
    normalizeBaseUrl(typeof process !== 'undefined' ? (process as any)?.env?.VITE_API_BASE_URL : null) ||
    normalizeBaseUrl(typeof process !== 'undefined' ? (process as any)?.env?.APP_URL : null);

  if (envUrl && !isLoopbackHost(envUrl)) {
    return envUrl;
  }

  return null;
}

/**
 * Resolves an `/api/...` path into a full fetch URL, or returns null on native
 * platforms when no external API server URL is configured (preventing requests
 * from hitting Capacitor's local `https://localhost` asset server and receiving `index.html`).
 */
export function resolveApiUrl(path: string): string | null {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const base = getConfiguredApiBaseUrl();
  if (base === null) {
    return null;
  }
  return `${base}${normalizedPath}`;
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

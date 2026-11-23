import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { auth } from '../firebase';
import {
  ApiNonJsonResponseError,
  isBackendUnavailableError,
  markBackendApiUnavailable,
  parseStrictJsonResponse,
  resolveApiUrl,
} from '../utils/apiClient';
import { adminFirestoreService } from './AdminFirestoreService';
import {
  AndroidAppRelease,
  AndroidAppSettings,
  AndroidDownloadStats,
  AndroidLatestVersionResponse,
  AndroidReleaseStatus,
  AndroidUpdateType,
} from '../types';

async function getAdminHeaders(json = true, forceRefresh = false): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  if (json) {
    headers['Content-Type'] = 'application/json';
  }
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken(forceRefresh);
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function handleResponse<T>(resp: Response): Promise<T> {
  return parseStrictJsonResponse<T>(resp);
}

function checkFallbackError(err: unknown): boolean {
  if ((err as any)?.status === 404 || err instanceof ApiNonJsonResponseError) {
    markBackendApiUnavailable();
  }
  return isBackendUnavailableError(err);
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return '—';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} Go`;
}

export interface AdminAndroidReleasesResponse {
  releases: AndroidAppRelease[];
  settings: AndroidAppSettings;
  stats: AndroidDownloadStats;
  currentRelease: AndroidAppRelease | null;
}

export interface UploadApkPayload {
  file: File;
  appName: string;
  packageName?: string;
  versionName: string;
  versionCode: number;
  description: string;
  whatsNew: string;
  releaseDate: string;
  status: AndroidReleaseStatus;
  minAndroidVersion: string;
  minAndroidApi: number;
  updateType: AndroidUpdateType;
  minSupportedVersionCode?: number | null;
  setAsCurrent: boolean;
}

export const androidAppService = {
  async getInstalledAppInfo(): Promise<{
    isNativeAndroid: boolean;
    versionName: string;
    versionCode: number;
  }> {
    const isNativeAndroid = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
    if (isNativeAndroid) {
      try {
        const info = await CapacitorApp.getInfo();
        const code = parseInt(info.build, 10);
        return {
          isNativeAndroid: true,
          versionName: info.version || '1.0',
          versionCode: Number.isFinite(code) && code > 0 ? code : 1,
        };
      } catch {
        // fallback to default gradle config
      }
    }
    return {
      isNativeAndroid,
      versionName: '1.0',
      versionCode: 1,
    };
  },

  async getLatestVersion(currentVersionCode?: number | null): Promise<AndroidLatestVersionResponse> {
    const apiUrl = resolveApiUrl('/api/android-app/latest');
    if (apiUrl !== null) {
      try {
        const qs = new URLSearchParams();
        if (
          typeof currentVersionCode === 'number' &&
          Number.isFinite(currentVersionCode) &&
          currentVersionCode > 0
        ) {
          qs.set('currentVersionCode', String(Math.floor(currentVersionCode)));
        }
        const query = qs.toString();
        const resp = await fetch(`${apiUrl}${query ? `?${query}` : ''}`);
        return await handleResponse<AndroidLatestVersionResponse>(resp);
      } catch (err) {
        if (!checkFallbackError(err)) {
          throw err;
        }
      }
    }
    return adminFirestoreService.getLatestAndroidRelease(currentVersionCode);
  },

  buildPublicDownloadUrl(
    releaseIdOrLatest = 'latest',
    source: 'web' | 'android_app' | 'qr' = 'web'
  ): string {
    const cleanId = encodeURIComponent(releaseIdOrLatest);
    const path = `/api/android-app/download/${cleanId}?source=${source}`;
    const resolved = resolveApiUrl(`/api/android-app/download/${cleanId}`);
    return resolved ? `${resolved}?source=${source}` : path;
  },

  async adminGetReleases(): Promise<AdminAndroidReleasesResponse> {
    const apiUrl = resolveApiUrl('/api/super-admin/android-app/releases');
    if (apiUrl !== null) {
      try {
        const headers = await getAdminHeaders();
        const resp = await fetch(apiUrl, { headers });
        return await handleResponse<AdminAndroidReleasesResponse>(resp);
      } catch (err) {
        if (!checkFallbackError(err)) {
          throw err;
        }
      }
    }
    return adminFirestoreService.adminGetAndroidReleases();
  },

  async adminUploadApk(
    payload: UploadApkPayload,
    onProgress?: (percent: number, loadedBytes: number, totalBytes: number) => void
  ): Promise<{
    release: AndroidAppRelease;
    stats: AndroidDownloadStats;
    currentRelease: AndroidAppRelease | null;
  }> {
    const uploadUrl = resolveApiUrl('/api/super-admin/android-app/releases');
    if (!uploadUrl) {
      throw new Error(
        'Le téléversement d’un fichier binaire .apk nécessite le serveur Node/Express actif.'
      );
    }

    const headers = await getAdminHeaders(false);
    const formData = new FormData();
    formData.append('apk', payload.file);
    formData.append('appName', payload.appName);
    if (payload.packageName) formData.append('packageName', payload.packageName);
    formData.append('versionName', payload.versionName);
    formData.append('versionCode', String(payload.versionCode));
    formData.append('description', payload.description);
    formData.append('whatsNew', payload.whatsNew);
    formData.append('releaseDate', payload.releaseDate);
    formData.append('status', payload.status);
    formData.append('minAndroidVersion', payload.minAndroidVersion);
    formData.append('minAndroidApi', String(payload.minAndroidApi));
    formData.append('updateType', payload.updateType);
    if (payload.minSupportedVersionCode) {
      formData.append('minSupportedVersionCode', String(payload.minSupportedVersionCode));
    }
    formData.append('setAsCurrent', payload.setAsCurrent ? 'true' : 'false');

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', uploadUrl, true);
      if (headers.Authorization) {
        xhr.setRequestHeader('Authorization', headers.Authorization);
      }

      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable && onProgress) {
          const pct = Math.min(100, Math.round((evt.loaded / evt.total) * 100));
          onProgress(pct, evt.loaded, evt.total);
        }
      };

      xhr.onload = () => {
        try {
          const parsed = JSON.parse(xhr.responseText || '{}');
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(parsed);
          } else {
            reject(
              Object.assign(new Error(parsed.error || `Erreur serveur (${xhr.status})`), {
                status: xhr.status,
              })
            );
          }
        } catch {
          if (xhr.status === 404) {
            markBackendApiUnavailable();
          }
          reject(
            new Error(
              'Téléversement binaire .apk indisponible sans serveur Node/Express connecté.'
            )
          );
        }
      };

      xhr.onerror = () => {
        reject(new Error('Erreur réseau pendant le transfert du fichier APK.'));
      };

      xhr.send(formData);
    });
  },

  async adminUpdateReleaseMetadata(
    id: string,
    updates: {
      appName?: string;
      versionName?: string;
      description?: string;
      whatsNew?: string[] | string;
      releaseDate?: string;
      minAndroidVersion?: string;
      minAndroidApi?: number;
      updateType?: AndroidUpdateType;
      minSupportedVersionCode?: number | null;
    }
  ): Promise<{ release: AndroidAppRelease; currentRelease: AndroidAppRelease | null }> {
    const apiUrl = resolveApiUrl(`/api/super-admin/android-app/releases/${encodeURIComponent(id)}`);
    if (apiUrl !== null) {
      try {
        const headers = await getAdminHeaders();
        const resp = await fetch(apiUrl, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(updates),
        });
        return await handleResponse(resp);
      } catch (err) {
        if (!checkFallbackError(err)) {
          throw err;
        }
      }
    }
    return adminFirestoreService.adminUpdateAndroidReleaseMetadata(id, updates);
  },

  async adminChangeReleaseStatus(
    id: string,
    action: 'publish' | 'unpublish' | 'disable' | 'restore'
  ): Promise<{
    release: AndroidAppRelease;
    releases: AndroidAppRelease[];
    currentRelease: AndroidAppRelease | null;
    stats: AndroidDownloadStats;
  }> {
    const apiUrl = resolveApiUrl(
      `/api/super-admin/android-app/releases/${encodeURIComponent(id)}/status`
    );
    if (apiUrl !== null) {
      try {
        const headers = await getAdminHeaders();
        const resp = await fetch(apiUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({ action }),
        });
        return await handleResponse(resp);
      } catch (err) {
        if (!checkFallbackError(err)) {
          throw err;
        }
      }
    }
    return adminFirestoreService.adminChangeAndroidReleaseStatus(id, action);
  },

  async adminDeleteRelease(
    id: string,
    confirmRetentionOverride = false
  ): Promise<{ deleted: boolean; releases: AndroidAppRelease[]; stats: AndroidDownloadStats }> {
    const apiUrl = resolveApiUrl(
      `/api/super-admin/android-app/releases/${encodeURIComponent(id)}?force=${
        confirmRetentionOverride ? 'true' : 'false'
      }`
    );
    if (apiUrl !== null) {
      try {
        const headers = await getAdminHeaders();
        const resp = await fetch(apiUrl, {
          method: 'DELETE',
          headers,
          body: JSON.stringify({ confirmRetentionOverride }),
        });
        return await handleResponse(resp);
      } catch (err) {
        if (!checkFallbackError(err)) {
          throw err;
        }
      }
    }
    return adminFirestoreService.adminDeleteAndroidRelease(id);
  },

  async adminDownloadRelease(id: string, versionName: string): Promise<void> {
    const apiUrl = resolveApiUrl(
      `/api/super-admin/android-app/releases/${encodeURIComponent(id)}/download`
    );
    if (!apiUrl) {
      throw new Error(
        'Le téléchargement direct du fichier APK nécessite le serveur Node/Express actif.'
      );
    }
    const headers = await getAdminHeaders(false);
    const resp = await fetch(apiUrl, { headers });
    const ct = resp.headers.get('content-type') || '';
    if (resp.status === 404 || ct.includes('text/html')) {
      markBackendApiUnavailable();
      throw new Error(
        'Fichier APK binaire non hébergé sur ce déploiement statique (serveur Node/Express requis).'
      );
    }
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      throw new Error(data.error || `Impossible de télécharger l’APK (${resp.status})`);
    }
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `VruGuard-v${versionName}.apk`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  async adminUpdateSettings(
    updates: Partial<
      Pick<
        AndroidAppSettings,
        | 'downloadsEnabled'
        | 'appName'
        | 'packageName'
        | 'description'
        | 'minSupportedVersionCode'
        | 'retentionKeepCount'
        | 'maxApkSizeBytes'
      >
    >
  ): Promise<{ settings: AndroidAppSettings }> {
    const apiUrl = resolveApiUrl('/api/super-admin/android-app/settings');
    if (apiUrl !== null) {
      try {
        const headers = await getAdminHeaders();
        const resp = await fetch(apiUrl, {
          method: 'PUT',
          headers,
          body: JSON.stringify(updates),
        });
        return await handleResponse(resp);
      } catch (err) {
        if (!checkFallbackError(err)) {
          throw err;
        }
      }
    }
    return adminFirestoreService.adminUpdateAndroidSettings(updates);
  },
};

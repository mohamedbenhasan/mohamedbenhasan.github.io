import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import {
  Coordinates,
  HeatmapPreferences,
  HeatmapQueryRequest,
  HeatmapQueryResponse,
  HeatmapZoneDetailRequest,
  HeatmapZoneDetailResponse,
} from '../types';
import { subscriptionService, SubscriptionRequiredError } from './SubscriptionService';

export interface GeocodingCandidate {
  label: string;
  lat: number;
  lng: number;
}

class HeatmapService {
  private async requestJson<T>(url: string, init: RequestInit): Promise<T> {
    const headers = await subscriptionService.getAuthHeaders();
    const res = await fetch(url, {
      ...init,
      headers: {
        ...headers,
        ...(init.headers || {}),
      },
    });

    if (!res.ok) {
      let body: any = {};
      try {
        body = await res.json();
      } catch {
        // ignore JSON parse errors
      }
      if (
        res.status === 403 &&
        (body.code === 'PREMIUM_REQUIRED' ||
          body.code === 'FAMILY_REQUIRED' ||
          body.code === 'SUBSCRIPTION_EXPIRED' ||
          body.code === 'SUBSCRIPTION_SUSPENDED')
      ) {
        subscriptionService.triggerUpgradeModal('global_risk_heatmap');
        throw new SubscriptionRequiredError(
          'global_risk_heatmap',
          body.requiredPlan || 'PREMIUM',
          body.code,
          body.error
        );
      }
      throw new Error(body.error || `Erreur serveur (${res.status})`);
    }

    return (await res.json()) as T;
  }

  public async queryHeatmap(payload: HeatmapQueryRequest): Promise<HeatmapQueryResponse> {
    return this.requestJson<HeatmapQueryResponse>('/api/heatmap/query', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async inspectZone(
    payload: HeatmapZoneDetailRequest
  ): Promise<HeatmapZoneDetailResponse> {
    return this.requestJson<HeatmapZoneDetailResponse>('/api/heatmap/zone-detail', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async getPreferences(): Promise<HeatmapPreferences> {
    const res = await this.requestJson<{ preferences: HeatmapPreferences }>(
      '/api/heatmap/preferences',
      { method: 'GET' }
    );
    // Optional read fallback from Firestore if server restarted clean
    const uid = auth.currentUser?.uid;
    if (uid && res.preferences) {
      try {
        const snap = await getDoc(doc(db, 'users', uid, 'settings', 'heatmap'));
        if (snap.exists()) {
          const fsData = snap.data() as Partial<HeatmapPreferences>;
          if ((fsData.updatedAt || 0) > (res.preferences.updatedAt || 0)) {
            return { ...res.preferences, ...fsData, uid };
          }
        }
      } catch {
        // Non-blocking Firestore mirror fallback
      }
    }
    return res.preferences;
  }

  public async savePreferences(
    patch: Partial<Omit<HeatmapPreferences, 'uid' | 'updatedAt'>>
  ): Promise<HeatmapPreferences> {
    const res = await this.requestJson<{ preferences: HeatmapPreferences }>(
      '/api/heatmap/preferences',
      {
        method: 'PUT',
        body: JSON.stringify(patch),
      }
    );

    const uid = auth.currentUser?.uid;
    if (uid && res.preferences) {
      try {
        await setDoc(
          doc(db, 'users', uid, 'settings', 'heatmap'),
          res.preferences,
          { merge: true }
        );
      } catch {
        // Server store already persisted preferences safely
      }
    }

    return res.preferences;
  }

  public async searchAddress(query: string): Promise<GeocodingCandidate[]> {
    const trimmed = query.trim();
    if (trimmed.length < 2) return [];
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(
        trimmed
      )}`;
      const resp = await fetch(url, {
        headers: {
          Accept: 'application/json',
        },
      });
      if (!resp.ok) return [];
      const rows = (await resp.json()) as Array<{
        display_name: string;
        lat: string;
        lon: string;
      }>;
      return rows
        .map((r) => ({
          label: r.display_name,
          lat: Number(r.lat),
          lng: Number(r.lon),
        }))
        .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng));
    } catch {
      return [];
    }
  }

  public getBrowserLocation(): Promise<Coordinates | null> {
    return new Promise((resolve) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 }
      );
    });
  }
}

export const heatmapService = new HeatmapService();

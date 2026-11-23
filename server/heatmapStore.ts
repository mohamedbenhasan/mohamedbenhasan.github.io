import fs from 'fs';
import path from 'path';
import ngeohash from 'ngeohash';
import {
  HeatmapCategory,
  HeatmapEvent,
  HeatmapPreferences,
  HeatmapSeverityTier,
  HeatmapSourceId,
} from '../types';

const DATA_DIR = path.join(process.cwd(), '.data');
const STORE_PATH = path.join(DATA_DIR, 'heatmap-store.json');

const ALL_CATEGORIES: HeatmapCategory[] = [
  'INCIDENT',
  'TRAFFIC',
  'WEATHER',
  'INFRASTRUCTURE',
  'EXTERNAL_ALERT',
];

const ALL_SEVERITIES: HeatmapSeverityTier[] = ['LOW', 'MODERATE', 'HIGH', 'CRITICAL'];

const ALL_SOURCES: HeatmapSourceId[] = [
  'VRUGUARD_USER',
  'TRAFFIC_API',
  'OPEN_METEO',
  'OPENSTREETMAP',
  'OFFICIAL_ALERT',
];

interface HeatmapSnapshotRecord {
  id: string;
  geohash6: string;
  timestamp: number;
  cellCount: number;
  avgRiskScore: number;
}

interface HeatmapStoreData {
  events: Record<string, HeatmapEvent>;
  preferences: Record<string, HeatmapPreferences>;
  snapshots: HeatmapSnapshotRecord[];
  updatedAt: number;
}

const MAX_RETENTION_MS = 40 * 24 * 60 * 60 * 1000; // 40 days retained for 30d historical comparisons

export function buildDefaultHeatmapPreferences(uid: string): HeatmapPreferences {
  return {
    uid,
    globalMode: true,
    categories: [...ALL_CATEGORIES],
    period: '24h',
    customStartAt: null,
    customEndAt: null,
    severities: [...ALL_SEVERITIES],
    sources: [...ALL_SOURCES],
    zoneFilter: {
      mode: 'viewport',
      radiusMeters: 3000,
    },
    compareOffset: 'none',
    updatedAt: Date.now(),
  };
}

class HeatmapStore {
  private data: HeatmapStoreData;

  constructor() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    this.data = this.load();
  }

  private load(): HeatmapStoreData {
    try {
      if (fs.existsSync(STORE_PATH)) {
        const raw = fs.readFileSync(STORE_PATH, 'utf8');
        const parsed = JSON.parse(raw) as Partial<HeatmapStoreData>;
        return {
          events: parsed.events || {},
          preferences: parsed.preferences || {},
          snapshots: Array.isArray(parsed.snapshots) ? parsed.snapshots : [],
          updatedAt: parsed.updatedAt || Date.now(),
        };
      }
    } catch (err) {
      console.warn('HeatmapStore load fallback:', (err as Error).message);
    }
    return {
      events: {},
      preferences: {},
      snapshots: [],
      updatedAt: Date.now(),
    };
  }

  private persist(): void {
    try {
      const cutoff = Date.now() - MAX_RETENTION_MS;
      const prunedEvents: Record<string, HeatmapEvent> = {};
      const entries = Object.entries(this.data.events);
      // Retain events within retention window, cap at 12,000 newest events to bound file size cleanly
      entries
        .filter(([, ev]) => (ev.lastUpdatedAt || ev.collectedAt) >= cutoff)
        .sort((a, b) => b[1].lastUpdatedAt - a[1].lastUpdatedAt)
        .slice(0, 12000)
        .forEach(([k, ev]) => {
          if (ev.expiresAt !== null && ev.expiresAt <= Date.now() && ev.status === 'active') {
            ev.status = 'expired';
          }
          prunedEvents[k] = ev;
        });

      this.data.events = prunedEvents;
      this.data.snapshots = this.data.snapshots
        .filter((s) => s.timestamp >= cutoff)
        .slice(-2000);
      this.data.updatedAt = Date.now();

      const tmpPath = `${STORE_PATH}.tmp.${process.pid}`;
      fs.writeFileSync(tmpPath, JSON.stringify(this.data), 'utf8');
      fs.renameSync(tmpPath, STORE_PATH);
    } catch (err) {
      console.warn('HeatmapStore persist warning:', (err as Error).message);
    }
  }

  public ingestEvents(incoming: HeatmapEvent[]): HeatmapEvent[] {
    if (!incoming.length) return [];
    const now = Date.now();
    let changed = false;

    const merged: HeatmapEvent[] = [];

    for (const raw of incoming) {
      const geohash = raw.geohash || ngeohash.encode(raw.lat, raw.lng, 7);
      const key = raw.dedupKey || `${geohash}:${raw.category}:${raw.subType}`;
      const existing = this.data.events[key];

      if (!existing) {
        const record: HeatmapEvent = {
          ...raw,
          geohash,
          dedupKey: key,
          confirmations: Math.max(1, raw.confirmations || 1),
          status:
            raw.expiresAt !== null && raw.expiresAt <= now
              ? 'expired'
              : raw.status || 'active',
        };
        this.data.events[key] = record;
        merged.push(record);
        changed = true;
      } else {
        // Merge duplicate spatial events without letting repetition artificially multiply severityScore
        const isDistinctUpdate =
          raw.id !== existing.id ||
          raw.lastUpdatedAt > existing.lastUpdatedAt + 60_000;

        const nextConfirmations = isDistinctUpdate
          ? Math.min(50, existing.confirmations + Math.max(1, raw.confirmations || 1))
          : Math.max(existing.confirmations, raw.confirmations || 1);

        const nextReliability = isDistinctUpdate
          ? Number(
              Math.min(
                0.98,
                1 - (1 - existing.reliability) * (1 - raw.reliability * 0.45)
              ).toFixed(3)
            )
          : Math.max(existing.reliability, raw.reliability);

        const nextSeverity = Math.max(existing.severityScore, raw.severityScore);
        const nextTier = severityTierFromScore(nextSeverity);
        const nextExpiresAt =
          raw.expiresAt === null || existing.expiresAt === null
            ? raw.expiresAt ?? existing.expiresAt
            : Math.max(existing.expiresAt, raw.expiresAt);

        const nextRecord: HeatmapEvent = {
          ...existing,
          title: raw.severityScore >= existing.severityScore ? raw.title : existing.title,
          description:
            raw.description && raw.description.length > existing.description.length
              ? raw.description
              : existing.description,
          severityScore: nextSeverity,
          severityTier: nextTier,
          reliability: nextReliability,
          confirmations: nextConfirmations,
          natureWeight: Math.max(existing.natureWeight, raw.natureWeight),
          collectedAt: Math.min(existing.collectedAt, raw.collectedAt),
          lastUpdatedAt: Math.max(existing.lastUpdatedAt, raw.lastUpdatedAt),
          expiresAt: nextExpiresAt,
          status:
            nextExpiresAt !== null && nextExpiresAt <= now
              ? 'expired'
              : raw.status || 'active',
          metadata: {
            ...(existing.metadata || {}),
            ...(raw.metadata || {}),
          },
        };

        this.data.events[key] = nextRecord;
        merged.push(nextRecord);
        changed = true;
      }
    }

    if (changed) {
      this.persist();
    }
    return merged;
  }

  public queryEvents(params: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
    startAt: number;
    endAt: number;
    includeExpired: boolean;
    categories?: HeatmapCategory[];
    severities?: HeatmapSeverityTier[];
    sources?: HeatmapSourceId[];
  }): HeatmapEvent[] {
    const now = Date.now();
    const catSet = params.categories?.length ? new Set(params.categories) : null;
    const sevSet = params.severities?.length ? new Set(params.severities) : null;
    const srcSet = params.sources?.length ? new Set(params.sources) : null;

    const results: HeatmapEvent[] = [];
    for (const ev of Object.values(this.data.events)) {
      if (
        ev.lat < params.minLat ||
        ev.lat > params.maxLat ||
        ev.lng < params.minLng ||
        ev.lng > params.maxLng
      ) {
        continue;
      }

      if (catSet && !catSet.has(ev.category)) continue;
      if (sevSet && !sevSet.has(ev.severityTier)) continue;
      if (srcSet && !srcSet.has(ev.source)) continue;

      const isCurrentlyExpired =
        ev.status === 'expired' ||
        ev.status === 'resolved' ||
        (ev.expiresAt !== null && ev.expiresAt <= now);

      if (!params.includeExpired) {
        // Realtime / active view: exclude expired items
        if (isCurrentlyExpired) continue;
        // Static infrastructure hazards remain active regardless of short window
        if (ev.category !== 'INFRASTRUCTURE' && ev.lastUpdatedAt < params.startAt) {
          continue;
        }
      } else {
        // Historical mode: keep any event whose active lifespan overlapped [startAt, endAt]
        const evStart = ev.collectedAt;
        const evEnd = ev.expiresAt ?? ev.lastUpdatedAt + 24 * 60 * 60 * 1000;
        const overlaps =
          ev.category === 'INFRASTRUCTURE'
            ? evStart <= params.endAt
            : evStart <= params.endAt && Math.max(evEnd, ev.lastUpdatedAt) >= params.startAt;
        if (!overlaps) continue;
      }

      results.push(ev);
    }

    return results;
  }

  public getPreferences(uid: string): HeatmapPreferences {
    const existing = this.data.preferences[uid];
    if (!existing) {
      return buildDefaultHeatmapPreferences(uid);
    }
    return existing;
  }

  public savePreferences(
    uid: string,
    patch: Partial<Omit<HeatmapPreferences, 'uid' | 'updatedAt'>>
  ): HeatmapPreferences {
    const current = this.getPreferences(uid);
    const nextCategories = Array.isArray(patch.categories)
      ? patch.categories.filter((c) => ALL_CATEGORIES.includes(c))
      : current.categories;
    const nextSeverities = Array.isArray(patch.severities)
      ? patch.severities.filter((s) => ALL_SEVERITIES.includes(s))
      : current.severities;
    const nextSources = Array.isArray(patch.sources)
      ? patch.sources.filter((s) => ALL_SOURCES.includes(s))
      : current.sources;

    const updated: HeatmapPreferences = {
      ...current,
      ...patch,
      uid,
      categories: nextCategories.length ? nextCategories : [...ALL_CATEGORIES],
      severities: nextSeverities.length ? nextSeverities : [...ALL_SEVERITIES],
      sources: nextSources.length ? nextSources : [...ALL_SOURCES],
      zoneFilter: patch.zoneFilter
        ? {
            mode: patch.zoneFilter.mode || 'viewport',
            label: patch.zoneFilter.label,
            center: patch.zoneFilter.center,
            radiusMeters: patch.zoneFilter.radiusMeters ?? current.zoneFilter.radiusMeters ?? 3000,
          }
        : current.zoneFilter,
      updatedAt: Date.now(),
    };

    this.data.preferences[uid] = updated;
    this.persist();
    return updated;
  }

  public recordSnapshot(geohash6: string, cellCount: number, avgRiskScore: number): void {
    const now = Date.now();
    const recent = this.data.snapshots.find(
      (s) => s.geohash6 === geohash6 && now - s.timestamp < 30 * 60 * 1000
    );
    if (recent) return;
    this.data.snapshots.push({
      id: `snap_${now}_${geohash6}`,
      geohash6,
      timestamp: now,
      cellCount,
      avgRiskScore: Math.round(avgRiskScore),
    });
    this.persist();
  }
}

export function severityTierFromScore(score: number): HeatmapSeverityTier {
  if (score >= 75) return 'CRITICAL';
  if (score >= 50) return 'HIGH';
  if (score >= 25) return 'MODERATE';
  return 'LOW';
}

export const heatmapStore = new HeatmapStore();

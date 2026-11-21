import ngeohash from 'ngeohash';
import {
  Coordinates,
  HeatmapCategory,
  HeatmapCategoryCoverage,
  HeatmapCell,
  HeatmapCompareOffset,
  HeatmapCoverageLevel,
  HeatmapEvent,
  HeatmapHeatPoint,
  HeatmapHistoricalCompareSummary,
  HeatmapPeriodPreset,
  HeatmapQueryRequest,
  HeatmapQueryResponse,
  HeatmapRegionCoverageSummary,
  HeatmapRegionalFeedDirectoryItem,
  HeatmapRiskLevel,
  HeatmapSeverityTier,
  HeatmapSourceId,
  HeatmapSourceStatus,
  HeatmapWeatherSummary,
  HeatmapZoneDetailRequest,
  HeatmapZoneDetailResponse,
  ViewportBounds,
} from '../types';
import { heatmapStore, severityTierFromScore } from './heatmapStore';

export type FirestoreCollectionFetcher = (
  collectionName: string
) => Promise<Record<string, any>[]>;

interface CacheEntry<T> {
  expiresAt: number;
  value: T;
}

const weatherCache = new Map<
  string,
  CacheEntry<{
    events: HeatmapEvent[];
    summary: HeatmapWeatherSummary;
    fallbackUsed: string | null;
    providerLabel: string;
  }>
>();

const osmCache = new Map<
  string,
  CacheEntry<{
    events: HeatmapEvent[];
    mappedWayCount: number;
    mirrorUsed: string | null;
  }>
>();

const osmRoadBaselineCache = new Map<string, CacheEntry<number>>();

const trafficCache = new Map<
  string,
  CacheEntry<{
    events: HeatmapEvent[];
    detail: string;
    mode: HeatmapSourceStatus['mode'];
    configured: boolean;
    activeProviders: string[];
    hasRegionalLiveFeed: boolean;
    fallbackUsed: string | null;
  }>
>();

const globalAlertsCache = new Map<
  string,
  CacheEntry<{
    events: HeatmapEvent[];
    activeProviders: string[];
    fallbackUsed: string | null;
  }>
>();

const regionalFeedCache = new Map<string, CacheEntry<HeatmapEvent[]>>();

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

const OVERPASS_MIRRORS = [
  { name: 'Overpass DE', url: 'https://overpass-api.de/api/interpreter' },
  { name: 'Overpass Kumi Mirror', url: 'https://overpass.kumi.systems/api/interpreter' },
  { name: 'Overpass Private.Coffee Mirror', url: 'https://overpass.private.coffee/api/interpreter' },
];

export function haversineMeters(a: Coordinates, b: Coordinates): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function riskLevelFromScore(score: number): HeatmapRiskLevel {
  if (score >= 75) return 'CRITICAL';
  if (score >= 50) return 'HIGH';
  if (score >= 25) return 'MODERATE';
  return 'LOW';
}

export function resolveTimeWindow(
  period: HeatmapPeriodPreset,
  customStartAt?: number | null,
  customEndAt?: number | null,
  nowMs: number = Date.now()
): { startAt: number; endAt: number; isHistorical: boolean } {
  const HOUR = 60 * 60 * 1000;
  const DAY = 24 * HOUR;
  switch (period) {
    case 'realtime':
      return { startAt: nowMs - 6 * HOUR, endAt: nowMs, isHistorical: false };
    case '24h':
      return { startAt: nowMs - DAY, endAt: nowMs, isHistorical: true };
    case '7d':
      return { startAt: nowMs - 7 * DAY, endAt: nowMs, isHistorical: true };
    case '30d':
      return { startAt: nowMs - 30 * DAY, endAt: nowMs, isHistorical: true };
    case 'custom': {
      const start =
        typeof customStartAt === 'number' && Number.isFinite(customStartAt)
          ? customStartAt
          : nowMs - 7 * DAY;
      const end =
        typeof customEndAt === 'number' && Number.isFinite(customEndAt)
          ? Math.max(start + HOUR, customEndAt)
          : nowMs;
      return { startAt: start, endAt: end, isHistorical: true };
    }
    default:
      return { startAt: nowMs - DAY, endAt: nowMs, isHistorical: true };
  }
}

export function resolveComparisonWindow(
  offset: HeatmapCompareOffset | undefined,
  currentStart: number,
  currentEnd: number,
  customStartAt?: number | null,
  customEndAt?: number | null
): { startAt: number; endAt: number; label: string } | null {
  if (!offset || offset === 'none') return null;
  const span = Math.max(60 * 60 * 1000, currentEnd - currentStart);
  const DAY = 24 * 60 * 60 * 1000;

  if (offset === 'custom' && customStartAt && customEndAt) {
    return {
      startAt: customStartAt,
      endAt: Math.max(customStartAt + 60 * 60 * 1000, customEndAt),
      label: 'Période personnalisée',
    };
  }
  const shiftMs = offset === '24h' ? DAY : offset === '7d' ? 7 * DAY : 30 * DAY;
  const label =
    offset === '24h'
      ? 'vs -24 heures'
      : offset === '7d'
      ? 'vs -7 jours'
      : 'vs -30 jours';

  return {
    startAt: currentStart - shiftMs,
    endAt: Math.min(currentStart, currentStart - shiftMs + span),
    label,
  };
}

function getGeohashPrecisionForZoom(zoom: number): number {
  if (zoom >= 15) return 7; // ~150m street/block
  if (zoom >= 12) return 6; // ~1.2km neighborhood
  if (zoom >= 9) return 5;  // ~4.8km city/district
  if (zoom >= 6) return 4;  // ~20km regional
  return 3;                 // ~150km continental / global overview
}

/**
 * Deduplicate raw or overlapping events so multiple identical reports boost reliability,
 * NOT artificial danger inflation.
 */
export function deduplicateHeatmapEvents(events: HeatmapEvent[]): HeatmapEvent[] {
  const map = new Map<string, HeatmapEvent>();
  for (const ev of events) {
    const key =
      ev.dedupKey ||
      `${ngeohash.encode(ev.lat, ev.lng, 7)}:${ev.category}:${ev.subType}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...ev, dedupKey: key });
    } else {
      const nextConf = Math.min(50, existing.confirmations + ev.confirmations);
      const nextRel = Number(
        Math.min(
          0.98,
          1 - (1 - existing.reliability) * (1 - ev.reliability * 0.45)
        ).toFixed(3)
      );
      const nextSev = Math.max(existing.severityScore, ev.severityScore);
      map.set(key, {
        ...existing,
        severityScore: nextSev,
        severityTier: severityTierFromScore(nextSev),
        reliability: nextRel,
        confirmations: nextConf,
        natureWeight: Math.max(existing.natureWeight, ev.natureWeight),
        collectedAt: Math.min(existing.collectedAt, ev.collectedAt),
        lastUpdatedAt: Math.max(existing.lastUpdatedAt, ev.lastUpdatedAt),
        expiresAt:
          existing.expiresAt === null || ev.expiresAt === null
            ? existing.expiresAt ?? ev.expiresAt
            : Math.max(existing.expiresAt, ev.expiresAt),
      });
    }
  }
  return Array.from(map.values());
}

function getRecencyDecay(
  ev: HeatmapEvent,
  refTimeMs: number,
  isHistorical: boolean
): number {
  if (ev.category === 'INFRASTRUCTURE') return 0.96;
  const ageHours = Math.max(0, (refTimeMs - ev.lastUpdatedAt) / (60 * 60 * 1000));
  if (isHistorical) {
    return Math.max(0.72, Math.exp(-ageHours / 96));
  }
  const halfLifeHours =
    ev.category === 'TRAFFIC'
      ? 2.5
      : ev.category === 'WEATHER'
      ? 4.5
      : ev.category === 'INCIDENT'
      ? 8
      : 14;
  return Math.max(0.35, Math.exp((-Math.LN2 * ageHours) / halfLifeHours));
}

export function computeRiskSummaryForEvents(
  rawEvents: HeatmapEvent[],
  refTimeMs: number,
  isHistorical: boolean
): {
  riskScore: number;
  riskLevel: HeatmapRiskLevel;
  synergyBonus: number;
  categoryBreakdown: Partial<Record<HeatmapCategory, number>>;
  categoryMaxSeverity: Partial<Record<HeatmapCategory, number>>;
  rawConfirmations: number;
  dedupEvents: HeatmapEvent[];
} {
  const dedupEvents = deduplicateHeatmapEvents(rawEvents);
  if (dedupEvents.length === 0) {
    return {
      riskScore: 0,
      riskLevel: 'LOW',
      synergyBonus: 0,
      categoryBreakdown: {},
      categoryMaxSeverity: {},
      rawConfirmations: 0,
      dedupEvents: [],
    };
  }

  const categoryBreakdown: Partial<Record<HeatmapCategory, number>> = {};
  const categoryMaxSeverity: Partial<Record<HeatmapCategory, number>> = {};
  const categoryWeightedHazards: Partial<Record<HeatmapCategory, number[]>> = {};

  let rawConfirmations = 0;

  for (const ev of dedupEvents) {
    rawConfirmations += Math.max(1, ev.confirmations);
    categoryBreakdown[ev.category] = (categoryBreakdown[ev.category] || 0) + 1;
    categoryMaxSeverity[ev.category] = Math.max(
      categoryMaxSeverity[ev.category] || 0,
      ev.severityScore
    );

    const relFactor = 0.58 + 0.42 * Math.min(1, Math.max(0.1, ev.reliability));
    const decay = getRecencyDecay(ev, refTimeMs, isHistorical);
    const effective = Math.min(
      100,
      ev.severityScore * ev.natureWeight * relFactor * decay
    );

    if (!categoryWeightedHazards[ev.category]) {
      categoryWeightedHazards[ev.category] = [];
    }
    categoryWeightedHazards[ev.category]!.push(effective);
  }

  const categoryScores: number[] = [];
  (Object.keys(categoryWeightedHazards) as HeatmapCategory[]).forEach((cat) => {
    const sorted = categoryWeightedHazards[cat]!.sort((a, b) => b - a);
    const primary = sorted[0] || 0;
    const secondarySum = sorted.slice(1, 8).reduce((acc, v) => acc + v / 100, 0);
    const logTail = Math.min(9, 4.5 * Math.log(1 + secondarySum));
    categoryScores.push(Math.min(100, primary + logTail));
  });

  categoryScores.sort((a, b) => b - a);
  const dominant = categoryScores[0] || 0;

  let stacked = dominant;
  for (let i = 1; i < categoryScores.length; i++) {
    stacked += categoryScores[i] * Math.pow(0.22, i);
  }

  let synergyBonus = 0;
  const hasWeatherRisk = (categoryMaxSeverity.WEATHER || 0) >= 40;
  const hasInfraRisk = (categoryMaxSeverity.INFRASTRUCTURE || 0) >= 35;
  const hasIncidentOrAlert =
    (categoryMaxSeverity.INCIDENT || 0) >= 50 ||
    (categoryMaxSeverity.EXTERNAL_ALERT || 0) >= 55;
  const hasTrafficRisk = (categoryMaxSeverity.TRAFFIC || 0) >= 45;

  if (hasWeatherRisk && hasInfraRisk) synergyBonus += 9;
  if (hasWeatherRisk && hasIncidentOrAlert) synergyBonus += 8;
  if (hasIncidentOrAlert && hasTrafficRisk) synergyBonus += 6;

  const combined = stacked + synergyBonus;
  const finalScore =
    combined <= 85 ? combined : 85 + 15 * (1 - Math.exp(-(combined - 85) / 18));

  const riskScore = Math.max(0, Math.min(100, Math.round(finalScore)));
  return {
    riskScore,
    riskLevel: riskLevelFromScore(riskScore),
    synergyBonus: Math.round(synergyBonus),
    categoryBreakdown,
    categoryMaxSeverity,
    rawConfirmations,
    dedupEvents,
  };
}

export function clusterEventsIntoCells(
  events: HeatmapEvent[],
  zoom: number,
  refTimeMs: number,
  isHistorical: boolean
): HeatmapCell[] {
  const precision = getGeohashPrecisionForZoom(zoom);
  const groups = new Map<string, HeatmapEvent[]>();

  for (const ev of events) {
    const gh = ngeohash.encode(ev.lat, ev.lng, precision);
    const list = groups.get(gh) || [];
    list.push(ev);
    groups.set(gh, list);
  }

  const cells: HeatmapCell[] = [];
  for (const [gh, groupEvents] of groups.entries()) {
    const summary = computeRiskSummaryForEvents(
      groupEvents,
      refTimeMs,
      isHistorical
    );
    if (summary.dedupEvents.length === 0) continue;

    let wLat = 0;
    let wLng = 0;
    let wSum = 0;
    const sourcesSet = new Set<HeatmapSourceId>();
    let minCollected = Number.MAX_SAFE_INTEGER;
    let maxUpdated = 0;
    let relSum = 0;
    let topEvent = summary.dedupEvents[0];

    for (const ev of summary.dedupEvents) {
      const w = Math.max(10, ev.severityScore);
      wLat += ev.lat * w;
      wLng += ev.lng * w;
      wSum += w;
      sourcesSet.add(ev.source);
      if (ev.collectedAt < minCollected) minCollected = ev.collectedAt;
      if (ev.lastUpdatedAt > maxUpdated) maxUpdated = ev.lastUpdatedAt;
      relSum += ev.reliability;
      if (ev.severityScore > topEvent.severityScore) {
        topEvent = ev;
      }
    }

    const dominantCategory =
      (Object.entries(summary.categoryMaxSeverity).sort(
        (a, b) => (b[1] || 0) - (a[1] || 0)
      )[0]?.[0] as HeatmapCategory) || topEvent.category;

    const heatIntensity = Number(
      Math.max(0.18, Math.min(1, summary.riskScore / 100)).toFixed(3)
    );

    cells.push({
      cellId: gh,
      geohash: gh,
      center: {
        lat: Number((wLat / wSum).toFixed(6)),
        lng: Number((wLng / wSum).toFixed(6)),
      },
      riskScore: summary.riskScore,
      riskLevel: summary.riskLevel,
      heatIntensity,
      rawEventCount: summary.rawConfirmations,
      dedupEventCount: summary.dedupEvents.length,
      dominantCategory,
      categoryBreakdown: summary.categoryBreakdown,
      categoryMaxSeverity: summary.categoryMaxSeverity,
      synergyBonus: summary.synergyBonus,
      reliabilityAvg: Number((relSum / summary.dedupEvents.length).toFixed(2)),
      sources: Array.from(sourcesSet),
      topIssueSummary: topEvent.title,
      collectedAt: minCollected === Number.MAX_SAFE_INTEGER ? Date.now() : minCollected,
      lastUpdatedAt: maxUpdated || Date.now(),
    });
  }

  return cells.sort((a, b) => b.riskScore - a.riskScore).slice(0, 650);
}

// =========================================================================
// Regional Footprint Helpers (100% Free & Keyless Open Data Detection)
// =========================================================================
function boundsIntersect(
  b: ViewportBounds,
  latMin: number,
  latMax: number,
  lngMin: number,
  lngMax: number
): boolean {
  return (
    b.northEast.lat >= latMin &&
    b.southWest.lat <= latMax &&
    b.northEast.lng >= lngMin &&
    b.southWest.lng <= lngMax
  );
}

export function detectRegionalCapabilities(bounds: ViewportBounds) {
  const spansWholeWorld =
    bounds.northEast.lng - bounds.southWest.lng > 55 ||
    bounds.northEast.lat - bounds.southWest.lat > 35;

  const touchesParisIdf = boundsIntersect(bounds, 48.72, 48.96, 2.18, 2.52);
  const touchesLondonUk = boundsIntersect(bounds, 51.25, 51.72, -0.55, 0.35);
  const touchesFinland = boundsIntersect(bounds, 59.4, 70.2, 19.0, 31.6);
  const touchesUsLower48 = boundsIntersect(bounds, 24.4, 49.5, -125.0, -66.5);

  const centerLat = (bounds.northEast.lat + bounds.southWest.lat) / 2;
  const centerLng = (bounds.northEast.lng + bounds.southWest.lng) / 2;

  let regionLabel = 'Zone Internationale';
  if (spansWholeWorld) {
    regionLabel = 'Vue Mondiale Multi-Continents';
  } else if (touchesParisIdf && !spansWholeWorld) {
    regionLabel = 'Europe · Paris / Île-de-France';
  } else if (touchesLondonUk && !spansWholeWorld) {
    regionLabel = 'Europe · Grand Londres (UK)';
  } else if (touchesFinland && !spansWholeWorld) {
    regionLabel = 'Europe du Nord · Finlande';
  } else if (centerLat >= 35 && centerLat <= 71 && centerLng >= -12 && centerLng <= 42) {
    regionLabel = centerLat >= 54 ? 'Europe du Nord' : 'Europe Continentale';
  } else if (centerLat >= 15 && centerLat <= 72 && centerLng >= -168 && centerLng <= -52) {
    regionLabel = centerLat >= 24 ? 'Amérique du Nord' : 'Amérique Centrale & Caraïbes';
  } else if (centerLat < 15 && centerLat >= -56 && centerLng >= -82 && centerLng <= -34) {
    regionLabel = 'Amérique du Sud';
  } else if (centerLat >= -36 && centerLat <= 37.5 && centerLng >= -18 && centerLng <= 52) {
    regionLabel = centerLat >= 18 ? 'Afrique du Nord & Sahara' : 'Afrique Subsaharienne';
  } else if (centerLat >= 12 && centerLat <= 43 && centerLng > 34 && centerLng <= 63) {
    regionLabel = 'Moyen-Orient & Golfe';
  } else if (centerLat >= -11 && centerLat <= 55 && centerLng > 63 && centerLng <= 150) {
    if (centerLng >= 100 && centerLat >= 20) regionLabel = "Asie de l'Est & Pacifique";
    else if (centerLat < 22) regionLabel = 'Asie du Sud-Est';
    else regionLabel = 'Asie Centrale & du Sud';
  } else if (centerLat >= -48 && centerLat <= -10 && centerLng >= 110 && centerLng <= 180) {
    regionLabel = 'Océanie & Australie';
  }

  return {
    spansWholeWorld,
    touchesParisIdf,
    touchesLondonUk,
    touchesFinland,
    touchesUsLower48,
    regionLabel,
  };
}

// =========================================================================
// Source 1: VRU Guard Sentinel (incidents, DENM, PMR feedback, infra alerts)
// =========================================================================
async function fetchVruGuardSource(
  fetcher: FirestoreCollectionFetcher | undefined,
  bounds: ViewportBounds
): Promise<{
  events: HeatmapEvent[];
  inBoundsCount: number;
  mode: HeatmapSourceStatus['mode'];
  detail: string;
}> {
  if (!fetcher) {
    const localCount = heatmapStore.queryEvents({
      minLat: bounds.southWest.lat,
      maxLat: bounds.northEast.lat,
      minLng: bounds.southWest.lng,
      maxLng: bounds.northEast.lng,
      startAt: Date.now() - 24 * 3600 * 1000,
      endAt: Date.now(),
      includeExpired: false,
      sources: ['VRUGUARD_USER'],
    }).length;
    return {
      events: [],
      inBoundsCount: localCount,
      mode: 'cached',
      detail: `Archive locale VRU Guard active (${localCount} dans la vue)`,
    };
  }

  try {
    const [incidents, denms, pmrFeedback, infraAlerts] = await Promise.all([
      fetcher('incidents').catch(() => []),
      fetcher('denm_events').catch(() => []),
      fetcher('pmr_feedback').catch(() => []),
      fetcher('infrastructure_alerts').catch(() => []),
    ]);

    const normalized: HeatmapEvent[] = [];

    for (const item of incidents) {
      const lat = Number(item.location?.lat ?? item.lat);
      const lng = Number(item.location?.lng ?? item.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

      const typeStr = String(item.type || 'DANGER').toUpperCase();
      const sevStr = String(item.severity || 'MEDIUM').toUpperCase();

      const category: HeatmapCategory =
        typeStr === 'ROADWORKS' || typeStr === 'ROAD_CLOSED'
          ? 'TRAFFIC'
          : 'INCIDENT';

      let baseScore = sevStr === 'HIGH' ? 76 : sevStr === 'MEDIUM' ? 52 : 28;
      if (typeStr === 'ACCIDENT') baseScore = Math.max(baseScore, 84);
      if (typeStr === 'ROAD_CLOSED') baseScore = Math.max(baseScore, 68);
      if (typeStr === 'SIDEWALK_CLOSED') baseScore = Math.max(baseScore, 58);

      const createdAt = Number(item.createdAt) || Date.now();
      const expiresAt = Number(item.expiresAt) || createdAt + 12 * 60 * 60 * 1000;
      const reportsCount = Math.max(1, Number(item.reportsCount) || 1);
      const reliability = Math.min(
        0.95,
        0.72 + Math.min(4, reportsCount - 1) * 0.06
      );
      const gh = ngeohash.encode(lat, lng, 7);

      normalized.push({
        id: `vru_inc_${item.id || gh}`,
        dedupKey: `${gh}:${category}:${typeStr}`,
        geohash: gh,
        lat,
        lng,
        category,
        subType: typeStr,
        title: `Signalement VRU : ${typeStr.replace(/_/g, ' ')}`,
        description:
          item.description ||
          `Incident routier signalé par la communauté VRU Guard (${sevStr}).`,
        source: 'VRUGUARD_USER',
        sourceLabel: 'VRU Guard Sentinel',
        severityScore: baseScore,
        severityTier: severityTierFromScore(baseScore),
        reliability,
        confirmations: reportsCount,
        natureWeight: typeStr === 'ACCIDENT' ? 1.12 : 1.0,
        collectedAt: createdAt,
        lastUpdatedAt: createdAt,
        expiresAt,
        status:
          item.status === 'resolved' || item.status === 'removed'
            ? 'resolved'
            : 'active',
      });
    }

    for (const denm of denms) {
      const lat = Number(denm.location?.lat ?? denm.lat);
      const lng = Number(denm.location?.lng ?? denm.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const riskStr = String(denm.riskLevel || 'WARNING').toUpperCase();
      const score =
        riskStr === 'CRITICAL'
          ? 88
          : riskStr === 'HIGH'
          ? 72
          : riskStr === 'WARNING'
          ? 48
          : 22;
      const ts = Number(denm.timestamp) || Date.now();
      const expiresAt = Number(denm.expiresAt) || ts + 30 * 60 * 1000;
      const gh = ngeohash.encode(lat, lng, 7);
      const eventType = String(denm.eventType || 'COLLISION_RISK');

      normalized.push({
        id: `vru_denm_${denm.id || gh}`,
        dedupKey: `${gh}:INCIDENT:DENM_${eventType}`,
        geohash: gh,
        lat,
        lng,
        category: 'INCIDENT',
        subType: `DENM_${eventType}`,
        title: `Alerte V2X DENM (${eventType.replace(/_/g, ' ')})`,
        description: `Message de sécurité coopératif émis à proximité (${riskStr}).`,
        source: 'VRUGUARD_USER',
        sourceLabel: 'VRU Guard Sentinel V2X',
        severityScore: score,
        severityTier: severityTierFromScore(score),
        reliability: 0.9,
        confirmations: 1,
        natureWeight: 1.1,
        collectedAt: ts,
        lastUpdatedAt: ts,
        expiresAt,
        status: 'active',
      });
    }

    for (const pmr of pmrFeedback) {
      const lat = Number(pmr.location?.lat ?? pmr.lat);
      const lng = Number(pmr.location?.lng ?? pmr.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const score = pmr.isAccessible === false ? 64 : 36;
      const ts = Number(pmr.createdAt || pmr.timestamp) || Date.now();
      const gh = ngeohash.encode(lat, lng, 7);

      normalized.push({
        id: `vru_pmr_${pmr.id || gh}`,
        dedupKey: `${gh}:INFRASTRUCTURE:PMR_${pmr.issueType || 'BARRIER'}`,
        geohash: gh,
        lat,
        lng,
        category: 'INFRASTRUCTURE',
        subType: String(pmr.issueType || 'PMR_BARRIER'),
        title: 'Obstacle accessibilité PMR / Trottoir',
        description:
          pmr.comment ||
          pmr.description ||
          'Problème de voirie ou d’accessibilité signalé par un usager vulnérable.',
        source: 'VRUGUARD_USER',
        sourceLabel: 'VRU Guard PMR',
        severityScore: score,
        severityTier: severityTierFromScore(score),
        reliability: 0.85,
        confirmations: 1,
        natureWeight: 1.04,
        collectedAt: ts,
        lastUpdatedAt: ts,
        expiresAt: null,
        status: 'active',
      });
    }

    for (const inf of infraAlerts) {
      const lat = Number(inf.location?.lat ?? inf.lat);
      const lng = Number(inf.location?.lng ?? inf.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const ts = Number(inf.timestamp || inf.createdAt) || Date.now();
      const score = Number(inf.severityScore) || 58;
      const gh = ngeohash.encode(lat, lng, 7);

      normalized.push({
        id: `vru_inf_${inf.id || gh}`,
        dedupKey: `${gh}:INFRASTRUCTURE:${inf.type || 'HAZARD'}`,
        geohash: gh,
        lat,
        lng,
        category: 'INFRASTRUCTURE',
        subType: String(inf.type || 'INFRA_HAZARD'),
        title: String(inf.title || 'Anomalie infrastructure détectée'),
        description: String(
          inf.description || 'Infrastructure routière à vigilance renforcée.'
        ),
        source: 'VRUGUARD_USER',
        sourceLabel: 'VRU Guard Sentinel',
        severityScore: score,
        severityTier: severityTierFromScore(score),
        reliability: 0.82,
        confirmations: 1,
        natureWeight: 1.0,
        collectedAt: ts,
        lastUpdatedAt: ts,
        expiresAt: null,
        status: 'active',
      });
    }

    if (normalized.length > 0) {
      heatmapStore.ingestEvents(normalized);
    }

    const inBoundsCount = normalized.filter(
      (e) =>
        e.lat >= bounds.southWest.lat &&
        e.lat <= bounds.northEast.lat &&
        e.lng >= bounds.southWest.lng &&
        e.lng <= bounds.northEast.lng
    ).length;

    return {
      events: normalized,
      inBoundsCount,
      mode: 'live',
      detail: `${inBoundsCount} signalement(s) VRU Guard dans l'emprise (${normalized.length} mondial)`,
    };
  } catch (err) {
    return {
      events: [],
      inBoundsCount: 0,
      mode: 'cached',
      detail: `Archive locale VRU Guard (${(err as Error).message})`,
    };
  }
}

// =========================================================================
// Source 2: Global Weather (Open-Meteo + Automatic MET Norway Failover)
// =========================================================================
function describeWmoWeather(code: number | null): string {
  if (code === null) return 'Conditions variables';
  if (code === 0) return 'Ciel dégagé';
  if (code <= 3) return 'Nuageux / Éclaircies';
  if (code === 45 || code === 48) return 'Brouillard / Visibilité réduite';
  if (code >= 51 && code <= 57) return 'Bruine / Pluie verglaçante';
  if (code >= 61 && code <= 67) return 'Pluie modérée à forte';
  if (code >= 71 && code <= 77) return 'Neige / Risque verglas';
  if (code >= 80 && code <= 82) return 'Averses violentes';
  if (code >= 95) return 'Orage / Grêle sévère';
  return 'Conditions météo actives';
}

function describeMetNoSymbol(symbolCode: string): string {
  const s = symbolCode.toLowerCase();
  if (s.includes('thunder')) return 'Orage / Risque électrique';
  if (s.includes('heavyrain')) return 'Pluies intenses';
  if (s.includes('rain') || s.includes('sleet')) return 'Pluie / Chaussée humide';
  if (s.includes('snow')) return 'Chutes de neige / Verglas';
  if (s.includes('fog')) return 'Brouillard dense';
  if (s.includes('clearsky') || s.includes('fair')) return 'Ciel dégagé';
  return 'Nuageux / Couvert';
}

async function fetchMetNoWeatherFallback(
  lat: number,
  lng: number,
  now: number
): Promise<{
  events: HeatmapEvent[];
  summary: HeatmapWeatherSummary;
} | null> {
  try {
    const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat.toFixed(
      4
    )}&lon=${lng.toFixed(4)}`;
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'VRUGuardSentinel/1.0 contact@vruguard.org',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(4000),
    });
    if (!resp.ok) return null;

    const json = await resp.json();
    const first = json?.properties?.timeseries?.[0];
    const details = first?.data?.instant?.details;
    if (!details) return null;

    const temp =
      typeof details.air_temperature === 'number'
        ? details.air_temperature
        : null;
    const windMs =
      typeof details.wind_speed === 'number' ? details.wind_speed : 0;
    const windKmh = Math.round(windMs * 3.6);
    const fogFrac =
      typeof details.fog_area_fraction === 'number'
        ? details.fog_area_fraction
        : 0;
    const next1h = first?.data?.next_1_hours;
    const precip =
      typeof next1h?.details?.precipitation_amount === 'number'
        ? next1h.details.precipitation_amount
        : 0;
    const symbolCode = String(next1h?.summary?.symbol_code || '');

    const gh = ngeohash.encode(lat, lng, 6);
    const expiresAt = now + 4 * 3600 * 1000;
    const events: HeatmapEvent[] = [];
    const flags: string[] = [];

    if (precip >= 10) {
      flags.push(`Pluie torrentielle MET.no (${precip.toFixed(1)} mm/h)`);
      events.push(
        buildWeatherEvent(
          gh,
          lat,
          lng,
          'FLOOD_RISK',
          'Fortes pluies / Risque inondation',
          `Précipitations intenses mesurées : ${precip.toFixed(1)} mm/h (MET Norway Fallback).`,
          precip >= 22 ? 84 : 68,
          now,
          expiresAt,
          'MET Norway (Failover)'
        )
      );
    } else if (precip >= 2.5 || symbolCode.includes('heavyrain')) {
      flags.push(`Pluie active MET.no (${precip.toFixed(1)} mm/h)`);
      events.push(
        buildWeatherEvent(
          gh,
          lat,
          lng,
          'HEAVY_RAIN',
          'Pluie modérée à forte',
          `Chaussée mouillée détectée via MET Norway (${precip.toFixed(1)} mm/h).`,
          precip >= 5 ? 52 : 34,
          now,
          expiresAt,
          'MET Norway (Failover)'
        )
      );
    }

    if (windKmh >= 45) {
      flags.push(`Vents forts MET.no (${windKmh} km/h)`);
      events.push(
        buildWeatherEvent(
          gh,
          lat,
          lng,
          'HIGH_WIND',
          'Vents forts / Risque latéral VRU',
          `Vent soutenu à ${windKmh} km/h (MET Norway Fallback).`,
          windKmh >= 70 ? 72 : 50,
          now,
          expiresAt,
          'MET Norway (Failover)'
        )
      );
    }

    if (fogFrac >= 50 || symbolCode.includes('fog')) {
      flags.push('Brouillard dense MET.no');
      events.push(
        buildWeatherEvent(
          gh,
          lat,
          lng,
          'FOG',
          'Brouillard / Faible visibilité',
          'Visibilité fortement réduite (MET Norway).',
          56,
          now,
          expiresAt,
          'MET Norway (Failover)'
        )
      );
    }

    if (temp !== null && (temp <= 1.5 || symbolCode.includes('snow'))) {
      flags.push(`Gel / Neige MET.no (${temp.toFixed(1)}°C)`);
      events.push(
        buildWeatherEvent(
          gh,
          lat,
          lng,
          'ICE',
          'Risque gel / Verglas',
          `Température ${temp.toFixed(1)}°C — vigilance adhérence (MET Norway).`,
          temp <= 0 ? 68 : 46,
          now,
          expiresAt,
          'MET Norway (Failover)'
        )
      );
    }

    return {
      events,
      summary: {
        temperatureC: temp,
        precipitationMm: precip,
        windSpeedKmh: windKmh,
        windGustsKmh: windKmh,
        visibilityM: fogFrac >= 50 ? 600 : 10000,
        weatherCode: null,
        conditionLabel: describeMetNoSymbol(symbolCode),
        riskFlags: flags,
        fetchedAt: now,
        providerName: 'MET Norway Locationforecast 2.0',
      },
    };
  } catch {
    return null;
  }
}

async function fetchOpenMeteoSource(
  bounds: ViewportBounds,
  periodStartAt: number,
  periodEndAt: number,
  isHistoricalWindow: boolean
): Promise<{
  events: HeatmapEvent[];
  summary: HeatmapWeatherSummary | null;
  mode: HeatmapSourceStatus['mode'];
  detail: string;
  fallbackUsed: string | null;
}> {
  const centerLat = Math.max(
    -85,
    Math.min(85, (bounds.northEast.lat + bounds.southWest.lat) / 2)
  );
  const centerLng = Math.max(
    -179.9,
    Math.min(179.9, (bounds.northEast.lng + bounds.southWest.lng) / 2)
  );
  const latSpan = Math.max(0.01, bounds.northEast.lat - bounds.southWest.lat);
  const lngSpan = Math.max(0.01, bounds.northEast.lng - bounds.southWest.lng);

  const samplePoints: Coordinates[] = [{ lat: centerLat, lng: centerLng }];
  if (latSpan > 0.04 || lngSpan > 0.04) {
    const dLat = Math.min(8.0, latSpan * 0.28);
    const dLng = Math.min(12.0, lngSpan * 0.28);
    samplePoints.push(
      {
        lat: Math.max(-85, Math.min(85, centerLat + dLat)),
        lng: Math.max(-179.9, Math.min(179.9, centerLng - dLng)),
      },
      {
        lat: Math.max(-85, Math.min(85, centerLat + dLat)),
        lng: Math.max(-179.9, Math.min(179.9, centerLng + dLng)),
      },
      {
        lat: Math.max(-85, Math.min(85, centerLat - dLat)),
        lng: Math.max(-179.9, Math.min(179.9, centerLng - dLng)),
      },
      {
        lat: Math.max(-85, Math.min(85, centerLat - dLat)),
        lng: Math.max(-179.9, Math.min(179.9, centerLng + dLng)),
      }
    );
  }

  const ghCenter = ngeohash.encode(centerLat, centerLng, 4);
  const dayBucket = new Date(periodEndAt).toISOString().slice(0, 10);
  const cacheKey = `${ghCenter}:${isHistoricalWindow ? dayBucket : 'now'}:${samplePoints.length}`;
  const cached = weatherCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return {
      events: cached.value.events,
      summary: cached.value.summary,
      mode: 'cached',
      fallbackUsed: cached.value.fallbackUsed,
      detail: `${cached.value.providerLabel} (${samplePoints.length} points grille, cache 10 min)`,
    };
  }

  const now = Date.now();
  const useArchiveApi =
    isHistoricalWindow && now - periodEndAt > 36 * 60 * 60 * 1000;
  const events: HeatmapEvent[] = [];
  let primarySummary: HeatmapWeatherSummary | null = null;
  let fallbackUsed: string | null = null;
  let providerLabel = 'Open-Meteo Mondial';

  try {
    if (useArchiveApi) {
      const startDate = new Date(periodStartAt).toISOString().slice(0, 10);
      const endDate = new Date(
        Math.min(periodEndAt, now - 24 * 3600 * 1000)
      )
        .toISOString()
        .slice(0, 10);
      const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${centerLat.toFixed(
        4
      )}&longitude=${centerLng.toFixed(
        4
      )}&start_date=${startDate}&end_date=${endDate}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max&timezone=UTC`;

      const resp = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (resp.ok) {
        const data = await resp.json();
        const daily = data?.daily;
        if (daily && Array.isArray(daily.time)) {
          let maxRain = 0;
          let maxWind = 0;
          let maxGust = 0;
          let minTemp = 99;
          let maxTemp = -99;
          let worstCode = 0;

          for (let i = 0; i < daily.time.length; i++) {
            const pSum = Number(daily.precipitation_sum?.[i] ?? 0);
            const wMax = Number(daily.wind_speed_10m_max?.[i] ?? 0);
            const gMax = Number(daily.wind_gusts_10m_max?.[i] ?? 0);
            const tMin = Number(daily.temperature_2m_min?.[i] ?? 15);
            const tMax = Number(daily.temperature_2m_max?.[i] ?? 20);
            const wCode = Number(daily.weather_code?.[i] ?? 0);
            if (pSum > maxRain) maxRain = pSum;
            if (wMax > maxWind) maxWind = wMax;
            if (gMax > maxGust) maxGust = gMax;
            if (tMin < minTemp) minTemp = tMin;
            if (tMax > maxTemp) maxTemp = tMax;
            if (wCode > worstCode) worstCode = wCode;
          }

          const gh = ngeohash.encode(centerLat, centerLng, 6);
          const flags: string[] = [];
          if (maxRain >= 25) {
            flags.push(
              `Cumul pluie / risque inondation (${maxRain.toFixed(1)} mm/j)`
            );
            events.push(
              buildWeatherEvent(
                gh,
                centerLat,
                centerLng,
                'FLOOD_RISK',
                'Risque d’inondation / Fortes pluies (Archive)',
                `Cumul journalier historique atteint : ${maxRain.toFixed(1)} mm.`,
                maxRain >= 50 ? 84 : 64,
                periodEndAt,
                null
              )
            );
          } else if (maxRain >= 10) {
            flags.push(`Pluies soutenues (${maxRain.toFixed(1)} mm/j)`);
            events.push(
              buildWeatherEvent(
                gh,
                centerLat,
                centerLng,
                'HEAVY_RAIN',
                'Chaussée mouillée / Fortes pluies',
                `Précipitations historiques jusqu’à ${maxRain.toFixed(1)} mm/jour.`,
                44,
                periodEndAt,
                null
              )
            );
          }

          if (maxGust >= 65 || maxWind >= 50) {
            flags.push(
              `Rafales violentes (${Math.round(Math.max(maxGust, maxWind))} km/h)`
            );
            events.push(
              buildWeatherEvent(
                gh,
                centerLat,
                centerLng,
                'HIGH_WIND',
                'Vents violents / Rafales latérales',
                `Rafales mesurées jusqu’à ${Math.round(maxGust)} km/h (danger deux-roues/piétons).`,
                maxGust >= 85 ? 76 : 54,
                periodEndAt,
                null
              )
            );
          }

          if (minTemp <= 1.5) {
            flags.push(`Gel / Verglas (${minTemp.toFixed(1)}°C)`);
            events.push(
              buildWeatherEvent(
                gh,
                centerLat,
                centerLng,
                'ICE',
                'Risque de gel / Verglas',
                `Température minimale de ${minTemp.toFixed(1)}°C relevée sur la période.`,
                62,
                periodEndAt,
                null
              )
            );
          }

          primarySummary = {
            temperatureC: Number(((maxTemp + minTemp) / 2).toFixed(1)),
            precipitationMm: Number(maxRain.toFixed(1)),
            windSpeedKmh: Math.round(maxWind),
            windGustsKmh: Math.round(maxGust),
            visibilityM: worstCode === 45 || worstCode === 48 ? 500 : 10000,
            weatherCode: worstCode,
            conditionLabel: describeWmoWeather(worstCode),
            riskFlags: flags,
            fetchedAt: now,
            providerName: 'Open-Meteo Archive',
          };
        }
      }
    } else {
      const lats = samplePoints.map((p) => p.lat.toFixed(4)).join(',');
      const lngs = samplePoints.map((p) => p.lng.toFixed(4)).join(',');
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}&current=temperature_2m,precipitation,rain,weather_code,wind_speed_10m,wind_gusts_10m,visibility&timezone=UTC`;

      const resp = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (resp.ok) {
        const rawJson = await resp.json();
        const items = Array.isArray(rawJson) ? rawJson : [rawJson];

        items.forEach((entry: any, idx: number) => {
          const pt = samplePoints[idx] || samplePoints[0];
          const cur = entry?.current;
          if (!cur) return;

          const temp =
            typeof cur.temperature_2m === 'number' ? cur.temperature_2m : null;
          const precip =
            typeof cur.precipitation === 'number' ? cur.precipitation : 0;
          const wind =
            typeof cur.wind_speed_10m === 'number' ? cur.wind_speed_10m : 0;
          const gusts =
            typeof cur.wind_gusts_10m === 'number' ? cur.wind_gusts_10m : 0;
          const vis =
            typeof cur.visibility === 'number' ? cur.visibility : 15000;
          const code =
            typeof cur.weather_code === 'number' ? cur.weather_code : 0;

          const flags: string[] = [];
          const gh = ngeohash.encode(pt.lat, pt.lng, 6);
          const expiresAt = now + 4 * 60 * 60 * 1000;

          if (precip >= 10) {
            flags.push(
              `Pluie torrentielle / Inondation (${precip.toFixed(1)} mm/h)`
            );
            events.push(
              buildWeatherEvent(
                gh,
                pt.lat,
                pt.lng,
                'FLOOD_RISK',
                'Fortes pluies / Risque d’inondation',
                `Précipitations intenses mesurées : ${precip.toFixed(1)} mm/h (Open-Meteo).`,
                precip >= 22 ? 84 : 68,
                now,
                expiresAt
              )
            );
          } else if (
            precip >= 2.5 ||
            (code >= 61 && code <= 67) ||
            (code >= 80 && code <= 82)
          ) {
            flags.push(`Pluie active (${precip.toFixed(1)} mm/h)`);
            events.push(
              buildWeatherEvent(
                gh,
                pt.lat,
                pt.lng,
                'HEAVY_RAIN',
                'Pluie modérée à forte',
                `Chaussée glissante et distance de freinage allongée (${precip.toFixed(1)} mm/h).`,
                precip >= 5 ? 52 : 34,
                now,
                expiresAt
              )
            );
          }

          if (gusts >= 55 || wind >= 42) {
            const peak = Math.round(Math.max(gusts, wind));
            flags.push(`Vents forts (${peak} km/h)`);
            events.push(
              buildWeatherEvent(
                gh,
                pt.lat,
                pt.lng,
                'HIGH_WIND',
                'Vents violents / Risque déport latéral',
                `Rafales jusqu’à ${peak} km/h dangereuses pour cyclistes, trottinettes et piétons.`,
                peak >= 75 ? 74 : 52,
                now,
                expiresAt
              )
            );
          }

          if (vis <= 1000 || code === 45 || code === 48) {
            flags.push(`Brouillard / Visibilité ${Math.round(vis)}m`);
            events.push(
              buildWeatherEvent(
                gh,
                pt.lat,
                pt.lng,
                'FOG',
                'Brouillard / Faible visibilité',
                `Visibilité estimée à ${Math.round(vis)} m. Détection visuelle des VRU fortement réduite.`,
                vis <= 300 ? 72 : 48,
                now,
                expiresAt
              )
            );
          }

          if (temp !== null && (temp <= 1.5 || (code >= 71 && code <= 77))) {
            flags.push(`Risque verglas / gel (${temp.toFixed(1)}°C)`);
            events.push(
              buildWeatherEvent(
                gh,
                pt.lat,
                pt.lng,
                'ICE',
                'Risque de gel / Verglas',
                `Température relevée à ${temp.toFixed(1)}°C — adhérence critique sur passages piétons et pistes.`,
                temp <= 0 ? 68 : 46,
                now,
                expiresAt
              )
            );
          }

          if (temp !== null && temp >= 37) {
            flags.push(`Forte chaleur (${temp.toFixed(1)}°C)`);
            events.push(
              buildWeatherEvent(
                gh,
                pt.lat,
                pt.lng,
                'EXTREME_TEMP',
                'Canicule / Température extrême',
                `Température élevée (${temp.toFixed(1)}°C) affectant la vigilance et l’état des chaussées.`,
                temp >= 41 ? 56 : 34,
                now,
                expiresAt
              )
            );
          }

          if (code >= 95) {
            flags.push('Orage violent / Vigilance officielle WMO');
            events.push({
              id: `official_wmo_${gh}_${now}`,
              dedupKey: `${gh}:EXTERNAL_ALERT:WMO_STORM`,
              geohash: gh,
              lat: pt.lat,
              lng: pt.lng,
              category: 'EXTERNAL_ALERT',
              subType: 'SEVERE_STORM_WMO',
              title: 'Alerte Météo Sévère : Orage / Grêle',
              description: `Code WMO ${code} détecté par Open-Meteo — vigilance maximale requise.`,
              source: 'OFFICIAL_ALERT',
              sourceLabel: 'Vigilance Météo WMO',
              severityScore: 78,
              severityTier: 'CRITICAL',
              reliability: 0.92,
              confirmations: 1,
              natureWeight: 1.08,
              collectedAt: now,
              lastUpdatedAt: now,
              expiresAt,
              status: 'active',
            });
          }

          if (idx === 0) {
            primarySummary = {
              temperatureC: temp,
              precipitationMm: precip,
              windSpeedKmh: wind,
              windGustsKmh: gusts,
              visibilityM: vis,
              weatherCode: code,
              conditionLabel: describeWmoWeather(code),
              riskFlags: flags,
              fetchedAt: now,
              providerName: 'Open-Meteo Global Forecast',
            };
          }
        });
      }
    }
  } catch {
    // will engage automatic MET Norway fallback below
  }

  // Automatic Failover to MET Norway Locationforecast 2.0 if Open-Meteo failed
  if (!primarySummary) {
    const metNo = await fetchMetNoWeatherFallback(centerLat, centerLng, now);
    if (metNo) {
      events.push(...metNo.events);
      primarySummary = metNo.summary;
      fallbackUsed = 'MET Norway Locationforecast 2.0';
      providerLabel = 'MET Norway (Failover)';
    }
  }

  if (!primarySummary) {
    return {
      events: [],
      summary: null,
      mode: 'unavailable',
      fallbackUsed: null,
      detail: 'Fournisseurs météo mondiaux (Open-Meteo & MET.no) indisponibles',
    };
  }

  if (events.length > 0) {
    heatmapStore.ingestEvents(events);
  }

  weatherCache.set(cacheKey, {
    expiresAt: now + 10 * 60 * 1000,
    value: { events, summary: primarySummary, fallbackUsed, providerLabel },
  });

  return {
    events,
    summary: primarySummary,
    mode: 'live',
    fallbackUsed,
    detail: fallbackUsed
      ? `Failover ${fallbackUsed} · ${primarySummary.conditionLabel} (${primarySummary.temperatureC ?? '—'}°C)`
      : `${primarySummary.conditionLabel} (${primarySummary.temperatureC ?? '—'}°C, ${events.length} aléa(s))`,
  };
}

function buildWeatherEvent(
  geohash6: string,
  lat: number,
  lng: number,
  subType: string,
  title: string,
  description: string,
  severityScore: number,
  timestamp: number,
  expiresAt: number | null,
  sourceLabel = 'Open-Meteo'
): HeatmapEvent {
  return {
    id: `meteo_${geohash6}_${subType}_${timestamp}`,
    dedupKey: `${geohash6}:WEATHER:${subType}`,
    geohash: geohash6,
    lat,
    lng,
    category: 'WEATHER',
    subType,
    title,
    description,
    source: 'OPEN_METEO',
    sourceLabel,
    severityScore,
    severityTier: severityTierFromScore(severityScore),
    reliability: 0.92,
    confirmations: 1,
    natureWeight: subType === 'FLOOD_RISK' || subType === 'ICE' ? 1.08 : 0.98,
    collectedAt: timestamp,
    lastUpdatedAt: timestamp,
    expiresAt,
    status: 'active',
  };
}

// =========================================================================
// Shared Overpass Multi-Mirror Executor with Automatic Failover
// =========================================================================
async function executeOverpassWithFailover(query: string): Promise<{
  ok: boolean;
  elements: any[];
  mirrorUsed: string | null;
  errorDetail?: string;
}> {
  let lastError = 'Timeout';
  for (let i = 0; i < OVERPASS_MIRRORS.length; i++) {
    const mirror = OVERPASS_MIRRORS[i];
    try {
      const resp = await fetch(mirror.url, {
        method: 'POST',
        headers: {
          'User-Agent': 'vru-guard-heatmap/2.0',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'data=' + encodeURIComponent(query),
        signal: AbortSignal.timeout(6500),
      });
      if (resp.ok) {
        const data = await resp.json();
        const elements: any[] = Array.isArray(data?.elements)
          ? data.elements
          : [];
        return {
          ok: true,
          elements,
          mirrorUsed: i > 0 ? mirror.name : null,
        };
      }
      lastError = `HTTP ${resp.status} (${mirror.name})`;
    } catch (err) {
      lastError = (err as Error).message;
    }
  }
  return {
    ok: false,
    elements: [],
    mirrorUsed: null,
    errorDetail: lastError,
  };
}

async function ensureOsmRoadBaselineForPoint(
  lat: number,
  lng: number
): Promise<{ known: boolean; roadCount: number }> {
  const gh5 = ngeohash.encode(lat, lng, 5);
  const cached = osmRoadBaselineCache.get(gh5);
  if (cached && cached.expiresAt > Date.now()) {
    return { known: true, roadCount: cached.value };
  }
  const s = (lat - 0.01).toFixed(4);
  const n = (lat + 0.01).toFixed(4);
  const w = (lng - 0.012).toFixed(4);
  const e = (lng + 0.012).toFixed(4);
  const q = `[out:json][timeout:4]; way["highway"~"primary|secondary|tertiary|residential|unclassified|trunk"](${s},${w},${n},${e}); out ids 25;`;
  const res = await executeOverpassWithFailover(q);
  if (!res.ok) return { known: false, roadCount: 0 };

  const roadCount = res.elements.length;
  osmRoadBaselineCache.set(gh5, {
    expiresAt: Date.now() + 30 * 60 * 1000,
    value: roadCount,
  });
  return { known: true, roadCount };
}

// =========================================================================
// Source 3: OpenStreetMap Overpass (Global Infrastructure + Road Baseline)
// =========================================================================
async function fetchOpenStreetMapSource(
  bounds: ViewportBounds,
  zoom: number
): Promise<{
  events: HeatmapEvent[];
  mode: HeatmapSourceStatus['mode'];
  detail: string;
  mappedWayCount: number;
  zoomDeferred: boolean;
  fallbackUsed: string | null;
}> {
  if (zoom < 10) {
    return {
      events: [],
      mode: 'derived',
      mappedWayCount: 0,
      zoomDeferred: true,
      fallbackUsed: null,
      detail: `Vue globale (Zoom ${zoom}) — zoomez (≥ 10) pour analyser la voirie OSM`,
    };
  }

  const centerLat = (bounds.northEast.lat + bounds.southWest.lat) / 2;
  const centerLng = (bounds.northEast.lng + bounds.southWest.lng) / 2;

  const halfLat = Math.min(
    0.025,
    Math.max(0.008, (bounds.northEast.lat - bounds.southWest.lat) / 2)
  );
  const halfLng = Math.min(
    0.032,
    Math.max(0.01, (bounds.northEast.lng - bounds.southWest.lng) / 2)
  );

  const s = (centerLat - halfLat).toFixed(4);
  const n = (centerLat + halfLat).toFixed(4);
  const w = (centerLng - halfLng).toFixed(4);
  const e = (centerLng + halfLng).toFixed(4);
  const gridKey = ngeohash.encode(centerLat, centerLng, 5);

  const cached = osmCache.get(gridKey);
  if (cached && cached.expiresAt > Date.now()) {
    return {
      events: cached.value.events,
      mode: 'cached',
      mappedWayCount: cached.value.mappedWayCount,
      zoomDeferred: false,
      fallbackUsed: cached.value.mirrorUsed,
      detail:
        cached.value.mappedWayCount === 0
          ? 'Aucune voie OSM cartographiée dans cette zone (cache)'
          : `${cached.value.events.length} aléa(s) voirie OSM indexés (cache)`,
    };
  }

  const query = `
    [out:json][timeout:6];
    (
      way["highway"="construction"](${s},${w},${n},${e});
      way["highway"]["access"="no"](${s},${w},${n},${e});
      way["highway"~"primary|trunk"]["lit"="no"](${s},${w},${n},${e});
      way["highway"]["smoothness"~"bad|very_bad|horrible"](${s},${w},${n},${e});
      node["highway"="crossing"]["crossing"="unmarked"](${s},${w},${n},${e});
    );
    out center 80;
    way["highway"~"primary|secondary|tertiary|residential"](${s},${w},${n},${e});
    out ids 15;
  `;

  const res = await executeOverpassWithFailover(query);
  if (!res.ok) {
    return {
      events: cached?.value.events || [],
      mode: cached ? 'cached' : 'unavailable',
      mappedWayCount: cached?.value.mappedWayCount ?? 0,
      zoomDeferred: false,
      fallbackUsed: null,
      detail: `Overpass miroirs indisponibles (${res.errorDetail})`,
    };
  }

  const now = Date.now();
  const events: HeatmapEvent[] = [];
  let mappedWayCount = 0;

  for (const el of res.elements) {
    if (el.type === 'way' && !el.tags && !el.center) {
      mappedWayCount += 1;
      continue;
    }

    const lat = Number(el.lat ?? el.center?.lat);
    const lng = Number(el.lon ?? el.center?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    mappedWayCount += 1;

    const tags: Record<string, string> = el.tags || {};
    const gh = ngeohash.encode(lat, lng, 7);

    if (tags.highway === 'construction' || tags.access === 'no') {
      const sev = tags.access === 'no' ? 66 : 52;
      events.push({
        id: `osm_${el.type}_${el.id}`,
        dedupKey: `${gh}:TRAFFIC:OSM_${tags.highway === 'construction' ? 'CONSTRUCTION' : 'CLOSED'}`,
        geohash: gh,
        lat,
        lng,
        category: 'TRAFFIC',
        subType: tags.highway === 'construction' ? 'ROAD_WORK' : 'ROAD_CLOSED',
        title:
          tags.highway === 'construction'
            ? `Travaux OSM (${tags.name || 'Voirie en chantier'})`
            : `Voie fermée / Accès interdit (${tags.name || 'OSM'})`,
        description:
          'Restriction de circulation détectée dans les métadonnées OpenStreetMap.',
        source: 'OPENSTREETMAP',
        sourceLabel: 'OpenStreetMap',
        severityScore: sev,
        severityTier: severityTierFromScore(sev),
        reliability: 0.88,
        confirmations: 1,
        natureWeight: 0.96,
        collectedAt: now,
        lastUpdatedAt: now,
        expiresAt: now + 7 * 24 * 60 * 60 * 1000,
        status: 'active',
      });
    } else if (tags.highway === 'crossing') {
      const isUnmarked = tags.crossing === 'unmarked';
      const sev = isUnmarked ? 56 : 40;
      events.push({
        id: `osm_${el.type}_${el.id}`,
        dedupKey: `${gh}:INFRASTRUCTURE:OSM_CROSSING`,
        geohash: gh,
        lat,
        lng,
        category: 'INFRASTRUCTURE',
        subType: isUnmarked ? 'UNMARKED_CROSSING' : 'UNSIGNALED_CROSSING',
        title: isUnmarked
          ? 'Passage piéton non matérialisé (OSM)'
          : 'Traversée piétonne sans feu tricolore',
        description: `${tags.name || 'Intersection'} — Zone de conflit VRU/véhicules sans signalisation lumineuse.`,
        source: 'OPENSTREETMAP',
        sourceLabel: 'OpenStreetMap',
        severityScore: sev,
        severityTier: severityTierFromScore(sev),
        reliability: 0.9,
        confirmations: 1,
        natureWeight: 1.05,
        collectedAt: now,
        lastUpdatedAt: now,
        expiresAt: null,
        status: 'active',
      });
    } else if (tags.lit === 'no') {
      const sev =
        tags.highway === 'trunk' || tags.highway === 'primary' ? 58 : 44;
      events.push({
        id: `osm_${el.type}_${el.id}`,
        dedupKey: `${gh}:INFRASTRUCTURE:OSM_UNLIT`,
        geohash: gh,
        lat,
        lng,
        category: 'INFRASTRUCTURE',
        subType: 'UNLIT_ROAD',
        title: `Axe principal sans éclairage (${tags.name || tags.highway})`,
        description:
          'Absence d’éclairage public signalée sur OpenStreetMap (risque nocturne VRU).',
        source: 'OPENSTREETMAP',
        sourceLabel: 'OpenStreetMap',
        severityScore: sev,
        severityTier: severityTierFromScore(sev),
        reliability: 0.89,
        confirmations: 1,
        natureWeight: 1.02,
        collectedAt: now,
        lastUpdatedAt: now,
        expiresAt: null,
        status: 'active',
      });
    } else if (tags.smoothness) {
      const sev = tags.smoothness === 'horrible' ? 54 : 38;
      events.push({
        id: `osm_${el.type}_${el.id}`,
        dedupKey: `${gh}:INFRASTRUCTURE:OSM_SURFACE`,
        geohash: gh,
        lat,
        lng,
        category: 'INFRASTRUCTURE',
        subType: 'POOR_SURFACE',
        title: `Chaussée dégradée (${tags.smoothness})`,
        description: `État de surface difficile (${tags.surface || tags.smoothness}) pour cycles, PMR et trottinettes.`,
        source: 'OPENSTREETMAP',
        sourceLabel: 'OpenStreetMap',
        severityScore: sev,
        severityTier: severityTierFromScore(sev),
        reliability: 0.86,
        confirmations: 1,
        natureWeight: 0.95,
        collectedAt: now,
        lastUpdatedAt: now,
        expiresAt: null,
        status: 'active',
      });
    }
  }

  osmRoadBaselineCache.set(gridKey, {
    expiresAt: now + 30 * 60 * 1000,
    value: mappedWayCount,
  });

  if (events.length > 0) {
    heatmapStore.ingestEvents(events);
  }

  osmCache.set(gridKey, {
    expiresAt: now + 20 * 60 * 1000,
    value: { events, mappedWayCount, mirrorUsed: res.mirrorUsed },
  });

  return {
    events,
    mode: 'live',
    mappedWayCount,
    zoomDeferred: false,
    fallbackUsed: res.mirrorUsed,
    detail:
      mappedWayCount === 0
        ? 'Zone non cartographiée sur OSM (0 voie détectée)'
        : `${events.length} point(s) infrastructure · ${mappedWayCount} routes OSM`,
  };
}

// =========================================================================
// Source 4: Multi-Region & Global Free Open Traffic Feeds (Zero Keys)
// Covers Global OSM Bottlenecks + Paris Open Data + TfL London + Finland Fintraffic + US NWS
// =========================================================================
async function fetchTrafficApiSource(
  bounds: ViewportBounds,
  zoom: number
): Promise<{
  events: HeatmapEvent[];
  mode: HeatmapSourceStatus['mode'];
  configured: boolean;
  detail: string;
  activeProviders: string[];
  hasRegionalLiveFeed: boolean;
  fallbackUsed: string | null;
}> {
  const cap = detectRegionalCapabilities(bounds);
  const centerLat = (bounds.northEast.lat + bounds.southWest.lat) / 2;
  const centerLng = (bounds.northEast.lng + bounds.southWest.lng) / 2;
  const gridKey = `open_traffic_${zoom >= 10 ? ngeohash.encode(centerLat, centerLng, 5) : ngeohash.encode(centerLat, centerLng, 3)}`;

  const cached = trafficCache.get(gridKey);
  if (cached && cached.expiresAt > Date.now()) {
    return {
      ...cached.value,
      mode: 'cached',
    };
  }

  const now = Date.now();
  const expiresAt = now + 2 * 60 * 60 * 1000;
  const events: HeatmapEvent[] = [];
  const activeProviders: string[] = [];
  let hasRegionalLiveFeed = false;
  let fallbackUsed: string | null = null;

  // 1) Global OSM Traffic Restrictions / Construction / Rail Crossings (Zoom >= 10)
  if (zoom >= 10) {
    const halfLat = Math.min(
      0.025,
      Math.max(0.008, (bounds.northEast.lat - bounds.southWest.lat) / 2)
    );
    const halfLng = Math.min(
      0.032,
      Math.max(0.01, (bounds.northEast.lng - bounds.southWest.lng) / 2)
    );
    const s = (centerLat - halfLat).toFixed(4);
    const n = (centerLat + halfLat).toFixed(4);
    const w = (centerLng - halfLng).toFixed(4);
    const e = (centerLng + halfLng).toFixed(4);

    const overpassTrafficQuery = `
      [out:json][timeout:6];
      (
        way["highway"="construction"](${s},${w},${n},${e});
        way["highway"]["access"="no"](${s},${w},${n},${e});
        node["railway"="level_crossing"](${s},${w},${n},${e});
        way["highway"~"trunk|primary"]["junction"="roundabout"](${s},${w},${n},${e});
      );
      out center 70;
    `;

    const osmTraf = await executeOverpassWithFailover(overpassTrafficQuery);
    if (osmTraf.ok) {
      activeProviders.push('OSM Traffic Global');
      if (osmTraf.mirrorUsed) fallbackUsed = osmTraf.mirrorUsed;

      for (const el of osmTraf.elements) {
        const lat = Number(el.lat ?? el.center?.lat);
        const lng = Number(el.lon ?? el.center?.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        const tags: Record<string, string> = el.tags || {};
        const gh = ngeohash.encode(lat, lng, 7);

        let subType = 'BOTTLENECK';
        let title = 'Point de congestion / intersection majeure';
        let desc = 'Flux routier dense détecté sur axe principal (OpenStreetMap).';
        let sev = 38;

        if (tags.highway === 'construction') {
          subType = 'ROAD_WORK';
          title = `Travaux routiers (${tags.name || 'Chantier'})`;
          desc = 'Zone de travaux et rétrécissement de voie (OpenStreetMap).';
          sev = 56;
        } else if (tags.access === 'no') {
          subType = 'ROAD_CLOSED';
          title = `Voie fermée / Accès restreint (${tags.name || 'Voirie'})`;
          desc = 'Circulation automobile restreinte ou fermée (OpenStreetMap).';
          sev = 66;
        } else if (tags.railway === 'level_crossing') {
          subType = 'LEVEL_CROSSING';
          title = 'Passage à niveau (ralentissement & conflit VRU)';
          desc = 'Intersection rail/route à vigilance accrue.';
          sev = 52;
        } else if (tags.junction === 'roundabout') {
          subType = 'ARTERIAL_ROUNDABOUT';
          title = `Carrefour giratoire majeur (${tags.name || tags.highway})`;
          desc = 'Point de convergence multi-flux fréquemment congestionné.';
          sev = 44;
        }

        events.push({
          id: `osm_traf_${el.type}_${el.id}`,
          dedupKey: `${gh}:TRAFFIC:${subType}`,
          geohash: gh,
          lat,
          lng,
          category: 'TRAFFIC',
          subType,
          title,
          description: desc,
          source: 'TRAFFIC_API',
          sourceLabel: 'Open Traffic (OSM)',
          severityScore: sev,
          severityTier: severityTierFromScore(sev),
          reliability: 0.88,
          confirmations: 1,
          natureWeight: 0.94,
          collectedAt: now,
          lastUpdatedAt: now,
          expiresAt,
          status: 'active',
        });
      }
    }
  }

  // 2) Paris Open Data (Île-de-France)
  if (cap.touchesParisIdf) {
    try {
      const parisCache = regionalFeedCache.get('paris');
      let rows: HeatmapEvent[] | null =
        parisCache && parisCache.expiresAt > now ? parisCache.value : null;

      if (!rows) {
        const resp = await fetch(
          'https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/chantiers-perturbants/records?limit=60',
          { signal: AbortSignal.timeout(3500) }
        );
        if (resp.ok) {
          const data = await resp.json();
          const list: any[] = Array.isArray(data?.results) ? data.results : [];
          rows = [];
          for (const r of list) {
            const lat = Number(r.geo_point_2d?.lat);
            const lng = Number(r.geo_point_2d?.lon);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
            const gh = ngeohash.encode(lat, lng, 7);
            const impact = String(r.impact_circulation || '').toUpperCase();
            const sev = impact.includes('BARR') ? 70 : 52;
            rows.push({
              id: `paris_${r.identifiant || gh}`,
              dedupKey: `${gh}:TRAFFIC:PARIS_WORK`,
              geohash: gh,
              lat,
              lng,
              category: 'TRAFFIC',
              subType: impact.includes('BARR') ? 'ROAD_CLOSED' : 'ROAD_WORK',
              title: String(r.objet || 'Chantier perturbant (Paris Open Data)'),
              description: `${r.voie || 'Voirie'} — Impact : ${r.impact_circulation || 'Circulation perturbée'}.`,
              source: 'TRAFFIC_API',
              sourceLabel: 'Paris Open Data (Gratuit)',
              severityScore: sev,
              severityTier: severityTierFromScore(sev),
              reliability: 0.95,
              confirmations: 1,
              natureWeight: 0.95,
              collectedAt: now,
              lastUpdatedAt: now,
              expiresAt,
              status: 'active',
            });
          }
          regionalFeedCache.set('paris', {
            expiresAt: now + 10 * 60 * 1000,
            value: rows,
          });
        }
      }
      if (rows) {
        events.push(...rows);
        activeProviders.push('Paris Open Data');
        hasRegionalLiveFeed = true;
      }
    } catch {
      // non-blocking
    }
  }

  // 3) TfL London Open API (UK)
  if (cap.touchesLondonUk) {
    try {
      const tflCache = regionalFeedCache.get('tfl');
      let rows: HeatmapEvent[] | null =
        tflCache && tflCache.expiresAt > now ? tflCache.value : null;

      if (!rows) {
        const tflResp = await fetch(
          'https://api.tfl.gov.uk/Road/all/Disruption',
          { signal: AbortSignal.timeout(3500) }
        );
        if (tflResp.ok) {
          const list: any[] = await tflResp.json();
          rows = [];
          for (const r of list.slice(0, 70)) {
            const pt = Array.isArray(r.point)
              ? r.point
              : typeof r.point === 'string'
              ? r.point.replace(/[\[\]]/g, '').split(',').map(Number)
              : null;
            const lng = Number(pt?.[0]);
            const lat = Number(pt?.[1]);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
            const gh = ngeohash.encode(lat, lng, 7);
            const sevStr = String(r.severity || 'Moderate').toLowerCase();
            const sev =
              sevStr.includes('serious') || sevStr.includes('severe') ? 72 : 48;
            rows.push({
              id: `tfl_${r.id || gh}`,
              dedupKey: `${gh}:TRAFFIC:TFL_DISRUPTION`,
              geohash: gh,
              lat,
              lng,
              category: 'TRAFFIC',
              subType: String(r.category || 'TRAFFIC_DISRUPTION').toUpperCase(),
              title: String(r.location || r.category || 'Perturbation Trafic TfL'),
              description: String(
                r.comments ||
                  'Perturbation signalée par Transport for London Open Data.'
              ),
              source: 'TRAFFIC_API',
              sourceLabel: 'TfL Open API (Gratuit)',
              severityScore: sev,
              severityTier: severityTierFromScore(sev),
              reliability: 0.95,
              confirmations: 1,
              natureWeight: 0.95,
              collectedAt: now,
              lastUpdatedAt: now,
              expiresAt,
              status: 'active',
            });
          }
          regionalFeedCache.set('tfl', {
            expiresAt: now + 8 * 60 * 1000,
            value: rows,
          });
        }
      }
      if (rows) {
        events.push(...rows);
        activeProviders.push('TfL London Open API');
        hasRegionalLiveFeed = true;
      }
    } catch {
      // non-blocking
    }
  }

  // 4) Finland Nationwide Fintraffic Digitraffic Open API (keyless)
  if (cap.touchesFinland) {
    try {
      const finCache = regionalFeedCache.get('fintraffic');
      let rows: HeatmapEvent[] | null =
        finCache && finCache.expiresAt > now ? finCache.value : null;

      if (!rows) {
        const resp = await fetch(
          'https://tie.digitraffic.fi/api/traffic-message/v1/messages?inactiveHours=0&situationType=TRAFFIC_ANNOUNCEMENT',
          { signal: AbortSignal.timeout(4000) }
        );
        if (resp.ok) {
          const geo = await resp.json();
          const features: any[] = Array.isArray(geo?.features)
            ? geo.features
            : [];
          rows = [];
          for (const f of features.slice(0, 75)) {
            const geom = f?.geometry;
            let coord: any = null;
            if (geom?.type === 'Point') coord = geom.coordinates;
            else if (geom?.type === 'MultiPoint') coord = geom.coordinates?.[0];
            else if (geom?.type === 'LineString') coord = geom.coordinates?.[0];
            const lng = Number(coord?.[0]);
            const lat = Number(coord?.[1]);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
            const ann = f?.properties?.announcements?.[0];
            const gh = ngeohash.encode(lat, lng, 7);
            const title =
              ann?.title ||
              f?.properties?.situationType ||
              'Perturbation routière Fintraffic';
            const sev = String(title).toLowerCase().includes('closed') ? 74 : 52;
            rows.push({
              id: `fintraffic_${f.properties?.situationId || gh}`,
              dedupKey: `${gh}:TRAFFIC:FINTRAFFIC`,
              geohash: gh,
              lat,
              lng,
              category: 'TRAFFIC',
              subType: 'TRAFFIC_ANNOUNCEMENT',
              title: String(title),
              description: String(
                ann?.location?.description ||
                  ann?.comment ||
                  'Incident de circulation officiel Fintraffic Digitraffic.'
              ),
              source: 'TRAFFIC_API',
              sourceLabel: 'Fintraffic Digitraffic (Finlande)',
              severityScore: sev,
              severityTier: severityTierFromScore(sev),
              reliability: 0.96,
              confirmations: 1,
              natureWeight: 0.98,
              collectedAt: now,
              lastUpdatedAt: now,
              expiresAt,
              status: 'active',
            });
          }
          regionalFeedCache.set('fintraffic', {
            expiresAt: now + 10 * 60 * 1000,
            value: rows,
          });
        }
      }
      if (rows) {
        events.push(...rows);
        activeProviders.push('Fintraffic Finlande');
        hasRegionalLiveFeed = true;
      }
    } catch {
      // non-blocking
    }
  }

  // 5) USA NWS Active Road-Hazard / Weather Advisories (keyless, point query)
  if (cap.touchesUsLower48 && !cap.spansWholeWorld) {
    try {
      const nwsResp = await fetch(
        `https://api.weather.gov/alerts/active?point=${centerLat.toFixed(
          4
        )},${centerLng.toFixed(4)}`,
        {
          headers: {
            'User-Agent': 'VRUGuardSentinel/1.0 contact@vruguard.org',
            Accept: 'application/geo+json',
          },
          signal: AbortSignal.timeout(3500),
        }
      );
      if (nwsResp.ok) {
        const geo = await nwsResp.json();
        const feats: any[] = Array.isArray(geo?.features) ? geo.features : [];
        activeProviders.push('NOAA NWS (USA)');
        hasRegionalLiveFeed = true;
        for (const f of feats.slice(0, 10)) {
          const p = f?.properties || {};
          const gh = ngeohash.encode(centerLat, centerLng, 6);
          const sevStr = String(p.severity || 'Moderate').toLowerCase();
          const sev =
            sevStr === 'extreme'
              ? 88
              : sevStr === 'severe'
              ? 74
              : sevStr === 'moderate'
              ? 52
              : 34;
          events.push({
            id: `nws_${p.id || gh}`,
            dedupKey: `${gh}:EXTERNAL_ALERT:NWS_${p.event || 'ALERT'}`,
            geohash: gh,
            lat: centerLat,
            lng: centerLng,
            category: 'EXTERNAL_ALERT',
            subType: 'NWS_ADVISORY',
            title: String(p.event || p.headline || 'Vigilance officielle NOAA NWS'),
            description: String(
              p.headline || p.description || 'Alerte active NOAA / NWS.'
            ).slice(0, 220),
            source: 'OFFICIAL_ALERT',
            sourceLabel: 'NOAA NWS Open API (USA)',
            severityScore: sev,
            severityTier: severityTierFromScore(sev),
            reliability: 0.96,
            confirmations: 1,
            natureWeight: 1.05,
            collectedAt: now,
            lastUpdatedAt: now,
            expiresAt,
            status: 'active',
          });
        }
      }
    } catch {
      // non-blocking
    }
  }

  if (events.length > 0) {
    heatmapStore.ingestEvents(events);
  }

  const result = {
    events,
    configured: true,
    activeProviders,
    hasRegionalLiveFeed,
    fallbackUsed,
    mode:
      activeProviders.length > 0
        ? ('live' as const)
        : zoom < 10
        ? ('derived' as const)
        : ('cached' as const),
    detail:
      activeProviders.length > 0
        ? `${activeProviders.join(' + ')} · ${events.length} flux`
        : zoom < 10
        ? 'Couverture trafic locale : zoomez au niveau ville ou utilisez un portail régional'
        : 'Aucune donnée trafic temps réel municipale dans ce secteur (VRU & OSM uniquement)',
  };

  trafficCache.set(gridKey, {
    expiresAt: now + 8 * 60 * 1000,
    value: result,
  });

  return result;
}

// =========================================================================
// Source 5: Worldwide Official Hazards (GDACS + USGS Earthquakes + NASA EONET)
// =========================================================================
async function fetchOfficialExternalAlertsSource(bounds: ViewportBounds): Promise<{
  events: HeatmapEvent[];
  mode: HeatmapSourceStatus['mode'];
  detail: string;
  activeProviders: string[];
  fallbackUsed: string | null;
}> {
  const now = Date.now();
  const cached = globalAlertsCache.get('world');
  let allGlobalAlerts: HeatmapEvent[] = [];
  let activeProviders: string[] = [];
  let fallbackUsed: string | null = null;
  let mode: HeatmapSourceStatus['mode'] = 'live';

  if (cached && cached.expiresAt > now) {
    allGlobalAlerts = cached.value.events;
    activeProviders = cached.value.activeProviders;
    fallbackUsed = cached.value.fallbackUsed;
    mode = 'cached';
  } else {
    const [gdacsRes, usgsRes, eonetRes] = await Promise.allSettled([
      fetch(
        'https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=EQ,TC,FL,VO,WF,DR&alertlevel=Orange;Red',
        { signal: AbortSignal.timeout(4000) }
      ),
      fetch(
        'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson',
        { signal: AbortSignal.timeout(4000) }
      ),
      fetch(
        'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=60',
        { signal: AbortSignal.timeout(4000) }
      ),
    ]);

    if (gdacsRes.status === 'fulfilled' && gdacsRes.value.ok) {
      try {
        const geo = await gdacsRes.value.json();
        const features: any[] = Array.isArray(geo?.features)
          ? geo.features
          : [];
        activeProviders.push('GDACS');
        for (const f of features.slice(0, 80)) {
          const coords = f?.geometry?.coordinates;
          const lng = Number(coords?.[0]);
          const lat = Number(coords?.[1]);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
          const props = f.properties || {};
          const level = String(props.alertlevel || 'Orange').toLowerCase();
          const score = level === 'red' ? 88 : 66;
          const gh = ngeohash.encode(lat, lng, 6);
          const fromMs = Date.parse(props.fromdate || '') || now;
          const toMs =
            Date.parse(props.todate || '') || now + 48 * 60 * 60 * 1000;

          allGlobalAlerts.push({
            id: `gdacs_${props.eventtype || 'AL'}_${props.eventid || gh}`,
            dedupKey: `${gh}:EXTERNAL_ALERT:GDACS_${props.eventtype || 'ALERT'}`,
            geohash: gh,
            lat,
            lng,
            category: 'EXTERNAL_ALERT',
            subType: `OFFICIAL_${props.eventtype || 'DISASTER'}`,
            title: String(
              props.name || props.htmldescription || 'Alerte officielle GDACS'
            ),
            description: `${props.country || 'Alerte mondiale'} — Niveau ${props.alertlevel || 'Orange'}.`,
            source: 'OFFICIAL_ALERT',
            sourceLabel: 'GDACS Open API',
            severityScore: score,
            severityTier: severityTierFromScore(score),
            reliability: 0.96,
            confirmations: 1,
            natureWeight: 1.1,
            collectedAt: fromMs,
            lastUpdatedAt: now,
            expiresAt: toMs,
            status: 'active',
          });
        }
      } catch {
        // non-blocking
      }
    }

    if (usgsRes.status === 'fulfilled' && usgsRes.value.ok) {
      try {
        const usgs = await usgsRes.value.json();
        const features: any[] = Array.isArray(usgs?.features)
          ? usgs.features
          : [];
        activeProviders.push('USGS');
        for (const f of features.slice(0, 80)) {
          const coords = f?.geometry?.coordinates;
          const lng = Number(coords?.[0]);
          const lat = Number(coords?.[1]);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
          const props = f.properties || {};
          const mag = Number(props.mag || 2.5);
          const score = mag >= 5.5 ? 88 : mag >= 4.5 ? 68 : 44;
          const gh = ngeohash.encode(lat, lng, 6);
          const evTime = Number(props.time) || now;

          allGlobalAlerts.push({
            id: `usgs_${f.id || gh}`,
            dedupKey: `${gh}:EXTERNAL_ALERT:USGS_EQ`,
            geohash: gh,
            lat,
            lng,
            category: 'EXTERNAL_ALERT',
            subType: 'SEISMIC_ALERT',
            title: String(
              props.title || `Secousse sismique M${mag.toFixed(1)}`
            ),
            description: `Alerte sismique USGS (magnitude ${mag.toFixed(1)}) — vigilance infrastructures.`,
            source: 'OFFICIAL_ALERT',
            sourceLabel: 'USGS Open Feed',
            severityScore: score,
            severityTier: severityTierFromScore(score),
            reliability: 0.97,
            confirmations: 1,
            natureWeight: 1.08,
            collectedAt: evTime,
            lastUpdatedAt: evTime,
            expiresAt: evTime + 48 * 60 * 60 * 1000,
            status: 'active',
          });
        }
      } catch {
        // non-blocking
      }
    }

    if (eonetRes.status === 'fulfilled' && eonetRes.value.ok) {
      try {
        const eonet = await eonetRes.value.json();
        const eventsList: any[] = Array.isArray(eonet?.events)
          ? eonet.events
          : [];
        activeProviders.push('NASA EONET');
        for (const ev of eventsList.slice(0, 60)) {
          const lastGeom =
            ev?.geometry?.[ev.geometry.length - 1] || ev?.geometry?.[0];
          const coords = lastGeom?.coordinates;
          if (!Array.isArray(coords) || coords.length < 2) continue;
          const lng = Number(coords[0]);
          const lat = Number(coords[1]);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

          const catTitle = String(
            ev?.categories?.[0]?.title || 'Natural Event'
          );
          const catLower = catTitle.toLowerCase();
          const score =
            catLower.includes('wildfire') ||
            catLower.includes('storm') ||
            catLower.includes('volcano')
              ? 76
              : 62;
          const gh = ngeohash.encode(lat, lng, 6);
          const evMs = Date.parse(lastGeom?.date || '') || now;

          allGlobalAlerts.push({
            id: `eonet_${ev.id || gh}`,
            dedupKey: `${gh}:EXTERNAL_ALERT:EONET_${catLower.replace(/\s+/g, '_')}`,
            geohash: gh,
            lat,
            lng,
            category: 'EXTERNAL_ALERT',
            subType: `EONET_${catLower.toUpperCase().replace(/\s+/g, '_')}`,
            title: String(ev.title || `Événement naturel (${catTitle})`),
            description: `Observation satellite NASA EONET (${catTitle}) — perturbation environnementale majeure.`,
            source: 'OFFICIAL_ALERT',
            sourceLabel: 'NASA EONET v3',
            severityScore: score,
            severityTier: severityTierFromScore(score),
            reliability: 0.94,
            confirmations: 1,
            natureWeight: 1.06,
            collectedAt: evMs,
            lastUpdatedAt: evMs,
            expiresAt: now + 48 * 60 * 60 * 1000,
            status: 'active',
          });
        }
      } catch {
        // non-blocking
      }
    }

    if (activeProviders.length > 0 && activeProviders.length < 3) {
      fallbackUsed = `Tolérance active (${activeProviders.join(' + ')})`;
    }

    if (allGlobalAlerts.length > 0) {
      heatmapStore.ingestEvents(allGlobalAlerts);
    }

    globalAlertsCache.set('world', {
      expiresAt: now + 15 * 60 * 1000,
      value: { events: allGlobalAlerts, activeProviders, fallbackUsed },
    });
  }

  const localMatches = allGlobalAlerts.filter(
    (a) =>
      a.lat >= bounds.southWest.lat &&
      a.lat <= bounds.northEast.lat &&
      a.lng >= bounds.southWest.lng &&
      a.lng <= bounds.northEast.lng
  );

  return {
    events: localMatches,
    mode: activeProviders.length > 0 ? mode : 'unavailable',
    activeProviders,
    fallbackUsed,
    detail:
      activeProviders.length > 0
        ? `${activeProviders.join(' + ')} actifs (${localMatches.length} alerte(s) dans l'emprise)`
        : 'Flux alertes officielles mondiales temporairement injoignables',
  };
}

// =========================================================================
// Geographic Coverage Matrix Evaluator (Worldwide + Honest Data Gaps)
// =========================================================================
export function evaluateRegionCoverage(params: {
  bounds: ViewportBounds;
  zoom: number;
  vruInBoundsCount: number;
  meteoMode: HeatmapSourceStatus['mode'];
  meteoFallback: string | null;
  osmMode: HeatmapSourceStatus['mode'];
  osmMappedWayCount: number;
  osmZoomDeferred: boolean;
  osmFallback: string | null;
  trafficHasRegionalFeed: boolean;
  trafficProviders: string[];
  officialMode: HeatmapSourceStatus['mode'];
  officialProviders: string[];
  cellsCount: number;
}): HeatmapRegionCoverageSummary {
  const cap = detectRegionalCapabilities(params.bounds);
  const regionalTrafficProviders = params.trafficProviders.filter(
    (p) => p !== 'OSM Traffic Global'
  );

  // Weather
  const weatherLevel: HeatmapCoverageLevel =
    params.meteoMode === 'unavailable' ? 'NONE' : 'FULL';

  // Official External Alerts
  const officialLevel: HeatmapCoverageLevel =
    params.officialMode === 'unavailable' ? 'NONE' : 'FULL';

  // OSM Street Infrastructure
  let infraLevel: HeatmapCoverageLevel = 'PARTIAL';
  let infraNote =
    'Couverture voirie mondiale OSM active.';
  if (params.osmZoomDeferred) {
    infraLevel = 'PARTIAL';
    infraNote = `Vue macro (Zoom ${params.zoom}) — zoomez (≥ 10) pour inspecter la voirie locale OSM.`;
  } else if (params.osmMode === 'unavailable') {
    infraLevel = 'NONE';
    infraNote = 'Miroirs Overpass OSM temporairement injoignables.';
  } else if (params.osmMappedWayCount === 0) {
    infraLevel = 'NONE';
    infraNote =
      'Aucune route ou infrastructure cartographiée sur OSM dans ce secteur (océan ou zone non cartographiée).';
  } else {
    infraLevel = 'FULL';
    infraNote = `${params.osmMappedWayCount} axes/infrastructures routières OSM vérifiés.`;
  }

  // Traffic & Roadworks
  let trafficLevel: HeatmapCoverageLevel = 'PARTIAL';
  let trafficNote = '';
  if (params.trafficHasRegionalFeed) {
    trafficLevel = 'FULL';
    trafficNote = `Flux trafic ouvert régional actif (${regionalTrafficProviders.join(', ')} + OSM).`;
  } else if (params.zoom < 10) {
    trafficLevel = 'NONE';
    trafficNote =
      'Aucun flux congestion temps réel mondial à cette échelle sans portail municipal dédié.';
  } else if (params.osmMappedWayCount === 0 && params.osmMode !== 'unavailable') {
    trafficLevel = 'NONE';
    trafficNote = 'Réseau routier absent dans l’emprise sélectionnée.';
  } else {
    trafficLevel = 'PARTIAL';
    trafficNote =
      'Travaux/fermetures OSM & communauté VRU actifs — aucun portail municipal de congestion en direct dans ce pays.';
  }

  // Community VRU Incidents
  const incidentLevel: HeatmapCoverageLevel =
    params.vruInBoundsCount > 0 ? 'FULL' : 'PARTIAL';
  const incidentNote =
    params.vruInBoundsCount > 0
      ? `${params.vruInBoundsCount} signalement(s) VRU Guard actifs dans la zone.`
      : 'Réseau communautaire mondial prêt — aucun signalement VRU déposé dans cette emprise.';

  const byCategory: HeatmapCategoryCoverage[] = [
    {
      category: 'WEATHER',
      label: 'Conditions Météo',
      level: weatherLevel,
      providers: [
        params.meteoFallback || 'Open-Meteo Global',
        'MET Norway Fallback',
      ],
      note:
        weatherLevel === 'FULL'
          ? `Couverture mondiale active (${params.meteoFallback || 'Open-Meteo'}).`
          : 'Météo mondiale momentanément indisponible.',
    },
    {
      category: 'EXTERNAL_ALERT',
      label: 'Alertes Officielles',
      level: officialLevel,
      providers: params.officialProviders.length
        ? params.officialProviders
        : ['GDACS', 'USGS', 'NASA EONET'],
      note:
        officialLevel === 'FULL'
          ? 'Catastrophes naturelles, séismes et alertes WMO mondiales actifs.'
          : 'Flux alertes mondiales indisponible.',
    },
    {
      category: 'INFRASTRUCTURE',
      label: 'Infrastructures & Voirie',
      level: infraLevel,
      providers: [params.osmFallback || 'OpenStreetMap Overpass'],
      note: infraNote,
    },
    {
      category: 'TRAFFIC',
      label: 'Trafic & Travaux',
      level: trafficLevel,
      providers: params.trafficProviders.length
        ? params.trafficProviders
        : ['OSM Traffic', 'Portails Open Data'],
      note: trafficNote,
    },
    {
      category: 'INCIDENT',
      label: 'Incidents VRU Guard',
      level: incidentLevel,
      providers: ['VRU Guard Sentinel'],
      note: incidentNote,
    },
  ];

  const hasLocalStreetCoverage = !params.osmZoomDeferred && params.osmMappedWayCount > 0;
  let overallStatus: HeatmapCoverageLevel = 'PARTIAL';
  if (
    weatherLevel === 'NONE' &&
    officialLevel === 'NONE' &&
    infraLevel === 'NONE'
  ) {
    overallStatus = 'NONE';
  } else if (
    weatherLevel === 'FULL' &&
    officialLevel === 'FULL' &&
    infraLevel === 'FULL' &&
    trafficLevel === 'FULL'
  ) {
    overallStatus = 'FULL';
  } else if (!hasLocalStreetCoverage && params.zoom >= 10 && params.cellsCount === 0) {
    overallStatus = params.osmMode === 'unavailable' ? 'NONE' : 'PARTIAL';
  }

  let insufficientDataReason: string | null = null;
  if (params.osmMappedWayCount === 0 && !params.osmZoomDeferred && params.osmMode !== 'unavailable') {
    insufficientDataReason =
      "Zone sans réseau routier OSM cartographié : l'absence d'incident ne signifie pas que l'endroit est sûr.";
  } else if (params.cellsCount === 0 && !params.trafficHasRegionalFeed) {
    insufficientDataReason =
      "Aucun portail de trafic municipal temps réel ni signalement local VRU dans ce secteur. L'absence de données ne garantit pas une zone sûre.";
  } else if (params.osmZoomDeferred && params.cellsCount === 0) {
    insufficientDataReason =
      'Échelle continentale/mondiale : zoomez au niveau urbain pour inspecter le détail voirie et local.';
  }

  const knownRegionalFeeds: HeatmapRegionalFeedDirectoryItem[] = [
    {
      id: 'open_meteo',
      name: 'Open-Meteo + Failover MET Norway 2.0',
      scope: 'GLOBAL',
      regionLabel: 'Monde entier (Terre & Océans)',
      categories: ['WEATHER', 'EXTERNAL_ALERT'],
      refreshCadenceLabel: 'Auto · 10 min',
      activeInViewport: weatherLevel === 'FULL',
      failoverCapable: true,
      statusNote: params.meteoFallback
        ? `Failover actif : ${params.meteoFallback}`
        : 'Source primaire active',
    },
    {
      id: 'global_hazards',
      name: 'GDACS + USGS + NASA EONET v3',
      scope: 'GLOBAL',
      regionLabel: 'Monde entier (Catastrophes & Séismes)',
      categories: ['EXTERNAL_ALERT'],
      refreshCadenceLabel: 'Auto · 15 min',
      activeInViewport: officialLevel === 'FULL',
      failoverCapable: true,
      statusNote: params.officialProviders.length
        ? `${params.officialProviders.join(' + ')}`
        : 'Indisponible',
    },
    {
      id: 'osm_overpass',
      name: 'OpenStreetMap Overpass Multi-Miroirs',
      scope: 'GLOBAL',
      regionLabel: 'Monde entier (Zoom ≥ 10)',
      categories: ['INFRASTRUCTURE', 'TRAFFIC'],
      refreshCadenceLabel: 'Auto · 20 min',
      activeInViewport: infraLevel === 'FULL',
      failoverCapable: true,
      statusNote: params.osmZoomDeferred
        ? 'En attente de zoom ville (≥ 10)'
        : params.osmFallback
        ? `Miroir actif : ${params.osmFallback}`
        : `${params.osmMappedWayCount} axes indexés`,
    },
    {
      id: 'paris_opendata',
      name: 'Paris Open Data (Chantiers Perturbants)',
      scope: 'REGIONAL',
      regionLabel: 'France · Paris / Île-de-France',
      categories: ['TRAFFIC'],
      refreshCadenceLabel: 'Auto · 10 min',
      activeInViewport: cap.touchesParisIdf,
      failoverCapable: false,
      statusNote: cap.touchesParisIdf ? 'Actif dans la vue' : 'Hors emprise actuelle',
    },
    {
      id: 'tfl_london',
      name: 'Transport for London (TfL Road API)',
      scope: 'REGIONAL',
      regionLabel: 'Royaume-Uni · Grand Londres',
      categories: ['TRAFFIC'],
      refreshCadenceLabel: 'Auto · 8 min',
      activeInViewport: cap.touchesLondonUk,
      failoverCapable: false,
      statusNote: cap.touchesLondonUk ? 'Actif dans la vue' : 'Hors emprise actuelle',
    },
    {
      id: 'fintraffic_fi',
      name: 'Fintraffic Digitraffic (Finlande)',
      scope: 'REGIONAL',
      regionLabel: 'Europe du Nord · Finlande nationale',
      categories: ['TRAFFIC'],
      refreshCadenceLabel: 'Auto · 10 min',
      activeInViewport: cap.touchesFinland,
      failoverCapable: false,
      statusNote: cap.touchesFinland ? 'Actif dans la vue' : 'Hors emprise actuelle',
    },
    {
      id: 'noaa_nws_us',
      name: 'NOAA National Weather Service Alerts',
      scope: 'REGIONAL',
      regionLabel: 'Amérique du Nord · États-Unis',
      categories: ['EXTERNAL_ALERT', 'TRAFFIC'],
      refreshCadenceLabel: 'Auto · 8 min',
      activeInViewport: cap.touchesUsLower48 && !cap.spansWholeWorld,
      failoverCapable: false,
      statusNote:
        cap.touchesUsLower48 && !cap.spansWholeWorld
          ? 'Actif dans la vue'
          : 'Hors emprise actuelle',
    },
  ];

  const summaryNote =
    overallStatus === 'FULL'
      ? `Couverture complète multi-fournisseurs vérifiée sur ${cap.regionLabel}.`
      : overallStatus === 'NONE'
      ? `Données indisponibles sur ${cap.regionLabel} — ne pas interpréter comme une zone sûre.`
      : `Couverture partielle sur ${cap.regionLabel} : météo & alertes mondiales actives, flux trafic local limité aux sources ouvertes disponibles.`;

  return {
    overallStatus,
    regionLabel: cap.regionLabel,
    summaryNote,
    insufficientDataReason,
    hasLocalStreetCoverage,
    hasRegionalLiveTraffic: params.trafficHasRegionalFeed,
    byCategory,
    knownRegionalFeeds,
  };
}

// =========================================================================
// Main Spatial Query & Historical Comparison Orchestrator
// =========================================================================
export async function queryHeatmap(
  req: HeatmapQueryRequest,
  firestoreFetcher?: FirestoreCollectionFetcher
): Promise<HeatmapQueryResponse> {
  const now = Date.now();
  const zoom = Number(req.zoom) || 13;
  const categories = req.categories?.length ? req.categories : ALL_CATEGORIES;
  const severities = req.severities?.length ? req.severities : ALL_SEVERITIES;
  const sources = req.sources?.length ? req.sources : ALL_SOURCES;

  const { startAt, endAt, isHistorical } = resolveTimeWindow(
    req.period,
    req.customStartAt,
    req.customEndAt,
    now
  );

  let effectiveBounds = req.bounds;
  const zoneCenter = req.zoneFilter?.center;
  const zoneRadius = req.zoneFilter?.radiusMeters || 3000;
  if (
    (req.zoneFilter?.mode === 'radius' || req.zoneFilter?.mode === 'search') &&
    zoneCenter
  ) {
    const dLat = zoneRadius / 111320;
    const dLng =
      zoneRadius /
      (111320 * Math.max(0.2, Math.cos((zoneCenter.lat * Math.PI) / 180)));
    effectiveBounds = {
      northEast: {
        lat: Math.max(req.bounds.northEast.lat, zoneCenter.lat + dLat),
        lng: Math.max(req.bounds.northEast.lng, zoneCenter.lng + dLng),
      },
      southWest: {
        lat: Math.min(req.bounds.southWest.lat, zoneCenter.lat - dLat),
        lng: Math.min(req.bounds.southWest.lng, zoneCenter.lng - dLng),
      },
    };
  }

  const [vruRes, meteoRes, osmRes, trafficRes, officialRes] = await Promise.all([
    sources.includes('VRUGUARD_USER')
      ? fetchVruGuardSource(firestoreFetcher, effectiveBounds)
      : Promise.resolve({
          events: [],
          inBoundsCount: 0,
          mode: 'cached' as const,
          detail: 'Source désactivée par filtre',
        }),
    sources.includes('OPEN_METEO')
      ? fetchOpenMeteoSource(effectiveBounds, startAt, endAt, isHistorical)
      : Promise.resolve({
          events: [],
          summary: null,
          mode: 'cached' as const,
          fallbackUsed: null,
          detail: 'Source désactivée par filtre',
        }),
    sources.includes('OPENSTREETMAP')
      ? fetchOpenStreetMapSource(effectiveBounds, zoom)
      : Promise.resolve({
          events: [],
          mode: 'cached' as const,
          mappedWayCount: 0,
          zoomDeferred: true,
          fallbackUsed: null,
          detail: 'Source désactivée par filtre',
        }),
    sources.includes('TRAFFIC_API')
      ? fetchTrafficApiSource(effectiveBounds, zoom)
      : Promise.resolve({
          events: [],
          configured: true,
          mode: 'cached' as const,
          activeProviders: [],
          hasRegionalLiveFeed: false,
          fallbackUsed: null,
          detail: 'Source désactivée par filtre',
        }),
    sources.includes('OFFICIAL_ALERT')
      ? fetchOfficialExternalAlertsSource(effectiveBounds)
      : Promise.resolve({
          events: [],
          mode: 'cached' as const,
          activeProviders: [],
          fallbackUsed: null,
          detail: 'Source désactivée par filtre',
        }),
  ]);

  let matchingEvents = heatmapStore.queryEvents({
    minLat: effectiveBounds.southWest.lat,
    maxLat: effectiveBounds.northEast.lat,
    minLng: effectiveBounds.southWest.lng,
    maxLng: effectiveBounds.northEast.lng,
    startAt,
    endAt,
    includeExpired: isHistorical,
    categories,
    severities,
    sources,
  });

  if (
    zoneCenter &&
    (req.zoneFilter?.mode === 'radius' || req.zoneFilter?.mode === 'search')
  ) {
    matchingEvents = matchingEvents.filter(
      (ev) =>
        haversineMeters(zoneCenter, { lat: ev.lat, lng: ev.lng }) <= zoneRadius
    );
  }

  const cells = clusterEventsIntoCells(
    matchingEvents,
    zoom,
    endAt,
    isHistorical
  );

  // Historical comparison mode
  let comparison: HeatmapHistoricalCompareSummary | null = null;
  const cmpWin = resolveComparisonWindow(
    req.compareOffset,
    startAt,
    endAt,
    req.compareStartAt,
    req.compareEndAt
  );

  if (cmpWin) {
    let pastEvents = heatmapStore.queryEvents({
      minLat: effectiveBounds.southWest.lat,
      maxLat: effectiveBounds.northEast.lat,
      minLng: effectiveBounds.southWest.lng,
      maxLng: effectiveBounds.northEast.lng,
      startAt: cmpWin.startAt,
      endAt: cmpWin.endAt,
      includeExpired: true,
      categories,
      severities,
      sources,
    });
    if (
      zoneCenter &&
      (req.zoneFilter?.mode === 'radius' || req.zoneFilter?.mode === 'search')
    ) {
      pastEvents = pastEvents.filter(
        (ev) =>
          haversineMeters(zoneCenter, { lat: ev.lat, lng: ev.lng }) <=
          zoneRadius
      );
    }

    const pastCells = clusterEventsIntoCells(
      pastEvents,
      zoom,
      cmpWin.endAt,
      true
    );
    const pastMap = new Map(pastCells.map((c) => [c.cellId, c]));

    let aggravated = 0;
    let improved = 0;
    let stable = 0;

    cells.forEach((cell) => {
      const prev = pastMap.get(cell.cellId);
      const prevScore = prev ? prev.riskScore : 0;
      const delta = cell.riskScore - prevScore;
      cell.previousRiskScore = prevScore;
      cell.deltaScore = delta;
      if (delta >= 8) aggravated++;
      else if (delta <= -8) improved++;
      else stable++;
    });

    const curAvg =
      cells.length > 0
        ? Math.round(cells.reduce((acc, c) => acc + c.riskScore, 0) / cells.length)
        : 0;
    const prevAvg =
      pastCells.length > 0
        ? Math.round(
            pastCells.reduce((acc, c) => acc + c.riskScore, 0) / pastCells.length
          )
        : 0;

    comparison = {
      enabled: true,
      referenceLabel: cmpWin.label,
      referenceStartAt: cmpWin.startAt,
      referenceEndAt: cmpWin.endAt,
      currentAvgRisk: curAvg,
      previousAvgRisk: prevAvg,
      deltaAvgRisk: curAvg - prevAvg,
      aggravatedZones: aggravated,
      improvedZones: improved,
      stableZones: stable,
      currentCriticalCells: cells.filter((c) => c.riskLevel === 'CRITICAL')
        .length,
      previousCriticalCells: pastCells.filter((c) => c.riskLevel === 'CRITICAL')
        .length,
    };
  }

  const heatPoints: HeatmapHeatPoint[] = cells.map((c) => [
    c.center.lat,
    c.center.lng,
    c.heatIntensity,
  ]);

  const dedupedAll = deduplicateHeatmapEvents(matchingEvents);
  const rawConfirmationsCount = dedupedAll.reduce(
    (acc, e) => acc + e.confirmations,
    0
  );

  const criticalCells = cells.filter((c) => c.riskLevel === 'CRITICAL').length;
  const highCells = cells.filter((c) => c.riskLevel === 'HIGH').length;
  const moderateCells = cells.filter((c) => c.riskLevel === 'MODERATE').length;
  const lowCells = cells.filter((c) => c.riskLevel === 'LOW').length;

  const coverage = evaluateRegionCoverage({
    bounds: effectiveBounds,
    zoom,
    vruInBoundsCount: vruRes.inBoundsCount,
    meteoMode: meteoRes.mode,
    meteoFallback: meteoRes.fallbackUsed,
    osmMode: osmRes.mode,
    osmMappedWayCount: osmRes.mappedWayCount,
    osmZoomDeferred: osmRes.zoomDeferred,
    osmFallback: osmRes.fallbackUsed,
    trafficHasRegionalFeed: trafficRes.hasRegionalLiveFeed,
    trafficProviders: trafficRes.activeProviders,
    officialMode: officialRes.mode,
    officialProviders: officialRes.activeProviders,
    cellsCount: cells.length,
  });

  // CRITICAL HONESTY RULE:
  // Zero cells does NOT mean Safe ("LOW") unless local street infrastructure + live regional traffic + weather all verified zero hazards!
  const hasFullLocalVerification =
    !osmRes.zoomDeferred &&
    osmRes.mappedWayCount > 0 &&
    meteoRes.mode !== 'unavailable' &&
    trafficRes.hasRegionalLiveFeed;

  const insufficientData =
    cells.length === 0 && !hasFullLocalVerification;

  const topSlice = cells.slice(0, Math.max(1, Math.min(10, cells.length)));
  const computedScore =
    topSlice.length > 0
      ? Math.round(
          topSlice[0].riskScore * 0.45 +
            (topSlice.reduce((a, b) => a + b.riskScore, 0) / topSlice.length) *
              0.55
        )
      : 0;

  const regionRiskIndex: number | null = insufficientData ? null : computedScore;
  const regionRiskLevel: HeatmapRiskLevel = insufficientData
    ? 'UNKNOWN'
    : riskLevelFromScore(computedScore);

  if (cells.length > 0) {
    const centerGh = ngeohash.encode(
      (effectiveBounds.northEast.lat + effectiveBounds.southWest.lat) / 2,
      (effectiveBounds.northEast.lng + effectiveBounds.southWest.lng) / 2,
      6
    );
    heatmapStore.recordSnapshot(centerGh, cells.length, computedScore);
  }

  const countBySource = (src: HeatmapSourceId) =>
    dedupedAll.filter((e) => e.source === src).length;

  const sourceStatuses: HeatmapSourceStatus[] = [
    {
      source: 'VRUGUARD_USER',
      label: 'VRU Guard Sentinel',
      active: sources.includes('VRUGUARD_USER'),
      configured: true,
      eventCount: countBySource('VRUGUARD_USER'),
      mode: vruRes.mode,
      detail: vruRes.detail,
      lastSyncAt: now,
      coverageScope: 'GLOBAL',
      coverageLevel: vruRes.inBoundsCount > 0 ? 'FULL' : 'PARTIAL',
      fallbackUsed: null,
      refreshCadenceLabel: 'Temps réel (2 min)',
      nextSyncAt: now + 2 * 60 * 1000,
    },
    {
      source: 'TRAFFIC_API',
      label: 'Trafic Open Data Multi-Pays',
      active: sources.includes('TRAFFIC_API'),
      configured: trafficRes.configured,
      eventCount: countBySource('TRAFFIC_API'),
      mode: trafficRes.mode,
      detail: trafficRes.detail,
      lastSyncAt: now,
      coverageScope: trafficRes.hasRegionalLiveFeed ? 'REGIONAL' : 'GLOBAL',
      coverageLevel:
        coverage.byCategory.find((c) => c.category === 'TRAFFIC')?.level ||
        'PARTIAL',
      fallbackUsed: trafficRes.fallbackUsed,
      refreshCadenceLabel: 'Auto · 8–10 min',
      nextSyncAt: now + 8 * 60 * 1000,
    },
    {
      source: 'OPEN_METEO',
      label: 'Météo Mondiale (Open-Meteo)',
      active: sources.includes('OPEN_METEO'),
      configured: true,
      eventCount: countBySource('OPEN_METEO'),
      mode: meteoRes.mode,
      detail: meteoRes.detail,
      lastSyncAt: now,
      coverageScope: 'GLOBAL',
      coverageLevel: meteoRes.mode === 'unavailable' ? 'NONE' : 'FULL',
      fallbackUsed: meteoRes.fallbackUsed,
      refreshCadenceLabel: 'Auto · 10 min',
      nextSyncAt: now + 10 * 60 * 1000,
    },
    {
      source: 'OPENSTREETMAP',
      label: 'OpenStreetMap Voirie',
      active: sources.includes('OPENSTREETMAP'),
      configured: true,
      eventCount: countBySource('OPENSTREETMAP'),
      mode: osmRes.mode,
      detail: osmRes.detail,
      lastSyncAt: now,
      coverageScope: 'GLOBAL',
      coverageLevel:
        coverage.byCategory.find((c) => c.category === 'INFRASTRUCTURE')?.level ||
        'PARTIAL',
      fallbackUsed: osmRes.fallbackUsed,
      refreshCadenceLabel: 'Auto · 20 min',
      nextSyncAt: now + 20 * 60 * 1000,
    },
    {
      source: 'OFFICIAL_ALERT',
      label: 'Alertes Mondiales (GDACS/USGS/NASA)',
      active: sources.includes('OFFICIAL_ALERT'),
      configured: true,
      eventCount: countBySource('OFFICIAL_ALERT'),
      mode: officialRes.mode,
      detail: officialRes.detail,
      lastSyncAt: now,
      coverageScope: 'GLOBAL',
      coverageLevel: officialRes.mode === 'unavailable' ? 'NONE' : 'FULL',
      fallbackUsed: officialRes.fallbackUsed,
      refreshCadenceLabel: 'Auto · 15 min',
      nextSyncAt: now + 15 * 60 * 1000,
    },
  ];

  return {
    generatedAt: now,
    periodStartAt: startAt,
    periodEndAt: endAt,
    isHistorical,
    heatPoints,
    cells,
    weatherSummary: meteoRes.summary,
    sourceStatuses,
    coverage,
    stats: {
      regionRiskIndex,
      regionRiskLevel,
      insufficientData,
      totalCells: cells.length,
      criticalCells,
      highCells,
      moderateCells,
      lowCells,
      dedupEventsCount: dedupedAll.length,
      rawConfirmationsCount,
    },
    comparison,
  };
}

export async function inspectHeatmapZone(
  req: HeatmapZoneDetailRequest
): Promise<HeatmapZoneDetailResponse> {
  const now = Date.now();
  const radiusMeters = Math.max(150, Math.min(10000, req.radiusMeters || 450));
  const zoom = Number(req.zoom) || 13;
  const categories = req.categories?.length ? req.categories : ALL_CATEGORIES;
  const severities = req.severities?.length ? req.severities : ALL_SEVERITIES;
  const sources = req.sources?.length ? req.sources : ALL_SOURCES;

  const { startAt, endAt, isHistorical } = resolveTimeWindow(
    req.period,
    req.customStartAt,
    req.customEndAt,
    now
  );

  const dLat = radiusMeters / 111320;
  const dLng =
    radiusMeters /
    (111320 * Math.max(0.2, Math.cos((req.lat * Math.PI) / 180)));

  const bounds: ViewportBounds = {
    northEast: { lat: req.lat + dLat, lng: req.lng + dLng },
    southWest: { lat: req.lat - dLat, lng: req.lng - dLng },
  };

  const [meteoRes, osmRoadCheck] = await Promise.all([
    sources.includes('OPEN_METEO')
      ? fetchOpenMeteoSource(bounds, startAt, endAt, isHistorical)
      : Promise.resolve({
          events: [],
          summary: null,
          mode: 'cached' as const,
          fallbackUsed: null,
          detail: '',
        }),
    sources.includes('OPENSTREETMAP') && zoom >= 10
      ? ensureOsmRoadBaselineForPoint(req.lat, req.lng)
      : Promise.resolve({ known: false, roadCount: 0 }),
  ]);

  const candidates = heatmapStore
    .queryEvents({
      minLat: bounds.southWest.lat,
      maxLat: bounds.northEast.lat,
      minLng: bounds.southWest.lng,
      maxLng: bounds.northEast.lng,
      startAt,
      endAt,
      includeExpired: isHistorical,
      categories,
      severities,
      sources,
    })
    .filter(
      (ev) =>
        haversineMeters({ lat: req.lat, lng: req.lng }, { lat: ev.lat, lng: ev.lng }) <=
        radiusMeters
    );

  const summary = computeRiskSummaryForEvents(candidates, endAt, isHistorical);
  const eventsSorted = [...summary.dedupEvents].sort(
    (a, b) => b.severityScore - a.severityScore || b.lastUpdatedAt - a.lastUpdatedAt
  );

  const cap = detectRegionalCapabilities(bounds);
  const hasRegionalLiveFeed =
    cap.touchesParisIdf ||
    cap.touchesLondonUk ||
    cap.touchesFinland ||
    cap.touchesUsLower48;

  const hasVerifiedLocalSurface =
    osmRoadCheck.known && osmRoadCheck.roadCount > 0 && meteoRes.mode !== 'unavailable';

  // CRITICAL HONESTY CHECK:
  // If 0 events found AND no live regional municipal feed confirming clear road state + mapped OSM streets,
  // we MUST mark as UNKNOWN / Insufficient Data — NEVER "Safe / Faible 0/100"!
  const hasSufficientData =
    eventsSorted.length > 0 || (hasVerifiedLocalSurface && hasRegionalLiveFeed);

  const coverageStatus: HeatmapCoverageLevel = !osmRoadCheck.known || osmRoadCheck.roadCount === 0
    ? 'NONE'
    : hasRegionalLiveFeed
    ? 'FULL'
    : 'PARTIAL';

  const finalRiskScore: number | null = hasSufficientData ? summary.riskScore : null;
  const finalRiskLevel: HeatmapRiskLevel = hasSufficientData
    ? summary.riskLevel
    : 'UNKNOWN';

  let coverageNote = '';
  let unknownSafeWarning: string | null = null;
  if (coverageStatus === 'NONE') {
    coverageNote =
      'Aucune route OSM ni capteur local détecté dans ce rayon (ex: océan, zone rurale isolée ou échelle trop large).';
  } else if (coverageStatus === 'PARTIAL') {
    coverageNote = `Couverture partielle (${cap.regionLabel}) : météo et voirie OSM disponibles, mais aucun flux trafic municipal temps réel.`;
  } else {
    coverageNote = `Couverture complète multi-sources active sur ${cap.regionLabel}.`;
  }

  let densityVsDangerNote = '';
  if (!hasSufficientData) {
    unknownSafeWarning =
      "Données locales insuffisantes : l'absence de signalement ici ne signifie pas que la zone est sûre.";
    densityVsDangerNote =
      "Indice non affirmé (Données insuffisantes) — seuls la météo macro ou la voirie statique sont disponibles sans retour d'incident local.";
  } else if (eventsSorted.length === 0) {
    densityVsDangerNote =
      'Secteur vérifié (voirie OSM, météo & portail trafic local actifs) : aucun incident ni perturbation détecté.';
  } else if (summary.riskScore >= 75 && eventsSorted.length <= 3) {
    densityVsDangerNote = `Indice élevé (${summary.riskScore}/100) malgré ${summary.rawConfirmations} événement(s) : gravité intrinsèque critique détectée.`;
  } else if (summary.rawConfirmations >= 6 && summary.riskScore < 50) {
    densityVsDangerNote = `${summary.rawConfirmations} signalement(s) mineurs dédupliqués — l’indice réel reste modéré (${summary.riskScore}/100) car la gravité unitaire est faible.`;
  } else {
    densityVsDangerNote = `Indice calculé (${summary.riskScore}/100) pondérant gravité, fiabilité et synergie sur ${eventsSorted.length} aléa(s) distinct(s) (${summary.rawConfirmations} confirmations).`;
  }

  const categoryScores = (Object.keys(summary.categoryBreakdown) as HeatmapCategory[])
    .map((cat) => ({
      category: cat,
      maxSeverity: Math.round(summary.categoryMaxSeverity[cat] || 0),
      count: summary.categoryBreakdown[cat] || 0,
    }))
    .sort((a, b) => b.maxSeverity - a.maxSeverity);

  const collectedAt =
    eventsSorted.length > 0
      ? Math.min(...eventsSorted.map((e) => e.collectedAt))
      : null;
  const lastUpdatedAt =
    eventsSorted.length > 0
      ? Math.max(...eventsSorted.map((e) => e.lastUpdatedAt))
      : null;

  let comparison: HeatmapZoneDetailResponse['comparison'] = null;
  const cmpWin = resolveComparisonWindow(
    req.compareOffset,
    startAt,
    endAt,
    req.compareStartAt,
    req.compareEndAt
  );
  if (cmpWin) {
    const pastEvents = heatmapStore
      .queryEvents({
        minLat: bounds.southWest.lat,
        maxLat: bounds.northEast.lat,
        minLng: bounds.southWest.lng,
        maxLng: bounds.northEast.lng,
        startAt: cmpWin.startAt,
        endAt: cmpWin.endAt,
        includeExpired: true,
        categories,
        severities,
        sources,
      })
      .filter(
        (ev) =>
          haversineMeters(
            { lat: req.lat, lng: req.lng },
            { lat: ev.lat, lng: ev.lng }
          ) <= radiusMeters
      );
    const pastSummary = computeRiskSummaryForEvents(
      pastEvents,
      cmpWin.endAt,
      true
    );
    const prevAvailable = pastSummary.dedupEvents.length > 0 || hasVerifiedLocalSurface;
    if (finalRiskScore === null || !prevAvailable) {
      comparison = {
        previousRiskScore: prevAvailable ? pastSummary.riskScore : null,
        previousRiskLevel: prevAvailable ? pastSummary.riskLevel : 'UNKNOWN',
        previousEventCount: pastSummary.dedupEvents.length,
        deltaScore: null,
        trend: 'unknown',
        referenceLabel: cmpWin.label,
      };
    } else {
      const delta = finalRiskScore - pastSummary.riskScore;
      comparison = {
        previousRiskScore: pastSummary.riskScore,
        previousRiskLevel: pastSummary.riskLevel,
        previousEventCount: pastSummary.dedupEvents.length,
        deltaScore: delta,
        trend: delta >= 8 ? 'aggravated' : delta <= -8 ? 'improved' : 'stable',
        referenceLabel: cmpWin.label,
      };
    }
  }

  return {
    center: { lat: req.lat, lng: req.lng },
    radiusMeters,
    cellId: ngeohash.encode(req.lat, req.lng, 7),
    riskScore: finalRiskScore,
    riskLevel: finalRiskLevel,
    coverageStatus,
    hasSufficientData,
    coverageNote,
    unknownSafeWarning,
    rawEventCount: summary.rawConfirmations,
    dedupEventCount: eventsSorted.length,
    densityVsDangerNote,
    synergyBonus: summary.synergyBonus,
    categoryScores,
    weather: meteoRes.summary,
    events: eventsSorted.slice(0, 40),
    sources: Array.from(new Set(eventsSorted.map((e) => e.source))),
    collectedAt,
    lastUpdatedAt,
    comparison,
  };
}

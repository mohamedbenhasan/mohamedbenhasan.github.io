import assert from 'assert';
import {
  clusterEventsIntoCells,
  computeRiskSummaryForEvents,
  deduplicateHeatmapEvents,
  detectRegionalCapabilities,
  evaluateRegionCoverage,
  inspectHeatmapZone,
} from '../server/heatmapEngine';
import { heatmapStore, severityTierFromScore } from '../server/heatmapStore';
import {
  getEntitlementsForPlan,
  hasFeatureAccess,
  resolveEffectiveSubscription,
} from '../utils/subscriptionPlans';
import { HeatmapEvent } from '../types';

function makeEvent(overrides: Partial<HeatmapEvent>): HeatmapEvent {
  const now = Date.now();
  const sev = overrides.severityScore ?? 50;
  return {
    id: overrides.id || `ev_${Math.random().toString(36).slice(2, 8)}`,
    dedupKey: overrides.dedupKey || '',
    geohash: overrides.geohash || 'snx1g2h',
    lat: overrides.lat ?? 48.8566,
    lng: overrides.lng ?? 2.3522,
    category: overrides.category || 'INCIDENT',
    subType: overrides.subType || 'TEST',
    title: overrides.title || 'Test Event',
    description: overrides.description || 'Verification test event',
    source: overrides.source || 'VRUGUARD_USER',
    sourceLabel: overrides.sourceLabel || 'VRU Guard Sentinel',
    severityScore: sev,
    severityTier: severityTierFromScore(sev),
    reliability: overrides.reliability ?? 0.85,
    confirmations: overrides.confirmations ?? 1,
    natureWeight: overrides.natureWeight ?? 1.0,
    collectedAt: overrides.collectedAt ?? now - 30 * 60 * 1000,
    lastUpdatedAt: overrides.lastUpdatedAt ?? now - 10 * 60 * 1000,
    expiresAt: overrides.expiresAt === undefined ? now + 3600 * 1000 : overrides.expiresAt,
    status: overrides.status || 'active',
  };
}

async function run() {
  const now = Date.now();

  // 1. Density != Danger: 15 minor events vs 1 critical accident
  const manyMinor: HeatmapEvent[] = Array.from({ length: 15 }, (_, i) =>
    makeEvent({
      id: `minor_${i}`,
      dedupKey: `minor_cell_${i}:TRAFFIC:SLOW`,
      lat: 48.8566 + i * 0.00005,
      lng: 2.3522 + i * 0.00005,
      category: 'TRAFFIC',
      subType: 'SLOWDOWN',
      severityScore: 20,
      natureWeight: 0.85,
      reliability: 0.8,
    })
  );
  const oneCritical = [
    makeEvent({
      id: 'crit_1',
      dedupKey: 'crit_cell:INCIDENT:ACCIDENT',
      category: 'INCIDENT',
      subType: 'ACCIDENT',
      severityScore: 92,
      natureWeight: 1.12,
      reliability: 0.94,
    }),
  ];

  const minorSummary = computeRiskSummaryForEvents(manyMinor, now, false);
  const criticalSummary = computeRiskSummaryForEvents(oneCritical, now, false);
  assert(
    criticalSummary.riskScore > minorSummary.riskScore + 35,
    `Expected critical (${criticalSummary.riskScore}) >> 15 minor (${minorSummary.riskScore})`
  );
  assert.strictEqual(criticalSummary.riskLevel, 'CRITICAL');
  assert(minorSummary.riskScore < 35, `15 minor slowdowns should stay <=34, got ${minorSummary.riskScore}`);

  // 2. Spatial Deduplication merges same location & subType into 1 event with higher reliability
  const duplicates: HeatmapEvent[] = Array.from({ length: 5 }, (_, i) =>
    makeEvent({
      id: `dup_${i}`,
      dedupKey: 'u09tunq:INCIDENT:POTHOLE',
      severityScore: 48,
      reliability: 0.65,
    })
  );
  const deduped = deduplicateHeatmapEvents(duplicates);
  assert.strictEqual(deduped.length, 1, '5 duplicate reports should merge into 1 event');
  assert.strictEqual(deduped[0].confirmations, 5);
  assert(deduped[0].reliability > 0.85, 'Confirmations should raise reliability');
  assert.strictEqual(deduped[0].severityScore, 48, 'Duplicates must not inflate severityScore');

  // 3. Multi-category Synergy stays bounded [0, 100]
  const multiFactor = [
    makeEvent({ dedupKey: 'syn:WEATHER:RAIN', category: 'WEATHER', severityScore: 68, natureWeight: 1.05 }),
    makeEvent({ dedupKey: 'syn:INFRA:UNLIT', category: 'INFRASTRUCTURE', severityScore: 58, natureWeight: 1.04 }),
    makeEvent({ dedupKey: 'syn:INC:CRASH', category: 'INCIDENT', severityScore: 80, natureWeight: 1.1 }),
  ];
  const synSummary = computeRiskSummaryForEvents(multiFactor, now, false);
  assert(synSummary.synergyBonus >= 15, `Expected multi-category synergy >= 15, got ${synSummary.synergyBonus}`);
  assert(synSummary.riskScore <= 100 && synSummary.riskScore >= 85);

  // 4. Clustering produces calibrated heatIntensity [0.18..1.0]
  const cells = clusterEventsIntoCells(multiFactor, 13, now, false);
  assert.strictEqual(cells.length, 1);
  assert(cells[0].heatIntensity >= 0.8 && cells[0].heatIntensity <= 1.0);

  // 5. Store Expiration vs Historical Mode
  const expiredKey = 'test_verify_expired:INCIDENT:OLD_BLOCK';
  heatmapStore.ingestEvents([
    makeEvent({
      id: 'old_ev',
      dedupKey: expiredKey,
      lat: 51.5074,
      lng: -0.1278,
      collectedAt: now - 48 * 3600 * 1000,
      lastUpdatedAt: now - 46 * 3600 * 1000,
      expiresAt: now - 36 * 3600 * 1000,
      status: 'active',
    }),
  ]);

  const realtimeQuery = heatmapStore.queryEvents({
    minLat: 51.50,
    maxLat: 51.52,
    minLng: -0.14,
    maxLng: -0.11,
    startAt: now - 72 * 3600 * 1000,
    endAt: now,
    includeExpired: false,
  });
  assert(
    !realtimeQuery.some((e) => e.dedupKey === expiredKey),
    'Expired event must be excluded in realtime mode'
  );

  const histQuery = heatmapStore.queryEvents({
    minLat: 51.50,
    maxLat: 51.52,
    minLng: -0.14,
    maxLng: -0.11,
    startAt: now - 72 * 3600 * 1000,
    endAt: now - 30 * 3600 * 1000,
    includeExpired: true,
  });
  assert(
    histQuery.some((e) => e.dedupKey === expiredKey),
    'Expired past event must remain available in historical mode'
  );

  // 6. Premium Feature Gating Verification
  const freeSub = resolveEffectiveSubscription({ uid: 'u_free', plan: 'FREE', status: 'active' }, now);
  const premSub = resolveEffectiveSubscription(
    {
      uid: 'u_prem',
      plan: 'PREMIUM',
      status: 'active',
      paymentVerified: true,
      endDate: now + 30 * 86400_000,
    },
    now
  );
  const famSub = resolveEffectiveSubscription(
    {
      uid: 'u_fam',
      plan: 'FAMILY',
      status: 'active',
      paymentVerified: true,
      endDate: now + 30 * 86400_000,
    },
    now
  );
  assert.strictEqual(hasFeatureAccess(freeSub, 'global_risk_heatmap'), false);
  assert.strictEqual(hasFeatureAccess(premSub, 'global_risk_heatmap'), true);
  assert.strictEqual(hasFeatureAccess(famSub, 'global_risk_heatmap'), true);
  assert.strictEqual(getEntitlementsForPlan('BUSINESS').canViewRiskHeatmap, true);

  // 7. Global Coverage & Regional Availability Evaluator (multi-continent, never Tunisia-locked)
  const londonBounds = {
    northEast: { lat: 51.53, lng: -0.09 },
    southWest: { lat: 51.48, lng: -0.16 },
  };
  const tokyoBounds = {
    northEast: { lat: 35.72, lng: 139.79 },
    southWest: { lat: 35.65, lng: 139.68 },
  };
  const finlandBounds = {
    northEast: { lat: 60.25, lng: 25.05 },
    southWest: { lat: 60.15, lng: 24.85 },
  };

  assert.strictEqual(detectRegionalCapabilities(londonBounds).touchesLondonUk, true);
  assert.strictEqual(detectRegionalCapabilities(finlandBounds).touchesFinland, true);
  assert(detectRegionalCapabilities(tokyoBounds).regionLabel.includes('Asie'));

  const londonCov = evaluateRegionCoverage({
    bounds: londonBounds,
    zoom: 13,
    vruInBoundsCount: 1,
    meteoMode: 'live',
    meteoFallback: null,
    osmMode: 'live',
    osmMappedWayCount: 140,
    osmZoomDeferred: false,
    osmFallback: null,
    trafficHasRegionalFeed: true,
    trafficProviders: ['OSM Traffic Global', 'TfL London Open API'],
    officialMode: 'live',
    officialProviders: ['GDACS', 'USGS', 'NASA EONET'],
    cellsCount: 2,
  });
  assert.strictEqual(londonCov.overallStatus, 'FULL');
  assert.strictEqual(londonCov.byCategory.find((c) => c.category === 'TRAFFIC')?.level, 'FULL');

  const tokyoPartialCov = evaluateRegionCoverage({
    bounds: tokyoBounds,
    zoom: 13,
    vruInBoundsCount: 0,
    meteoMode: 'live',
    meteoFallback: 'MET Norway Locationforecast 2.0',
    osmMode: 'live',
    osmMappedWayCount: 220,
    osmZoomDeferred: false,
    osmFallback: null,
    trafficHasRegionalFeed: false,
    trafficProviders: ['OSM Traffic Global'],
    officialMode: 'live',
    officialProviders: ['GDACS', 'USGS', 'NASA EONET'],
    cellsCount: 0,
  });
  assert.strictEqual(tokyoPartialCov.overallStatus, 'PARTIAL');
  assert.strictEqual(tokyoPartialCov.byCategory.find((c) => c.category === 'TRAFFIC')?.level, 'PARTIAL');
  assert.strictEqual(tokyoPartialCov.byCategory.find((c) => c.category === 'WEATHER')?.level, 'FULL');
  assert(tokyoPartialCov.insufficientDataReason, 'Empty partial area must include insufficientDataReason');

  // 8. Honest Insufficient Data Rule: empty ocean point must return UNKNOWN (never LOW / Safe!)
  const oceanDetail = await inspectHeatmapZone({
    lat: 0.0,
    lng: -30.0,
    zoom: 6,
    radiusMeters: 450,
    categories: ['INCIDENT', 'TRAFFIC', 'WEATHER', 'INFRASTRUCTURE', 'EXTERNAL_ALERT'],
    period: '24h',
    severities: ['LOW', 'MODERATE', 'HIGH', 'CRITICAL'],
    sources: ['VRUGUARD_USER', 'TRAFFIC_API', 'OPENSTREETMAP', 'OFFICIAL_ALERT'],
  });
  assert.strictEqual(oceanDetail.riskLevel, 'UNKNOWN', 'Unverified zero-data zone must never be marked Safe/LOW');
  assert.strictEqual(oceanDetail.riskScore, null);
  assert.strictEqual(oceanDetail.hasSufficientData, false);
  assert(oceanDetail.unknownSafeWarning, 'Must explain that no data does not mean safe');

  console.log('GLOBAL HEATMAP VERIFICATION PASSED:', {
    criticalScore: criticalSummary.riskScore,
    fifteenMinorScore: minorSummary.riskScore,
    dedupConfirmations: deduped[0].confirmations,
    londonStatus: londonCov.overallStatus,
    tokyoStatus: tokyoPartialCov.overallStatus,
    oceanRiskLevel: oceanDetail.riskLevel,
  });
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as L from 'leaflet';
import { HeatLayer } from 'leaflet.heat';
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Car,
  Check,
  CloudRain,
  Compass,
  Construction,
  Crosshair,
  Database,
  Flame,
  GitCompare,
  Globe,
  Layers,
  Lock,
  MapPin,
  Radio,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  SlidersHorizontal,
  Thermometer,
  TrendingDown,
  TrendingUp,
  Wind,
  X,
} from 'lucide-react';
import {
  Coordinates,
  HeatmapCategory,
  HeatmapCell,
  HeatmapCompareOffset,
  HeatmapCoverageLevel,
  HeatmapPeriodPreset,
  HeatmapQueryResponse,
  HeatmapRiskLevel,
  HeatmapSeverityTier,
  HeatmapSourceId,
  HeatmapZoneDetailResponse,
  HeatmapZoneFilter,
  ViewportBounds,
} from '../types';
import { GeocodingCandidate, heatmapService } from '../services/HeatmapService';
import { ThemeToggle } from './ThemeToggle';
import { useAuth } from '../AuthContext';
import { toast } from '../services/NotificationService';

interface Props {
  onBack: () => void;
  onOpenPricing?: () => void;
}

// Worldwide default fallback (never locked to a single country or city)
const GLOBAL_DEFAULT_CENTER: Coordinates = { lat: 24.0, lng: 8.0 };
const GLOBAL_DEFAULT_ZOOM = 3;
const AUTO_SYNC_INTERVAL_SEC = 120;

const GLOBAL_PRESETS: Array<{
  id: string;
  label: string;
  lat: number;
  lng: number;
  zoom: number;
}> = [
  { id: 'world', label: 'Monde', lat: 24.0, lng: 8.0, zoom: 3 },
  { id: 'europe', label: 'Europe', lat: 48.85, lng: 9.0, zoom: 5 },
  { id: 'americas', label: 'Amériques', lat: 37.5, lng: -95.0, zoom: 4 },
  { id: 'africa', label: 'Afrique', lat: 6.5, lng: 18.0, zoom: 4 },
  { id: 'asia', label: 'Asie-Pacifique', lat: 31.0, lng: 112.0, zoom: 4 },
];

const CATEGORY_META: Record<
  HeatmapCategory,
  {
    label: string;
    shortLabel: string;
    description: string;
    colorClass: string;
    icon: React.FC<{ className?: string }>;
  }
> = {
  INCIDENT: {
    label: 'Incidents & Dangers VRU',
    shortLabel: 'Incidents',
    description: 'Accidents, obstacles, alertes V2X',
    colorClass: 'text-red-400',
    icon: AlertTriangle,
  },
  TRAFFIC: {
    label: 'Trafic & Travaux',
    shortLabel: 'Trafic',
    description: 'Congestions, travaux, fermetures',
    colorClass: 'text-amber-400',
    icon: Car,
  },
  WEATHER: {
    label: 'Conditions Météo',
    shortLabel: 'Météo',
    description: 'Pluies, inondations, vents, verglas',
    colorClass: 'text-sky-400',
    icon: CloudRain,
  },
  INFRASTRUCTURE: {
    label: 'Infrastructures',
    shortLabel: 'Voirie',
    description: 'Passages, éclairage, chaussée, PMR',
    colorClass: 'text-orange-400',
    icon: Construction,
  },
  EXTERNAL_ALERT: {
    label: 'Alertes Officielles',
    shortLabel: 'Officiel',
    description: 'WMO, GDACS, USGS, NASA EONET, NWS',
    colorClass: 'text-purple-400',
    icon: Radio,
  },
};

const SOURCE_META: Record<HeatmapSourceId, { label: string }> = {
  VRUGUARD_USER: { label: 'VRU Guard Sentinel' },
  TRAFFIC_API: { label: 'Trafic Open Data Multi-Pays' },
  OPEN_METEO: { label: 'Météo Mondiale (Open-Meteo / MET.no)' },
  OPENSTREETMAP: { label: 'OpenStreetMap Multi-Miroirs' },
  OFFICIAL_ALERT: { label: 'Alertes Mondiales (GDACS/USGS/NASA)' },
};

const SEVERITY_LABELS: Record<
  HeatmapSeverityTier,
  { label: string; range: string; bar: string; text: string }
> = {
  LOW: {
    label: 'Faible',
    range: '0–24',
    bar: 'bg-emerald-500',
    text: 'text-emerald-400',
  },
  MODERATE: {
    label: 'Modéré',
    range: '25–49',
    bar: 'bg-amber-500',
    text: 'text-amber-400',
  },
  HIGH: {
    label: 'Élevé',
    range: '50–74',
    bar: 'bg-orange-500',
    text: 'text-orange-400',
  },
  CRITICAL: {
    label: 'Critique',
    range: '75–100',
    bar: 'bg-red-600',
    text: 'text-red-400',
  },
};

const ALL_CATEGORIES: HeatmapCategory[] = [
  'INCIDENT',
  'TRAFFIC',
  'WEATHER',
  'INFRASTRUCTURE',
  'EXTERNAL_ALERT',
];

const ALL_SEVERITIES: HeatmapSeverityTier[] = ['CRITICAL', 'HIGH', 'MODERATE', 'LOW'];

const ALL_SOURCES: HeatmapSourceId[] = [
  'VRUGUARD_USER',
  'TRAFFIC_API',
  'OPEN_METEO',
  'OPENSTREETMAP',
  'OFFICIAL_ALERT',
];

function formatTimestamp(ms: number | null | undefined): string {
  if (!ms) return '—';
  return new Date(ms).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getRiskAccent(level: HeatmapRiskLevel) {
  switch (level) {
    case 'CRITICAL':
      return {
        label: 'Critique',
        text: 'text-red-400',
        border: 'border-red-500/40',
        bg: 'bg-red-500/10',
        bar: 'bg-red-600',
      };
    case 'HIGH':
      return {
        label: 'Élevé',
        text: 'text-orange-400',
        border: 'border-orange-500/40',
        bg: 'bg-orange-500/10',
        bar: 'bg-orange-500',
      };
    case 'MODERATE':
      return {
        label: 'Modéré',
        text: 'text-amber-400',
        border: 'border-amber-500/40',
        bg: 'bg-amber-500/10',
        bar: 'bg-amber-500',
      };
    case 'UNKNOWN':
      return {
        label: 'Données insuffisantes',
        text: 'text-slate-300',
        border: 'border-slate-600',
        bg: 'bg-slate-800/80',
        bar: 'bg-slate-600',
      };
    default:
      return {
        label: 'Faible',
        text: 'text-emerald-400',
        border: 'border-emerald-500/40',
        bg: 'bg-emerald-500/10',
        bar: 'bg-emerald-500',
      };
  }
}

function getCoverageMeta(level: HeatmapCoverageLevel | undefined) {
  switch (level) {
    case 'FULL':
      return {
        label: 'Disponible',
        text: 'text-emerald-400',
        border: 'border-emerald-500/40',
        bg: 'bg-emerald-500/10',
      };
    case 'PARTIAL':
      return {
        label: 'Partielle',
        text: 'text-amber-400',
        border: 'border-amber-500/40',
        bg: 'bg-amber-500/10',
      };
    default:
      return {
        label: 'Indisponible',
        text: 'text-slate-300',
        border: 'border-slate-700',
        bg: 'bg-slate-800/80',
      };
  }
}

export const RiskHeatmapPage: React.FC<Props> = ({ onBack, onOpenPricing }) => {
  const { hasFeature, openUpgradeModal, effectivePlan } = useAuth();
  const hasHeatmapAccess = hasFeature('global_risk_heatmap');

  // Filter & Personalization state
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [globalMode, setGlobalMode] = useState(true);
  const [categories, setCategories] = useState<HeatmapCategory[]>([...ALL_CATEGORIES]);
  const [period, setPeriod] = useState<HeatmapPeriodPreset>('24h');
  const [customStartDate, setCustomStartDate] = useState<string>(() =>
    new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10)
  );
  const [customEndDate, setCustomEndDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [severities, setSeverities] = useState<HeatmapSeverityTier[]>([...ALL_SEVERITIES]);
  const [sources, setSources] = useState<HeatmapSourceId[]>([...ALL_SOURCES]);
  const [zoneFilter, setZoneFilter] = useState<HeatmapZoneFilter>({
    mode: 'viewport',
    radiusMeters: 3000,
  });
  const [compareOffset, setCompareOffset] = useState<HeatmapCompareOffset>('none');

  // UI panels, auto-refresh & coverage directory
  const [isFilterOpen, setIsFilterOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );
  const [isCoverageModalOpen, setIsCoverageModalOpen] = useState(false);
  const [showCellContours, setShowCellContours] = useState(true);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [autoSyncCountdown, setAutoSyncCountdown] = useState(AUTO_SYNC_INTERVAL_SEC);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodingCandidate[]>([]);
  const [searching, setSearching] = useState(false);

  // Data state
  const [loadingMapData, setLoadingMapData] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [queryData, setQueryData] = useState<HeatmapQueryResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Zone Inspector state
  const [selectedPoint, setSelectedPoint] = useState<Coordinates | null>(null);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [zoneDetail, setZoneDetail] = useState<HeatmapZoneDetailResponse | null>(null);

  // Leaflet refs
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const refTileLayerRef = useRef<L.TileLayer | null>(null);
  const heatLayerRef = useRef<HeatLayer | null>(null);
  const contourGroupRef = useRef<L.LayerGroup | null>(null);
  const zoneCircleRef = useRef<L.Circle | null>(null);
  const inspectMarkerRef = useRef<L.Circle | null>(null);
  const debounceTimerRef = useRef<number | null>(null);

  const [viewportBounds, setViewportBounds] = useState<ViewportBounds>(() => ({
    northEast: { lat: 60.0, lng: 80.0 },
    southWest: { lat: -35.0, lng: -70.0 },
  }));
  const [mapZoom, setMapZoom] = useState<number>(GLOBAL_DEFAULT_ZOOM);
  const [isDarkTheme, setIsDarkTheme] = useState(() =>
    typeof document !== 'undefined'
      ? document.documentElement.classList.contains('dark')
      : true
  );

  // Watch dark/light class changes for Carto basemap sync
  useEffect(() => {
    if (typeof MutationObserver === 'undefined') return;
    const obs = new MutationObserver(() => {
      setIsDarkTheme(document.documentElement.classList.contains('dark'));
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  // Load saved user preferences
  useEffect(() => {
    if (!hasHeatmapAccess) return;
    let active = true;
    (async () => {
      try {
        const prefs = await heatmapService.getPreferences();
        if (!active) return;
        setGlobalMode(prefs.globalMode);
        setCategories(prefs.categories.length ? prefs.categories : [...ALL_CATEGORIES]);
        setPeriod(prefs.period || '24h');
        if (prefs.customStartAt) {
          setCustomStartDate(new Date(prefs.customStartAt).toISOString().slice(0, 10));
        }
        if (prefs.customEndAt) {
          setCustomEndDate(new Date(prefs.customEndAt).toISOString().slice(0, 10));
        }
        setSeverities(prefs.severities.length ? prefs.severities : [...ALL_SEVERITIES]);
        setSources(prefs.sources.length ? prefs.sources : [...ALL_SOURCES]);
        if (prefs.zoneFilter) {
          setZoneFilter(prefs.zoneFilter);
        }
        setCompareOffset(prefs.compareOffset || 'none');
      } catch {
        // keep defaults cleanly
      } finally {
        if (active) setPrefsLoaded(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [hasHeatmapAccess]);

  const customTimestamps = useMemo(() => {
    if (period !== 'custom') return { start: null, end: null };
    const s = Date.parse(`${customStartDate}T00:00:00Z`);
    const e = Date.parse(`${customEndDate}T23:59:59Z`);
    return {
      start: Number.isNaN(s) ? null : s,
      end: Number.isNaN(e) ? null : e,
    };
  }, [period, customStartDate, customEndDate]);

  const handleInspectCoordinate = useCallback(
    async (coords: Coordinates) => {
      if (!hasHeatmapAccess) {
        openUpgradeModal('global_risk_heatmap');
        return;
      }
      setSelectedPoint(coords);
      setInspectLoading(true);
      try {
        const detail = await heatmapService.inspectZone({
          lat: coords.lat,
          lng: coords.lng,
          zoom: mapZoom,
          radiusMeters: mapZoom >= 14 ? 350 : mapZoom >= 12 ? 750 : 1800,
          categories: globalMode ? ALL_CATEGORIES : categories,
          period,
          customStartAt: customTimestamps.start,
          customEndAt: customTimestamps.end,
          severities,
          sources,
          compareOffset,
        });
        setZoneDetail(detail);
      } catch (err: any) {
        toast.error(err?.message || "Impossible d'analyser cette zone.");
      } finally {
        setInspectLoading(false);
      }
    },
    [
      hasHeatmapAccess,
      openUpgradeModal,
      mapZoom,
      globalMode,
      categories,
      period,
      customTimestamps,
      severities,
      sources,
      compareOffset,
    ]
  );

  // Initialize Leaflet Map once container mounts (worldwide scale, minZoom 2)
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!hasHeatmapAccess || !container || mapInstanceRef.current) return;

    let isDisposed = false;

    if ((container as unknown as { _leaflet_id?: number | null })._leaflet_id) {
      (container as unknown as { _leaflet_id?: number | null })._leaflet_id = null;
    }

    const map = L.map(container, {
      center: [GLOBAL_DEFAULT_CENTER.lat, GLOBAL_DEFAULT_CENTER.lng],
      zoom: GLOBAL_DEFAULT_ZOOM,
      minZoom: 2,
      worldCopyJump: true,
      zoomControl: false,
      preferCanvas: true,
    });
    mapInstanceRef.current = map;

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const darkBaseUrl =
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';
    const darkLabelsUrl =
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}';
    const lightOsmUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

    const tile = L.tileLayer(isDarkTheme ? darkBaseUrl : lightOsmUrl, {
      attribution: '&copy; OpenStreetMap &copy; Esri',
      maxNativeZoom: isDarkTheme ? 16 : 19,
      maxZoom: 19,
    }).addTo(map);

    const refTile = L.tileLayer(darkLabelsUrl, {
      maxNativeZoom: 16,
      maxZoom: 19,
      opacity: isDarkTheme ? 0.92 : 0,
      pane: 'overlayPane',
    });
    if (isDarkTheme) {
      refTile.addTo(map);
    }

    // Automatic tile fallback if primary dark tile host fails in restrictive networks
    let usedTileFallback = false;
    tile.on('tileerror', () => {
      if (!usedTileFallback && !isDisposed) {
        usedTileFallback = true;
        tile.setUrl(lightOsmUrl);
      }
    });

    const heat = new HeatLayer([], {
      radius: 28,
      blur: 22,
      maxZoom: GLOBAL_DEFAULT_ZOOM,
      minOpacity: 0.45,
      max: 1.0,
      gradient: {
        0.15: '#22c55e',
        0.4: '#f59e0b',
        0.68: '#f97316',
        0.92: '#dc2626',
      },
    });
    map.addLayer(heat as unknown as L.Layer);

    const contourGroup = L.layerGroup().addTo(map);

    tileLayerRef.current = tile;
    refTileLayerRef.current = refTile;
    heatLayerRef.current = heat;
    contourGroupRef.current = contourGroup;

    const isMapAlive = () =>
      !isDisposed &&
      mapInstanceRef.current === map &&
      Boolean((map as unknown as { _mapPane?: HTMLElement })._mapPane) &&
      Boolean(map.getContainer()?.isConnected);

    const syncBounds = () => {
      if (!isMapAlive()) return;
      try {
        const b = map.getBounds();
        setViewportBounds({
          northEast: {
            lat: Math.min(85, b.getNorthEast().lat),
            lng: Math.min(180, b.getNorthEast().lng),
          },
          southWest: {
            lat: Math.max(-85, b.getSouthWest().lat),
            lng: Math.max(-180, b.getSouthWest().lng),
          },
        });
        setMapZoom(map.getZoom());
      } catch {
        // Ignore if map destroyed mid-frame
      }
    };

    map.on('moveend zoomend', syncBounds);
    map.on('click', (e: L.LeafletMouseEvent) => {
      handleInspectCoordinate({ lat: e.latlng.lat, lng: e.latlng.lng });
    });

    map.whenReady(() => {
      if (isMapAlive()) syncBounds();
    });

    // Respect user's real GPS location if permitted, otherwise stay in global overview
    heatmapService.getBrowserLocation().then((loc) => {
      if (!isMapAlive()) return;
      if (loc) {
        map.setView([loc.lat, loc.lng], 13, { animate: false });
      } else {
        syncBounds();
      }
    });

    return () => {
      isDisposed = true;
      map.off();
      map.remove();
      if (mapInstanceRef.current === map) {
        mapInstanceRef.current = null;
      }
      tileLayerRef.current = null;
      refTileLayerRef.current = null;
      heatLayerRef.current = null;
      contourGroupRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasHeatmapAccess]);

  // Keep map click callback fresh with latest filter state
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.off('click');
    map.on('click', (e: L.LeafletMouseEvent) => {
      handleInspectCoordinate({ lat: e.latlng.lat, lng: e.latlng.lng });
    });
  }, [handleInspectCoordinate]);

  // Swap free keyless basemap smoothly on Light/Dark theme switch
  useEffect(() => {
    const map = mapInstanceRef.current;
    const tile = tileLayerRef.current;
    const refTile = refTileLayerRef.current;
    if (!map || !tile) return;

    const darkBaseUrl =
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';
    const lightOsmUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

    tile.options.maxNativeZoom = isDarkTheme ? 16 : 19;
    tile.setUrl(isDarkTheme ? darkBaseUrl : lightOsmUrl);

    if (refTile) {
      if (isDarkTheme) {
        if (!map.hasLayer(refTile)) refTile.addTo(map);
        refTile.setOpacity(0.92);
      } else if (map.hasLayer(refTile)) {
        map.removeLayer(refTile);
      }
    }
  }, [isDarkTheme]);

  // Fetch Heatmap spatial data whenever bounds or filters change (debounced)
  const fetchHeatmapData = useCallback(async () => {
    if (!hasHeatmapAccess) return;
    setLoadingMapData(true);
    setErrorMsg(null);
    try {
      const res = await heatmapService.queryHeatmap({
        bounds: viewportBounds,
        zoom: mapZoom,
        categories: globalMode ? ALL_CATEGORIES : categories,
        period,
        customStartAt: customTimestamps.start,
        customEndAt: customTimestamps.end,
        severities,
        sources,
        zoneFilter,
        compareOffset,
      });
      setQueryData(res);
      setAutoSyncCountdown(AUTO_SYNC_INTERVAL_SEC);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erreur lors du chargement de la heatmap.');
    } finally {
      setLoadingMapData(false);
    }
  }, [
    hasHeatmapAccess,
    viewportBounds,
    mapZoom,
    globalMode,
    categories,
    period,
    customTimestamps,
    severities,
    sources,
    zoneFilter,
    compareOffset,
  ]);

  useEffect(() => {
    if (!hasHeatmapAccess || !prefsLoaded) return;
    if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = window.setTimeout(() => {
      fetchHeatmapData();
    }, 320);
    return () => {
      if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
    };
  }, [fetchHeatmapData, hasHeatmapAccess, prefsLoaded]);

  // Automatic periodic refresh aligned with real-time provider sync cadence
  useEffect(() => {
    if (!hasHeatmapAccess || !prefsLoaded || !autoSyncEnabled) return;
    const id = window.setInterval(() => {
      setAutoSyncCountdown((prev) => {
        if (prev <= 1) {
          fetchHeatmapData();
          return AUTO_SYNC_INTERVAL_SEC;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [hasHeatmapAccess, prefsLoaded, autoSyncEnabled, fetchHeatmapData]);

  // Render Leaflet HeatLayer + subtle hotspot inspection contours + zone circle
  useEffect(() => {
    const map = mapInstanceRef.current;
    const heat = heatLayerRef.current;
    const contours = contourGroupRef.current;
    if (!map || !heat || !contours || !(map as unknown as { _mapPane?: HTMLElement })._mapPane) return;

    const heatPts = queryData?.heatPoints || [];
    const dynamicRadius = mapZoom >= 15 ? 42 : mapZoom >= 13 ? 36 : mapZoom >= 10 ? 32 : 28;
    heat.setOptions({
      radius: dynamicRadius,
      blur: Math.round(dynamicRadius * 0.72),
      maxZoom: Math.max(2, mapZoom),
      minOpacity: 0.45,
    });
    heat.setLatLngs(heatPts);

    contours.clearLayers();
    if (showCellContours && queryData?.cells) {
      queryData.cells.slice(0, 180).forEach((cell: HeatmapCell) => {
        const color =
          cell.riskLevel === 'CRITICAL'
            ? '#ef4444'
            : cell.riskLevel === 'HIGH'
            ? '#f97316'
            : cell.riskLevel === 'MODERATE'
            ? '#f59e0b'
            : '#22c55e';

        const ringRadius =
          cell.riskLevel === 'CRITICAL' ? 14 : cell.riskLevel === 'HIGH' ? 11 : 8;

        const ring = L.circleMarker([cell.center.lat, cell.center.lng], {
          radius: ringRadius,
          color,
          weight:
            compareOffset !== 'none' &&
            typeof cell.deltaScore === 'number' &&
            Math.abs(cell.deltaScore) >= 8
              ? 2
              : 1,
          opacity: 0.45,
          fillColor: color,
          fillOpacity: 0.08,
        });

        ring.on('click', (ev) => {
          L.DomEvent.stopPropagation(ev);
          handleInspectCoordinate(cell.center);
        });

        const deltaLabel =
          compareOffset !== 'none' && typeof cell.deltaScore === 'number'
            ? ` · Δ ${cell.deltaScore > 0 ? '+' : ''}${cell.deltaScore}`
            : '';

        ring.bindTooltip(
          `<div class="px-2 py-1 text-xs font-mono">
            <strong>Indice ${cell.riskScore}/100</strong> (${getRiskAccent(cell.riskLevel).label})${deltaLabel}<br/>
            <span>${cell.topIssueSummary}</span>
          </div>`,
          { direction: 'top', opacity: 0.95 }
        );
        ring.addTo(contours);
      });
    }

    if (zoneCircleRef.current) {
      zoneCircleRef.current.remove();
      zoneCircleRef.current = null;
    }
    if (
      (zoneFilter.mode === 'radius' || zoneFilter.mode === 'search') &&
      zoneFilter.center
    ) {
      zoneCircleRef.current = L.circle(
        [zoneFilter.center.lat, zoneFilter.center.lng],
        {
          radius: zoneFilter.radiusMeters || 3000,
          color: '#3b82f6',
          weight: 2,
          dashArray: '6, 6',
          fillColor: '#3b82f6',
          fillOpacity: 0.06,
          interactive: false,
        }
      ).addTo(map);
    }
  }, [queryData, mapZoom, showCellContours, zoneFilter, compareOffset, handleInspectCoordinate]);

  // Selected inspection marker ring
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !(map as unknown as { _mapPane?: HTMLElement })._mapPane) return;
    if (inspectMarkerRef.current) {
      inspectMarkerRef.current.remove();
      inspectMarkerRef.current = null;
    }
    if (selectedPoint) {
      inspectMarkerRef.current = L.circle([selectedPoint.lat, selectedPoint.lng], {
        radius: zoneDetail?.radiusMeters || 450,
        color: '#ffffff',
        weight: 2,
        dashArray: '4, 4',
        fillColor: '#3b82f6',
        fillOpacity: 0.12,
        interactive: false,
      }).addTo(map);
    }
  }, [selectedPoint, zoneDetail?.radiusMeters]);

  const toggleCategory = (cat: HeatmapCategory) => {
    setGlobalMode(false);
    setCategories((prev) => {
      const exists = prev.includes(cat);
      if (exists && prev.length === 1) return prev;
      return exists ? prev.filter((c) => c !== cat) : [...prev, cat];
    });
  };

  const toggleSeverity = (sev: HeatmapSeverityTier) => {
    setSeverities((prev) => {
      const exists = prev.includes(sev);
      if (exists && prev.length === 1) return prev;
      return exists ? prev.filter((s) => s !== sev) : [...prev, sev];
    });
  };

  const toggleSource = (src: HeatmapSourceId) => {
    setSources((prev) => {
      const exists = prev.includes(src);
      if (exists && prev.length === 1) return prev;
      return exists ? prev.filter((s) => s !== src) : [...prev, src];
    });
  };

  const handleSavePreferences = async () => {
    setSavingPrefs(true);
    try {
      await heatmapService.savePreferences({
        globalMode,
        categories: globalMode ? ALL_CATEGORIES : categories,
        period,
        customStartAt: customTimestamps.start,
        customEndAt: customTimestamps.end,
        severities,
        sources,
        zoneFilter,
        compareOffset,
      });
      toast.success('Configuration de la Heatmap enregistrée sur votre compte.');
    } catch (err: any) {
      toast.error(err?.message || 'Erreur lors de la sauvegarde.');
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleResetFilters = () => {
    setGlobalMode(true);
    setCategories([...ALL_CATEGORIES]);
    setPeriod('24h');
    setSeverities([...ALL_SEVERITIES]);
    setSources([...ALL_SOURCES]);
    setZoneFilter({ mode: 'viewport', radiusMeters: 3000 });
    setCompareOffset('none');
    toast.info('Filtres réinitialisés.');
  };

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    const results = await heatmapService.searchAddress(searchQuery);
    setSearchResults(results);
    setSearching(false);
    if (results.length === 1 && mapInstanceRef.current) {
      const r = results[0];
      mapInstanceRef.current.setView([r.lat, r.lng], 13, { animate: true });
      setZoneFilter({
        mode: 'search',
        label: r.label.split(',')[0],
        center: { lat: r.lat, lng: r.lng },
        radiusMeters: zoneFilter.radiusMeters || 3000,
      });
      setSearchResults([]);
    }
  };

  const handleJumpToRegion = (lat: number, lng: number, zoom: number) => {
    setZoneFilter({ mode: 'viewport', radiusMeters: 3000 });
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([lat, lng], zoom, { animate: true });
    }
  };

  const handleCenterOnGps = async () => {
    const loc = await heatmapService.getBrowserLocation();
    if (!loc) {
      toast.warning('Localisation GPS indisponible ou refusée par le navigateur.');
      return;
    }
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([loc.lat, loc.lng], 13, { animate: true });
    }
    setZoneFilter((prev) => ({
      ...prev,
      mode: 'radius',
      label: 'Autour de ma position',
      center: loc,
      radiusMeters: prev.radiusMeters || 3000,
    }));
  };

  // Strict Premium Gate Screen
  if (!hasHeatmapAccess) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        <header className="h-16 border-b border-slate-800 bg-slate-950/90 px-4 sm:px-6 flex items-center justify-between">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-white px-3 py-2 rounded-xl border border-slate-800 bg-slate-900"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour
          </button>
          <ThemeToggle />
        </header>

        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-xl w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-600/15 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0">
                <Lock className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="text-[11px] font-mono tracking-wider text-blue-400">
                  Fonctionnalité VruGuard Premium
                </div>
                <h1 className="font-display text-2xl font-bold text-white">
                  Global Incident &amp; Risk Heatmap
                </h1>
                <p className="text-sm text-slate-300">
                  Votre formule actuelle ({effectivePlan}) n’inclut pas l’analyse thermique mondiale multi-sources et la comparaison historique.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-300">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="font-semibold text-white">Couverture mondiale multi-fournisseurs</div>
                <div className="text-slate-400">Open-Meteo, MET.no, OSM Miroirs, GDACS, USGS, NASA EONET &amp; flux trafic régionaux</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="font-semibold text-white">Indice de risque réel</div>
                <div className="text-slate-400">Gravité pondérée, transparence de couverture &amp; historique</div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={() => {
                  if (onOpenPricing) onOpenPricing();
                  else openUpgradeModal('global_risk_heatmap');
                }}
                className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-[#ffffff] text-sm font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <Flame className="w-4 h-4" />
                Débloquer avec Premium
              </button>
              <button
                onClick={onBack}
                className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium border border-slate-700"
              >
                Retour au tableau de bord
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const regionRiskLevel: HeatmapRiskLevel =
    queryData?.stats.insufficientData
      ? 'UNKNOWN'
      : queryData?.stats.regionRiskLevel || 'UNKNOWN';
  const regionAccent = getRiskAccent(regionRiskLevel);
  const regionCovMeta = getCoverageMeta(queryData?.coverage?.overallStatus);

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Bar */}
      <header className="h-14 sm:h-16 border-b border-slate-800 bg-slate-950/95 px-3 sm:px-5 flex items-center justify-between gap-2 sm:gap-4 shrink-0 z-30">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="h-9 px-2.5 sm:px-3 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap transition-colors"
            title="Retour au tableau de bord"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Tableau de bord</span>
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-[#ffffff] shrink-0">
              <Flame className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h1 className="font-display font-bold text-sm sm:text-base text-white truncate">
                Global Incident &amp; Risk Heatmap
              </h1>
              <p className="hidden sm:block text-[11px] text-slate-400 truncate">
                Couverture mondiale · Multi-fournisseurs libres · Gravité vs densité
              </p>
            </div>
          </div>
        </div>

        {/* Worldwide Geocoding Search */}
        <div className="relative flex-1 max-w-md hidden md:block">
          <form onSubmit={handleSearchSubmit} className="relative flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher n'importe quelle ville, rue ou pays..."
              className="w-full h-9 pl-9 pr-16 bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none"
            />
            {searching ? (
              <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin absolute right-3" />
            ) : (
              searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSearchResults([]);
                  }}
                  className="text-[11px] text-slate-400 hover:text-white absolute right-3"
                >
                  Effacer
                </button>
              )
            )}
          </form>

          {searchResults.length > 0 && (
            <div className="absolute left-0 right-0 top-11 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-[4000]">
              {searchResults.map((cand, idx) => (
                <button
                  key={`${cand.lat}_${cand.lng}_${idx}`}
                  type="button"
                  onClick={() => {
                    if (mapInstanceRef.current) {
                      mapInstanceRef.current.setView([cand.lat, cand.lng], 13, { animate: true });
                    }
                    setZoneFilter({
                      mode: 'search',
                      label: cand.label.split(',')[0],
                      center: { lat: cand.lat, lng: cand.lng },
                      radiusMeters: zoneFilter.radiusMeters || 3000,
                    });
                    setSearchResults([]);
                    setSearchQuery(cand.label.split(',')[0]);
                  }}
                  className="w-full px-3 py-2 text-left text-xs text-slate-200 hover:bg-slate-800 border-b border-slate-800 last:border-b-0 flex items-center gap-2"
                >
                  <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span className="truncate">{cand.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Top Bar Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsCoverageModalOpen(true)}
            className="h-9 px-2.5 sm:px-3 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            title="Voir la disponibilité des API par pays et catégorie"
          >
            <Globe className="w-4 h-4 text-sky-400" />
            <span className="hidden lg:inline">Couverture</span>
          </button>

          <button
            type="button"
            onClick={handleCenterOnGps}
            className="h-9 px-2.5 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            title="Centrer sur ma position GPS"
          >
            <Crosshair className="w-4 h-4 text-blue-400" />
            <span className="hidden xl:inline">Ma position</span>
          </button>

          <button
            type="button"
            onClick={() =>
              setCompareOffset((prev) => (prev === 'none' ? '7d' : 'none'))
            }
            className={`h-9 px-2.5 sm:px-3 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
              compareOffset !== 'none'
                ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300'
                : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
            title="Activer / désactiver le comparateur historique"
          >
            <GitCompare className="w-4 h-4" />
            <span className="hidden sm:inline">Comparer</span>
          </button>

          <button
            type="button"
            onClick={fetchHeatmapData}
            disabled={loadingMapData}
            className="h-9 w-9 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white inline-flex items-center justify-center disabled:opacity-50 shrink-0"
            title="Actualiser les sources maintenant"
            aria-label="Actualiser"
          >
            <RefreshCw className={`w-4 h-4 ${loadingMapData ? 'animate-spin text-blue-400' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => setIsFilterOpen((v) => !v)}
            className={`h-9 px-2.5 sm:px-3 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              isFilterOpen
                ? 'bg-blue-600 border-blue-500 text-[#ffffff]'
                : 'bg-slate-900 border-slate-800 text-slate-200 hover:bg-slate-800'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span className="hidden sm:inline">Filtres</span>
          </button>

          <ThemeToggle compact />
        </div>
      </header>

      {/* Crisp Global Telemetry & Regional Coverage Strip */}
      <div className="border-b border-slate-800 bg-slate-900/70 px-3 sm:px-5 py-2 shrink-0 overflow-x-auto">
        <div className="flex items-center justify-between gap-4 min-w-max text-xs">
          <div className="flex items-center gap-4">
            {/* Risk Score / Honest Unknown indicator */}
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Indice secteur :</span>
              {queryData && !queryData.stats.insufficientData && queryData.stats.regionRiskIndex !== null ? (
                <>
                  <span className={`font-mono font-bold text-sm tabular-nums ${regionAccent.text}`}>
                    {queryData.stats.regionRiskIndex}/100
                  </span>
                  <span className={`text-xs font-medium ${regionAccent.text}`}>
                    · {regionAccent.label}
                  </span>
                </>
              ) : (
                <span className="text-xs font-medium text-slate-300">
                  {queryData ? 'Non vérifié (Données insuffisantes)' : '—'}
                </span>
              )}
            </div>

            <div className="h-4 w-px bg-slate-800" />

            {/* Coverage Region & Availability Link */}
            <button
              type="button"
              onClick={() => setIsCoverageModalOpen(true)}
              className="flex items-center gap-1.5 hover:underline text-left"
              title="Détails de couverture par fournisseur et catégorie"
            >
              <Globe className="w-3.5 h-3.5 text-sky-400" />
              <span className="text-slate-200 font-medium">
                {queryData?.coverage?.regionLabel || 'Analyse globale'}
              </span>
              <span className="text-slate-600">·</span>
              <span className={`font-semibold ${regionCovMeta.text}`}>
                Couverture {regionCovMeta.label}
              </span>
            </button>

            <div className="h-4 w-px bg-slate-800" />

            <div className="flex items-center gap-3 font-mono tabular-nums">
              <span className="text-slate-400 font-sans">Hotspots :</span>
              <span className="text-red-400 font-semibold">
                {queryData?.stats.criticalCells ?? 0} Crit.
              </span>
              <span className="text-orange-400 font-semibold">
                {queryData?.stats.highCells ?? 0} Élevés
              </span>
              <span className="text-amber-400">
                {queryData?.stats.moderateCells ?? 0} Mod.
              </span>
            </div>

            <div className="h-4 w-px bg-slate-800" />

            <div className="flex items-center gap-1.5 font-mono tabular-nums text-slate-300">
              <span className="text-white font-semibold">
                {queryData?.stats.dedupEventsCount ?? 0}
              </span>
              <span className="text-slate-400 font-sans">aléas</span>
              <span className="text-slate-500">
                ({queryData?.stats.rawConfirmationsCount ?? 0} conf.)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {queryData?.weatherSummary && (
              <div className="flex items-center gap-2 text-slate-300 font-mono tabular-nums">
                <Thermometer className="w-3.5 h-3.5 text-sky-400" />
                <span>
                  {queryData.weatherSummary.temperatureC !== null
                    ? `${queryData.weatherSummary.temperatureC}°C`
                    : '—'}
                </span>
                <span className="text-slate-600">·</span>
                <Wind className="w-3.5 h-3.5 text-slate-400" />
                <span>{Math.round(queryData.weatherSummary.windSpeedKmh || 0)} km/h</span>
                {queryData.weatherSummary.precipitationMm !== null &&
                  queryData.weatherSummary.precipitationMm > 0 && (
                    <span className="text-sky-400 font-semibold">
                      · {queryData.weatherSummary.precipitationMm} mm/h
                    </span>
                  )}
              </div>
            )}

            {/* Auto-Sync toggle button */}
            <button
              type="button"
              onClick={() => setAutoSyncEnabled((v) => !v)}
              className="text-[11px] font-mono tabular-nums text-slate-400 hover:text-white border-l border-slate-800 pl-3 whitespace-nowrap"
              title="Activer ou suspendre l'actualisation automatique des API"
            >
              {autoSyncEnabled ? `Auto-Sync ${autoSyncCountdown}s` : 'Auto-Sync OFF'}
            </button>

            {queryData?.comparison?.enabled && (
              <div className="flex items-center gap-2 pl-3 border-l border-slate-800 font-mono tabular-nums">
                <span className="text-slate-400 font-sans">
                  {queryData.comparison.referenceLabel} :
                </span>
                <span
                  className={`font-bold inline-flex items-center gap-1 ${
                    queryData.comparison.deltaAvgRisk > 0
                      ? 'text-red-400'
                      : queryData.comparison.deltaAvgRisk < 0
                      ? 'text-emerald-400'
                      : 'text-slate-300'
                  }`}
                >
                  {queryData.comparison.deltaAvgRisk > 0 ? (
                    <TrendingUp className="w-3.5 h-3.5" />
                  ) : queryData.comparison.deltaAvgRisk < 0 ? (
                    <TrendingDown className="w-3.5 h-3.5" />
                  ) : null}
                  {queryData.comparison.deltaAvgRisk > 0 ? '+' : ''}
                  {queryData.comparison.deltaAvgRisk} pts
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Spatial Workspace */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Left Filter & Personalization Panel */}
        {isFilterOpen && (
          <aside className="w-80 sm:w-[340px] max-w-[90vw] bg-slate-950/95 lg:bg-slate-950 border-r border-slate-800 h-full overflow-y-auto p-4 space-y-5 shrink-0 z-[1500] absolute lg:relative left-0 top-0 bottom-0 shadow-2xl lg:shadow-none">
            <div className="flex items-center justify-between lg:hidden pb-2 border-b border-slate-800">
              <span className="font-display font-bold text-sm text-white">
                Filtres &amp; Personnalisation
              </span>
              <button
                type="button"
                onClick={() => setIsFilterOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mobile Search */}
            <form onSubmit={handleSearchSubmit} className="md:hidden relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher une ville ou un pays..."
                className="w-full h-9 pl-9 pr-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
              />
            </form>

            {/* Quick Global Continental Jump Bar */}
            <section className="space-y-2">
              <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-sky-400" />
                Navigation mondiale rapide
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {GLOBAL_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleJumpToRegion(preset.lat, preset.lng, preset.zoom)}
                    className="py-1.5 px-2 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-[11px] font-medium text-slate-200 whitespace-nowrap truncate"
                  >
                    {preset.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleCenterOnGps}
                  className="py-1.5 px-2 rounded-lg border border-blue-500/40 bg-blue-600/15 hover:bg-blue-600/25 text-[11px] font-medium text-blue-300 whitespace-nowrap"
                >
                  Mon GPS
                </button>
              </div>
            </section>

            {/* 1. Categories & Global Preset */}
            <section className="space-y-2.5 pt-2 border-t border-slate-800/80">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-slate-400">
                  Catégories de risques
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setGlobalMode(true);
                    setCategories([...ALL_CATEGORIES]);
                  }}
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded border transition-colors whitespace-nowrap ${
                    globalMode
                      ? 'bg-blue-600 border-blue-500 text-[#ffffff]'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white'
                  }`}
                >
                  Heatmap Globale
                </button>
              </div>

              <div className="space-y-1.5">
                {ALL_CATEGORIES.map((cat) => {
                  const meta = CATEGORY_META[cat];
                  const Icon = meta.icon;
                  const active = globalMode || categories.includes(cat);
                  const catCov = queryData?.coverage?.byCategory.find((c) => c.category === cat);
                  const covMeta = getCoverageMeta(catCov?.level);
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => toggleCategory(cat)}
                      className={`w-full px-3 py-2 rounded-xl border text-left flex items-center justify-between gap-2 transition-colors ${
                        active
                          ? 'bg-slate-900 border-slate-700 text-white'
                          : 'bg-slate-950 border-slate-800/70 text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon className={`w-4 h-4 shrink-0 ${active ? meta.colorClass : 'text-slate-600'}`} />
                        <div className="min-w-0">
                          <div className="text-xs font-semibold truncate">{meta.label}</div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {catCov ? `${covMeta.label} · ${meta.description}` : meta.description}
                          </div>
                        </div>
                      </div>
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                          active
                            ? 'bg-blue-600 border-blue-500 text-[#ffffff]'
                            : 'border-slate-700 bg-slate-950'
                        }`}
                      >
                        {active && <Check className="w-3 h-3" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* 2. Temporal & Historical Period */}
            <section className="space-y-2.5 pt-2 border-t border-slate-800/80">
              <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
                <Calendar className="w-3.5 h-3.5" />
                Période &amp; Historique
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    { id: 'realtime', label: 'Temps réel' },
                    { id: '24h', label: '24h' },
                    { id: '7d', label: '7 jours' },
                    { id: '30d', label: '30 jours' },
                    { id: 'custom', label: 'Plage' },
                  ] as Array<{ id: HeatmapPeriodPreset; label: string }>
                ).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPeriod(p.id)}
                    className={`py-1.5 px-2 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap ${
                      period === p.id
                        ? 'bg-blue-600 border-blue-500 text-[#ffffff]'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {period === 'custom' && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Du</label>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Au</label>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-white"
                    />
                  </div>
                </div>
              )}

              {/* Historical Comparison Selector */}
              <div className="pt-1 space-y-1.5">
                <label className="block text-[11px] text-slate-400">
                  Comparaison historique (évolution Δ)
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(
                    [
                      { id: 'none', label: 'Off' },
                      { id: '24h', label: '-24h' },
                      { id: '7d', label: '-7j' },
                      { id: '30d', label: '-30j' },
                    ] as Array<{ id: HeatmapCompareOffset; label: string }>
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setCompareOffset(opt.id)}
                      className={`py-1.5 rounded-lg border text-[11px] font-mono font-semibold transition-colors ${
                        compareOffset === opt.id
                          ? 'bg-indigo-600 border-indigo-500 text-[#ffffff]'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* 3. Geographic Zone Filter */}
            <section className="space-y-2.5 pt-2 border-t border-slate-800/80">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5" />
                  Zone géographique
                </span>
                {zoneFilter.mode !== 'viewport' && (
                  <button
                    type="button"
                    onClick={() => setZoneFilter({ mode: 'viewport', radiusMeters: 3000 })}
                    className="text-[10px] text-blue-400 hover:underline"
                  >
                    Toute la carte
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setZoneFilter({ mode: 'viewport', radiusMeters: zoneFilter.radiusMeters || 3000 })
                  }
                  className={`py-1.5 px-2.5 rounded-lg border text-xs font-semibold ${
                    zoneFilter.mode === 'viewport'
                      ? 'bg-blue-600 border-blue-500 text-[#ffffff]'
                      : 'bg-slate-900 border-slate-800 text-slate-300'
                  }`}
                >
                  Emprise carte
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const mapCenter = mapInstanceRef.current?.getCenter();
                    const center = mapCenter
                      ? { lat: mapCenter.lat, lng: mapCenter.lng }
                      : GLOBAL_DEFAULT_CENTER;
                    setZoneFilter({
                      mode: 'radius',
                      label: 'Rayon centré',
                      center,
                      radiusMeters: zoneFilter.radiusMeters || 3000,
                    });
                  }}
                  className={`py-1.5 px-2.5 rounded-lg border text-xs font-semibold ${
                    zoneFilter.mode !== 'viewport'
                      ? 'bg-blue-600 border-blue-500 text-[#ffffff]'
                      : 'bg-slate-900 border-slate-800 text-slate-300'
                  }`}
                >
                  Rayon ciblé
                </button>
              </div>

              {zoneFilter.mode !== 'viewport' && (
                <div className="space-y-1.5 bg-slate-900/80 border border-slate-800 rounded-xl p-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 truncate">
                      {zoneFilter.label || 'Zone personnalisée'}
                    </span>
                    <span className="font-mono font-semibold text-blue-400 tabular-nums">
                      {((zoneFilter.radiusMeters || 3000) / 1000).toFixed(1)} km
                    </span>
                  </div>
                  <input
                    type="range"
                    min={500}
                    max={25000}
                    step={500}
                    value={zoneFilter.radiusMeters || 3000}
                    onChange={(e) =>
                      setZoneFilter((prev) => ({
                        ...prev,
                        radiusMeters: Number(e.target.value),
                      }))
                    }
                    className="w-full accent-blue-500"
                  />
                </div>
              )}
            </section>

            {/* 4. Severity Levels */}
            <section className="space-y-2 pt-2 border-t border-slate-800/80">
              <div className="text-[11px] font-mono text-slate-400">
                Niveaux de gravité
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {ALL_SEVERITIES.map((sev) => {
                  const meta = SEVERITY_LABELS[sev];
                  const active = severities.includes(sev);
                  return (
                    <button
                      key={sev}
                      type="button"
                      onClick={() => toggleSeverity(sev)}
                      className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center justify-between transition-colors ${
                        active
                          ? 'bg-slate-900 border-slate-700 text-white'
                          : 'bg-slate-950 border-slate-800/60 text-slate-500'
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-sm ${meta.bar}`} />
                        {meta.label}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">{meta.range}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* 5. Data Sources, Failover & Refresh Transparency */}
            <section className="space-y-2 pt-2 border-t border-slate-800/80">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5" />
                  Sources mondiales (5)
                </span>
                <button
                  type="button"
                  onClick={() => setShowCellContours((v) => !v)}
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                    showCellContours
                      ? 'border-blue-500/40 bg-blue-500/10 text-blue-400'
                      : 'border-slate-800 text-slate-400'
                  }`}
                >
                  Contours {showCellContours ? 'ON' : 'OFF'}
                </button>
              </div>

              <div className="space-y-1.5">
                {ALL_SOURCES.map((srcId) => {
                  const active = sources.includes(srcId);
                  const liveStatus = queryData?.sourceStatuses.find((s) => s.source === srcId);
                  const cov = getCoverageMeta(liveStatus?.coverageLevel);
                  return (
                    <button
                      key={srcId}
                      type="button"
                      onClick={() => toggleSource(srcId)}
                      className={`w-full px-2.5 py-2 rounded-xl border text-left transition-colors ${
                        active
                          ? 'bg-slate-900 border-slate-700 text-slate-100'
                          : 'bg-slate-950 border-slate-800/70 text-slate-500'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold truncate">
                          {liveStatus?.label || SOURCE_META[srcId].label}
                        </span>
                        <span className="text-[10px] font-mono tabular-nums text-slate-400 shrink-0">
                          {liveStatus ? `${liveStatus.eventCount} · ${cov.label}` : active ? 'ON' : 'OFF'}
                        </span>
                      </div>
                      {liveStatus?.detail && (
                        <div className="text-[10px] text-slate-400 truncate mt-0.5">
                          {liveStatus.detail}
                        </div>
                      )}
                      {liveStatus && (
                        <div className="text-[10px] text-slate-500 font-mono truncate mt-0.5">
                          {liveStatus.refreshCadenceLabel}
                          {liveStatus.fallbackUsed ? ` · Failover : ${liveStatus.fallbackUsed}` : ''}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Save & Reset Configuration */}
            <div className="pt-3 border-t border-slate-800 flex items-center gap-2 sticky bottom-0 bg-slate-950 pb-1">
              <button
                type="button"
                onClick={handleSavePreferences}
                disabled={savingPrefs}
                className="flex-1 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-[#ffffff] text-xs font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {savingPrefs ? 'Sauvegarde...' : 'Enregistrer'}
              </button>
              <button
                type="button"
                onClick={handleResetFilters}
                className="py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold inline-flex items-center gap-1"
                title="Réinitialiser les filtres"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </aside>
        )}

        {/* Map Canvas Container */}
        <div className="flex-1 relative h-full min-w-0">
          <div ref={mapContainerRef} className="w-full h-full z-0" />

          {/* Error Banner if API call failed */}
          {errorMsg && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[1200] bg-red-950/90 border border-red-500/50 text-red-200 px-4 py-2 rounded-xl text-xs flex items-center gap-2 shadow-xl">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Legend & Honest Scale Overlay */}
          <div className="absolute bottom-4 left-3 sm:left-4 z-[1000] bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-xl p-3 shadow-xl max-w-[285px] space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] font-display font-bold text-white flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-orange-400" />
                Échelle de risque réel
              </span>
              <span className="text-[10px] font-mono text-slate-400 tabular-nums">
                Zoom {mapZoom}
              </span>
            </div>

            <div className="h-2 w-full rounded-sm bg-gradient-to-r from-[#22c55e] via-[#f59e0b] via-[#f97316] to-[#dc2626]" />

            <div className="grid grid-cols-4 gap-1 text-[10px] font-mono text-slate-300 tabular-nums">
              <div>
                <div className="text-emerald-400 font-semibold">Faible</div>
                <div className="text-slate-500">0–24</div>
              </div>
              <div>
                <div className="text-amber-400 font-semibold">Modéré</div>
                <div className="text-slate-500">25–49</div>
              </div>
              <div>
                <div className="text-orange-400 font-semibold">Élevé</div>
                <div className="text-slate-500">50–74</div>
              </div>
              <div className="text-right">
                <div className="text-red-400 font-semibold">Critique</div>
                <div className="text-slate-500">75+</div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1 border-t border-slate-800 text-[10px] text-slate-300">
              <span className="w-3 h-3 rounded-sm bg-slate-800 border border-slate-600 shrink-0" />
              <span>Zone neutre : non couverte ou sans données locales (≠ sûre)</span>
            </div>
          </div>
        </div>

        {/* Interactive Zone Inspector Drawer */}
        {selectedPoint && (
          <aside className="w-full sm:w-[400px] bg-slate-950 border-t sm:border-t-0 sm:border-l border-slate-800 h-[62vh] sm:h-full overflow-y-auto p-4 sm:p-5 space-y-4 shrink-0 z-[1600] absolute sm:relative bottom-0 left-0 right-0 sm:inset-auto rounded-t-2xl sm:rounded-none shadow-2xl">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="min-w-0">
                <div className="text-[10px] font-mono tracking-wider text-blue-400">
                  Inspection Spatiale · Cellule {zoneDetail?.cellId || '—'}
                </div>
                <h2 className="font-display text-base font-bold text-white mt-0.5">
                  Analyse de zone
                </h2>
                <div className="text-[11px] font-mono text-slate-400 tabular-nums mt-0.5">
                  {selectedPoint.lat.toFixed(5)}, {selectedPoint.lng.toFixed(5)} · Rayon{' '}
                  {zoneDetail?.radiusMeters ?? 450}m
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedPoint(null);
                  setZoneDetail(null);
                }}
                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800"
                aria-label="Fermer l'inspecteur"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {inspectLoading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400 text-xs">
                <RefreshCw className="w-6 h-6 animate-spin text-blue-400" />
                <span>Calcul de l’indice et vérification multi-fournisseurs...</span>
              </div>
            ) : zoneDetail ? (
              <div className="space-y-4">
                {/* Computed Score vs Honest Unknown Warning */}
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <div className="text-[11px] text-slate-400">Indice de Risque Calculé</div>
                      <div className="flex items-baseline gap-2 mt-0.5">
                        {zoneDetail.riskScore !== null && zoneDetail.riskLevel !== 'UNKNOWN' ? (
                          <>
                            <span
                              className={`font-mono text-3xl font-bold tabular-nums ${
                                getRiskAccent(zoneDetail.riskLevel).text
                              }`}
                            >
                              {zoneDetail.riskScore}
                            </span>
                            <span className="text-xs font-mono text-slate-500">/100</span>
                            <span className={`text-xs font-semibold ${getRiskAccent(zoneDetail.riskLevel).text}`}>
                              · {getRiskAccent(zoneDetail.riskLevel).label}
                            </span>
                          </>
                        ) : (
                          <span className="text-base font-bold text-slate-200">
                            Non vérifié (Données insuffisantes)
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right font-mono tabular-nums">
                      <div className="text-[10px] text-slate-400">Aléas / Conf.</div>
                      <div className="text-sm font-bold text-white">
                        {zoneDetail.dedupEventCount}{' '}
                        <span className="text-slate-500 font-normal">/ {zoneDetail.rawEventCount}</span>
                      </div>
                    </div>
                  </div>

                  {zoneDetail.riskScore !== null && zoneDetail.riskLevel !== 'UNKNOWN' && (
                    <div className="h-2 w-full bg-slate-950 rounded-sm overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          getRiskAccent(zoneDetail.riskLevel).bar
                        }`}
                        style={{ width: `${Math.max(4, zoneDetail.riskScore)}%` }}
                      />
                    </div>
                  )}

                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    {zoneDetail.densityVsDangerNote}
                  </p>

                  {zoneDetail.unknownSafeWarning && (
                    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-[11px] text-amber-300 flex items-start gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>{zoneDetail.unknownSafeWarning}</span>
                    </div>
                  )}

                  <div className="text-[10px] text-slate-400 border-t border-slate-800 pt-2">
                    <span className="font-semibold text-slate-300">
                      Couverture {getCoverageMeta(zoneDetail.coverageStatus).label} :
                    </span>{' '}
                    {zoneDetail.coverageNote}
                  </div>

                  {zoneDetail.synergyBonus > 0 && (
                    <div className="text-[11px] font-mono text-amber-400">
                      + Synergie multi-facteurs : +{zoneDetail.synergyBonus} pts
                    </div>
                  )}
                </div>

                {/* Historical Comparison Card */}
                {zoneDetail.comparison && (
                  <div className="p-3.5 rounded-xl bg-slate-900 border border-indigo-500/30 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-indigo-300 flex items-center gap-1.5">
                        <GitCompare className="w-3.5 h-3.5" />
                        Comparaison ({zoneDetail.comparison.referenceLabel})
                      </span>
                      <span className="font-mono font-bold tabular-nums text-slate-200">
                        {zoneDetail.comparison.deltaScore === null
                          ? 'Non vérifié'
                          : `${zoneDetail.comparison.deltaScore > 0 ? '+' : ''}${zoneDetail.comparison.deltaScore} pts`}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-300 font-mono tabular-nums">
                      Précédent : {zoneDetail.comparison.previousRiskScore ?? '—'}/100 (
                      {zoneDetail.comparison.previousEventCount} aléas) · Tendance :{' '}
                      {zoneDetail.comparison.trend === 'aggravated'
                        ? 'Aggravation'
                        : zoneDetail.comparison.trend === 'improved'
                        ? 'Amélioration'
                        : zoneDetail.comparison.trend === 'stable'
                        ? 'Stable'
                        : 'Données insuffisantes'}
                    </div>
                  </div>
                )}

                {/* Weather Conditions Snapshot */}
                {zoneDetail.weather && (
                  <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-white flex items-center gap-1.5">
                        <CloudRain className="w-3.5 h-3.5 text-sky-400" />
                        Météo ({zoneDetail.weather.providerName || 'Open-Meteo'})
                      </span>
                      <span className="text-[11px] text-sky-400">
                        {zoneDetail.weather.conditionLabel}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[11px] font-mono tabular-nums text-slate-300">
                      <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-2">
                        <div className="text-[10px] text-slate-500">Temp.</div>
                        <div className="font-semibold text-white">
                          {zoneDetail.weather.temperatureC ?? '—'}°C
                        </div>
                      </div>
                      <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-2">
                        <div className="text-[10px] text-slate-500">Pluie</div>
                        <div className="font-semibold text-white">
                          {zoneDetail.weather.precipitationMm ?? 0} mm
                        </div>
                      </div>
                      <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-2">
                        <div className="text-[10px] text-slate-500">Vent/Raf.</div>
                        <div className="font-semibold text-white">
                          {Math.round(zoneDetail.weather.windGustsKmh || zoneDetail.weather.windSpeedKmh || 0)} km/h
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Timestamps Metadata */}
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono tabular-nums">
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                    <div className="text-[10px] text-slate-500">Collecté le</div>
                    <div className="text-slate-200 mt-0.5">
                      {formatTimestamp(zoneDetail.collectedAt)}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                    <div className="text-[10px] text-slate-500">Mis à jour</div>
                    <div className="text-slate-200 mt-0.5">
                      {formatTimestamp(zoneDetail.lastUpdatedAt)}
                    </div>
                  </div>
                </div>

                {/* Deduplicated Events List */}
                <div className="space-y-2">
                  <h3 className="text-xs font-display font-bold text-white">
                    Problèmes &amp; Aléas détectés ({zoneDetail.events.length})
                  </h3>

                  {zoneDetail.events.length === 0 ? (
                    <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-400 text-center">
                      {zoneDetail.hasSufficientData
                        ? 'Aucun incident ou perturbation répertorié dans ce périmètre vérifié.'
                        : 'Aucun capteur local ou signalement ici — absence de données ne vaut pas sécurité.'}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {zoneDetail.events.map((ev) => {
                        const catMeta = CATEGORY_META[ev.category];
                        const sevMeta = SEVERITY_LABELS[ev.severityTier];
                        return (
                          <div
                            key={ev.id}
                            className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 text-[10px] font-mono">
                                  <span className={catMeta.colorClass}>{catMeta.shortLabel}</span>
                                  <span className="text-slate-600">·</span>
                                  <span className="text-slate-400">{ev.sourceLabel}</span>
                                </div>
                                <div className="text-xs font-semibold text-white mt-0.5">
                                  {ev.title}
                                </div>
                              </div>
                              <span className={`font-mono text-xs font-bold tabular-nums shrink-0 ${sevMeta.text}`}>
                                {ev.severityScore}/100
                              </span>
                            </div>

                            <p className="text-[11px] text-slate-300 leading-snug">
                              {ev.description}
                            </p>

                            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-800/80 tabular-nums">
                              <span>
                                Fiabilité {Math.round(ev.reliability * 100)}% · {ev.confirmations} conf.
                              </span>
                              <span>{formatTimestamp(ev.lastUpdatedAt)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </aside>
        )}
      </div>

      {/* Global Coverage & Multi-Provider Failover Modal */}
      {isCoverageModalOpen && queryData?.coverage && (
        <div className="fixed inset-0 z-[3000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[88vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-base font-bold text-white flex items-center gap-2">
                  <Globe className="w-4 h-4 text-sky-400" />
                  Couverture Géographique Mondiale &amp; API Libres
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Emprise actuelle : {queryData.coverage.regionLabel} · Statut global : {regionCovMeta.label}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCoverageModalOpen(false)}
                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-6">
              <p className="text-xs text-slate-300 bg-slate-900 border border-slate-800 rounded-xl p-3">
                {queryData.coverage.summaryNote}
              </p>

              {/* Category Availability Table */}
              <div className="space-y-2">
                <h3 className="text-xs font-display font-bold text-white">
                  Disponibilité par catégorie dans cette emprise
                </h3>
                <div className="border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800">
                  {queryData.coverage.byCategory.map((item) => {
                    const cov = getCoverageMeta(item.level);
                    return (
                      <div key={item.category} className="p-3 bg-slate-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                        <div className="min-w-0">
                          <div className="font-semibold text-white">{item.label}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5">{item.note}</div>
                        </div>
                        <div className="shrink-0 text-left sm:text-right">
                          <div className={`font-mono font-semibold ${cov.text}`}>{cov.label}</div>
                          <div className="text-[10px] font-mono text-slate-500">
                            {item.providers.join(' / ')}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Worldwide & Regional Free Providers Matrix */}
              <div className="space-y-2">
                <h3 className="text-xs font-display font-bold text-white">
                  Fournisseurs gratuits mondiaux, portails régionaux &amp; basculement (Failover)
                </h3>
                <div className="border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800">
                  {queryData.coverage.knownRegionalFeeds.map((feed) => (
                    <div key={feed.id} className="p-3 bg-slate-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div className="min-w-0 space-y-0.5">
                        <div className="font-semibold text-white">
                          {feed.name}{' '}
                          <span className="text-[10px] font-mono font-normal text-slate-400">
                            · {feed.scope === 'GLOBAL' ? 'Mondial' : 'Régional'}
                            {feed.failoverCapable ? ' · Failover auto' : ''}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {feed.regionLabel} · {feed.refreshCadenceLabel}
                        </div>
                      </div>
                      <div className={`text-[11px] font-mono shrink-0 ${feed.activeInViewport ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {feed.statusNote}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

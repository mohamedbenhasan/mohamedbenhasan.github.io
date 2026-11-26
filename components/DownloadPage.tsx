import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  ArrowRight,
  BellRing,
  Bike,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  FileCheck2,
  Footprints,
  Image as ImageIcon,
  Loader2,
  Mail,
  MapPin,
  Maximize2,
  Menu,
  Navigation,
  QrCode,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Smartphone,
  Sparkles,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { androidAppService, formatBytes } from '../services/AndroidAppService';
import { AndroidLatestVersionResponse, SubscriptionPlan } from '../types';
import { ThemeToggle } from './ThemeToggle';
import { toast } from '../services/NotificationService';
import { VruLogo } from './VruLogo';

import vruMissionImg from '../src/assets/images/vru_sentinel_mission_1795167913927.jpg';

interface DownloadPageProps {
  onBack: () => void;
  onLaunchApp?: () => void;
  onOpenPricing?: (highlightPlan?: SubscriptionPlan) => void;
  isAuthenticated?: boolean;
}

interface ScreenshotSlot {
  id: string;
  indexLabel: string;
  fileName: string;
  publicPath: string;
  sourcePath: string;
  title: string;
  subtitle: string;
  description: string;
  recommendedSize: string;
}

type SlotLoadStatus = 'loading' | 'ready' | 'placeholder';

type MobilityProfileId = 'pedestrian' | 'cyclist' | 'scooter' | 'pmr_family';

const SCREENSHOT_SLOTS: ScreenshotSlot[] = [
  {
    id: 'map-navigation',
    indexLabel: '01',
    fileName: '01-carte-navigation.png',
    publicPath: '/images/app-screenshots/01-carte-navigation.png',
    sourcePath: 'public/images/app-screenshots/01-carte-navigation.png',
    title: 'Carte & Navigation GPS',
    subtitle: 'Écran principal · Localisation & Itinéraires',
    description:
      'Carte interactive temps réel, calage routier intelligent, recherche de trajet et accès instantané aux couches cyclables et trafic.',
    recommendedSize: '1080 × 2400 px (PNG)',
  },
  {
    id: 'risk-alerts',
    indexLabel: '02',
    fileName: '02-alertes-risque.png',
    publicPath: '/images/app-screenshots/02-alertes-risque.png',
    sourcePath: 'public/images/app-screenshots/02-alertes-risque.png',
    title: 'Alertes & Score de risque',
    subtitle: 'Prévention dynamique & Messages V2X',
    description:
      'Analyse des zones sensibles, indice de vigilance en direct selon les conditions urbaines et alertes de proximité contextualisées.',
    recommendedSize: '1080 × 2400 px (PNG)',
  },
  {
    id: 'sos-emergency',
    indexLabel: '03',
    fileName: '03-assistance-sos.png',
    publicPath: '/images/app-screenshots/03-assistance-sos.png',
    sourcePath: 'public/images/app-screenshots/03-assistance-sos.png',
    title: 'Assistance SOS & Contacts',
    subtitle: 'Protection d’urgence · Premium & Family',
    description:
      'Déclenchement SOS sécurisé en un geste ou à la voix, transmission immédiate de votre position et alerte des contacts de confiance.',
    recommendedSize: '1080 × 2400 px (PNG)',
  },
  {
    id: 'family-tracking',
    indexLabel: '04',
    fileName: '04-suivi-famille.png',
    publicPath: '/images/app-screenshots/04-suivi-famille.png',
    sourcePath: 'public/images/app-screenshots/04-suivi-famille.png',
    title: 'Suivi & Partage familial',
    subtitle: 'Trajets sécurisés · Jusqu’à 6 profils',
    description:
      'Partage temporaire de position en direct pour rassurer vos proches lors d’un trajet nocturne ou suivi centralisé de la famille.',
    recommendedSize: '1080 × 2400 px (PNG)',
  },
  {
    id: 'profile-updates',
    indexLabel: '05',
    fileName: '05-profil-parametres.png',
    publicPath: '/images/app-screenshots/05-profil-parametres.png',
    sourcePath: 'public/images/app-screenshots/05-profil-parametres.png',
    title: 'Profil, Offre & Mises à jour',
    subtitle: 'Compte VruGuard · Redeem & APK',
    description:
      'Gestion de votre formule (Free, Premium, Family), activation de code Redeem et contrôle intégré des nouvelles versions Android.',
    recommendedSize: '1080 × 2400 px (PNG)',
  },
];

const MOBILITY_PROFILES: Array<{
  id: MobilityProfileId;
  label: string;
  headline: string;
  detail: string;
  focus: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: 'pedestrian',
    label: 'Piétons',
    headline: 'Traversées sécurisées & guidage apaisé',
    detail:
      'Détection des carrefours accidentogènes, alertes de proximité en environnement dense et partage de trajet rassurant lors des déplacements nocturnes.',
    focus: 'Priorité : visibilité urbaine & alerte rapide',
    icon: Footprints,
  },
  {
    id: 'cyclist',
    label: 'Cyclistes',
    headline: 'Itinéraires cyclables & alertes mains libres',
    detail:
      'Affichage des aménagements cyclables, avertissements vocaux et haptiques avant les zones à risque et suivi continu même en canyon urbain.',
    focus: 'Priorité : anticipation & guidage vocal',
    icon: Bike,
  },
  {
    id: 'scooter',
    label: 'Trottinettes',
    headline: 'Réactivité immédiate en micro-mobilité',
    detail:
      'Calage précis sur la chaussée, signalement instantané des obstacles ou chaussées dégradées et déclenchement SOS simplifié en cas de chute.',
    focus: 'Priorité : précision temps réel & SOS',
    icon: Zap,
  },
  {
    id: 'pmr_family',
    label: 'PMR & Familles',
    headline: 'Accessibilité maîtrisée & lien familial continu',
    detail:
      'Prise en compte des critères d’accessibilité PMR, signalement participatif des entraves sur trottoir et supervision bienveillante jusqu’à 6 membres.',
    focus: 'Priorité : trajets accessibles & tranquillité',
    icon: Users,
  },
];

export const DownloadPage: React.FC<DownloadPageProps> = ({
  onBack,
  onLaunchApp,
  onOpenPricing,
  isAuthenticated = false,
}) => {
  const [info, setInfo] = useState<AndroidLatestVersionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [legalModal, setLegalModal] = useState<'privacy' | 'terms' | null>(null);

  // Gallery state
  const [activeSlideIdx, setActiveSlideIdx] = useState(0);
  const [slotStatusMap, setSlotStatusMap] = useState<Record<string, SlotLoadStatus>>(() =>
    Object.fromEntries(SCREENSHOT_SLOTS.map((s) => [s.id, 'loading' as SlotLoadStatus]))
  );
  const [zoomedSlot, setZoomedSlot] = useState<ScreenshotSlot | null>(null);
  const touchStartXRef = useRef<number | null>(null);

  // Mission profile selector state
  const [activeProfile, setActiveProfile] = useState<MobilityProfileId>('cyclist');

  // Download & QR state
  const [qrMode, setQrMode] = useState<'page' | 'apk'>('apk');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copiedSha, setCopiedSha] = useState(false);
  const [chunkDownloadingPct, setChunkDownloadingPct] = useState<number | null>(null);
  const autoStartedRef = useRef(false);

  const loadLatest = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await androidAppService.getLatestVersion();
      setInfo(res);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Impossible de récupérer les informations de version.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLatest();
  }, []);

  // Preload screenshot slots so status badges reflect user-added PNG files immediately
  useEffect(() => {
    let active = true;
    SCREENSHOT_SLOTS.forEach((slot) => {
      const img = new window.Image();
      img.onload = () => {
        if (!active) return;
        const isReal = img.naturalWidth >= 120 && img.naturalHeight >= 120;
        setSlotStatusMap((prev) => ({
          ...prev,
          [slot.id]: isReal ? 'ready' : 'placeholder',
        }));
      };
      img.onerror = () => {
        if (!active) return;
        setSlotStatusMap((prev) => ({
          ...prev,
          [slot.id]: 'placeholder',
        }));
      };
      img.src = slot.publicPath;
    });
    return () => {
      active = false;
    };
  }, []);

  // Dedicated SEO metadata for /download
  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;
    const prevTitle = document.title;
    const host = window.location.hostname.toLowerCase();
    const canonicalOrigin =
      host === 'vruguard.me' || host === 'www.vruguard.me'
        ? 'https://www.vruguard.me'
        : window.location.origin;
    const pageUrl = `${canonicalOrigin}/download`;
    const seoTitle =
      info?.available && info.versionName
        ? `Télécharger l’application VruGuard v${info.versionName} pour Android (APK) | VruGuard`
        : 'Télécharger l’application VruGuard pour Android (APK) | VruGuard';
    const seoDescription =
      'Téléchargez l’application de sécurité routière VruGuard (VRU Guard Sentinel) pour Android : carte interactive des incidents, alertes routières, signalement des dangers et assistance SOS.';

    document.title = seoTitle;

    const upsertMeta = (attr: 'name' | 'property', key: string, value: string) => {
      let tag = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
      const prev = tag?.getAttribute('content') || null;
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute(attr, key);
        document.head.appendChild(tag);
      }
      tag.setAttribute('content', value);
      return { tag, prev };
    };

    const metaUpdates = [
      upsertMeta('name', 'robots', 'index, follow'),
      upsertMeta('name', 'description', seoDescription),
      upsertMeta('property', 'og:type', 'website'),
      upsertMeta('property', 'og:title', seoTitle),
      upsertMeta('property', 'og:description', seoDescription),
      upsertMeta('property', 'og:url', pageUrl),
      upsertMeta('property', 'og:image', `${canonicalOrigin}/favicon-192x192.png`),
      upsertMeta('name', 'twitter:card', 'summary'),
      upsertMeta('name', 'twitter:title', seoTitle),
      upsertMeta('name', 'twitter:description', seoDescription),
      upsertMeta('name', 'twitter:image', `${canonicalOrigin}/favicon-192x192.png`),
    ];

    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    const createdCanonical = !canonical;
    const prevCanonical = canonical?.getAttribute('href') || null;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = pageUrl;

    const ldScript = document.createElement('script');
    ldScript.type = 'application/ld+json';
    ldScript.id = 'vruguard-download-jsonld';
    ldScript.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      '@id': `${pageUrl}#software`,
      name: info?.appName || 'VRU Guard Sentinel',
      alternateName: 'VruGuard Android',
      operatingSystem: info?.minAndroidVersion || 'Android',
      applicationCategory: 'NavigationApplication',
      inLanguage: 'fr',
      softwareVersion: info?.versionName || undefined,
      fileSize: info?.fileSize ? formatBytes(info.fileSize) : undefined,
      url: pageUrl,
      description: info?.description || seoDescription,
      publisher: {
        '@id': `${canonicalOrigin}/#organization`,
      },
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'EUR',
      },
    });
    const existingLd = document.getElementById('vruguard-download-jsonld');
    if (existingLd) existingLd.remove();
    document.head.appendChild(ldScript);

    return () => {
      document.title = prevTitle;
      metaUpdates.forEach(({ tag, prev }) => {
        if (prev !== null) tag.setAttribute('content', prev);
      });
      if (canonical) {
        if (createdCanonical) canonical.remove();
        else if (prevCanonical) canonical.href = prevCanonical;
      }
      ldScript.remove();
    };
  }, [info]);

  // Dynamic QR code synced with latest published APK or /download URL
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const resolvedQrUrl = androidAppService.resolvePublicDownloadUrl(info, 'qr');
    const targetUrl =
      qrMode === 'apk' && info?.available
        ? resolvedQrUrl
          ? /^https?:\/\//i.test(resolvedQrUrl)
            ? resolvedQrUrl
            : `${window.location.origin}${resolvedQrUrl}`
          : `${window.location.origin}/download?autostart=1`
        : `${window.location.origin}/download`;

    QRCode.toDataURL(targetUrl, {
      width: 220,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => setQrDataUrl(url))
      .catch(() => setQrDataUrl(null));
  }, [info, qrMode]);

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleImageLoad = (slotId: string, img: HTMLImageElement) => {
    // Starter files in public/images/app-screenshots/ are 9x19 lossless markers (<120px).
    // Once replaced manually by a real screenshot (>=120px wide), the image renders live automatically.
    const isRealScreenshot = img.naturalWidth >= 120 && img.naturalHeight >= 120;
    setSlotStatusMap((prev) => ({
      ...prev,
      [slotId]: isRealScreenshot ? 'ready' : 'placeholder',
    }));
  };

  const handleImageError = (slotId: string) => {
    setSlotStatusMap((prev) => ({
      ...prev,
      [slotId]: 'placeholder',
    }));
  };

  const handleCopySha = async () => {
    if (!info?.sha256) return;
    try {
      await navigator.clipboard.writeText(info.sha256);
      setCopiedSha(true);
      toast.success('Empreinte SHA-256 copiée.');
      setTimeout(() => setCopiedSha(false), 2500);
    } catch {
      toast.error('Impossible de copier automatiquement.');
    }
  };

  const startChunkedDownload = async () => {
    if (!info?.available || !info.releaseId || chunkDownloadingPct !== null) return;
    setChunkDownloadingPct(5);
    try {
      await androidAppService.downloadChunkedApk(
        info.releaseId,
        info.fileName || `VRU-Guard-Sentinel-v${info.versionName}.apk`,
        (pct) => setChunkDownloadingPct(pct)
      );
      toast.success(`Téléchargement de ${info.appName} v${info.versionName} prêt.`);
    } catch (err: any) {
      toast.error(err?.message || 'Impossible de télécharger le paquet APK.');
    } finally {
      setChunkDownloadingPct(null);
    }
  };

  const handleTriggerDownload = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!info?.available) {
      e.preventDefault();
      return;
    }
    if (isChunked) {
      e.preventDefault();
      void startChunkedDownload();
      return;
    }
    toast.success(`Téléchargement de ${info.appName} v${info.versionName} démarré.`);
  };

  useEffect(() => {
    if (typeof window === 'undefined' || autoStartedRef.current) return;
    const params = new URLSearchParams(window.location.search);
    if (
      params.get('autostart') === '1' &&
      info?.available &&
      androidAppService.isChunkedRelease(info)
    ) {
      autoStartedRef.current = true;
      void startChunkedDownload();
    }
  }, [info]);

  const goPrevSlide = () => {
    setActiveSlideIdx((prev) => (prev === 0 ? SCREENSHOT_SLOTS.length - 1 : prev - 1));
  };

  const goNextSlide = () => {
    setActiveSlideIdx((prev) => (prev === SCREENSHOT_SLOTS.length - 1 ? 0 : prev + 1));
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartXRef.current;
    const diff = touchStartXRef.current - endX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) goNextSlide();
      else goPrevSlide();
    }
    touchStartXRef.current = null;
  };

  const downloadHref = androidAppService.resolvePublicDownloadUrl(info, 'web') || undefined;
  const isChunked = androidAppService.isChunkedRelease(info);
  const isDownloadAvailable = Boolean(info?.available && (downloadHref || isChunked));
  const appTitle = info?.appName || 'VRU Guard Sentinel';

  const formattedDate = info?.publishedAt
    ? new Date(info.publishedAt).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : '—';

  const activeSlot = SCREENSHOT_SLOTS[activeSlideIdx];
  const activeSlotStatus = slotStatusMap[activeSlot.id] || 'loading';
  const currentProfile =
    MOBILITY_PROFILES.find((p) => p.id === activeProfile) || MOBILITY_PROFILES[1];
  const ActiveProfileIcon = currentProfile.icon;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col overflow-x-hidden">
      {/* HEADER — Identical 3-zone structure & design to Home */}
      <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Brand Wordmark */}
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onBack();
            }}
            className="flex items-center gap-2.5 shrink-0 text-left focus:outline-none"
          >
            <VruLogo className="w-8 h-8 rounded-lg" />
            <span className="font-display font-bold text-lg tracking-tight text-white whitespace-nowrap">
              VruGuard
            </span>
          </a>

          {/* Zone 2: Nav Links */}
          <nav className="hidden lg:flex items-center gap-7 text-sm font-medium text-slate-300">
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                onBack();
              }}
              className="whitespace-nowrap hover:text-white transition-colors"
            >
              Accueil
            </a>
            <button
              type="button"
              onClick={() => scrollToSection('apercu-application')}
              className="whitespace-nowrap hover:text-white transition-colors"
            >
              Captures
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('mission-vru')}
              className="whitespace-nowrap hover:text-white transition-colors"
            >
              Mission
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('telechargement')}
              className="whitespace-nowrap text-blue-400 hover:text-blue-300 transition-colors"
            >
              Télécharger
            </button>
          </nav>

          {/* Zone 3: ThemeToggle + Single Primary Action */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden sm:block">
              <ThemeToggle />
            </div>

            {onLaunchApp && (
              <button
                type="button"
                onClick={onLaunchApp}
                className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white transition-colors whitespace-nowrap"
              >
                {isAuthenticated ? 'Espace web' : 'Connexion'}
              </button>
            )}

            {isDownloadAvailable && downloadHref ? (
              <a
                href={downloadHref}
                download={info?.fileName || `VRU-Guard-Sentinel-v${info?.versionName}.apk`}
                onClick={handleTriggerDownload}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-[#ffffff] text-sm font-semibold transition-colors whitespace-nowrap flex items-center gap-2 shadow-sm shadow-blue-600/20"
              >
                <Download className="w-4 h-4" />
                <span>Télécharger APK</span>
              </a>
            ) : isDownloadAvailable && isChunked ? (
              <button
                type="button"
                disabled={chunkDownloadingPct !== null}
                onClick={() => void startChunkedDownload()}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-[#ffffff] text-sm font-semibold transition-colors whitespace-nowrap flex items-center gap-2 shadow-sm shadow-blue-600/20 disabled:opacity-70"
              >
                {chunkDownloadingPct !== null ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span>
                  {chunkDownloadingPct !== null
                    ? `Téléchargement ${chunkDownloadingPct}%`
                    : 'Télécharger APK'}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => scrollToSection('telechargement')}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-[#ffffff] text-sm font-semibold transition-colors whitespace-nowrap flex items-center gap-2 shadow-sm shadow-blue-600/20"
              >
                <Download className="w-4 h-4" />
                <span>Télécharger APK</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="lg:hidden p-2 rounded-lg border border-slate-800 text-slate-300 hover:text-white"
              aria-label="Menu de navigation"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-800 bg-slate-950 px-4 py-4 space-y-2">
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                setMobileMenuOpen(false);
                onBack();
              }}
              className="block w-full text-left py-2 text-sm font-medium text-slate-300 hover:text-white"
            >
              Accueil VruGuard
            </a>
            <button
              type="button"
              onClick={() => scrollToSection('apercu-application')}
              className="block w-full text-left py-2 text-sm font-medium text-slate-300 hover:text-white"
            >
              Galerie de l&apos;application
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('mission-vru')}
              className="block w-full text-left py-2 text-sm font-medium text-slate-300 hover:text-white"
            >
              Notre mission VRU
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('telechargement')}
              className="block w-full text-left py-2 text-sm font-medium text-blue-400 hover:text-blue-300"
            >
              Télécharger l&apos;APK Android
            </button>
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
              <ThemeToggle showLabel={true} />
              {onLaunchApp && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onLaunchApp();
                  }}
                  className="text-xs font-semibold text-blue-400"
                >
                  {isAuthenticated ? 'Espace web' : 'Connexion'}
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">
        {/* =========================================================
            SECTION 1 : HERO
           ========================================================= */}
        <section className="relative border-b border-slate-800/70">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 lg:py-24">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
              {/* Hero Copy */}
              <div className="lg:col-span-6 space-y-6 animate-fade-up">
                {/* Logo & App Name Lockup */}
                <div className="flex items-center gap-3.5">
                  <VruLogo
                    className="w-12 h-12 rounded-2xl shadow-lg shadow-blue-600/20"
                    alt="Logo VRU Guard Sentinel"
                  />
                  <div>
                    <div className="font-display font-bold text-base sm:text-lg text-white leading-tight">
                      {appTitle}
                    </div>
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-400 mt-0.5">
                      Application mobile Android
                    </div>
                  </div>
                </div>

                <h1
                  className="font-display text-4xl sm:text-5xl lg:text-[3.3rem] font-extrabold tracking-tight text-white leading-[1.08]"
                  style={{ textWrap: 'balance' }}
                >
                  Votre bouclier urbain, directement dans la poche.
                </h1>

                <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-xl">
                  VRU Guard Sentinel accompagne piétons, cyclistes et usagers vulnérables sur Android avec une cartographie temps réel, une navigation sécurisée, des alertes de proximité et l&apos;assistance SOS.
                </p>

                {/* Primary Download Action */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 pt-1">
                  {isDownloadAvailable && downloadHref ? (
                    <a
                      href={downloadHref}
                      download={info?.fileName || `VRU-Guard-Sentinel-v${info?.versionName}.apk`}
                      onClick={handleTriggerDownload}
                      className="px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-[#ffffff] font-semibold text-sm sm:text-base transition-colors flex items-center justify-center gap-2.5 shadow-lg shadow-blue-600/20"
                    >
                      <Download className="w-4 h-4" />
                      <span>Télécharger pour Android</span>
                    </a>
                  ) : isDownloadAvailable && isChunked ? (
                    <button
                      type="button"
                      disabled={chunkDownloadingPct !== null}
                      onClick={() => void startChunkedDownload()}
                      className="px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-[#ffffff] font-semibold text-sm sm:text-base transition-colors flex items-center justify-center gap-2.5 shadow-lg shadow-blue-600/20 disabled:opacity-70"
                    >
                      {chunkDownloadingPct !== null ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      <span>
                        {chunkDownloadingPct !== null
                          ? `Préparation APK (${chunkDownloadingPct}%)`
                          : 'Télécharger pour Android'}
                      </span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => scrollToSection('telechargement')}
                      className="px-6 py-3.5 rounded-xl bg-slate-800 text-slate-300 border border-slate-700 font-semibold text-sm sm:text-base transition-colors flex items-center justify-center gap-2.5"
                    >
                      <Download className="w-4 h-4" />
                      <span>
                        {loading ? 'Vérification en cours...' : 'Téléchargement indisponible'}
                      </span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => scrollToSection('apercu-application')}
                    className="px-6 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white border border-slate-700 font-semibold text-sm sm:text-base transition-colors flex items-center justify-center gap-2"
                  >
                    <span>Explorer les écrans</span>
                    <ArrowRight className="w-4 h-4 text-blue-400" />
                  </button>
                </div>

                {/* Live Version & APK Size Bar */}
                <div className="pt-4 border-t border-slate-800/80 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-xs font-mono text-slate-300 tabular-nums">
                  {loading ? (
                    <span className="inline-flex items-center gap-2 text-slate-400">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                      Synchronisation avec la dernière version publiée...
                    </span>
                  ) : isDownloadAvailable && info ? (
                    <>
                      <span className="text-emerald-400 font-semibold">
                        Version v{info.versionName}
                      </span>
                      <span aria-hidden="true" className="text-slate-600">·</span>
                      <span>Taille APK : {formatBytes(info.fileSize)}</span>
                      <span aria-hidden="true" className="text-slate-600">·</span>
                      <span>{info.minAndroidVersion}</span>
                      <span aria-hidden="true" className="text-slate-600">·</span>
                      <span>Build {info.versionCode}</span>
                    </>
                  ) : (
                    <span className="text-amber-400">
                      {error ||
                        info?.disabledReason ||
                        'Aucune version Android publiée pour le moment.'}
                    </span>
                  )}
                </div>
              </div>

              {/* Hero Visual — Sleek Smartphone Hardware Frame (Emblem & Live Release Identity, Zero Fake Screenshots) */}
              <div className="lg:col-span-6 flex justify-center animate-fade-up" style={{ animationDelay: '0.08s' }}>
                <div className="relative w-full max-w-[330px] sm:max-w-[350px]">
                  {/* Ambient radial aura matching Home's cobalt palette */}
                  <div
                    aria-hidden="true"
                    className="absolute -inset-6 rounded-full bg-blue-600/10 blur-3xl pointer-events-none"
                  />

                  <div className="relative rounded-[2.6rem] border-[6px] border-slate-800 bg-slate-900 p-3 shadow-2xl">
                    {/* Hardware speaker & front sensor notch */}
                    <div className="mx-auto mb-3 h-4 w-24 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                      <span className="w-8 h-1 rounded-full bg-slate-800" />
                    </div>

                    {/* Crisp Obsidian App Identity Display */}
                    <div className="rounded-[1.9rem] bg-slate-950 border border-slate-800/90 px-6 py-8 flex flex-col justify-between min-h-[430px] relative overflow-hidden">
                      {/* Subtle geometric radar lines */}
                      <div
                        aria-hidden="true"
                        className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-25"
                      >
                        <div className="w-72 h-72 rounded-full border border-blue-500/30 flex items-center justify-center">
                          <div className="w-48 h-48 rounded-full border border-blue-500/40 flex items-center justify-center">
                            <div className="w-28 h-28 rounded-full border border-emerald-400/40" />
                          </div>
                        </div>
                      </div>

                      <div className="relative z-10 flex items-center justify-between text-[11px] font-mono text-slate-400 tabular-nums">
                        <span>ANDROID APK</span>
                        <span>{info?.minAndroidVersion || 'Android 8.0+'}</span>
                      </div>

                      <div className="relative z-10 my-auto py-8 flex flex-col items-center text-center space-y-5">
                        <VruLogo
                          className="w-20 h-20 rounded-3xl shadow-xl shadow-blue-600/25"
                          alt="VRU Guard Sentinel"
                        />

                        <div className="space-y-1.5">
                          <h2 className="font-display text-2xl font-extrabold tracking-tight text-white">
                            {appTitle}
                          </h2>
                          <p className="text-xs text-slate-400 leading-relaxed max-w-[220px] mx-auto">
                            Localisation · Guidage VRU · Alertes &amp; SOS connecté
                          </p>
                        </div>

                        <div className="w-full pt-2 grid grid-cols-3 gap-2 text-center border-t border-slate-800/80">
                          <div className="py-2">
                            <MapPin className="w-4 h-4 text-blue-400 mx-auto mb-1" />
                            <div className="text-[11px] font-medium text-slate-300">Carte GPS</div>
                          </div>
                          <div className="py-2">
                            <BellRing className="w-4 h-4 text-amber-400 mx-auto mb-1" />
                            <div className="text-[11px] font-medium text-slate-300">Alertes</div>
                          </div>
                          <div className="py-2">
                            <Siren className="w-4 h-4 text-red-400 mx-auto mb-1" />
                            <div className="text-[11px] font-medium text-slate-300">SOS</div>
                          </div>
                        </div>
                      </div>

                      <div className="relative z-10 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono tabular-nums">
                        <span className="text-slate-400 truncate max-w-[160px]">
                          {info?.packageName || 'com.vruguard.sentinel'}
                        </span>
                        <span className={isDownloadAvailable ? 'text-emerald-400 font-semibold' : 'text-amber-400'}>
                          {isDownloadAvailable && info
                            ? `v${info.versionName} · ${formatBytes(info.fileSize)}`
                            : 'En attente'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================
            SECTION 2 : GALERIE DE CAPTURES D'ÉCRAN (PRÊTE POUR PNG MANUELS)
           ========================================================= */}
        <section
          id="apercu-application"
          className="py-16 sm:py-24 border-b border-slate-800/70 bg-slate-900/30"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div className="max-w-2xl space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-400">
                  Aperçu de l&apos;application
                </p>
                <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white">
                  Les écrans clés de VRU Guard Sentinel
                </h2>
                <p className="text-sm sm:text-base text-slate-400">
                  Chaque emplacement ci-dessous est directement relié à son fichier PNG dans{' '}
                  <code className="font-mono text-xs text-slate-200 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                    public/images/app-screenshots/
                  </code>
                  . Remplacez les fichiers pour afficher vos captures réelles.
                </p>
              </div>

              {/* Carousel Prev / Next Controls */}
              <div className="flex items-center gap-2 shrink-0 self-start md:self-auto">
                <button
                  type="button"
                  onClick={goPrevSlide}
                  aria-label="Capture précédente"
                  className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-mono text-xs text-slate-400 px-2 tabular-nums">
                  {activeSlot.indexLabel} / 0{SCREENSHOT_SLOTS.length}
                </span>
                <button
                  type="button"
                  onClick={goNextSlide}
                  aria-label="Capture suivante"
                  className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
              {/* Left: Interactive Smartphone Frame Bound to PNG Path */}
              <div className="lg:col-span-5 flex justify-center">
                <div
                  className="w-full max-w-[300px] sm:max-w-[320px] select-none"
                  onTouchStart={handleTouchStart}
                  onTouchEnd={handleTouchEnd}
                >
                  <div className="rounded-[2.4rem] border-[6px] border-slate-800 bg-slate-900 p-2.5 shadow-2xl">
                    <div className="mx-auto mb-2.5 h-3.5 w-20 rounded-full bg-slate-950 border border-slate-800" />

                    <div className="relative aspect-[9/19] w-full rounded-[1.75rem] bg-slate-950 border border-slate-800 overflow-hidden flex flex-col">
                      {/* Real PNG img element (hidden visually if starter 9x19 marker, crisp display once replaced) */}
                      <img
                        src={activeSlot.publicPath}
                        alt={`${activeSlot.title} — ${appTitle}`}
                        onLoad={(e) => handleImageLoad(activeSlot.id, e.currentTarget)}
                        onError={() => handleImageError(activeSlot.id)}
                        onClick={() => activeSlotStatus === 'ready' && setZoomedSlot(activeSlot)}
                        className={
                          activeSlotStatus === 'ready'
                            ? 'w-full h-full object-cover object-top block cursor-zoom-in'
                            : 'sr-only'
                        }
                      />

                      {activeSlotStatus === 'ready' ? (
                        <button
                          type="button"
                          onClick={() => setZoomedSlot(activeSlot)}
                          aria-label="Agrandir la capture"
                          className="absolute bottom-3 right-3 p-2 rounded-lg bg-slate-950/80 hover:bg-slate-900 text-white border border-slate-700/80 backdrop-blur-sm transition-colors"
                        >
                          <Maximize2 className="w-4 h-4" />
                        </button>
                      ) : (
                        /* Identified Ready-for-Manual-Drop-In Slot (No fake UI screenshot!) */
                        <div className="flex-1 p-5 flex flex-col justify-between text-center">
                          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 tabular-nums">
                            <span>ÉCRAN {activeSlot.indexLabel}</span>
                            <span>PNG</span>
                          </div>

                          <div className="my-auto space-y-4">
                            <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-900 border border-dashed border-blue-500/50 flex items-center justify-center text-blue-400">
                              <ImageIcon className="w-6 h-6" />
                            </div>

                            <div className="space-y-1.5">
                              <h3 className="font-display text-base font-bold text-white">
                                {activeSlot.title}
                              </h3>
                              <p className="text-xs text-slate-400 leading-relaxed">
                                Emplacement prêt pour votre capture d&apos;écran Android réelle.
                              </p>
                            </div>

                            <div className="rounded-xl bg-slate-900 border border-slate-800 p-3 text-left space-y-1.5">
                              <div className="text-[10px] font-semibold uppercase tracking-wider text-blue-400">
                                Fichier PNG à remplacer
                              </div>
                              <div className="font-mono text-[11px] text-slate-200 break-all">
                                {activeSlot.sourcePath}
                              </div>
                              <div className="font-mono text-[10px] text-slate-400">
                                Format conseillé : {activeSlot.recommendedSize}
                              </div>
                            </div>
                          </div>

                          <div className="text-[11px] text-slate-500 font-mono">
                            Affichage automatique dès ajout du PNG
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Compact Screen Index Switcher (handy on mobile swipe & quick jump) */}
                  <div className="mt-4 flex items-center justify-center gap-2">
                    {SCREENSHOT_SLOTS.map((slot, idx) => {
                      const active = idx === activeSlideIdx;
                      return (
                        <button
                          key={slot.id}
                          type="button"
                          onClick={() => setActiveSlideIdx(idx)}
                          aria-label={`Afficher l'écran ${slot.indexLabel} : ${slot.title}`}
                          className={`px-2.5 py-1 rounded-lg font-mono text-xs font-semibold tabular-nums transition-colors border ${
                            active
                              ? 'bg-blue-600 border-blue-500 text-[#ffffff]'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          {slot.indexLabel}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Right: Screen Selector List & Details */}
              <div className="lg:col-span-7 space-y-4">
                <div className="space-y-2.5">
                  {SCREENSHOT_SLOTS.map((slot, idx) => {
                    const isActive = idx === activeSlideIdx;
                    const slotStatus = slotStatusMap[slot.id] || 'loading';
                    return (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() => setActiveSlideIdx(idx)}
                        className={`w-full text-left rounded-2xl border p-4 sm:p-5 transition-colors flex items-start gap-4 ${
                          isActive
                            ? 'bg-slate-900 border-blue-500 shadow-lg shadow-blue-950/20'
                            : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div
                          className={`font-mono text-sm font-bold tabular-nums pt-0.5 shrink-0 ${
                            isActive ? 'text-blue-400' : 'text-slate-500'
                          }`}
                        >
                          {slot.indexLabel}
                        </div>

                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h3 className="font-display text-base sm:text-lg font-bold text-white">
                              {slot.title}
                            </h3>
                            <span className="font-mono text-[11px] text-slate-400 truncate">
                              {slot.fileName}
                            </span>
                          </div>
                          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                            {slot.description}
                          </p>
                          <div className="pt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono text-slate-400">
                            <span>{slot.subtitle}</span>
                            <span aria-hidden="true" className="text-slate-600">·</span>
                            <span
                              className={
                                slotStatus === 'ready' ? 'text-emerald-400' : 'text-blue-400'
                              }
                            >
                              {slotStatus === 'ready'
                                ? 'Capture PNG chargée'
                                : 'Emplacement PNG prêt'}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================
            SECTION 3 : UNE SEULE SECTION ORIGINALE & CRÉATIVE (MISSION VRU)
           ========================================================= */}
        <section id="mission-vru" className="py-16 sm:py-24 border-b border-slate-800/70">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
            <div className="max-w-2xl space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-400">
                Notre mission sur le terrain
              </p>
              <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white">
                Protéger chaque usager vulnérable dans la ville en mouvement
              </h2>
              <p className="text-slate-400 text-sm sm:text-base">
                Sélectionnez un profil de déplacement pour découvrir comment VRU Guard Sentinel adapte sa vigilance, sa navigation et ses alertes sur Android.
              </p>
            </div>

            <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden grid grid-cols-1 lg:grid-cols-12">
              {/* Atmospheric Visual Story */}
              <div className="lg:col-span-6 relative min-h-[280px] sm:min-h-[340px]">
                <img
                  src={vruMissionImg}
                  alt="Cycliste et piéton protégés sur une intersection urbaine connectée par VRU Guard Sentinel"
                  className="w-full h-full object-cover object-center"
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/35 to-transparent"
                />
                <div className="absolute bottom-5 left-5 right-5 sm:bottom-6 sm:left-6 sm:right-6 space-y-1.5">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-400">
                    Mobilité intelligente &amp; Sécurité VRU
                  </div>
                  <p className="text-sm text-slate-200 leading-relaxed max-w-md">
                    Conçue pour réduire les angles morts urbains et relier immédiatement chaque usager vulnérable à ses proches.
                  </p>
                </div>
              </div>

              {/* Interactive VRU Protection Spectrum */}
              <div className="lg:col-span-6 p-6 sm:p-8 lg:p-10 flex flex-col justify-between gap-6">
                {/* 4 Profile Selector Buttons */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {MOBILITY_PROFILES.map((profile) => {
                    const Icon = profile.icon;
                    const selected = profile.id === activeProfile;
                    return (
                      <button
                        key={profile.id}
                        type="button"
                        onClick={() => setActiveProfile(profile.id)}
                        className={`p-3 rounded-xl border text-left transition-colors flex flex-col gap-2 ${
                          selected
                            ? 'bg-blue-600 border-blue-500 text-[#ffffff]'
                            : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                        }`}
                      >
                        <Icon
                          className={`w-4 h-4 ${selected ? 'text-[#ffffff]' : 'text-blue-400'}`}
                        />
                        <span className="text-xs font-semibold whitespace-nowrap">
                          {profile.label}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Selected Profile Insight */}
                <div className="rounded-xl bg-slate-950/70 border border-slate-800 p-5 sm:p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                      <ActiveProfileIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-mono text-blue-400">
                        {currentProfile.focus}
                      </div>
                      <h3 className="font-display text-lg sm:text-xl font-bold text-white">
                        {currentProfile.headline}
                      </h3>
                    </div>
                  </div>

                  <p className="text-sm text-slate-300 leading-relaxed">
                    {currentProfile.detail}
                  </p>
                </div>

                {/* Quiet Capabilities Anchor Line */}
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-400 pt-1 border-t border-slate-800">
                  <span className="inline-flex items-center gap-1.5">
                    <Navigation className="w-3.5 h-3.5 text-emerald-400" />
                    Carte &amp; GPS gratuits
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                    Alertes contextuelles
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Siren className="w-3.5 h-3.5 text-red-400" />
                    SOS &amp; Suivi famille (Premium)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================
            SECTION 4 : SECTION DE TÉLÉCHARGEMENT FINALE + QR CODE
           ========================================================= */}
        <section
          id="telechargement"
          className="py-16 sm:py-24 border-b border-slate-800/70 bg-slate-900/30"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
            <div className="max-w-2xl space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-400">
                Téléchargement officiel
              </p>
              <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white">
                Installer {appTitle} sur Android
              </h2>
              <p className="text-slate-400 text-sm sm:text-base">
                Paquet APK officiel servi directement depuis VruGuard, avec vérification d&apos;intégrité et mise à jour synchronisée depuis notre plateforme.
              </p>
            </div>

            {loading ? (
              <div className="rounded-2xl bg-slate-900 border border-slate-800 p-10 flex items-center justify-center gap-3 text-slate-300">
                <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                <span className="text-sm">Chargement de la dernière version publiée...</span>
              </div>
            ) : !isDownloadAvailable || !info ? (
              <div className="rounded-2xl bg-slate-900 border border-amber-500/35 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="font-display text-lg font-bold text-white">
                      Téléchargement Android momentanément indisponible
                    </h3>
                    <p className="text-sm text-slate-300 leading-relaxed max-w-xl">
                      {error ||
                        info?.disabledReason ||
                        'Aucune version APK publique n’est activée pour le moment. Revenez bientôt ou utilisez directement l’application web VruGuard.'}
                    </p>
                  </div>
                </div>
                {onLaunchApp && (
                  <button
                    type="button"
                    onClick={onLaunchApp}
                    className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-[#ffffff] text-sm font-semibold whitespace-nowrap shrink-0"
                  >
                    Ouvrir l&apos;application web
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                {/* Main Download & Release Details Card */}
                <div className="lg:col-span-8 rounded-2xl bg-slate-900 border border-slate-800 p-6 sm:p-8 flex flex-col justify-between gap-6">
                  <div className="space-y-6">
                    {/* App Header & Download Button */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 pb-6 border-b border-slate-800">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-[#ffffff] shadow-lg shadow-blue-600/25 shrink-0">
                          <Smartphone className="w-7 h-7" />
                        </div>
                        <div>
                          <h3 className="font-display text-xl sm:text-2xl font-bold text-white">
                            {info.appName}
                          </h3>
                          <p className="text-xs font-mono text-slate-400 mt-0.5 tabular-nums">
                            {info.packageName} · Version {info.versionName} (Build{' '}
                            {info.versionCode})
                          </p>
                        </div>
                      </div>

                      {downloadHref ? (
                        <a
                          href={downloadHref}
                          download={info.fileName || `VRU-Guard-Sentinel-v${info.versionName}.apk`}
                          onClick={handleTriggerDownload}
                          className="px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-[#ffffff] font-semibold text-sm sm:text-base transition-colors flex items-center justify-center gap-2.5 shadow-lg shadow-blue-600/20 shrink-0"
                        >
                          <Download className="w-4 h-4" />
                          <span>Télécharger VRU Guard Sentinel</span>
                        </a>
                      ) : isChunked ? (
                        <button
                          type="button"
                          disabled={chunkDownloadingPct !== null}
                          onClick={() => void startChunkedDownload()}
                          className="px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-[#ffffff] font-semibold text-sm sm:text-base transition-colors flex items-center justify-center gap-2.5 shadow-lg shadow-blue-600/20 shrink-0 disabled:opacity-70"
                        >
                          {chunkDownloadingPct !== null ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                          <span>
                            {chunkDownloadingPct !== null
                              ? `Téléchargement (${chunkDownloadingPct}%)`
                              : 'Télécharger VRU Guard Sentinel'}
                          </span>
                        </button>
                      ) : null}
                    </div>

                    {/* Key Technical Specs Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 tabular-nums">
                      <div className="rounded-xl bg-slate-950/60 border border-slate-800 p-3.5">
                        <div className="text-[11px] uppercase tracking-wider text-slate-400">
                          Dernière version
                        </div>
                        <div className="font-display text-base font-bold text-white mt-1">
                          v{info.versionName}
                        </div>
                      </div>

                      <div className="rounded-xl bg-slate-950/60 border border-slate-800 p-3.5">
                        <div className="text-[11px] uppercase tracking-wider text-slate-400">
                          Taille de l&apos;APK
                        </div>
                        <div className="font-display text-base font-bold text-white mt-1">
                          {formatBytes(info.fileSize)}
                        </div>
                      </div>

                      <div className="rounded-xl bg-slate-950/60 border border-slate-800 p-3.5">
                        <div className="text-[11px] uppercase tracking-wider text-slate-400">
                          Publication
                        </div>
                        <div className="font-display text-sm font-bold text-white mt-1.5">
                          {formattedDate}
                        </div>
                      </div>

                      <div className="rounded-xl bg-slate-950/60 border border-slate-800 p-3.5">
                        <div className="text-[11px] uppercase tracking-wider text-slate-400">
                          Android requis
                        </div>
                        <div className="font-display text-base font-bold text-white mt-1">
                          {info.minAndroidVersion}
                        </div>
                      </div>
                    </div>

                    {/* Release Notes (What's New) */}
                    {info.whatsNew && info.whatsNew.length > 0 && (
                      <div className="space-y-2.5">
                        <div className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                          Nouveautés de cette version
                        </div>
                        <ul className="space-y-2">
                          {info.whatsNew.map((note, idx) => (
                            <li
                              key={`${idx}-${note.slice(0, 16)}`}
                              className="flex items-start gap-2.5 text-sm text-slate-300"
                            >
                              <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                              <span>{note}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* SHA-256 Checksum & File Verification */}
                  {info.sha256 && (
                    <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileCheck2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <div className="min-w-0">
                          <span className="text-xs font-semibold text-slate-300 mr-2">
                            SHA-256 :
                          </span>
                          <code className="font-mono text-[11px] text-slate-400 break-all">
                            {info.sha256}
                          </code>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleCopySha}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 whitespace-nowrap self-start sm:self-auto shrink-0"
                      >
                        {copiedSha ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Copié</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copier</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* QR Code Card */}
                <aside className="lg:col-span-4 rounded-2xl bg-slate-900 border border-slate-800 p-6 sm:p-8 flex flex-col items-center justify-between gap-5 text-center">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-400">
                      <QrCode className="w-4 h-4" />
                      Scanner sur mobile
                    </div>
                    <p className="text-xs text-slate-400">
                      Flashez ce QR code avec l&apos;appareil photo de votre téléphone Android.
                    </p>
                  </div>

                  <div className="bg-[#ffffff] rounded-2xl p-4 border border-slate-700">
                    {qrDataUrl ? (
                      <img
                        src={qrDataUrl}
                        alt={`QR Code pour télécharger ${info.appName} v${info.versionName}`}
                        className="w-44 h-44 block"
                      />
                    ) : (
                      <div className="w-44 h-44 flex items-center justify-center text-slate-500 text-xs">
                        Génération QR...
                      </div>
                    )}
                  </div>

                  <div className="w-full grid grid-cols-2 p-1 rounded-xl bg-slate-950 border border-slate-800 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setQrMode('apk')}
                      className={`py-1.5 rounded-lg transition-colors ${
                        qrMode === 'apk'
                          ? 'bg-blue-600 text-[#ffffff]'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      APK direct
                    </button>
                    <button
                      type="button"
                      onClick={() => setQrMode('page')}
                      className={`py-1.5 rounded-lg transition-colors ${
                        qrMode === 'page'
                          ? 'bg-blue-600 text-[#ffffff]'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Page /download
                    </button>
                  </div>
                </aside>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* FOOTER — Identical design & structure to Home LandingPage */}
      <footer className="bg-slate-950 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 pb-10 border-b border-slate-800/80">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <VruLogo className="w-7 h-7 rounded-lg" />
                <span className="font-display font-bold text-base text-white">VruGuard</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Plateforme de mobilité connectée pour piétons, cyclistes et familles : localisation, navigation et protection en temps réel.
              </p>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Navigation
              </h4>
              <ul className="space-y-2 text-xs text-slate-400">
                <li>
                  <a
                    href="/"
                    onClick={(e) => {
                      e.preventDefault();
                      onBack();
                    }}
                    className="hover:text-white transition-colors"
                  >
                    Page d&apos;accueil
                  </a>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection('apercu-application')}
                    className="hover:text-white transition-colors"
                  >
                    Captures d&apos;écran
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection('mission-vru')}
                    className="hover:text-white transition-colors"
                  >
                    Mission VRU
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection('telechargement')}
                    className="text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Télécharger l&apos;APK Android
                  </button>
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Abonnements
              </h4>
              <ul className="space-y-2 text-xs text-slate-400">
                <li>
                  <button
                    type="button"
                    onClick={() => (onOpenPricing ? onOpenPricing('FREE') : onBack())}
                    className="hover:text-white transition-colors"
                  >
                    Offre Free (Gratuite)
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => (onOpenPricing ? onOpenPricing('PREMIUM') : onBack())}
                    className="hover:text-white transition-colors"
                  >
                    VruGuard Premium
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => (onOpenPricing ? onOpenPricing('FAMILY') : onBack())}
                    className="hover:text-white transition-colors"
                  >
                    VruGuard Family
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => (onOpenPricing ? onOpenPricing('BUSINESS') : onBack())}
                    className="hover:text-white transition-colors"
                  >
                    Business (Sur devis)
                  </button>
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Support &amp; Légal
              </h4>
              <ul className="space-y-2 text-xs text-slate-400">
                <li>
                  <a
                    href="mailto:support@vruguard.me"
                    className="hover:text-white transition-colors inline-flex items-center gap-1.5"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    support@vruguard.me
                  </a>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setLegalModal('privacy')}
                    className="hover:text-white transition-colors"
                  >
                    Politique de confidentialité
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setLegalModal('terms')}
                    className="hover:text-white transition-colors"
                  >
                    Conditions d&apos;utilisation
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <span>© {new Date().getFullYear()} VruGuard (vruguard.me). Tous droits réservés.</span>
            <span>Localisation intelligente · Navigation · Protection VRU</span>
          </div>
        </div>
      </footer>

      {/* Lightbox Modal when user has dropped a real PNG screenshot and clicks zoom */}
      {zoomedSlot && (
        <div
          className="fixed inset-0 z-[120000] bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setZoomedSlot(null)}
        >
          <div
            className="relative max-w-md w-full bg-slate-900 border border-slate-700 rounded-2xl p-4 space-y-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-display text-sm font-bold text-white">{zoomedSlot.title}</div>
                <div className="font-mono text-[11px] text-slate-400">{zoomedSlot.fileName}</div>
              </div>
              <button
                type="button"
                onClick={() => setZoomedSlot(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                aria-label="Fermer l'aperçu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <img
              src={zoomedSlot.publicPath}
              alt={`${zoomedSlot.title} — ${appTitle}`}
              className="w-full max-h-[75vh] object-contain rounded-xl bg-slate-950"
            />
          </div>
        </div>
      )}

      {/* Legal Modal (Privacy / Terms) */}
      {legalModal && (
        <div
          className="fixed inset-0 z-[120000] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-display text-lg font-bold text-white">
                {legalModal === 'privacy'
                  ? 'Politique de confidentialité VruGuard'
                  : "Conditions d'utilisation VruGuard"}
              </h3>
              <button
                type="button"
                onClick={() => setLegalModal(null)}
                className="p-1 text-slate-400 hover:text-white"
                aria-label="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {legalModal === 'privacy' ? (
              <div className="text-xs sm:text-sm text-slate-300 space-y-2.5 leading-relaxed">
                <p>
                  VruGuard traite uniquement les données de compte et de géolocalisation nécessaires au fonctionnement de la carte, de la navigation et des fonctions de sécurité activées par votre abonnement.
                </p>
                <p>
                  Sur Android, l&apos;accès au microphone sert uniquement aux commandes vocales lorsque vous choisissez de les utiliser. Les contacts d&apos;urgence et le partage de localisation en direct ne sont utilisés qu&apos;à votre initiative.
                </p>
              </div>
            ) : (
              <div className="text-xs sm:text-sm text-slate-300 space-y-2.5 leading-relaxed">
                <p>
                  L&apos;application Android VRU Guard Sentinel est téléchargeable gratuitement. L&apos;accès Free inclut la carte interactive, la localisation GPS de base et la navigation standard.
                </p>
                <p>
                  Les fonctionnalités SOS, contacts d&apos;urgence, alertes avancées et profils familiaux nécessitent un abonnement Premium, Family ou Business actif.
                </p>
              </div>
            )}
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setLegalModal(null)}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-[#ffffff] text-xs font-semibold"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

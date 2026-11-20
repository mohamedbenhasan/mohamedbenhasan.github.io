import React, { useState, useEffect, useCallback } from 'react';
import { Dashboard } from './components/Dashboard';
import { HistoryPage } from './components/HistoryPage';
import { UserProfile } from './components/UserProfile';
import { Login } from './components/Login';
import { useAuth } from './AuthContext';
import { User, SubscriptionPlan } from './types';
import { simulationService } from './services/SimulationService';
import { VruToaster } from './components/VruToaster';

import MessagesPage from './components/MessagesPage';
import ZoneSafetyPage from './components/ZoneSafetyPage';
import { appFeedbackService } from './services/AppFeedbackService';
import { FeedbackModal } from './components/FeedbackModal';

import { TrustedContactsPage } from './components/TrustedContactsPage';
import { SosSettingsPage } from './components/SosSettingsPage';
import { LiveTrackingViewer } from './components/LiveTrackingViewer';
import { ParentalTrackingPage } from './components/ParentalTrackingPage';
import { SuperAdminDashboard } from './components/SuperAdminDashboard';
import { PricingPage } from './components/PricingPage';
import { PremiumUpgradeModal } from './components/PremiumUpgradeModal';
import { LandingPage } from './components/LandingPage';
import { DownloadPage } from './components/DownloadPage';
import { RiskHeatmapPage } from './components/RiskHeatmapPage';
import { AndroidUpdateModal } from './components/AndroidUpdateModal';
import { FirstConsentModal } from './components/FirstConsentModal';
import { androidAppService } from './services/AndroidAppService';
import { AndroidLatestVersionResponse } from './types';

enum View {
  LANDING = 'LANDING',
  LOGIN = 'LOGIN',
  APP = 'APP',
  HISTORY = 'HISTORY',
  PROFILE = 'PROFILE',
  MESSAGES = 'MESSAGES',
  ZONE_SAFETY = 'ZONE_SAFETY',
  RISK_HEATMAP = 'RISK_HEATMAP',
  TRUSTED_CONTACTS = 'TRUSTED_CONTACTS',
  SOS_SETTINGS = 'SOS_SETTINGS',
  SHARE_VIEWER = 'SHARE_VIEWER',
  PARENTAL_TRACKING = 'PARENTAL_TRACKING',
  SUPER_ADMIN = 'SUPER_ADMIN',
  PRICING = 'PRICING',
  DOWNLOAD = 'DOWNLOAD',
}

const isSuperAdminPath = () =>
  typeof window !== 'undefined' &&
  window.location.pathname.replace(/\/+$/, '') === '/super-admin';

const isDownloadPath = () =>
  typeof window !== 'undefined' &&
  window.location.pathname.replace(/\/+$/, '') === '/download';

const isRiskHeatmapPath = () =>
  typeof window !== 'undefined' &&
  window.location.pathname.replace(/\/+$/, '') === '/risk-heatmap';

const App: React.FC = () => {
  const [view, setView] = useState<View>(() =>
    isSuperAdminPath()
      ? View.SUPER_ADMIN
      : isDownloadPath()
      ? View.DOWNLOAD
      : isRiskHeatmapPath()
      ? View.RISK_HEATMAP
      : View.LANDING
  );
  const [pricingHighlightPlan, setPricingHighlightPlan] = useState<SubscriptionPlan | undefined>(
    undefined
  );
  const [showExitFeedback, setShowExitFeedback] = useState(false);
  const [shareParams, setShareParams] = useState<{ sessionId: string; token: string } | null>(null);
  const [androidUpdateState, setAndroidUpdateState] = useState<{
    open: boolean;
    latestInfo: AndroidLatestVersionResponse | null;
    installedVersionName: string;
    installedVersionCode: number;
  }>({
    open: false,
    latestInfo: null,
    installedVersionName: '1.0',
    installedVersionCode: 1,
  });

  const {
    user,
    role,
    isSuperAdmin,
    effectivePlan,
    publicConfig,
    accountRestrictionMessage,
    clearAccountRestriction,
    loading,
    consentStatus,
    consentLoading,
    logout,
    upgradePromptFeature,
    closeUpgradeModal,
    hasFeature,
    openUpgradeModal,
  } = useAuth();

  const navigateToSuperAdmin = useCallback(() => {
    if (typeof window !== 'undefined' && window.location.pathname !== '/super-admin') {
      window.history.pushState({}, '', '/super-admin');
    }
    setView(View.SUPER_ADMIN);
  }, []);

  const navigateToDownload = useCallback(() => {
    if (typeof window !== 'undefined' && window.location.pathname !== '/download') {
      window.history.pushState({}, '', '/download');
    }
    setView(View.DOWNLOAD);
  }, []);

  const navigateToRiskHeatmap = useCallback(() => {
    if (!hasFeature('global_risk_heatmap')) {
      openUpgradeModal('global_risk_heatmap');
      return;
    }
    if (typeof window !== 'undefined' && window.location.pathname !== '/risk-heatmap') {
      window.history.pushState({}, '', '/risk-heatmap');
    }
    setView(View.RISK_HEATMAP);
  }, [hasFeature, openUpgradeModal]);

  const navigateOutOfSpecialRoute = useCallback((fallback: View) => {
    if (
      typeof window !== 'undefined' &&
      (window.location.pathname === '/super-admin' ||
        window.location.pathname === '/download' ||
        window.location.pathname === '/risk-heatmap')
    ) {
      window.history.pushState({}, '', '/');
    }
    setView(fallback);
  }, []);

  // Startup Android APK update check when running inside Capacitor Android
  useEffect(() => {
    let active = true;
    const checkAndroidUpdate = async () => {
      try {
        const installed = await androidAppService.getInstalledAppInfo();
        if (!installed.isNativeAndroid) return;
        const latest = await androidAppService.getLatestVersion(installed.versionCode);
        if (!active) return;
        if (latest.available && latest.updateAvailable) {
          setAndroidUpdateState({
            open: true,
            latestInfo: latest,
            installedVersionName: installed.versionName,
            installedVersionCode: installed.versionCode,
          });
        }
      } catch {
        // Silent check failure at startup so offline usage is never blocked
      }
    };
    checkAndroidUpdate();
    return () => {
      active = false;
    };
  }, []);

  // Listen for browser back/forward on /super-admin, /download and /risk-heatmap
  useEffect(() => {
    const onPopState = () => {
      if (isSuperAdminPath()) {
        setView(View.SUPER_ADMIN);
      } else if (isDownloadPath()) {
        setView(View.DOWNLOAD);
      } else if (isRiskHeatmapPath()) {
        setView(View.RISK_HEATMAP);
      } else if (
        view === View.SUPER_ADMIN ||
        view === View.DOWNLOAD ||
        view === View.RISK_HEATMAP
      ) {
        setView(user ? View.APP : View.LANDING);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [view, user]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const trackingSessionId = params.get('live_track');
    const trackingToken = params.get('t');

    if (trackingSessionId && trackingToken) {
      setShareParams({ sessionId: trackingSessionId, token: trackingToken });
      setView(View.SHARE_VIEWER);
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    if (isSuperAdminPath() && view !== View.LOGIN && view !== View.SUPER_ADMIN) {
      setView(View.SUPER_ADMIN);
      return;
    }

    if (isDownloadPath() && view !== View.LOGIN && view !== View.DOWNLOAD) {
      setView(View.DOWNLOAD);
      return;
    }

    if (isRiskHeatmapPath() && view !== View.LOGIN && view !== View.RISK_HEATMAP && user) {
      setView(View.RISK_HEATMAP);
      return;
    }

    if (params.get('view') === 'pricing' || params.get('session_id') || params.get('paymentRef')) {
      setView(View.PRICING);
      return;
    }

    if (user && view === View.LOGIN) {
      setView(
        isSuperAdminPath()
          ? View.SUPER_ADMIN
          : isRiskHeatmapPath()
          ? View.RISK_HEATMAP
          : View.APP
      );
    }

    if (
      !user &&
      (view === View.APP ||
        view === View.HISTORY ||
        view === View.PROFILE ||
        view === View.MESSAGES ||
        view === View.ZONE_SAFETY ||
        view === View.RISK_HEATMAP ||
        view === View.TRUSTED_CONTACTS ||
        view === View.SOS_SETTINGS ||
        view === View.PARENTAL_TRACKING)
    ) {
      setView(View.LANDING);
    }

    simulationService.setUserId(user ? user.uid : null);
  }, [user, view, shareParams]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-blue-500 flex flex-col items-center gap-4">
          <svg
            className="animate-spin h-8 w-8"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span className="text-xs font-mono tracking-widest uppercase">
            Chargement de VruGuard...
          </span>
        </div>
      </div>
    );
  }

  const mockUser: User = user
    ? {
        id: user.uid,
        name: user.displayName || user.email?.split('@')[0] || 'Utilisateur',
        email: user.email || '',
        organization: 'VruGuard',
        role: isSuperAdmin || role === 'ADMIN' ? 'ADMIN' : 'OPERATOR',
      }
    : {
        id: '',
        name: '',
        email: '',
        organization: '',
        role: 'OPERATOR',
      };

  const executeLogout = async () => {
    setShowExitFeedback(false);
    await logout();
    navigateOutOfSpecialRoute(View.LANDING);
  };

  const handleLogoutRequest = () => {
    if (user && appFeedbackService.shouldRequestFeedback()) {
      setShowExitFeedback(true);
    } else {
      executeLogout();
    }
  };

  const handleLaunch = () => {
    if (user) {
      setView(View.APP);
    } else {
      setView(View.LOGIN);
    }
  };

  const exitFeedbackUI = showExitFeedback && user && (
    <FeedbackModal
      userId={user.uid}
      vruType={
        simulationService?.getState?.()?.vrus.find((v) => v.isUserControlled)?.type || 'UNKNOWN'
      }
      onClose={executeLogout}
      isExitMode={true}
    />
  );

  const openPricingView = (highlightPlan?: SubscriptionPlan) => {
    setPricingHighlightPlan(highlightPlan);
    setView(View.PRICING);
  };

  const upgradeModalUI = (
    <PremiumUpgradeModal
      feature={upgradePromptFeature}
      onClose={closeUpgradeModal}
      onViewPricing={(plan) => openPricingView(plan)}
    />
  );

  // Maintenance gate: blocks regular users while allowing Login and Super Admin access
  const maintenanceBlocked =
    Boolean(publicConfig?.maintenanceMode) &&
    !isSuperAdmin &&
    view !== View.LOGIN &&
    view !== View.SUPER_ADMIN;

  const isPublicGuestExceptionView = view === View.DOWNLOAD || view === View.SHARE_VIEWER;
  const waitingForConsentVerification =
    Boolean(user) && !isPublicGuestExceptionView && consentLoading && !consentStatus;
  const requiresMandatoryConsentGate =
    Boolean(user) &&
    !isPublicGuestExceptionView &&
    !waitingForConsentVerification &&
    consentStatus?.accessAllowed !== true;

  const renderView = () => {
    if (waitingForConsentVerification) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950">
          <div className="text-blue-400 flex flex-col items-center gap-3">
            <svg
              className="animate-spin h-7 w-7"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span className="text-xs font-mono tracking-widest uppercase">
              Vérification du consentement...
            </span>
          </div>
        </div>
      );
    }

    if (requiresMandatoryConsentGate) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
          <FirstConsentModal onLogout={executeLogout} />
        </div>
      );
    }
    if (view === View.SUPER_ADMIN) {
      return (
        <SuperAdminDashboard
          onBackToApp={() => navigateOutOfSpecialRoute(user ? View.APP : View.LANDING)}
          onLogout={executeLogout}
          onRequireLogin={() => setView(View.LOGIN)}
        />
      );
    }

    if (view === View.DOWNLOAD) {
      return (
        <DownloadPage
          onBack={() => navigateOutOfSpecialRoute(user ? View.APP : View.LANDING)}
          onLaunchApp={() => navigateOutOfSpecialRoute(user ? View.APP : View.LOGIN)}
          onOpenPricing={(plan) => {
            if (typeof window !== 'undefined' && window.location.pathname === '/download') {
              window.history.pushState({}, '', '/');
            }
            openPricingView(plan);
          }}
          isAuthenticated={Boolean(user)}
        />
      );
    }

    if (maintenanceBlocked) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-slate-900 border border-amber-500/40 rounded-2xl p-8 text-center space-y-5 shadow-2xl">
            <div className="text-xs font-mono uppercase tracking-widest text-amber-400">
              Maintenance programmée
            </div>
            <h1 className="font-display text-2xl font-bold text-white">
              {publicConfig?.platformName || 'VruGuard'} est temporairement en maintenance
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              {publicConfig?.maintenanceMessage ||
                'VruGuard est actuellement en maintenance programmée. Veuillez réessayer dans quelques instants.'}
            </p>
            {!user && (
              <button
                onClick={() => setView(View.LOGIN)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 border border-slate-700"
              >
                Connexion administrateur
              </button>
            )}
          </div>
        </div>
      );
    }

    if (view === View.LOGIN && !user) {
      return (
        <>
          <Login
            onBackToHome={() => setView(View.LANDING)}
            onOpenPricing={() => openPricingView()}
          />
          {upgradeModalUI}
        </>
      );
    }

    if (view === View.PRICING) {
      return (
        <>
          <PricingPage
            onBack={() => setView(user ? View.APP : View.LANDING)}
            onRequireLogin={() => setView(View.LOGIN)}
            onOpenProfile={user ? () => setView(View.PROFILE) : undefined}
            initialHighlightPlan={pricingHighlightPlan}
          />
          {upgradeModalUI}
        </>
      );
    }

    if (view === View.APP && user) {
      return (
        <>
          <Dashboard
            user={mockUser}
            onLogout={handleLogoutRequest}
            onViewHistory={() => {
              if (!hasFeature('safety_history')) {
                openUpgradeModal('safety_history');
                return;
              }
              setView(View.HISTORY);
            }}
            onViewProfile={() => setView(View.PROFILE)}
            onMessages={() => setView(View.MESSAGES)}
            onZoneSafety={() => setView(View.ZONE_SAFETY)}
            onRiskHeatmap={navigateToRiskHeatmap}
            onParentalTracking={() => setView(View.PARENTAL_TRACKING)}
            onAdminFeedback={isSuperAdmin ? navigateToSuperAdmin : undefined}
            onOpenPricing={() => openPricingView()}
          />
          {exitFeedbackUI}
          {upgradeModalUI}
        </>
      );
    }

    if (view === View.HISTORY && user) {
      return (
        <>
          <HistoryPage user={mockUser} onBack={() => setView(View.APP)} />
          {exitFeedbackUI}
          {upgradeModalUI}
        </>
      );
    }

    if (view === View.PROFILE && user) {
      return (
        <>
          <UserProfile
            user={mockUser}
            onBack={() => setView(View.APP)}
            onTrustedContacts={() => {
              if (!hasFeature('emergency_contacts')) {
                openUpgradeModal('emergency_contacts');
                return;
              }
              setView(View.TRUSTED_CONTACTS);
            }}
            onSosSettings={() => {
              if (!hasFeature('sos')) {
                openUpgradeModal('sos');
                return;
              }
              setView(View.SOS_SETTINGS);
            }}
            onOpenPricing={(plan) => openPricingView(plan)}
            onParentalTracking={() => {
              if (!hasFeature('family_dashboard')) {
                openUpgradeModal('family_dashboard');
                return;
              }
              setView(View.PARENTAL_TRACKING);
            }}
            onHistory={() => {
              if (!hasFeature('safety_history')) {
                openUpgradeModal('safety_history');
                return;
              }
              setView(View.HISTORY);
            }}
            onAdminDashboard={isSuperAdmin ? navigateToSuperAdmin : undefined}
            onOpenDownload={navigateToDownload}
            onRiskHeatmap={navigateToRiskHeatmap}
            onLogout={handleLogoutRequest}
          />
          {exitFeedbackUI}
          {upgradeModalUI}
        </>
      );
    }

    if (view === View.MESSAGES && user) {
      return (
        <>
          <MessagesPage onBack={() => setView(View.APP)} />
          {upgradeModalUI}
        </>
      );
    }

    if (view === View.ZONE_SAFETY && user) {
      return (
        <>
          <ZoneSafetyPage onBack={() => setView(View.APP)} />
          {upgradeModalUI}
        </>
      );
    }

    if (view === View.RISK_HEATMAP && user) {
      return (
        <>
          <RiskHeatmapPage
            onBack={() => navigateOutOfSpecialRoute(View.APP)}
            onOpenPricing={() => {
              navigateOutOfSpecialRoute(View.PRICING);
              openPricingView('PREMIUM');
            }}
          />
          {upgradeModalUI}
        </>
      );
    }

    if (view === View.TRUSTED_CONTACTS && user) {
      return (
        <>
          <TrustedContactsPage onClose={() => setView(View.PROFILE)} />
          {upgradeModalUI}
        </>
      );
    }

    if (view === View.SOS_SETTINGS && user) {
      return (
        <>
          <SosSettingsPage onClose={() => setView(View.PROFILE)} />
          {upgradeModalUI}
        </>
      );
    }

    if (view === View.PARENTAL_TRACKING && user) {
      return (
        <>
          <ParentalTrackingPage onBack={() => setView(View.APP)} />
          {upgradeModalUI}
        </>
      );
    }

    if (view === View.SHARE_VIEWER && shareParams) {
      return (
        <LiveTrackingViewer
          sessionId={shareParams.sessionId}
          token={shareParams.token}
          onExit={() => setView(View.LANDING)}
        />
      );
    }

    return (
      <>
        <LandingPage
          isAuthenticated={Boolean(user)}
          userName={mockUser.name}
          userPlan={effectivePlan}
          onLaunch={handleLaunch}
          onOpenPricing={openPricingView}
          onOpenDownload={navigateToDownload}
          onOpenProfile={user ? () => setView(View.PROFILE) : undefined}
          onOpenHistory={
            user
              ? () => {
                  if (!hasFeature('safety_history')) {
                    openUpgradeModal('safety_history');
                    return;
                  }
                  setView(View.HISTORY);
                }
              : undefined
          }
        />
        {upgradeModalUI}
      </>
    );
  };

  return (
    <>
      {accountRestrictionMessage && (
        <div className="bg-red-950 border-b border-red-500/50 text-red-200 px-4 py-2.5 text-xs flex items-center justify-between gap-3">
          <span>{accountRestrictionMessage}</span>
          <button
            onClick={clearAccountRestriction}
            className="text-red-300 hover:text-white font-semibold shrink-0"
          >
            Fermer
          </button>
        </div>
      )}

      {publicConfig?.announcementEnabled &&
        publicConfig.announcementText &&
        view !== View.SUPER_ADMIN && (
          <div
            className={`px-4 py-2 text-xs text-center font-medium border-b ${
              publicConfig.announcementType === 'warning'
                ? 'bg-amber-950/80 border-amber-500/40 text-amber-200'
                : publicConfig.announcementType === 'success'
                ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-200'
                : 'bg-blue-950/80 border-blue-500/40 text-blue-200'
            }`}
          >
            {publicConfig.announcementText}
          </div>
        )}

      <VruToaster
        onOpenHistory={
          user
            ? () => {
                if (!hasFeature('safety_history')) {
                  openUpgradeModal('safety_history');
                  return;
                }
                setView(View.HISTORY);
              }
            : undefined
        }
      />
      {renderView()}
      {view !== View.SUPER_ADMIN && view !== View.DOWNLOAD && (
        <AndroidUpdateModal
          open={androidUpdateState.open}
          latestInfo={androidUpdateState.latestInfo}
          installedVersionName={androidUpdateState.installedVersionName}
          installedVersionCode={androidUpdateState.installedVersionCode}
          onDismiss={() => setAndroidUpdateState((prev) => ({ ...prev, open: false }))}
        />
      )}
    </>
  );
};

export default App;
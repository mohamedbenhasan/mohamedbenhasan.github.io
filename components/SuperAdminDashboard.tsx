import React, { useCallback, useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Ticket,
  Accessibility,
  Award,
  ScrollText,
  Sliders,
  Bell,
  LifeBuoy,
  ShieldCheck,
  ArrowLeft,
  RefreshCw,
  Menu,
  X,
  LogOut,
  Shield,
  Smartphone,
  FileCheck2,
} from 'lucide-react';
import { useAuth } from '../AuthContext';
import { SuperAdminOverviewResponse, superAdminService } from '../services/SuperAdminService';
import { toast } from '../services/NotificationService';
import { ThemeToggle } from './ThemeToggle';
import { AccessDenied403, ReauthConfirmModal } from './super-admin/SuperAdminShared';
import { OverviewSection } from './super-admin/OverviewSection';
import { UsersSection } from './super-admin/UsersSection';
import { SubscriptionsSection } from './super-admin/SubscriptionsSection';
import { RedeemCodesSection } from './super-admin/RedeemCodesSection';
import { AccessibilitySection, PioneerSection } from './super-admin/ProgramsSection';
import {
  AuditLogsSection,
  NotificationsSection,
  SupportSection,
} from './super-admin/OperationsSection';
import { SettingsSection, SecuritySection } from './super-admin/GovernanceSection';
import { AndroidAppSection } from './super-admin/AndroidAppSection';
import { ConsentsSection } from './super-admin/ConsentsSection';

type SectionId =
  | 'overview'
  | 'users'
  | 'subscriptions'
  | 'redeem'
  | 'accessibility'
  | 'pioneer'
  | 'android_app'
  | 'consents'
  | 'audit'
  | 'settings'
  | 'notifications'
  | 'support'
  | 'security';

interface Props {
  onBackToApp: () => void;
  onLogout: () => void;
  onRequireLogin?: () => void;
}

const NAV_GROUPS: Array<{
  title: string;
  items: Array<{ id: SectionId; label: string; icon: React.ComponentType<{ className?: string }> }>;
}> = [
  {
    title: 'Pilotage',
    items: [
      { id: 'overview', label: 'Vue générale', icon: LayoutDashboard },
      { id: 'users', label: 'Utilisateurs & Présence', icon: Users },
    ],
  },
  {
    title: 'Monétisation & Programmes',
    items: [
      { id: 'subscriptions', label: 'Abonnements', icon: CreditCard },
      { id: 'redeem', label: 'Codes Redeem', icon: Ticket },
      { id: 'accessibility', label: 'Programme Accessibilité', icon: Accessibility },
      { id: 'pioneer', label: 'Programme Pioneer', icon: Award },
    ],
  },
  {
    title: 'Opérations & Distribution',
    items: [
      { id: 'android_app', label: 'Application Android', icon: Smartphone },
      { id: 'notifications', label: 'Notifications Admin', icon: Bell },
      { id: 'support', label: 'Support & Rapports', icon: LifeBuoy },
    ],
  },
  {
    title: 'Gouvernance & Sécurité',
    items: [
      { id: 'consents', label: 'Gestion des consentements', icon: FileCheck2 },
      { id: 'audit', label: 'Logs & Audit', icon: ScrollText },
      { id: 'settings', label: 'Paramètres Plateforme', icon: Sliders },
      { id: 'security', label: 'Sécurité & RBAC', icon: ShieldCheck },
    ],
  },
];

export const SuperAdminDashboard: React.FC<Props> = ({
  onBackToApp,
  onLogout,
  onRequireLogin,
}) => {
  const {
    user,
    isSuperAdmin,
    loading: authLoading,
    reauthenticateAdmin,
    refreshPublicConfig,
  } = useAuth();
  const [activeSection, setActiveSection] = useState<SectionId>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [overview, setOverview] = useState<SuperAdminOverviewResponse | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);

  // Re-authentication modal state for critical actions
  const [reauthState, setReauthState] = useState<{
    open: boolean;
    title: string;
    description: string;
    retryFn: (() => Promise<void>) | null;
  }>({
    open: false,
    title: '',
    description: '',
    retryFn: null,
  });

  // Security guard: log unauthorized access attempt server-side and render HTTP 403 UI
  useEffect(() => {
    if (!authLoading && user && !isSuperAdmin) {
      superAdminService.logUnauthorizedRouteAttempt();
    }
  }, [authLoading, user, isSuperAdmin]);

  const loadOverview = useCallback(async () => {
    if (!isSuperAdmin) return;
    setOverviewLoading(true);
    try {
      const res = await superAdminService.getOverview();
      setOverview(res);
    } catch (err: any) {
      toast.error(err?.message || 'Erreur lors du chargement de la vue générale.');
    } finally {
      setOverviewLoading(false);
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview, refreshTick]);

  // Live auto-refresh every 15s (keeps presence & KPIs fresh without full page reload)
  useEffect(() => {
    if (!isSuperAdmin || !autoRefresh) return;
    const interval = setInterval(() => {
      setRefreshTick((t) => t + 1);
    }, 15_000);
    return () => clearInterval(interval);
  }, [isSuperAdmin, autoRefresh]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-xs font-mono text-blue-400">
        Vérification des privilèges Super Admin...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-5 shadow-2xl">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center mx-auto text-amber-400">
            <Shield className="w-6 h-6" />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-mono uppercase tracking-widest text-amber-400">
              Console Super Admin · /super-admin
            </p>
            <h1 className="font-display text-xl font-bold text-white">
              Connexion requise
            </h1>
            <p className="text-sm text-slate-400">
              Authentifiez-vous avec votre compte propriétaire Super Admin pour accéder au centre de contrôle.
            </p>
          </div>
          <div className="space-y-2.5">
            {onRequireLogin && (
              <button
                onClick={onRequireLogin}
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-[#ffffff] text-sm font-semibold transition-colors"
              >
                Se connecter
              </button>
            )}
            <button
              onClick={onBackToApp}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Retourner à VruGuard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return <AccessDenied403 onReturnHome={onBackToApp} userEmail={user?.email} />;
  }

  const hasPasswordProvider = user.providerData.some((p) => p.providerId === 'password');

  const triggerManualRefresh = () => {
    setRefreshTick((t) => t + 1);
    void refreshPublicConfig();
  };

  const handleOpenReauth = (title: string, description: string, retryFn: () => Promise<void>) => {
    setReauthState({ open: true, title, description, retryFn });
  };

  const handleConfirmReauth = async (password?: string) => {
    const ok = await reauthenticateAdmin(password);
    if (!ok) {
      throw new Error('Identifiants invalides ou ré-authentification annulée.');
    }
    if (reauthState.retryFn) {
      await reauthState.retryFn();
    }
  };

  const currentSectionLabel =
    NAV_GROUPS.flatMap((g) => g.items).find((i) => i.id === activeSection)?.label ||
    'Vue générale';

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <div className="font-display text-sm font-bold text-white leading-tight">
              VruGuard
            </div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-amber-400">
              Super Admin
            </div>
          </div>
        </div>
        <button
          onClick={() => setMobileMenuOpen(false)}
          className="lg:hidden p-1.5 text-slate-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {NAV_GROUPS.map((group) => (
          <div key={group.title} className="space-y-1">
            <div className="px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              {group.title}
            </div>
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              const badgeCount =
                item.id === 'accessibility'
                  ? overview?.kpis.pendingAccessibility || 0
                  : item.id === 'support'
                  ? (overview?.kpis.openSupportTickets || 0) + (overview?.kpis.newBusinessQuotes || 0)
                  : 0;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveSection(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors ${
                    isActive
                      ? 'bg-blue-600/20 text-blue-300 border border-blue-500/40'
                      : 'text-slate-300 hover:bg-slate-900 hover:text-white border border-transparent'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </span>
                  {badgeCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-mono text-[10px] tabular-nums">
                      {badgeCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-slate-800 space-y-2 text-xs">
        <div className="px-2 py-1.5 rounded-xl bg-slate-900 border border-slate-800">
          <div className="text-[10px] text-slate-500 uppercase font-mono">Propriétaire connecté</div>
          <div className="text-slate-200 font-mono truncate text-[11px]">{user.email}</div>
        </div>
        <button
          onClick={onBackToApp}
          className="w-full px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-semibold flex items-center gap-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Retour à VruGuard
        </button>
        <button
          onClick={onLogout}
          className="w-full px-3 py-2 rounded-xl bg-slate-900 hover:bg-red-950/50 border border-slate-800 hover:border-red-500/40 text-slate-300 hover:text-red-300 font-semibold flex items-center gap-2"
        >
          <LogOut className="w-3.5 h-3.5" />
          Déconnexion
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 border-r border-slate-800 bg-slate-950 flex-col sticky top-0 h-screen">
        {renderSidebarContent()}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[110000] lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-72 max-w-[85vw] bg-slate-950 border-r border-slate-800 h-full z-10">
            {renderSidebarContent()}
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 h-16 border-b border-slate-800 bg-slate-950/90 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div>
              <h1 className="font-display text-base sm:text-lg font-bold text-white">
                {currentSectionLabel}
              </h1>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Console de gouvernance Zero-Trust · Route dédiée /super-admin
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <label className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-slate-700 bg-slate-950 text-emerald-500"
              />
              <span>Live 15s</span>
            </label>
            <button
              onClick={triggerManualRefresh}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-200 inline-flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${overviewLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Actualiser</span>
            </button>
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-[1600px] w-full mx-auto">
          {activeSection === 'overview' && (
            <OverviewSection
              data={overview}
              loading={overviewLoading}
              onNavigateSection={(sec) => setActiveSection(sec as SectionId)}
            />
          )}
          {activeSection === 'users' && (
            <UsersSection
              refreshTick={refreshTick}
              currentAdminUid={user.uid}
              onOpenReauth={handleOpenReauth}
              onChanged={triggerManualRefresh}
            />
          )}
          {activeSection === 'subscriptions' && (
            <SubscriptionsSection refreshTick={refreshTick} onChanged={triggerManualRefresh} />
          )}
          {activeSection === 'redeem' && (
            <RedeemCodesSection refreshTick={refreshTick} onChanged={triggerManualRefresh} />
          )}
          {activeSection === 'accessibility' && (
            <AccessibilitySection refreshTick={refreshTick} onChanged={triggerManualRefresh} />
          )}
          {activeSection === 'pioneer' && (
            <PioneerSection refreshTick={refreshTick} onChanged={triggerManualRefresh} />
          )}
          {activeSection === 'android_app' && (
            <AndroidAppSection refreshTick={refreshTick} onChanged={triggerManualRefresh} />
          )}
          {activeSection === 'notifications' && (
            <NotificationsSection refreshTick={refreshTick} onChanged={triggerManualRefresh} />
          )}
          {activeSection === 'support' && (
            <SupportSection refreshTick={refreshTick} onChanged={triggerManualRefresh} />
          )}
          {activeSection === 'consents' && <ConsentsSection refreshTick={refreshTick} />}
          {activeSection === 'audit' && <AuditLogsSection refreshTick={refreshTick} />}
          {activeSection === 'settings' && (
            <SettingsSection
              refreshTick={refreshTick}
              onOpenReauth={handleOpenReauth}
              onChanged={triggerManualRefresh}
            />
          )}
          {activeSection === 'security' && (
            <SecuritySection
              refreshTick={refreshTick}
              onOpenReauth={handleOpenReauth}
              onChanged={triggerManualRefresh}
            />
          )}
        </main>
      </div>

      <ReauthConfirmModal
        open={reauthState.open}
        title={reauthState.title}
        description={reauthState.description}
        hasPasswordProvider={hasPasswordProvider}
        onClose={() => setReauthState((s) => ({ ...s, open: false }))}
        onConfirmReauth={handleConfirmReauth}
      />
    </div>
  );
};

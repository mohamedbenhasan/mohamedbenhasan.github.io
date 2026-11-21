import React, { useEffect, useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { User, SubscriptionPlan } from '../types';
import { historyService, SessionRecord } from '../services/HistoryService';
import { subscriptionService } from '../services/SubscriptionService';
import { ThemeToggle } from './ThemeToggle';
import { CurrencySelector } from './CurrencySelector';
import { useAuth } from '../AuthContext';
import { formatPrice, getPlanPrice } from '../utils/subscriptionPlans';
import { toast } from '../services/NotificationService';
import {
  Award,
  CreditCard,
  Lock,
  Ticket,
  Siren,
  Users,
  MapPin,
  Clock,
  LogOut,
  CheckCircle2,
  Loader2,
  ArrowRight,
  Sparkles,
  FileDown,
  ShieldCheck,
  Accessibility,
  LifeBuoy,
  Smartphone,
  RefreshCw,
  FileCheck2,
  AlertTriangle,
  Flame,
} from 'lucide-react';
import {
  AccessibilityApplicationModal,
  SupportTicketModal,
} from './AccessibilityAndSupportModals';
import { VruLogo } from './VruLogo';
import { androidAppService } from '../services/AndroidAppService';
import { AndroidLatestVersionResponse } from '../types';
import { AndroidUpdateModal } from './AndroidUpdateModal';

interface Props {
  user: User | null;
  onBack: () => void;
  onTrustedContacts?: () => void;
  onSosSettings?: () => void;
  onOpenPricing?: (plan?: SubscriptionPlan) => void;
  onParentalTracking?: () => void;
  onHistory?: () => void;
  onAdminDashboard?: () => void;
  onOpenDownload?: () => void;
  onRiskHeatmap?: () => void;
  onLogout?: () => void;
}

export const UserProfile: React.FC<Props> = ({
  user,
  onBack,
  onTrustedContacts,
  onSosSettings,
  onOpenPricing,
  onParentalTracking,
  onHistory,
  onAdminDashboard,
  onOpenDownload,
  onRiskHeatmap,
  onLogout,
}) => {
  const {
    subscription,
    effectivePlan,
    hasFeature,
    openUpgradeModal,
    refreshSubscription,
    isSuperAdmin,
    publicConfig,
    currency,
    consentStatus,
    updateOptionalConsents,
    withdrawUserConsent,
  } = useAuth();

  const premMonthlyStr = formatPrice(
    getPlanPrice('PREMIUM', 'monthly', currency, publicConfig),
    currency
  );
  const famMonthlyStr = formatPrice(
    getPlanPrice('FAMILY', 'monthly', currency, publicConfig),
    currency
  );

  const canManageContacts = hasFeature('emergency_contacts');
  const canUseSos = hasFeature('sos');
  const canExportHistory = hasFeature('safety_history');
  const canViewRiskHeatmap = hasFeature('global_risk_heatmap');
  const canUseFamily = hasFeature('family_dashboard');

  const isEarlyTesterActive = Boolean(
    subscription?.isEarlyTester &&
      subscription?.earlyTesterEndDate &&
      subscription.earlyTesterEndDate > Date.now()
  );

  const [history, setHistory] = useState<SessionRecord[]>([]);
  const [stats, setStats] = useState({
    totalSessions: 0,
    totalDuration: 0,
    avgRisk: 0,
  });

  // Redeem code state
  const [redeemCode, setRedeemCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [redeemMessage, setRedeemMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [showAccessibilityModal, setShowAccessibilityModal] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [savingOptionalConsent, setSavingOptionalConsent] = useState(false);
  const [confirmWithdrawOpen, setConfirmWithdrawOpen] = useState(false);
  const [withdrawingConsent, setWithdrawingConsent] = useState(false);
  const [updatePrompt, setUpdatePrompt] = useState<{
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

  useEffect(() => {
    const fetchHistory = async () => {
      if (!user) return;
      try {
        const data = await historyService.getHistory(user.id);
        setHistory(data);

        if (data.length > 0) {
          const totalTime = data.reduce((acc, curr) => acc + curr.duration, 0);
          const totalWarnings = data.reduce(
            (acc, curr) => acc + curr.metrics.collisionWarnings,
            0
          );

          setStats({
            totalSessions: data.length,
            totalDuration: totalTime,
            avgRisk: totalWarnings / data.length,
          });
        }
      } catch (error) {
        console.error('Failed to fetch history:', error);
      }
    };

    fetchHistory();
  }, [user?.id]);

  if (!user) return null;

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const formatDate = (ms?: number | null) => {
    if (!ms) return '—';
    return new Date(ms).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getSubscriptionStatusLabel = () => {
    if (isEarlyTesterActive) return 'Actif · Early Tester (2 ans)';
    if (!subscription || effectivePlan === 'FREE') return 'Actif · Gratuit';
    if (subscription.status === 'expired') return 'Expiré';
    if (subscription.status === 'canceled' || subscription.cancelAtPeriodEnd) return 'Annulé';
    return 'Actif';
  };

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    setRedeemMessage(null);
    const cleaned = redeemCode.trim().toUpperCase();
    if (!cleaned) {
      setRedeemMessage({ type: 'error', text: 'Veuillez saisir un code Redeem valide.' });
      return;
    }

    setRedeeming(true);
    try {
      const res = await subscriptionService.redeemCode({ code: cleaned });
      const activatedPlan = res.subscription?.plan || res.plan || res.activation?.plan;
      if (!activatedPlan) {
        throw new Error('Réponse d’activation invalide. Veuillez réessayer.');
      }
      await refreshSubscription();
      setRedeemCode('');
      const endDate = res.subscription?.endDate ?? res.activation?.endDate ?? null;
      const isLifetime = Boolean(res.subscription?.isLifetime || res.activation?.isLifetime);
      setRedeemMessage({
        type: 'success',
        text: isLifetime || !endDate
          ? `Formule ${activatedPlan} activée (accès illimité).`
          : `Formule ${activatedPlan} activée jusqu'au ${formatDate(endDate)}.`,
      });
      toast.success(`Abonnement ${activatedPlan} activé.`);
    } catch (err: any) {
      const msg = err?.message || 'Code Redeem invalide ou déjà utilisé.';
      setRedeemMessage({ type: 'error', text: msg });
      toast.error(msg);
    } finally {
      setRedeeming(false);
    }
  };

  const handleCheckAndroidUpdates = async () => {
    setCheckingUpdates(true);
    try {
      const installed = await androidAppService.getInstalledAppInfo();
      const latest = await androidAppService.getLatestVersion(installed.versionCode);
      if (!latest.available) {
        toast.info(latest.disabledReason || 'Aucune version Android disponible pour le moment.');
        return;
      }
      if (latest.updateAvailable || !installed.isNativeAndroid) {
        setUpdatePrompt({
          open: true,
          latestInfo: latest,
          installedVersionName: installed.versionName,
          installedVersionCode: installed.versionCode,
        });
      } else {
        toast.success(`Vous utilisez déjà la dernière version (v${installed.versionName}).`);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Impossible de vérifier les mises à jour.');
    } finally {
      setCheckingUpdates(false);
    }
  };

  const handleToggleOptionalConsent = async (
    key: 'notifications' | 'locationEnhancements',
    nextVal: boolean
  ) => {
    setSavingOptionalConsent(true);
    try {
      await updateOptionalConsents({ [key]: nextVal });
      toast.success('Préférence de confidentialité mise à jour.');
    } catch (err: any) {
      toast.error(err?.message || 'Impossible de mettre à jour cette préférence.');
    } finally {
      setSavingOptionalConsent(false);
    }
  };

  const handleWithdrawConsent = async () => {
    setWithdrawingConsent(true);
    try {
      await withdrawUserConsent();
      setConfirmWithdrawOpen(false);
      toast.info('Votre consentement a été retiré. L’accès au compte est suspendu.');
    } catch (err: any) {
      toast.error(err?.message || 'Erreur lors du retrait du consentement.');
    } finally {
      setWithdrawingConsent(false);
    }
  };

  const exportCSV = () => {
    if (!canExportHistory) {
      openUpgradeModal('safety_history');
      return;
    }
    if (history.length === 0) return;

    const headers = [
      'Session ID',
      'Date',
      'Duration (s)',
      'Environment',
      'Weather',
      'Time of Day',
      'Avg Error (m)',
      'Warnings',
      'Quantum Fusion',
    ];
    const rows = history.map((s) => [
      s.id,
      new Date(s.timestamp).toISOString(),
      s.duration.toFixed(1),
      s.context.environment,
      s.context.weather,
      s.context.time,
      s.metrics.avgError.toFixed(4),
      s.metrics.collisionWarnings,
      s.metrics.quantumFusionActive ? 'Yes' : 'No',
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `vruguard_history_${user.id}_${new Date().toISOString().split('T')[0]}.csv`
    );
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportPDF = () => {
    if (!canExportHistory) {
      openUpgradeModal('safety_history');
      return;
    }
    if (history.length === 0) return;

    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Rapport d'activité VruGuard", 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Utilisateur : ${user.name} (${user.email})`, 14, 30);
    doc.text(`Offre : ${effectivePlan}`, 14, 36);
    doc.text(`Généré le : ${new Date().toLocaleString('fr-FR')}`, 14, 42);

    doc.text(`Sessions : ${stats.totalSessions}`, 14, 54);
    doc.text(`Temps total : ${formatDuration(stats.totalDuration)}`, 14, 60);
    doc.text(`Alertes moyennes : ${stats.avgRisk.toFixed(2)}`, 14, 66);

    const tableData = history.map((s) => [
      new Date(s.timestamp).toLocaleDateString('fr-FR'),
      s.context.environment,
      `${s.duration.toFixed(0)}s`,
      s.metrics.collisionWarnings,
      s.metrics.avgError.toFixed(3),
    ]);

    autoTable(doc, {
      startY: 74,
      head: [['Date', 'Environnement', 'Durée', 'Alertes', 'RMSE (m)']],
      body: tableData,
    });

    doc.save(`vruguard_rapport_${user.id}.pdf`);
  };

  const activations = subscription?.activations || [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col overflow-y-auto">
      {/* Modern Top Navigation Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <VruLogo className="w-8 h-8 rounded-lg" />
            <span className="font-display font-bold text-base text-white whitespace-nowrap">
              Mon espace VruGuard
            </span>
          </div>

          <nav className="hidden lg:flex items-center gap-6 text-xs font-semibold text-slate-300">
            <button onClick={onBack} className="hover:text-white transition-colors whitespace-nowrap">
              Carte interactive
            </button>
            <button
              onClick={() => onOpenPricing?.()}
              className="hover:text-white transition-colors whitespace-nowrap"
            >
              Abonnements &amp; Redeem
            </button>
            {onParentalTracking && (
              <button
                onClick={onParentalTracking}
                className="hover:text-white transition-colors whitespace-nowrap flex items-center gap-1"
              >
                {!canUseFamily && <Lock className="w-3 h-3 text-slate-500" />}
                Suivi Famille
              </button>
            )}
            {onHistory && (
              <button
                onClick={onHistory}
                className="hover:text-white transition-colors whitespace-nowrap flex items-center gap-1"
              >
                {!canExportHistory && <Lock className="w-3 h-3 text-slate-500" />}
                Historique
              </button>
            )}
            {isSuperAdmin && onAdminDashboard && (
              <button
                onClick={onAdminDashboard}
                className="text-amber-400 hover:text-amber-300 transition-colors whitespace-nowrap"
              >
                Super Admin
              </button>
            )}
          </nav>

          <div className="flex items-center gap-2.5">
            <ThemeToggle />
            <button
              onClick={onBack}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-[#ffffff] text-xs font-semibold transition-colors whitespace-nowrap"
            >
              Ouvrir la carte
            </button>
            {onLogout && (
              <button
                onClick={onLogout}
                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-red-400 transition-colors"
                title="Déconnexion"
                aria-label="Déconnexion"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-8 space-y-8 flex-1">
        {/* Top Banner: Free Upgrade CTA OR Active Premium/Family Summary */}
        {effectivePlan === 'FREE' ? (
          <section className="rounded-2xl bg-slate-900 border border-blue-500/40 p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-400">
                <Sparkles className="w-4 h-4" />
                Passez à VruGuard Premium ou Family
              </div>
              <h1 className="font-display text-xl sm:text-2xl font-bold text-white">
                Débloquez le bouton SOS et vos contacts d&apos;urgence
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 max-w-2xl tabular-nums">
                Votre compte Free inclut la carte et la navigation de base. Activez l&apos;offre Premium ({premMonthlyStr}/mois) ou Family ({famMonthlyStr}/mois) par paiement en ligne ou code Redeem pour activer la protection d&apos;urgence complète.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                onClick={() => onOpenPricing?.('PREMIUM')}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-[#ffffff] text-xs sm:text-sm font-semibold transition-colors inline-flex items-center gap-2"
              >
                Voir les abonnements
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </section>
        ) : (
          <section className="rounded-2xl bg-slate-900 border border-emerald-500/35 p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
                <ShieldCheck className="w-4 h-4" />
                Protection {effectivePlan} active
              </div>
              <h1 className="font-display text-xl sm:text-2xl font-bold text-white">
                Toutes vos fonctions de sécurité sont débloquées
              </h1>
              <p className="text-xs sm:text-sm text-slate-300">
                Bouton SOS rapide &amp; vocal, jusqu&apos;à 10 contacts d&apos;urgence, partage GPS en direct et localisation multi-sources actifs.
                {effectivePlan === 'FAMILY' && ' Jusqu’à 6 profils familiaux et suivi parental inclus.'}
              </p>
            </div>
            <button
              onClick={() => onOpenPricing?.()}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-700 shrink-0 self-start md:self-auto"
            >
              Gérer mon offre
            </button>
          </section>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Account Overview + Subscription Card */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-2xl font-display font-bold text-[#ffffff] shrink-0">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h2 className="font-display text-lg font-bold text-white truncate">
                    {user.name}
                  </h2>
                  <p className="text-xs text-slate-400 truncate">{user.email}</p>
                  <p className="text-[11px] font-mono text-slate-500 mt-0.5 truncate">
                    Rôle : {user.role}
                  </p>
                </div>
              </div>

              <div className="border-t border-slate-800 pt-4 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Abonnement actuel</span>
                  <span className="font-display font-bold text-sm text-blue-400">
                    {effectivePlan}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Statut</span>
                  <span className="font-medium text-emerald-400">
                    {getSubscriptionStatusLabel()}
                  </span>
                </div>
                <div className="flex items-center justify-between tabular-nums">
                  <span className="text-slate-400">Date d&apos;expiration</span>
                  <span className="font-mono text-slate-200">
                    {isEarlyTesterActive
                      ? formatDate(subscription?.earlyTesterEndDate)
                      : effectivePlan !== 'FREE'
                      ? formatDate(subscription?.endDate)
                      : 'Illimitée (Free)'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-0.5">Identifiant utilisateur</span>
                  <div className="font-mono text-[11px] text-slate-300 truncate bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800">
                    {user.id}
                  </div>
                </div>
              </div>

              {isEarlyTesterActive && subscription?.earlyTesterEndDate && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-amber-300">
                    <Award className="w-4 h-4 shrink-0" />
                    <span>Early Tester — Premium offert 2 ans</span>
                  </div>
                  <div className="text-slate-300 tabular-nums">
                    Valable jusqu&apos;au {formatDate(subscription.earlyTesterEndDate)}
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-slate-800 space-y-2.5 text-xs text-slate-400">
                <div className="flex items-center justify-between">
                  <span>Apparence de l&apos;interface</span>
                  <ThemeToggle showLabel={true} />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>Devise</span>
                  <CurrencySelector compact showOriginHint={false} />
                </div>
              </div>
            </div>

            {/* Quick Feature Shortcuts */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
              <h3 className="font-display text-sm font-bold text-white">
                Accès rapide aux fonctionnalités
              </h3>

              <button
                onClick={onBack}
                className="w-full py-2.5 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 flex items-center justify-between text-xs font-semibold transition-colors"
              >
                <span className="flex items-center gap-2.5">
                  <MapPin className="w-4 h-4 text-blue-400" />
                  Carte &amp; Navigation
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              </button>

              <button
                onClick={() => {
                  if (!canManageContacts) {
                    openUpgradeModal('emergency_contacts');
                    return;
                  }
                  onTrustedContacts?.();
                }}
                className={`w-full py-2.5 px-3.5 rounded-xl border flex items-center justify-between text-xs font-semibold transition-colors ${
                  canManageContacts
                    ? 'bg-slate-800 hover:bg-slate-700 text-white border-slate-700'
                    : 'bg-slate-950/60 hover:bg-slate-800/70 text-slate-400 border-slate-800'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-indigo-400" />
                  Contacts d&apos;urgence
                </span>
                {canManageContacts ? (
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] text-amber-400">
                    <Lock className="w-3 h-3" /> Premium
                  </span>
                )}
              </button>

              <button
                onClick={() => {
                  if (!canUseSos) {
                    openUpgradeModal('sos');
                    return;
                  }
                  onSosSettings?.();
                }}
                className={`w-full py-2.5 px-3.5 rounded-xl border flex items-center justify-between text-xs font-semibold transition-colors ${
                  canUseSos
                    ? 'bg-red-950/30 hover:bg-red-900/40 text-red-200 border-red-500/30'
                    : 'bg-slate-950/60 hover:bg-slate-800/70 text-slate-400 border-slate-800'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Siren className="w-4 h-4 text-red-400" />
                  Paramètres SOS
                </span>
                {canUseSos ? (
                  <ArrowRight className="w-3.5 h-3.5 text-red-300" />
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] text-amber-400">
                    <Lock className="w-3 h-3" /> Premium
                  </span>
                )}
              </button>

              {onRiskHeatmap && (
                <button
                  onClick={() => {
                    if (!canViewRiskHeatmap) {
                      openUpgradeModal('global_risk_heatmap');
                      return;
                    }
                    onRiskHeatmap();
                  }}
                  className={`w-full py-2.5 px-3.5 rounded-xl border flex items-center justify-between text-xs font-semibold transition-colors ${
                    canViewRiskHeatmap
                      ? 'bg-orange-950/30 hover:bg-orange-900/40 text-orange-200 border-orange-500/30'
                      : 'bg-slate-950/60 hover:bg-slate-800/70 text-slate-400 border-slate-800'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Flame className="w-4 h-4 text-orange-400" />
                    Global Risk Heatmap
                  </span>
                  {canViewRiskHeatmap ? (
                    <ArrowRight className="w-3.5 h-3.5 text-orange-300" />
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] text-amber-400">
                      <Lock className="w-3 h-3" /> Premium
                    </span>
                  )}
                </button>
              )}

              {onParentalTracking && (
                <button
                  onClick={onParentalTracking}
                  className={`w-full py-2.5 px-3.5 rounded-xl border flex items-center justify-between text-xs font-semibold transition-colors ${
                    canUseFamily
                      ? 'bg-indigo-950/30 hover:bg-indigo-900/40 text-indigo-200 border-indigo-500/30'
                      : 'bg-slate-950/60 hover:bg-slate-800/70 text-slate-400 border-slate-800'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Users className="w-4 h-4 text-indigo-400" />
                    Protection &amp; Suivi Famille
                  </span>
                  {canUseFamily ? (
                    <ArrowRight className="w-3.5 h-3.5 text-indigo-300" />
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] text-indigo-400">
                      <Lock className="w-3 h-3" /> Family
                    </span>
                  )}
                </button>
              )}

              {onOpenPricing && (
                <button
                  onClick={() => onOpenPricing()}
                  className="w-full py-2.5 px-3.5 rounded-xl bg-blue-600/15 hover:bg-blue-600/25 text-blue-300 border border-blue-500/30 flex items-center justify-between text-xs font-semibold transition-colors"
                >
                  <span className="flex items-center gap-2.5">
                    <CreditCard className="w-4 h-4" />
                    Comparer les offres
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}

              {publicConfig?.accessibilityProgramEnabled !== false && (
                <button
                  onClick={() => setShowAccessibilityModal(true)}
                  className="w-full py-2.5 px-3.5 rounded-xl bg-slate-800/70 hover:bg-slate-800 text-slate-200 border border-slate-700/80 flex items-center justify-between text-xs font-semibold transition-colors"
                >
                  <span className="flex items-center gap-2.5">
                    <Accessibility className="w-4 h-4 text-blue-400" />
                    Programme Accessibilité
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                </button>
              )}

              <button
                onClick={() => setShowSupportModal(true)}
                className="w-full py-2.5 px-3.5 rounded-xl bg-slate-800/70 hover:bg-slate-800 text-slate-200 border border-slate-700/80 flex items-center justify-between text-xs font-semibold transition-colors"
              >
                <span className="flex items-center gap-2.5">
                  <LifeBuoy className="w-4 h-4 text-emerald-400" />
                  Contacter le support
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              </button>

              <div className="pt-2 border-t border-slate-800 space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Application Android
                </div>
                {onOpenDownload && (
                  <button
                    onClick={onOpenDownload}
                    className="w-full py-2.5 px-3.5 rounded-xl bg-slate-800/70 hover:bg-slate-800 text-slate-200 border border-slate-700/80 flex items-center justify-between text-xs font-semibold transition-colors"
                  >
                    <span className="flex items-center gap-2.5">
                      <Smartphone className="w-4 h-4 text-blue-400" />
                      Télécharger l&apos;APK Android
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                )}
                <button
                  onClick={handleCheckAndroidUpdates}
                  disabled={checkingUpdates}
                  className="w-full py-2.5 px-3.5 rounded-xl bg-slate-800/70 hover:bg-slate-800 text-slate-200 border border-slate-700/80 flex items-center justify-between text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  <span className="flex items-center gap-2.5">
                    <RefreshCw className={`w-4 h-4 text-emerald-400 ${checkingUpdates ? 'animate-spin' : ''}`} />
                    Vérifier les mises à jour
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Redeem Activation + Activation History + Activity Stats */}
          <div className="lg:col-span-8 space-y-6">
            {/* Redeem Code Activation Section */}
            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <Ticket className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="font-display text-base font-bold text-white">
                      Activer un code Redeem
                    </h2>
                    <p className="text-xs text-slate-400">
                      Saisissez votre code VruGuard pour activer instantanément Premium ou Family.
                    </p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleRedeem} className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={redeemCode}
                  onChange={(e) => {
                    setRedeemCode(e.target.value.toUpperCase());
                    setRedeemMessage(null);
                  }}
                  placeholder="Ex. VRU-PREM-XXXX-XXXX"
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm font-mono tracking-wider text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 uppercase"
                />
                <button
                  type="submit"
                  disabled={redeeming}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-[#ffffff] text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shrink-0"
                >
                  {redeeming && <Loader2 className="w-4 h-4 animate-spin" />}
                  Activer mon code
                </button>
              </form>

              {redeemMessage && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                    redeemMessage.type === 'success'
                      ? 'bg-emerald-950/40 border border-emerald-500/40 text-emerald-300'
                      : 'bg-red-500/15 border border-red-500/40 text-red-300'
                  }`}
                >
                  {redeemMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                  <span>{redeemMessage.text}</span>
                </div>
              )}
            </section>

            {/* Activation History Table */}
            <section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-400" />
                  <h2 className="font-display text-base font-bold text-white">
                    Historique des activations
                  </h2>
                </div>
                <span className="text-xs font-mono text-slate-400 tabular-nums">
                  {activations.length} entrée{activations.length > 1 ? 's' : ''}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Date</th>
                      <th className="py-3 px-4 font-semibold">Formule</th>
                      <th className="py-3 px-4 font-semibold">Source / Code</th>
                      <th className="py-3 px-4 font-semibold">Expiration</th>
                      <th className="py-3 px-4 font-semibold">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {activations.map((act) => (
                      <tr key={act.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4 text-slate-300 tabular-nums">
                          {formatDate(act.activatedAt)}
                        </td>
                        <td className="py-3 px-4 font-bold text-blue-400">
                          {act.plan}
                          {act.billingCycle ? ` (${act.billingCycle === 'annual' ? 'Annuel' : 'Mensuel'})` : ''}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-300">
                          {act.code || act.source}
                        </td>
                        <td className="py-3 px-4 text-slate-400 tabular-nums">
                          {act.isLifetime ? 'À vie' : formatDate(act.endDate)}
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-emerald-400 font-medium">Activé</span>
                        </td>
                      </tr>
                    ))}
                    {activations.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-6 px-4 text-center text-slate-500">
                          Aucune activation enregistrée sur ce compte pour le moment.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Real Trip / Simulation KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 tabular-nums">
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">
                  Trajets enregistrés
                </div>
                <div className="font-display text-2xl font-bold text-white">
                  {stats.totalSessions}
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">
                  Temps de trajet cumulé
                </div>
                <div className="font-display text-2xl font-bold text-white">
                  {formatDuration(stats.totalDuration)}
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">
                  Alertes moy. / trajet
                </div>
                <div
                  className={`font-display text-2xl font-bold ${
                    stats.avgRisk > 2 ? 'text-red-400' : 'text-emerald-400'
                  }`}
                >
                  {stats.avgRisk.toFixed(1)}
                </div>
              </div>
            </div>

            {/* Recent Trajets & Exports */}
            <section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="p-4 sm:px-6 border-b border-slate-800 flex flex-wrap justify-between items-center gap-3">
                <h3 className="font-display font-bold text-white">Activité récente</h3>
                <div className="flex gap-2">
                  <button
                    onClick={exportCSV}
                    disabled={history.length === 0}
                    className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg border border-slate-700 transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    CSV
                  </button>
                  <button
                    onClick={exportPDF}
                    disabled={history.length === 0}
                    className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg border border-slate-700 transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    PDF
                  </button>
                </div>
              </div>
              <div className="divide-y divide-slate-800">
                {history.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-sm">
                    Aucun trajet enregistré pour le moment.
                  </div>
                ) : (
                  history.slice(0, 5).map((session) => (
                    <div
                      key={session.id}
                      className="p-4 sm:px-6 hover:bg-slate-800/40 transition-colors flex justify-between items-center gap-4"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-slate-200">
                            Trajet {session.context.environment.replace('_', ' ')}
                          </span>
                          <span className="text-xs text-slate-500 font-mono tabular-nums">
                            {new Date(session.timestamp).toLocaleDateString('fr-FR')}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 flex gap-3 tabular-nums">
                          <span>
                            {Math.floor(session.duration / 60)}m {Math.floor(session.duration % 60)}s
                          </span>
                          <span>·</span>
                          <span>{session.metrics.collisionWarnings} alerte(s)</span>
                        </div>
                      </div>
                      <div className="text-right tabular-nums">
                        <div className="text-[11px] font-mono text-slate-500">Précision moy.</div>
                        <div className="text-sm font-mono text-blue-400 font-semibold">
                          {session.metrics.avgError.toFixed(2)} m
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* RGPD & Consent Proof + Optional Preferences + Withdrawal */}
            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                    <FileCheck2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="font-display text-base font-bold text-white">
                      Données &amp; Consentements (RGPD)
                    </h2>
                    <p className="text-xs text-slate-400">
                      Preuve d&apos;acceptation synchronisée entre Web et Android et gestion de vos choix facultatifs.
                    </p>
                  </div>
                </div>
                {consentStatus?.consentVersion && (
                  <span className="text-[11px] font-mono text-slate-400 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 self-start sm:self-auto">
                    CGU v{consentStatus.termsVersion || consentStatus.consentVersion} · Conf. v{consentStatus.privacyVersion || consentStatus.consentVersion}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 tabular-nums">
                <div>
                  <span className="text-slate-500 block">Statut légal</span>
                  <span className="font-semibold text-emerald-400">
                    {consentStatus?.accessAllowed ? 'Accepté & vérifié' : consentStatus?.consentStatus || 'En attente'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Accepté le</span>
                  <span className="font-mono text-slate-200">
                    {formatDate(consentStatus?.acceptedAt)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Plateforme d&apos;origine</span>
                  <span className="font-mono uppercase text-slate-200">
                    {consentStatus?.platform || '—'}
                  </span>
                </div>
              </div>

              <div className="space-y-2.5">
                <label className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-950/70 border border-slate-800 cursor-pointer">
                  <span className="text-xs text-slate-300">
                    <strong className="text-white block">Notifications préventives (facultatif)</strong>
                    Alertes produit et conseils de vigilance routière non critiques.
                  </span>
                  <input
                    type="checkbox"
                    checked={Boolean(consentStatus?.optionalConsents?.notifications)}
                    disabled={savingOptionalConsent || !consentStatus?.accessAllowed}
                    onChange={(e) => handleToggleOptionalConsent('notifications', e.target.checked)}
                    className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-blue-600 shrink-0"
                  />
                </label>

                <label className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-950/70 border border-slate-800 cursor-pointer">
                  <span className="text-xs text-slate-300">
                    <strong className="text-white block">Amélioration cartographique (facultatif)</strong>
                    Statistiques techniques de précision pour affiner les zones VRU.
                  </span>
                  <input
                    type="checkbox"
                    checked={Boolean(consentStatus?.optionalConsents?.locationEnhancements)}
                    disabled={savingOptionalConsent || !consentStatus?.accessAllowed}
                    onChange={(e) =>
                      handleToggleOptionalConsent('locationEnhancements', e.target.checked)
                    }
                    className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-blue-600 shrink-0"
                  />
                </label>
              </div>

              <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-[11px] text-slate-500">
                  Vous pouvez également exercer votre droit de retrait global à tout moment.
                </span>
                {!confirmWithdrawOpen ? (
                  <button
                    type="button"
                    onClick={() => setConfirmWithdrawOpen(true)}
                    className="px-3.5 py-2 rounded-xl bg-slate-950 hover:bg-red-950/40 border border-slate-800 hover:border-red-500/40 text-xs font-semibold text-slate-300 hover:text-red-300 transition-colors self-start sm:self-auto"
                  >
                    Retirer mon consentement
                  </button>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] text-amber-300 inline-flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Suspendra l&apos;accès aux services :
                    </span>
                    <button
                      type="button"
                      onClick={() => setConfirmWithdrawOpen(false)}
                      disabled={withdrawingConsent}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={handleWithdrawConsent}
                      disabled={withdrawingConsent}
                      className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-semibold text-white inline-flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {withdrawingConsent && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Confirmer le retrait
                    </button>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </main>

      <AccessibilityApplicationModal
        open={showAccessibilityModal}
        defaultName={user.name}
        onClose={() => setShowAccessibilityModal(false)}
      />

      <SupportTicketModal
        open={showSupportModal}
        defaultName={user.name}
        defaultEmail={user.email}
        onClose={() => setShowSupportModal(false)}
      />

      <AndroidUpdateModal
        open={updatePrompt.open}
        latestInfo={updatePrompt.latestInfo}
        installedVersionName={updatePrompt.installedVersionName}
        installedVersionCode={updatePrompt.installedVersionCode}
        onDismiss={() => setUpdatePrompt((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
};

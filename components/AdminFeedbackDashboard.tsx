import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  Star,
  MessageSquare,
  Award,
  CreditCard,
  Building2,
  Plus,
  Users,
  Ticket,
  Copy,
  Check,
  Search,
  Ban,
  Loader2,
  Sparkles,
  Clock,
} from 'lucide-react';
import { VruLogo } from './VruLogo';
import { collection, getDocs, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { ExitFeedback } from '../services/AppFeedbackService';
import { subscriptionService } from '../services/SubscriptionService';
import { requireApiUrl } from '../utils/apiClient';
import {
  ActivationRecord,
  AdminOverviewStats,
  BillingCycle,
  BusinessQuoteRequest,
  RedeemCodeRecord,
  RedeemCodeStatus,
  UserSubscription,
} from '../types';
import { toast } from '../services/NotificationService';
import { ThemeToggle } from './ThemeToggle';
import { useAuth } from '../AuthContext';
import { formatPrice, getPlanPrice } from '../utils/subscriptionPlans';

interface FirestoreUserRecord {
  uid: string;
  email?: string;
  name?: string;
  role?: string;
  createdAt?: any;
}

export const AdminFeedbackDashboard: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { currency, publicConfig } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'subscriptions' | 'feedback'>('overview');

  // Admin Subscription & Redeem state
  const [adminSubscriptions, setAdminSubscriptions] = useState<UserSubscription[]>([]);
  const [businessQuotes, setBusinessQuotes] = useState<BusinessQuoteRequest[]>([]);
  const [redeemCodes, setRedeemCodes] = useState<RedeemCodeRecord[]>([]);
  const [activations, setActivations] = useState<ActivationRecord[]>([]);
  const [serverStats, setServerStats] = useState<AdminOverviewStats | null>(null);
  const [firestoreUsers, setFirestoreUsers] = useState<FirestoreUserRecord[]>([]);
  const [loadingAdminData, setLoadingAdminData] = useState(true);

  // Redeem generator state
  const [genPlan, setGenPlan] = useState<'PREMIUM' | 'FAMILY'>('PREMIUM');
  const [genCycle, setGenCycle] = useState<BillingCycle>('monthly');
  const [genCount, setGenCount] = useState<number>(5);
  const [genNote, setGenNote] = useState('');
  const [generatingCodes, setGeneratingCodes] = useState(false);
  const [newlyGeneratedCodes, setNewlyGeneratedCodes] = useState<RedeemCodeRecord[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [revokingCode, setRevokingCode] = useState<string | null>(null);

  // Filters for Redeem table
  const [redeemFilter, setRedeemFilter] = useState<'ALL' | RedeemCodeStatus>('ALL');
  const [redeemSearch, setRedeemSearch] = useState('');

  // Early tester form state
  const [earlyEmail, setEarlyEmail] = useState('');
  const [earlyUid, setEarlyUid] = useState('');
  const [grantingEarly, setGrantingEarly] = useState(false);

  // Feedbacks stream
  const [feedbacks, setFeedbacks] = useState<(ExitFeedback & { id: string; createdAt: any })[]>([]);
  const [loadingFeedbacks, setLoadingFeedbacks] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) {
      setLoadingFeedbacks(false);
      return;
    }
    const q = query(collection(db, 'app_feedback'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const results: any[] = [];
        snapshot.forEach((docSnap) => {
          results.push({ id: docSnap.id, ...docSnap.data() });
        });
        setFeedbacks(results);
        setLoadingFeedbacks(false);
      },
      (error) => {
        if (auth.currentUser) {
          console.error('Error fetching app feedback:', error);
        }
        setLoadingFeedbacks(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const loadAdminData = async () => {
    setLoadingAdminData(true);
    try {
      const [overview, usersSnap] = await Promise.all([
        subscriptionService.getAdminOverview(),
        getDocs(collection(db, 'users')).catch(() => null),
      ]);

      setAdminSubscriptions(overview.subscriptions || []);
      setBusinessQuotes(overview.businessQuotes || []);
      setRedeemCodes(overview.redeemCodes || []);
      setActivations(overview.activations || []);
      setServerStats(overview.stats || null);

      if (usersSnap) {
        const usersList: FirestoreUserRecord[] = [];
        usersSnap.forEach((d) => {
          const data = d.data();
          usersList.push({
            uid: d.id,
            email: data.email,
            name: data.name,
            role: data.role,
            createdAt: data.createdAt,
          });
        });
        setFirestoreUsers(usersList);
      }
    } catch (e: any) {
      console.warn('Admin load failed:', e);
      toast.error(e?.message || 'Impossible de charger les données administrateur.');
    } finally {
      setLoadingAdminData(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  // Authentic computed KPIs (combining Firestore users + subscriptionStore records)
  const kpis = useMemo(() => {
    const subByUid = new Map<string, UserSubscription>();
    adminSubscriptions.forEach((s) => subByUid.set(s.uid, s));

    const allUids = new Set<string>();
    firestoreUsers.forEach((u) => {
      if (!u?.uid) return;
      allUids.add(u.uid);
    });
    adminSubscriptions.forEach((s) => {
      if (!s?.uid) return;
      allUids.add(s.uid);
    });

    let freeCount = 0;
    let premiumCount = 0;
    let familyCount = 0;
    let businessCount = 0;

    allUids.forEach((uid) => {
      const plan = subByUid.get(uid)?.effectivePlan || 'FREE';
      if (plan === 'PREMIUM') premiumCount += 1;
      else if (plan === 'FAMILY') familyCount += 1;
      else if (plan === 'BUSINESS') businessCount += 1;
      else freeCount += 1;
    });

    return {
      totalUsers: allUids.size,
      freeCount,
      premiumCount,
      familyCount,
      businessCount,
      totalRedeemCodes: serverStats?.totalRedeemCodes ?? redeemCodes.length,
      usedRedeemCodes:
        serverStats?.usedRedeemCodes ?? redeemCodes.filter((c) => c.status === 'used').length,
      availableRedeemCodes:
        serverStats?.availableRedeemCodes ??
        redeemCodes.filter((c) => c.status === 'available').length,
      recentActivationsCount: serverStats?.recentActivationsCount ?? activations.length,
    };
  }, [firestoreUsers, adminSubscriptions, serverStats, redeemCodes, activations]);

  // Combined users + subscriptions table rows
  const combinedAccounts = useMemo(() => {
    const map = new Map<
      string,
      {
        uid: string;
        email?: string | null;
        name?: string;
        plan: string;
        status: string;
        isEarlyTester: boolean;
        endDate?: number | null;
      }
    >();

    firestoreUsers.forEach((u) => {
      if (!u?.uid) return;
      map.set(u.uid, {
        uid: u.uid,
        email: u.email,
        name: u.name,
        plan: 'FREE',
        status: 'active',
        isEarlyTester: false,
        endDate: null,
      });
    });

    adminSubscriptions.forEach((s) => {
      if (!s?.uid) return;
      const existing = map.get(s.uid);
      map.set(s.uid, {
        uid: s.uid,
        email: s.email || existing?.email,
        name: existing?.name,
        plan: s.effectivePlan,
        status: s.status,
        isEarlyTester: Boolean(s.isEarlyTester),
        endDate: s.earlyTesterEndDate || s.endDate,
      });
    });

    return Array.from(map.values());
  }, [firestoreUsers, adminSubscriptions]);

  const filteredRedeemCodes = useMemo(() => {
    const q = redeemSearch.trim().toLowerCase();
    return redeemCodes.filter((c) => {
      if (redeemFilter !== 'ALL' && c.status !== redeemFilter) return false;
      if (!q) return true;
      return (
        c.code.toLowerCase().includes(q) ||
        (c.note || '').toLowerCase().includes(q) ||
        (c.usedByEmail || '').toLowerCase().includes(q) ||
        (c.usedByUid || '').toLowerCase().includes(q)
      );
    });
  }, [redeemCodes, redeemFilter, redeemSearch]);

  const handleGenerateCodes = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneratingCodes(true);
    try {
      const res = await subscriptionService.generateRedeemCodes({
        plan: genPlan,
        billingCycle: genCycle,
        count: Math.min(50, Math.max(1, genCount)),
        note: genNote.trim() || undefined,
      });
      setNewlyGeneratedCodes(res.codes || []);
      setServerStats(res.stats);
      setGenNote('');
      toast.success(`${res.codes.length} code(s) Redeem ${genPlan} généré(s).`);
      await loadAdminData();
    } catch (err: any) {
      toast.error(err?.message || 'Erreur lors de la génération.');
    } finally {
      setGeneratingCodes(false);
    }
  };

  const handleRevokeCode = async (code: string) => {
    setRevokingCode(code);
    try {
      const res = await subscriptionService.revokeRedeemCode(code);
      setServerStats(res.stats);
      toast.success(`Code ${code} révoqué.`);
      await loadAdminData();
    } catch (err: any) {
      toast.error(err?.message || 'Erreur lors de la révocation.');
    } finally {
      setRevokingCode(null);
    }
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      toast.success('Code copié dans le presse-papiers.');
      setTimeout(() => setCopiedCode(null), 1800);
    } catch {
      toast.error('Copie impossible.');
    }
  };

  const handleGrantEarlyTester = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!earlyEmail.trim() && !earlyUid.trim()) return;
    setGrantingEarly(true);
    try {
      const headers = await subscriptionService.getAuthHeaders();
      const resp = await fetch(requireApiUrl('/api/admin/early-tester'), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          email: earlyEmail.trim() || undefined,
          uid: earlyUid.trim() || undefined,
          note: 'Granted via Admin Dashboard',
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Échec');
      toast.success('Statut Early Tester (2 ans Premium gratuit) attribué.');
      setEarlyEmail('');
      setEarlyUid('');
      loadAdminData();
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    } finally {
      setGrantingEarly(false);
    }
  };

  const formatDate = (ms?: number | null) => {
    if (!ms) return '—';
    return new Date(ms).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  // Feedback summaries
  const totalReviews = feedbacks.length;
  const avgRating =
    totalReviews > 0
      ? (feedbacks.reduce((acc, f) => acc + f.rating, 0) / totalReviews).toFixed(1)
      : '0';
  const tagCounts: Record<string, number> = {};
  const vruTypeCounts: Record<string, number> = {};
  feedbacks.forEach((f) => {
    f.categoryTags?.forEach((tag) => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
    const vruType = f.metadata?.vruType || 'UNKNOWN';
    vruTypeCounts[vruType] = (vruTypeCounts[vruType] || 0) + 1;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col overflow-y-auto">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 h-16 border-b border-slate-800 bg-slate-950/90 backdrop-blur-md shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-full flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 hover:bg-slate-800 rounded-xl transition-colors text-slate-400 hover:text-white"
              aria-label="Retour"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="flex items-center gap-2">
              <VruLogo className="w-7 h-7 rounded-lg" />
              <h1 className="font-display text-base sm:text-lg font-bold text-white whitespace-nowrap">
                Administration VruGuard
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <nav className="hidden md:flex bg-slate-900 p-1 rounded-xl border border-slate-800 gap-1">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  activeTab === 'overview'
                    ? 'bg-blue-600 text-[#ffffff]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Vue globale &amp; Redeem
              </button>
              <button
                onClick={() => setActiveTab('subscriptions')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  activeTab === 'subscriptions'
                    ? 'bg-blue-600 text-[#ffffff]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Utilisateurs &amp; Early Testers
              </button>
              <button
                onClick={() => setActiveTab('feedback')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  activeTab === 'feedback'
                    ? 'bg-blue-600 text-[#ffffff]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Évaluations ({totalReviews})
              </button>
            </nav>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Mobile Tab Switcher */}
      <div className="md:hidden border-b border-slate-800 px-4 py-2 bg-slate-900/60 flex gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
            activeTab === 'overview' ? 'bg-blue-600 text-[#ffffff]' : 'text-slate-400'
          }`}
        >
          Vue globale &amp; Redeem
        </button>
        <button
          onClick={() => setActiveTab('subscriptions')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
            activeTab === 'subscriptions' ? 'bg-blue-600 text-[#ffffff]' : 'text-slate-400'
          }`}
        >
          Utilisateurs &amp; Early Testers
        </button>
        <button
          onClick={() => setActiveTab('feedback')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
            activeTab === 'feedback' ? 'bg-blue-600 text-[#ffffff]' : 'text-slate-400'
          }`}
        >
          Évaluations ({totalReviews})
        </button>
      </div>

      <main className="max-w-7xl mx-auto w-full p-4 sm:p-6 space-y-6 flex-1">
        {/* TAB 1: OVERVIEW + REDEEM GENERATOR & MANAGEMENT */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Real KPI Cards */}
            <section className="grid grid-cols-2 md:grid-cols-4 gap-4 tabular-nums">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-blue-400" />
                  Utilisateurs totaux
                </div>
                <div className="font-display text-3xl font-bold text-white">
                  {loadingAdminData ? '—' : kpis.totalUsers}
                </div>
                <div className="text-[11px] text-slate-500">
                  Free : {kpis.freeCount} · Business : {kpis.businessCount}
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  Abonnés Premium
                </div>
                <div className="font-display text-3xl font-bold text-blue-400">
                  {loadingAdminData ? '—' : kpis.premiumCount}
                </div>
                <div className="text-[11px] text-slate-500">Inclut Early Testers actifs</div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-indigo-400" />
                  Abonnés Family
                </div>
                <div className="font-display text-3xl font-bold text-indigo-400">
                  {loadingAdminData ? '—' : kpis.familyCount}
                </div>
                <div className="text-[11px] text-slate-500">Jusqu&apos;à 6 membres / foyer</div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Ticket className="w-3.5 h-3.5 text-emerald-400" />
                  Codes Redeem
                </div>
                <div className="font-display text-3xl font-bold text-emerald-400">
                  {loadingAdminData ? '—' : kpis.totalRedeemCodes}
                </div>
                <div className="text-[11px] text-slate-400">
                  Utilisés : {kpis.usedRedeemCodes} · Dispo : {kpis.availableRedeemCodes}
                </div>
              </div>
            </section>

            {/* Redeem Generator */}
            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-base font-bold text-white flex items-center gap-2">
                    <Ticket className="w-4 h-4 text-emerald-400" />
                    Générateur de codes Redeem
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Générez des codes d&apos;activation uniques pour attribuer les abonnements Premium ou Family.
                  </p>
                </div>
              </div>

              <form onSubmit={handleGenerateCodes} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Offre</label>
                  <select
                    value={genPlan}
                    onChange={(e) => setGenPlan(e.target.value as 'PREMIUM' | 'FAMILY')}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500"
                  >
                    <option value="PREMIUM">
                      Premium ({formatPrice(getPlanPrice('PREMIUM', 'monthly', currency, publicConfig), currency)}/mois)
                    </option>
                    <option value="FAMILY">
                      Family ({formatPrice(getPlanPrice('FAMILY', 'monthly', currency, publicConfig), currency)}/mois)
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Durée</label>
                  <select
                    value={genCycle}
                    onChange={(e) => setGenCycle(e.target.value as BillingCycle)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500"
                  >
                    <option value="monthly">Mensuel (30 jours)</option>
                    <option value="annual">Annuel (365 jours)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Quantité</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={genCount}
                    onChange={(e) => setGenCount(Number(e.target.value) || 1)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white font-mono outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Note interne
                  </label>
                  <input
                    type="text"
                    value={genNote}
                    onChange={(e) => setGenNote(e.target.value)}
                    placeholder="Ex. Partenariat Tunis"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={generatingCodes}
                  className="bg-blue-600 hover:bg-blue-500 text-[#ffffff] font-semibold rounded-xl px-4 py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                >
                  {generatingCodes ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  Générer
                </button>
              </form>

              {newlyGeneratedCodes.length > 0 && (
                <div className="rounded-xl bg-emerald-950/30 border border-emerald-500/35 p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-emerald-300">
                    <span>Codes générés à l&apos;instant ({newlyGeneratedCodes.length})</span>
                    <button
                      onClick={() => setNewlyGeneratedCodes([])}
                      className="text-slate-400 hover:text-white"
                    >
                      Masquer
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {newlyGeneratedCodes.map((c) => (
                      <div
                        key={c.code}
                        className="flex items-center justify-between gap-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs"
                      >
                        <span className="font-mono font-bold text-white">{c.code}</span>
                        <button
                          onClick={() => handleCopyCode(c.code)}
                          className="text-slate-400 hover:text-emerald-400 p-1"
                          title="Copier le code"
                        >
                          {copiedCode === c.code ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* Redeem Codes Management Table */}
            <section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="p-4 sm:px-6 border-b border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="flex items-center gap-2 font-display font-bold text-sm text-white">
                  <Ticket className="w-4 h-4 text-blue-400" />
                  <span>Gestion des codes Redeem ({filteredRedeemCodes.length})</span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                    {(
                      [
                        { id: 'ALL', label: 'Tous' },
                        { id: 'available', label: 'Disponibles' },
                        { id: 'used', label: 'Utilisés' },
                        { id: 'revoked', label: 'Révoqués' },
                      ] as const
                    ).map((f) => (
                      <button
                        key={f.id}
                        onClick={() => setRedeemFilter(f.id)}
                        className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                          redeemFilter === f.id
                            ? 'bg-blue-600 text-[#ffffff]'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={redeemSearch}
                      onChange={(e) => setRedeemSearch(e.target.value)}
                      placeholder="Rechercher un code ou email..."
                      className="bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 text-slate-400 uppercase border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Code</th>
                      <th className="py-3 px-4">Offre</th>
                      <th className="py-3 px-4">Cycle</th>
                      <th className="py-3 px-4">Statut</th>
                      <th className="py-3 px-4">Utilisé par / Note</th>
                      <th className="py-3 px-4">Créé le</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {filteredRedeemCodes.map((c) => (
                      <tr key={c.code} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-white flex items-center gap-2">
                          <span>{c.code}</span>
                          <button
                            onClick={() => handleCopyCode(c.code)}
                            className="text-slate-500 hover:text-blue-400"
                            title="Copier"
                          >
                            {copiedCode === c.code ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </td>
                        <td className="py-3 px-4 font-semibold text-blue-400">{c.plan}</td>
                        <td className="py-3 px-4 text-slate-300">
                          {c.billingCycle === 'annual' ? 'Annuel' : 'Mensuel'}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`font-semibold ${
                              c.status === 'available'
                                ? 'text-emerald-400'
                                : c.status === 'used'
                                ? 'text-blue-400'
                                : 'text-red-400'
                            }`}
                          >
                            {c.status === 'available'
                              ? 'Disponible'
                              : c.status === 'used'
                              ? 'Utilisé'
                              : 'Révoqué'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-300">
                          {c.status === 'used' ? (
                            <span>
                              {c.usedByEmail || c.usedByUid || 'Utilisateur'}
                              {c.usedAt && (
                                <span className="text-slate-500 ml-1 tabular-nums">
                                  ({formatDate(c.usedAt)})
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-slate-400">{c.note || '—'}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-400 tabular-nums">
                          {formatDate(c.createdAt)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {c.status === 'available' && (
                            <button
                              onClick={() => handleRevokeCode(c.code)}
                              disabled={revokingCode === c.code}
                              className="inline-flex items-center gap-1 text-red-400 hover:text-red-300 font-semibold disabled:opacity-50"
                            >
                              <Ban className="w-3.5 h-3.5" />
                              Révoquer
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {filteredRedeemCodes.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-500">
                          Aucun code Redeem correspondant.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Recent Activations Table */}
            <section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="p-4 sm:px-6 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2 font-display font-bold text-sm text-white">
                  <Clock className="w-4 h-4 text-emerald-400" />
                  <span>Activations récentes ({activations.length})</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 text-slate-400 uppercase border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Utilisateur</th>
                      <th className="py-3 px-4">Offre</th>
                      <th className="py-3 px-4">Code / Source</th>
                      <th className="py-3 px-4">Expiration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {activations.slice(0, 20).map((act) => (
                      <tr key={act.id} className="hover:bg-slate-800/30">
                        <td className="py-3 px-4 text-slate-300 tabular-nums">
                          {formatDate(act.activatedAt)}
                        </td>
                        <td className="py-3 px-4 text-slate-200 font-mono">
                          {act.uid}
                        </td>
                        <td className="py-3 px-4 font-bold text-blue-400">{act.plan}</td>
                        <td className="py-3 px-4 font-mono text-slate-300">
                          {act.codeUsed || act.source}
                        </td>
                        <td className="py-3 px-4 text-slate-400 tabular-nums">
                          {formatDate(act.expiresAt)}
                        </td>
                      </tr>
                    ))}
                    {activations.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-500">
                          Aucune activation enregistrée pour le moment.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* TAB 2: USERS, EARLY TESTERS & BUSINESS QUOTES */}
        {activeTab === 'subscriptions' && (
          <div className="space-y-6">
            <form
              onSubmit={handleGrantEarlyTester}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4"
            >
              <h3 className="font-display font-bold text-sm text-white flex items-center gap-2">
                <Award size={18} className="text-amber-400" />
                Attribuer un accès Early Tester (Premium gratuit 2 ans)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  type="email"
                  placeholder="E-mail utilisateur (optionnel si UID)"
                  value={earlyEmail}
                  onChange={(e) => setEarlyEmail(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500"
                />
                <input
                  type="text"
                  placeholder="UID Firebase (optionnel si e-mail)"
                  value={earlyUid}
                  onChange={(e) => setEarlyUid(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500"
                />
                <button
                  type="submit"
                  disabled={grantingEarly}
                  className="bg-amber-600 hover:bg-amber-500 text-[#ffffff] font-semibold rounded-xl px-4 py-2.5 text-xs flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                >
                  <Plus size={16} />
                  {grantingEarly ? 'Enregistrement...' : 'Activer Early Tester (2 ans)'}
                </button>
              </div>
            </form>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="p-4 sm:px-6 border-b border-slate-800 flex items-center justify-between font-display font-bold text-sm text-white">
                <span className="flex items-center gap-2">
                  <CreditCard size={18} className="text-blue-400" />
                  Comptes &amp; Abonnements ({combinedAccounts.length})
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 text-slate-400 uppercase border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">UID</th>
                      <th className="py-3 px-4">Utilisateur / E-mail</th>
                      <th className="py-3 px-4">Plan effectif</th>
                      <th className="py-3 px-4">Statut</th>
                      <th className="py-3 px-4">Early Tester</th>
                      <th className="py-3 px-4">Échéance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {combinedAccounts.map((acc) => (
                      <tr key={acc.uid} className="hover:bg-slate-800/30">
                        <td className="py-3 px-4 font-mono text-slate-400">{acc.uid}</td>
                        <td className="py-3 px-4 text-slate-200">
                          {acc.name && <div className="font-semibold">{acc.name}</div>}
                          <div className="text-slate-400">{acc.email || '—'}</div>
                        </td>
                        <td className="py-3 px-4 font-bold text-blue-400">{acc.plan}</td>
                        <td className="py-3 px-4 text-slate-300">{acc.status}</td>
                        <td className="py-3 px-4 text-amber-300">
                          {acc.isEarlyTester ? 'Oui (2 ans)' : 'Non'}
                        </td>
                        <td className="py-3 px-4 text-slate-400 tabular-nums">
                          {formatDate(acc.endDate)}
                        </td>
                      </tr>
                    ))}
                    {combinedAccounts.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-500">
                          Aucun utilisateur enregistré.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="p-4 sm:px-6 border-b border-slate-800 flex items-center gap-2 font-display font-bold text-sm text-white">
                <Building2 size={18} className="text-emerald-400" />
                Demandes de devis Business ({businessQuotes.length})
              </div>
              <div className="divide-y divide-slate-800/60">
                {businessQuotes.map((q) => (
                  <div key={q.id} className="p-4 sm:px-6 text-xs space-y-1">
                    <div className="flex justify-between font-bold text-white">
                      <span>
                        {q.companyName} — {q.contactName}
                      </span>
                      <span className="text-slate-400 font-mono tabular-nums">
                        {formatDate(q.createdAt)}
                      </span>
                    </div>
                    <div className="text-slate-400">
                      {q.email} · {q.phone || 'Tél N/A'} · Équipe : {q.teamSize} · Flotte :{' '}
                      {q.vehicleCount}
                    </div>
                    {q.message && <p className="text-slate-300 pt-1">{q.message}</p>}
                  </div>
                ))}
                {businessQuotes.length === 0 && (
                  <div className="p-6 text-center text-slate-500 text-xs">
                    Aucune demande Business pour le moment.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: USER FEEDBACK */}
        {activeTab === 'feedback' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 tabular-nums">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col gap-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Total Évaluations
                </span>
                <span className="font-display text-3xl font-bold text-white">{totalReviews}</span>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col gap-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Note Moyenne
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-display text-3xl font-bold text-amber-400">{avgRating}</span>
                  <Star className="text-amber-400 fill-amber-400" size={20} />
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col gap-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Par Mode (VRU)
                </span>
                <div className="flex flex-wrap gap-1.5 mt-1 text-[11px] text-blue-300">
                  {Object.entries(vruTypeCounts)
                    .sort((a, b) => b[1] - a[1])
                    .map(([type, count]) => (
                      <span key={type}>
                        {type} ({Math.round((count / Math.max(1, totalReviews)) * 100)}%)
                      </span>
                    ))}
                  {Object.keys(vruTypeCounts).length === 0 && (
                    <span className="text-xs text-slate-500">N/A</span>
                  )}
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col gap-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Tags fréquents
                </span>
                <div className="flex flex-wrap gap-1.5 mt-1 text-[11px] text-slate-300">
                  {Object.entries(tagCounts)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 3)
                    .map(([tag, count]) => (
                      <span key={tag}>
                        {tag} ({count})
                      </span>
                    ))}
                  {Object.keys(tagCounts).length === 0 && (
                    <span className="text-xs text-slate-500">Aucun tag</span>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="p-4 sm:px-6 border-b border-slate-800">
                <h3 className="font-display font-bold flex items-center gap-2 text-white text-sm">
                  <MessageSquare size={16} className="text-blue-400" /> Historique des retours
                </h3>
              </div>

              <div className="divide-y divide-slate-800/60">
                {loadingFeedbacks ? (
                  <div className="p-8 text-center text-slate-500 text-sm">Chargement...</div>
                ) : feedbacks.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-sm">
                    Aucune évaluation pour le moment.
                  </div>
                ) : (
                  feedbacks.map((f) => (
                    <div key={f.id} className="p-4 sm:px-6 hover:bg-slate-800/20 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1 text-xs font-bold text-amber-400">
                            {f.rating} <Star size={12} className="fill-amber-400" />
                          </div>
                          <span className="text-xs text-slate-500 tabular-nums">
                            {f.createdAt?.seconds
                              ? new Date(f.createdAt.seconds * 1000).toLocaleString('fr-FR')
                              : 'Récemment'}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-slate-500">
                          {f.metadata?.vruType || 'UNKNOWN'} · v{f.metadata?.appVersion || 'N/A'}
                        </span>
                      </div>

                      {f.comment && (
                        <p className="text-sm text-slate-300 mt-2 whitespace-pre-wrap">{f.comment}</p>
                      )}

                      {f.categoryTags && f.categoryTags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2 text-[10px] font-semibold uppercase tracking-wider text-blue-400">
                          {f.categoryTags.map((tag: string) => (
                            <span key={tag}>{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

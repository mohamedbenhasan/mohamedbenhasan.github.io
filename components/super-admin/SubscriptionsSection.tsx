import React, { useCallback, useEffect, useState } from 'react';
import {
  CreditCard,
  Search,
  Edit3,
  X,
  Loader2,
  Infinity as InfinityIcon,
  Award,
  Accessibility,
  RefreshCw,
} from 'lucide-react';
import {
  ActivationSource,
  AdminUserSummary,
  BillingCycle,
  SubscriptionPlan,
} from '../../types';
import { superAdminService } from '../../services/SuperAdminService';
import { toast } from '../../services/NotificationService';
import { PlanText, formatDateFr } from './SuperAdminShared';

interface Props {
  refreshTick: number;
  onChanged: () => void;
}

export const SubscriptionsSection: React.FC<Props> = ({ refreshTick, onChanged }) => {
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUserSummary | null>(null);
  const [manualUid, setManualUid] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [action, setAction] = useState<
    'assign' | 'extend' | 'grant_lifetime' | 'suspend' | 'reactivate' | 'downgrade_free'
  >('assign');
  const [plan, setPlan] = useState<SubscriptionPlan>('PREMIUM');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [durationDays, setDurationDays] = useState<string>('30');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [isLifetime, setIsLifetime] = useState(false);
  const [activationType, setActivationType] = useState<ActivationSource>('admin');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await superAdminService.getUsers({ page: 1, pageSize: 200 });
      setUsers(res.users);
    } catch (err: any) {
      toast.error(err?.message || 'Erreur lors du chargement des abonnements.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData, refreshTick]);

  const openEditorForUser = (u: AdminUserSummary | null) => {
    setEditingUser(u);
    setEditorOpen(true);
    if (u) {
      setManualUid(u.uid);
      setManualEmail(u.email || '');
      setPlan(u.subscription.effectivePlan === 'FREE' ? 'PREMIUM' : u.subscription.effectivePlan);
      setBillingCycle(u.subscription.billingCycle || 'monthly');
      setIsLifetime(Boolean(u.subscription.isLifetime));
      setActivationType(u.subscription.activationSource || 'admin');
    } else {
      setManualUid('');
      setManualEmail('');
      setPlan('PREMIUM');
      setBillingCycle('monthly');
      setIsLifetime(false);
      setActivationType('admin');
    }
    setAction('assign');
    setDurationDays('30');
    setCustomEndDate('');
    setReason('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetUid = editingUser?.uid || manualUid.trim();
    if (!targetUid) {
      toast.error('UID utilisateur requis.');
      return;
    }
    setSaving(true);
    try {
      const endMs = customEndDate ? new Date(`${customEndDate}T23:59:59`).getTime() : undefined;
      await superAdminService.updateUserSubscription(targetUid, {
        action,
        plan,
        billingCycle,
        durationDays: isLifetime || action === 'grant_lifetime' ? null : Number(durationDays) || 30,
        endDate: endMs,
        isLifetime: isLifetime || action === 'grant_lifetime',
        activationType,
        reason: reason.trim(),
        targetEmail: manualEmail.trim() || undefined,
      });
      toast.success('Abonnement mis à jour côté serveur.');
      setEditorOpen(false);
      setEditingUser(null);
      setManualUid('');
      await loadData();
      onChanged();
    } catch (err: any) {
      toast.error(err?.message || 'Impossible de mettre à jour l’abonnement.');
    } finally {
      setSaving(false);
    }
  };

  const filtered = users.filter((u) => {
    const q = search.trim().toLowerCase();
    if (
      q &&
      !u.uid.toLowerCase().includes(q) &&
      !(u.email || '').toLowerCase().includes(q) &&
      !(u.displayName || '').toLowerCase().includes(q)
    ) {
      return false;
    }
    if (planFilter !== 'ALL' && u.subscription.effectivePlan !== planFilter) return false;
    if (statusFilter === 'lifetime' && !u.subscription.isLifetime) return false;
    if (statusFilter === 'pioneer' && !u.subscription.isEarlyTester) return false;
    if (
      statusFilter !== 'ALL' &&
      statusFilter !== 'lifetime' &&
      statusFilter !== 'pioneer' &&
      u.subscription.status !== statusFilter
    ) {
      return false;
    }
    return true;
  });

  const paidActiveCount = users.filter(
    (u) => u.subscription.effectivePlan !== 'FREE' && u.subscription.status === 'active'
  ).length;
  const lifetimeCount = users.filter((u) => u.subscription.isLifetime).length;
  const pioneerCount = users.filter((u) => u.subscription.isEarlyTester).length;
  const suspendedCount = users.filter((u) => u.subscription.status === 'suspended').length;

  return (
    <div className="space-y-5">
      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 tabular-nums">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="text-xs text-slate-400">Abonnements payants actifs</div>
          <div className="font-display text-2xl font-bold text-blue-400 mt-1">{paidActiveCount}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="text-xs text-slate-400">Accès À vie (Lifetime)</div>
          <div className="font-display text-2xl font-bold text-emerald-400 mt-1">
            {lifetimeCount}
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="text-xs text-slate-400">Programme Pioneer (2 ans)</div>
          <div className="font-display text-2xl font-bold text-amber-400 mt-1">{pioneerCount}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="text-xs text-slate-400">Abonnements suspendus</div>
          <div className="font-display text-2xl font-bold text-red-400 mt-1">{suspendedCount}</div>
        </div>
      </div>

      {/* Filter + Manual Grant Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrer par email, nom ou UID..."
            className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white outline-none focus:border-blue-500"
          />
        </div>
        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
          className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none"
        >
          <option value="ALL">Toutes formules</option>
          <option value="FREE">FREE</option>
          <option value="PREMIUM">PREMIUM</option>
          <option value="FAMILY">FAMILY</option>
          <option value="BUSINESS">BUSINESS</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none"
        >
          <option value="ALL">Tous statuts</option>
          <option value="active">Actifs</option>
          <option value="suspended">Suspendus</option>
          <option value="expired">Expirés</option>
          <option value="lifetime">À vie uniquement</option>
          <option value="pioneer">Pioneer uniquement</option>
        </select>
        <button
          onClick={loadData}
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
        <button
          onClick={() => openEditorForUser(null)}
          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-[#ffffff] text-xs font-semibold inline-flex items-center gap-1.5"
        >
          <CreditCard className="w-3.5 h-3.5" />
          Attribution manuelle (UID)
        </button>
      </div>

      {/* Subscriptions Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Compte</th>
                <th className="py-3 px-4">Plan effectif</th>
                <th className="py-3 px-4">Source / Badges</th>
                <th className="py-3 px-4">Début → Expiration</th>
                <th className="py-3 px-4">Statut</th>
                <th className="py-3 px-4 text-right">Gérer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {filtered.map((u) => (
                <tr key={u.uid} className="hover:bg-slate-800/30">
                  <td className="py-3 px-4">
                    <div className="font-semibold text-white">{u.displayName || 'Sans nom'}</div>
                    <div className="font-mono text-[11px] text-slate-400">{u.email || u.uid}</div>
                  </td>
                  <td className="py-3 px-4">
                    <PlanText
                      plan={u.subscription.effectivePlan}
                      isLifetime={u.subscription.isLifetime}
                    />
                    <div className="text-[11px] text-slate-500">
                      SOS : {u.subscription.entitlements.canUseSos ? 'Autorisé' : 'Bloqué (Free)'}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="font-mono text-slate-300">
                        {u.subscription.activationSource || 'free'}
                      </span>
                      {u.subscription.isEarlyTester && (
                        <span className="inline-flex items-center gap-1 text-amber-400 font-semibold">
                          <Award className="w-3 h-3" /> Pioneer
                        </span>
                      )}
                      {u.subscription.isAccessibilityLifetime && (
                        <span className="inline-flex items-center gap-1 text-blue-400 font-semibold">
                          <Accessibility className="w-3 h-3" /> Accessibilité
                        </span>
                      )}
                      {u.subscription.isLifetime && (
                        <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                          <InfinityIcon className="w-3 h-3" /> À vie
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-slate-300 tabular-nums">
                    <div>{formatDateFr(u.subscription.startDate)}</div>
                    <div className="text-slate-500">
                      →{' '}
                      {u.subscription.isLifetime
                        ? 'Illimitée (À vie)'
                        : u.subscription.effectivePlan === 'FREE'
                        ? 'Sans expiration'
                        : formatDateFr(u.subscription.endDate)}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`font-semibold ${
                        u.subscription.status === 'active'
                          ? 'text-emerald-400'
                          : u.subscription.status === 'suspended'
                          ? 'text-red-400'
                          : 'text-amber-400'
                      }`}
                    >
                      {u.subscription.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => openEditorForUser(u)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Modifier
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    Aucun abonnement trouvé.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <SubscriptionEditModal
        open={editorOpen}
        editingUser={editingUser}
        manualUid={manualUid}
        setManualUid={setManualUid}
        manualEmail={manualEmail}
        setManualEmail={setManualEmail}
        action={action}
        setAction={setAction}
        plan={plan}
        setPlan={setPlan}
        billingCycle={billingCycle}
        setBillingCycle={setBillingCycle}
        durationDays={durationDays}
        setDurationDays={setDurationDays}
        customEndDate={customEndDate}
        setCustomEndDate={setCustomEndDate}
        isLifetime={isLifetime}
        setIsLifetime={setIsLifetime}
        activationType={activationType}
        setActivationType={setActivationType}
        reason={reason}
        setReason={setReason}
        saving={saving}
        onClose={() => {
          setEditorOpen(false);
          setEditingUser(null);
          setManualUid('');
        }}
        onSubmit={handleSubmit}
      />
    </div>
  );
};

interface ModalProps {
  open: boolean;
  editingUser: AdminUserSummary | null;
  manualUid: string;
  setManualUid: (v: string) => void;
  manualEmail: string;
  setManualEmail: (v: string) => void;
  action: 'assign' | 'extend' | 'grant_lifetime' | 'suspend' | 'reactivate' | 'downgrade_free';
  setAction: (
    v: 'assign' | 'extend' | 'grant_lifetime' | 'suspend' | 'reactivate' | 'downgrade_free'
  ) => void;
  plan: SubscriptionPlan;
  setPlan: (v: SubscriptionPlan) => void;
  billingCycle: BillingCycle;
  setBillingCycle: (v: BillingCycle) => void;
  durationDays: string;
  setDurationDays: (v: string) => void;
  customEndDate: string;
  setCustomEndDate: (v: string) => void;
  isLifetime: boolean;
  setIsLifetime: (v: boolean) => void;
  activationType: ActivationSource;
  setActivationType: (v: ActivationSource) => void;
  reason: string;
  setReason: (v: string) => void;
  saving: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

const SubscriptionEditModal: React.FC<ModalProps> = ({
  open,
  editingUser,
  manualUid,
  setManualUid,
  manualEmail,
  setManualEmail,
  action,
  setAction,
  plan,
  setPlan,
  billingCycle,
  setBillingCycle,
  durationDays,
  setDurationDays,
  customEndDate,
  setCustomEndDate,
  isLifetime,
  setIsLifetime,
  activationType,
  setActivationType,
  reason,
  setReason,
  saving,
  onClose,
  onSubmit,
}) => {
  // Keep open controlled explicitly by parent
  const [forceOpen, setForceOpen] = useState(false);
  useEffect(() => {
    setForceOpen(open);
  }, [open]);

  if (!forceOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[125000] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-display text-base font-bold text-white">
            Gestion manuelle d’abonnement
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={onSubmit} className="p-6 space-y-4">
          {!editingUser ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  UID utilisateur *
                </label>
                <input
                  type="text"
                  required
                  value={manualUid}
                  onChange={(e) => setManualUid(e.target.value)}
                  placeholder="Firebase UID"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Email (optionnel)
                </label>
                <input
                  type="email"
                  value={manualEmail}
                  onChange={(e) => setManualEmail(e.target.value)}
                  placeholder="utilisateur@domaine.com"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
                />
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs">
              <div className="font-semibold text-white">
                {editingUser.displayName || editingUser.email || editingUser.uid}
              </div>
              <div className="text-slate-400 font-mono text-[11px]">
                Actuel : {editingUser.subscription.effectivePlan} ({editingUser.subscription.status})
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Action *</label>
              <select
                value={action}
                onChange={(e) => setAction(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none"
              >
                <option value="assign">Attribuer / Modifier plan</option>
                <option value="extend">Prolonger l’abonnement</option>
                <option value="grant_lifetime">Accorder Premium/Plan À vie</option>
                <option value="suspend">Suspendre l’abonnement</option>
                <option value="reactivate">Réactiver l’abonnement</option>
                <option value="downgrade_free">Rétrograder vers FREE</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Source</label>
              <select
                value={activationType}
                onChange={(e) => setActivationType(e.target.value as ActivationSource)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none"
              >
                <option value="admin">Attribution Admin</option>
                <option value="pioneer">Programme Pioneer</option>
                <option value="accessibility">Programme Accessibilité</option>
                <option value="redeem">Compensation Redeem</option>
              </select>
            </div>
          </div>

          {action !== 'suspend' && action !== 'reactivate' && action !== 'downgrade_free' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Formule cible
                  </label>
                  <select
                    value={plan}
                    onChange={(e) => setPlan(e.target.value as SubscriptionPlan)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none"
                  >
                    <option value="FREE">FREE</option>
                    <option value="PREMIUM">PREMIUM</option>
                    <option value="FAMILY">FAMILY</option>
                    <option value="BUSINESS">BUSINESS</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Cycle</label>
                  <select
                    value={billingCycle}
                    onChange={(e) => setBillingCycle(e.target.value as BillingCycle)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none"
                  >
                    <option value="monthly">Mensuel</option>
                    <option value="annual">Annuel</option>
                    <option value="custom">Personnalisé / À vie</option>
                  </select>
                </div>
              </div>

              {action !== 'grant_lifetime' && plan !== 'FREE' && (
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isLifetime}
                      onChange={(e) => setIsLifetime(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-950 text-blue-600"
                    />
                    <span>Accès à vie (sans date d’expiration)</span>
                  </label>

                  {!isLifetime && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1">
                          Durée (jours)
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={3650}
                          value={durationDays}
                          onChange={(e) => setDurationDays(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1">
                          Ou date de fin exacte
                        </label>
                        <input
                          type="date"
                          value={customEndDate}
                          onChange={(e) => setCustomEndDate(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              Raison de l’opération (obligatoire pour audit) *
            </label>
            <textarea
              rows={2}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex. Geste commercial suite ticket #142, attribution partenaire..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-[#ffffff] text-xs font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Appliquer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

import React, { useCallback, useEffect, useState } from 'react';
import {
  Search,
  UserCheck,
  UserX,
  Ban,
  Trash2,
  KeyRound,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  Clock,
  ShieldAlert,
  Loader2,
  AlertTriangle,
  Copy,
  Check,
  RefreshCw,
} from 'lucide-react';
import { AdminUserSummary, AuditLogEntry, AccessibilityRequestRecord, SupportTicketRecord } from '../../types';
import { superAdminService } from '../../services/SuperAdminService';
import { toast } from '../../services/NotificationService';
import {
  AccountStatusText,
  PlanText,
  PresenceDot,
  formatDateFr,
  formatDateTimeFr,
  formatRelativeTimeFr,
} from './SuperAdminShared';

interface Props {
  refreshTick: number;
  currentAdminUid?: string;
  onOpenReauth: (title: string, description: string, retryFn: () => Promise<void>) => void;
  onChanged: () => void;
}

type ActionModalState =
  | { type: 'suspend'; user: AdminUserSummary }
  | { type: 'ban'; user: AdminUserSummary }
  | { type: 'unban'; user: AdminUserSummary }
  | { type: 'revoke'; user: AdminUserSummary }
  | { type: 'soft_delete'; user: AdminUserSummary }
  | { type: 'hard_delete'; user: AdminUserSummary }
  | null;

export const UsersSection: React.FC<Props> = ({
  refreshTick,
  currentAdminUid,
  onOpenReauth,
  onChanged,
}) => {
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [presenceSummary, setPresenceSummary] = useState({
    onlineCount: 0,
    idleCount: 0,
    offlineCount: 0,
  });
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [presenceFilter, setPresenceFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Detail drawer state
  const [detailUid, setDetailUid] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<{
    user: AdminUserSummary;
    accessibilityRequests: AccessibilityRequestRecord[];
    supportTickets: SupportTicketRecord[];
    familyProfilesCount: number;
    auditLogs: AuditLogEntry[];
  } | null>(null);

  // Action modal state
  const [modal, setModal] = useState<ActionModalState>(null);
  const [reason, setReason] = useState('');
  const [durationHours, setDurationHours] = useState(24);
  const [hardDeletePhrase, setHardDeletePhrase] = useState('');
  const [hardDeleteAck, setHardDeleteAck] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [copiedUid, setCopiedUid] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await superAdminService.getUsers({
        search: search.trim() || undefined,
        plan: planFilter !== 'ALL' ? planFilter : undefined,
        accountStatus: statusFilter !== 'ALL' ? statusFilter : undefined,
        presence: presenceFilter !== 'ALL' ? presenceFilter : undefined,
        sortBy,
        sortDir,
        page,
        pageSize,
      });
      setUsers(res.users);
      setTotal(res.total);
      setPresenceSummary({
        onlineCount: res.presenceSummary.onlineCount,
        idleCount: res.presenceSummary.idleCount,
        offlineCount: res.presenceSummary.offlineCount,
      });
    } catch (err: any) {
      toast.error(err?.message || 'Erreur lors du chargement des utilisateurs.');
    } finally {
      setLoading(false);
    }
  }, [search, planFilter, statusFilter, presenceFilter, sortBy, sortDir, page]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers, refreshTick]);

  const openDetails = async (uid: string) => {
    setDetailUid(uid);
    setDetailLoading(true);
    try {
      const res = await superAdminService.getUserDetails(uid);
      setDetailData(res);
    } catch (err: any) {
      toast.error(err?.message || 'Impossible de charger la fiche utilisateur.');
      setDetailUid(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const copyUid = async (uid: string) => {
    try {
      await navigator.clipboard.writeText(uid);
      setCopiedUid(uid);
      setTimeout(() => setCopiedUid(null), 1800);
    } catch {
      // ignore
    }
  };

  const resetModal = () => {
    setModal(null);
    setReason('');
    setDurationHours(24);
    setHardDeletePhrase('');
    setHardDeleteAck(false);
    setSubmitting(false);
  };

  const handleActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modal) return;
    setSubmitting(true);

    const runAction = async (forceRefreshToken = false) => {
      const targetUid = modal.user.uid;
      if (modal.type === 'suspend') {
        await superAdminService.suspendUser(targetUid, reason.trim(), Number(durationHours));
        toast.success(`Compte suspendu (${durationHours}h).`);
      } else if (modal.type === 'ban') {
        await superAdminService.banUser(targetUid, reason.trim(), forceRefreshToken);
        toast.success('Compte banni définitivement.');
      } else if (modal.type === 'unban') {
        await superAdminService.unbanUser(targetUid, reason.trim() || 'Réactivation manuelle');
        toast.success('Compte réactivé.');
      } else if (modal.type === 'revoke') {
        await superAdminService.revokeUserSessions(
          targetUid,
          reason.trim() || 'Révocation administrative'
        );
        toast.success('Sessions révoquées.');
      } else if (modal.type === 'soft_delete') {
        await superAdminService.softDeleteUser(targetUid, reason.trim());
        toast.success('Compte archivé (soft delete).');
      } else if (modal.type === 'hard_delete') {
        await superAdminService.hardDeleteUser(
          targetUid,
          hardDeletePhrase.trim(),
          reason.trim(),
          forceRefreshToken
        );
        toast.success('Données utilisateur supprimées définitivement.');
      }
      resetModal();
      await loadUsers();
      if (detailUid === targetUid) {
        setDetailUid(null);
        setDetailData(null);
      }
      onChanged();
    };

    try {
      await runAction(false);
    } catch (err: any) {
      if (err?.code === 'REAUTH_REQUIRED') {
        setSubmitting(false);
        onOpenReauth(
          'Ré-authentification requise',
          'Cette sanction critique exige une vérification récente de votre identité Super Admin.',
          async () => {
            await runAction(true);
          }
        );
        return;
      }
      toast.error(err?.message || 'Action impossible.');
      setSubmitting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-5">
      {/* Presence & Directory Summary Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 tabular-nums">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="text-xs text-slate-400">Comptes indexés</div>
          <div className="font-display text-2xl font-bold text-white mt-1">{total}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="text-xs text-slate-400">En ligne maintenant</div>
          <div className="font-display text-2xl font-bold text-emerald-400 mt-1">
            {presenceSummary.onlineCount}
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="text-xs text-slate-400">Inactifs (idle)</div>
          <div className="font-display text-2xl font-bold text-amber-400 mt-1">
            {presenceSummary.idleCount}
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="text-xs text-slate-400">Hors ligne</div>
          <div className="font-display text-2xl font-bold text-slate-300 mt-1">
            {presenceSummary.offlineCount}
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Rechercher par email, nom ou UID..."
            className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500"
          />
        </div>

        <select
          value={planFilter}
          onChange={(e) => {
            setPlanFilter(e.target.value);
            setPage(1);
          }}
          className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500"
        >
          <option value="ALL">Tous les plans</option>
          <option value="FREE">FREE</option>
          <option value="PREMIUM">PREMIUM</option>
          <option value="FAMILY">FAMILY</option>
          <option value="BUSINESS">BUSINESS</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500"
        >
          <option value="ALL">Tous statuts compte</option>
          <option value="active">Actifs</option>
          <option value="suspended">Suspendus</option>
          <option value="banned">Bannis</option>
          <option value="soft_deleted">Supprimés (soft)</option>
        </select>

        <select
          value={presenceFilter}
          onChange={(e) => {
            setPresenceFilter(e.target.value);
            setPage(1);
          }}
          className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500"
        >
          <option value="ALL">Toute présence</option>
          <option value="online">En ligne</option>
          <option value="idle">Inactifs</option>
          <option value="offline">Hors ligne</option>
        </select>

        <select
          value={`${sortBy}:${sortDir}`}
          onChange={(e) => {
            const [s, d] = e.target.value.split(':');
            setSortBy(s);
            setSortDir((d as 'asc' | 'desc') || 'desc');
          }}
          className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500"
        >
          <option value="createdAt:desc">Plus récents</option>
          <option value="lastLoginAt:desc">Dernière connexion</option>
          <option value="presence:asc">Présence (En ligne d’abord)</option>
          <option value="email:asc">Email (A-Z)</option>
          <option value="plan:asc">Plan</option>
        </select>

        <button
          onClick={loadUsers}
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300"
          title="Actualiser la liste"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Utilisateur</th>
                <th className="py-3 px-4">Rôle</th>
                <th className="py-3 px-4">Abonnement</th>
                <th className="py-3 px-4">Statut</th>
                <th className="py-3 px-4">Présence live</th>
                <th className="py-3 px-4">Activité</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {users.map((u) => {
                const isSelf = u.uid === currentAdminUid;
                return (
                  <tr key={u.uid} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">
                        {u.displayName || 'Sans nom'}
                      </div>
                      <div className="text-slate-400 font-mono text-[11px]">
                        {u.email || 'Email non renseigné'}
                      </div>
                      <button
                        type="button"
                        onClick={() => copyUid(u.uid)}
                        className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-mono text-slate-500 hover:text-blue-400"
                      >
                        {copiedUid === u.uid ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        {u.uid.slice(0, 14)}…
                      </button>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`font-mono text-[11px] font-semibold ${
                          u.role === 'SUPER_ADMIN'
                            ? 'text-amber-400'
                            : u.role === 'ADMIN'
                            ? 'text-blue-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <PlanText
                        plan={u.subscription.effectivePlan}
                        isLifetime={u.subscription.isLifetime}
                      />
                      <div className="text-[11px] text-slate-500">
                        {u.subscription.isEarlyTester
                          ? 'Pioneer (2 ans)'
                          : u.subscription.isAccessibilityLifetime
                          ? 'Accessibilité'
                          : u.subscription.activationSource || 'free'}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <AccountStatusText status={u.accountStatus} />
                      {u.accountStatus === 'suspended' && u.suspensionExpiresAt && (
                        <div className="text-[10px] text-amber-400/80 tabular-nums">
                          Jusqu’au {formatDateFr(u.suspensionExpiresAt)}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <PresenceDot state={u.presence.state} />
                      <div className="text-[10px] text-slate-500 tabular-nums mt-0.5">
                        {formatRelativeTimeFr(u.presence.lastHeartbeatAt)}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-400 tabular-nums">
                      <div>Inscrit : {formatDateFr(u.createdAt)}</div>
                      <div className="text-[11px] text-slate-500">
                        Conn. : {formatRelativeTimeFr(u.lastLoginAt)}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => openDetails(u.uid)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
                          title="Fiche détaillée"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {!isSelf && (
                          <>
                            {u.accountStatus === 'active' ? (
                              <>
                                <button
                                  onClick={() => setModal({ type: 'suspend', user: u })}
                                  className="p-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/30 text-amber-300"
                                  title="Suspendre temporairement"
                                >
                                  <Clock className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setModal({ type: 'ban', user: u })}
                                  className="p-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/30 text-red-300"
                                  title="Bannir définitivement"
                                >
                                  <Ban className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => setModal({ type: 'unban', user: u })}
                                className="p-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-300"
                                title="Réactiver le compte"
                              >
                                <UserCheck className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => setModal({ type: 'revoke', user: u })}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                              title="Révoquer les sessions actives"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                            </button>
                            {u.accountStatus !== 'soft_deleted' ? (
                              <button
                                onClick={() => setModal({ type: 'soft_delete', user: u })}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-950/60 text-slate-400 hover:text-red-300"
                                title="Archiver (Soft Delete)"
                              >
                                <UserX className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <button
                                onClick={() => setModal({ type: 'hard_delete', user: u })}
                                className="p-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/40 text-red-300"
                                title="Suppression définitive"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {users.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500">
                    Aucun utilisateur ne correspond aux critères sélectionnés.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-4 py-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 tabular-nums">
          <span>
            Page {page} / {totalPages} · {total} compte{total > 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* User Detail Drawer (Strictly privacy-respecting: no raw GPS or private messages) */}
      {detailUid && (
        <div
          className="fixed inset-0 z-[120000] bg-slate-950/75 backdrop-blur-sm flex justify-end"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-2xl bg-slate-900 border-l border-slate-800 h-full overflow-y-auto p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <p className="text-[11px] font-mono uppercase tracking-widest text-blue-400">
                  Fiche de gouvernance compte
                </p>
                <h2 className="font-display text-xl font-bold text-white">
                  {detailData?.user.displayName || detailData?.user.email || detailUid}
                </h2>
              </div>
              <button
                onClick={() => {
                  setDetailUid(null);
                  setDetailData(null);
                }}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {detailLoading || !detailData ? (
              <div className="py-16 flex flex-col items-center gap-3 text-slate-400 text-sm">
                <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                Chargement de la fiche sécurisée...
              </div>
            ) : (
              <div className="space-y-6">
                {/* Privacy Notice */}
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400">
                  Conformité vie privée : seules les métadonnées de compte, présence, abonnement et conformité sont affichées (aucune trace GPS brute ni contenu de message privé).
                </div>

                {/* General Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-950/60 border border-slate-800 rounded-2xl p-4">
                  <div>
                    <span className="text-slate-500 block">UID</span>
                    <span className="font-mono text-slate-200 break-all">{detailData.user.uid}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Email</span>
                    <span className="font-mono text-slate-200">
                      {detailData.user.email || '—'}{' '}
                      {detailData.user.emailVerified ? '✓' : '(non vérifié)'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Statut du compte</span>
                    <AccountStatusText status={detailData.user.accountStatus} />
                  </div>
                  <div>
                    <span className="text-slate-500 block">Présence temps réel</span>
                    <PresenceDot state={detailData.user.presence.state} />{' '}
                    <span className="text-slate-500">
                      ({formatRelativeTimeFr(detailData.user.presence.lastHeartbeatAt)})
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Inscrit le</span>
                    <span className="text-slate-200">{formatDateTimeFr(detailData.user.createdAt)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Dernière connexion</span>
                    <span className="text-slate-200">{formatDateTimeFr(detailData.user.lastLoginAt)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Profils Famille associés</span>
                    <span className="text-slate-200 tabular-nums">{detailData.familyProfilesCount}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Dossiers Accessibilité / Tickets</span>
                    <span className="text-slate-200 tabular-nums">
                      {detailData.accessibilityRequests.length} / {detailData.supportTickets.length}
                    </span>
                  </div>
                </div>

                {/* Current Subscription */}
                <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-sm font-bold text-white">Abonnement</h3>
                    <PlanText
                      plan={detailData.user.subscription.effectivePlan}
                      isLifetime={detailData.user.subscription.isLifetime}
                    />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-slate-300 tabular-nums">
                    <div>
                      <span className="text-slate-500 block">Statut</span>
                      {detailData.user.subscription.status}
                    </div>
                    <div>
                      <span className="text-slate-500 block">Source</span>
                      {detailData.user.subscription.activationSource || 'free'}
                    </div>
                    <div>
                      <span className="text-slate-500 block">Expiration</span>
                      {detailData.user.subscription.isLifetime
                        ? 'À vie'
                        : formatDateFr(detailData.user.subscription.endDate)}
                    </div>
                  </div>
                  {detailData.user.subscription.history &&
                    detailData.user.subscription.history.length > 0 && (
                      <div className="pt-2 border-t border-slate-800 space-y-1.5">
                        <div className="text-[11px] font-semibold text-slate-400">
                          Historique des changements d’abonnement
                        </div>
                        {detailData.user.subscription.history.slice(0, 6).map((h) => (
                          <div
                            key={h.id}
                            className="text-[11px] flex flex-wrap justify-between gap-2 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800"
                          >
                            <span className="text-slate-200 font-medium">
                              {h.action} : {h.oldPlan} → {h.newPlan}
                            </span>
                            <span className="text-slate-400">{h.reason || h.source}</span>
                            <span className="text-slate-500 tabular-nums">
                              {formatDateTimeFr(h.timestamp)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                </div>

                {/* Sanctions History */}
                <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-sm font-bold text-white flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-amber-400" />
                      Historique des sanctions
                    </h3>
                    {detailData.user.uid !== currentAdminUid && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setModal({ type: 'hard_delete', user: detailData.user })}
                          className="text-[11px] px-2.5 py-1 rounded-lg bg-red-600/20 hover:bg-red-600/35 text-red-300 font-semibold"
                        >
                          Suppression définitive
                        </button>
                      </div>
                    )}
                  </div>
                  {detailData.user.sanctionHistory.length === 0 ? (
                    <p className="text-xs text-slate-500">Aucune sanction enregistrée.</p>
                  ) : (
                    <div className="space-y-2">
                      {detailData.user.sanctionHistory.map((s) => (
                        <div
                          key={s.id}
                          className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs flex justify-between gap-2"
                        >
                          <div>
                            <span className="font-mono font-bold text-amber-300">{s.action}</span>
                            <p className="text-slate-300 mt-0.5">{s.reason}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">Par : {s.adminEmail}</p>
                          </div>
                          <span className="text-[11px] text-slate-500 whitespace-nowrap tabular-nums">
                            {formatDateTimeFr(s.createdAt)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* User Audit Trail */}
                <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-2">
                  <h3 className="font-display text-sm font-bold text-white">
                    Événements d’audit liés ({detailData.auditLogs.length})
                  </h3>
                  <div className="space-y-1.5 max-h-56 overflow-y-auto">
                    {detailData.auditLogs.map((l) => (
                      <div
                        key={l.id}
                        className="text-[11px] flex justify-between gap-2 py-1.5 border-b border-slate-800/70 last:border-0"
                      >
                        <div>
                          <span className="font-mono text-blue-300">{l.action}</span> —{' '}
                          <span className="text-slate-300">{l.detail}</span>
                        </div>
                        <span className="text-slate-500 whitespace-nowrap tabular-nums">
                          {formatDateTimeFr(l.timestamp)}
                        </span>
                      </div>
                    ))}
                    {detailData.auditLogs.length === 0 && (
                      <p className="text-xs text-slate-500">Aucun événement.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sanction / Account Action Confirmation Modal */}
      {modal && (
        <div
          className="fixed inset-0 z-[125000] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-white flex items-center gap-2">
                {modal.type === 'hard_delete' && <AlertTriangle className="w-4 h-4 text-red-400" />}
                {modal.type === 'suspend' && 'Suspendre le compte'}
                {modal.type === 'ban' && 'Bannir le compte'}
                {modal.type === 'unban' && 'Réactiver le compte'}
                {modal.type === 'revoke' && 'Révoquer les sessions'}
                {modal.type === 'soft_delete' && 'Archiver le compte (Soft Delete)'}
                {modal.type === 'hard_delete' && 'Suppression définitive irréversible'}
              </h3>
              <button onClick={resetModal} className="text-slate-400 hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleActionSubmit} className="p-6 space-y-4">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                <div className="text-slate-400">Compte ciblé :</div>
                <div className="font-semibold text-white mt-0.5">
                  {modal.user.displayName || modal.user.email || modal.user.uid}
                </div>
                <div className="font-mono text-[11px] text-slate-500">{modal.user.uid}</div>
              </div>

              {modal.type === 'suspend' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Durée de suspension (heures)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={8760}
                    required
                    value={durationHours}
                    onChange={(e) => setDurationHours(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-amber-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Motif administratif{' '}
                  {modal.type === 'unban' || modal.type === 'revoke' ? '(optionnel)' : '*'}
                </label>
                <textarea
                  rows={3}
                  required={modal.type !== 'unban' && modal.type !== 'revoke'}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Indiquez la raison exacte qui sera conservée dans l’audit..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
                />
              </div>

              {modal.type === 'hard_delete' && (
                <div className="space-y-3 p-3.5 rounded-xl bg-red-950/30 border border-red-500/40">
                  <p className="text-xs text-red-200 leading-relaxed">
                    Cette action supprime définitivement le profil, l’abonnement, la présence et anonymise les références locales. Les traces d’audit restent conservées.
                  </p>
                  <label className="flex items-start gap-2 text-xs text-red-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hardDeleteAck}
                      onChange={(e) => setHardDeleteAck(e.target.checked)}
                      className="mt-0.5 rounded border-red-500 bg-slate-950"
                    />
                    <span>Je confirme comprendre que cette action est irréversible.</span>
                  </label>
                  <div>
                    <label className="block text-[11px] font-semibold text-red-300 mb-1">
                      Tapez exactement : <span className="font-mono">SUPPRIMER DEFINITIVEMENT</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={hardDeletePhrase}
                      onChange={(e) => setHardDeletePhrase(e.target.value)}
                      placeholder="SUPPRIMER DEFINITIVEMENT"
                      className="w-full bg-slate-950 border border-red-500/50 rounded-xl px-3 py-2 text-xs font-mono text-white outline-none"
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={resetModal}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={
                    submitting ||
                    (modal.type === 'hard_delete' &&
                      (!hardDeleteAck || hardDeletePhrase.trim() !== 'SUPPRIMER DEFINITIVEMENT'))
                  }
                  className={`flex-1 py-2.5 rounded-xl text-[#ffffff] text-xs font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-40 ${
                    modal.type === 'ban' ||
                    modal.type === 'hard_delete' ||
                    modal.type === 'soft_delete'
                      ? 'bg-red-600 hover:bg-red-500'
                      : modal.type === 'suspend'
                      ? 'bg-amber-600 hover:bg-amber-500'
                      : 'bg-blue-600 hover:bg-blue-500'
                  }`}
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Confirmer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

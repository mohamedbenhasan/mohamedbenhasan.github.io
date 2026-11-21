import React, { useCallback, useEffect, useState } from 'react';
import {
  FileCheck2,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldAlert,
  Monitor,
  Smartphone,
  History,
  X,
  Lock,
  Loader2,
} from 'lucide-react';
import {
  AdminConsentUserRow,
  AdminConsentsOverviewResponse,
} from '../../types';
import {
  AdminUserConsentDetailResponse,
  consentService,
} from '../../services/ConsentService';
import { toast } from '../../services/NotificationService';
import { formatDateTimeFr } from './SuperAdminShared';

interface Props {
  refreshTick: number;
}

export const ConsentsSection: React.FC<Props> = ({ refreshTick }) => {
  const [data, setData] = useState<AdminConsentsOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [platformFilter, setPlatformFilter] = useState('ALL');

  const [detailModal, setDetailModal] = useState<{
    open: boolean;
    loading: boolean;
    row: AdminConsentUserRow | null;
    detail: AdminUserConsentDetailResponse | null;
  }>({
    open: false,
    loading: false,
    row: null,
    detail: null,
  });

  const loadConsents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await consentService.adminGetConsents({
        status: statusFilter,
        platform: platformFilter,
        search,
      });
      setData(res);
    } catch (err: any) {
      toast.error(err?.message || 'Erreur lors du chargement des consentements.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, platformFilter, search]);

  useEffect(() => {
    const t = setTimeout(() => {
      loadConsents();
    }, 150);
    return () => clearTimeout(t);
  }, [loadConsents, refreshTick]);

  const openDetail = async (row: AdminConsentUserRow) => {
    setDetailModal({ open: true, loading: true, row, detail: null });
    try {
      const detail = await consentService.adminGetUserConsentDetail(row.uid);
      setDetailModal({ open: true, loading: false, row, detail });
    } catch (err: any) {
      toast.error(err?.message || 'Impossible de charger l’historique.');
      setDetailModal({ open: false, loading: false, row: null, detail: null });
    }
  };

  const renderStatusLabel = (row: AdminConsentUserRow) => {
    if (row.status === 'accepted' && row.accessAllowed) {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Accepté
        </span>
      );
    }
    if (row.status === 'refused') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-400">
          <XCircle className="w-3.5 h-3.5" />
          Refusé
        </span>
      );
    }
    if (row.status === 'withdrawn') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-400">
          <ShieldAlert className="w-3.5 h-3.5" />
          Retiré (RGPD)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400">
        <Clock className="w-3.5 h-3.5" />
        En attente
      </span>
    );
  };

  const renderPlatformLabel = (platform: AdminConsentUserRow['platform']) => {
    if (platform === 'android') {
      return (
        <span className="inline-flex items-center gap-1 text-xs text-emerald-300 font-mono">
          <Smartphone className="w-3.5 h-3.5" />
          Android
        </span>
      );
    }
    if (platform === 'web') {
      return (
        <span className="inline-flex items-center gap-1 text-xs text-blue-300 font-mono">
          <Monitor className="w-3.5 h-3.5" />
          Web
        </span>
      );
    }
    return <span className="text-xs text-slate-500">—</span>;
  };

  const stats = data?.stats;

  return (
    <div className="space-y-6">
      {/* RGPD Integrity Notice & Active Legal Versions */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0 mt-0.5">
            <FileCheck2 className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-display text-sm sm:text-base font-bold text-white">
              Registre vérifiable des consentements utilisateurs
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              Journal strictement en lecture seule : aucun administrateur ne peut accepter ou modifier un consentement à la place d’un utilisateur.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-slate-300 tabular-nums shrink-0">
          <span className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800">
            Consentement v{stats?.currentConsentVersion || '2026.1'}
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800">
            CGU {stats?.currentTermsVersion || '2026.1'} · Conf. {stats?.currentPrivacyVersion || '2026.1'}
          </span>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 tabular-nums">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Total acceptés
          </div>
          <div className="font-display text-2xl font-bold text-emerald-400 mt-1">
            {stats?.acceptedCount ?? '—'}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            sur {stats?.totalUsers ?? '—'} comptes
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Refusés / Retirés
          </div>
          <div className="font-display text-2xl font-bold text-red-400 mt-1">
            {stats ? stats.refusedCount + stats.withdrawnCount : '—'}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {stats?.refusedCount ?? 0} refus · {stats?.withdrawnCount ?? 0} retraits
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Sans réponse (en attente)
          </div>
          <div className="font-display text-2xl font-bold text-amber-400 mt-1">
            {stats?.pendingCount ?? '—'}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Bloqués jusqu&apos;à validation
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Taux d&apos;acceptation
          </div>
          <div className="font-display text-2xl font-bold text-blue-400 mt-1">
            {stats ? `${stats.acceptanceRatePct}%` : '—'}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Version active {stats?.currentConsentVersion || '2026.1'}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 col-span-2 lg:col-span-1">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Dernier consentement
          </div>
          <div className="text-xs font-mono font-semibold text-slate-200 mt-2">
            {formatDateTimeFr(stats?.lastAcceptedAt)}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par e-mail, nom ou UID..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
        >
          <option value="ALL">Tous les statuts</option>
          <option value="accepted">Acceptés</option>
          <option value="refused">Refusés</option>
          <option value="pending">En attente</option>
          <option value="withdrawn">Retirés (RGPD)</option>
        </select>

        <select
          value={platformFilter}
          onChange={(e) => setPlatformFilter(e.target.value)}
          className="bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
        >
          <option value="ALL">Toutes plateformes</option>
          <option value="web">Web</option>
          <option value="android">Android</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4 font-semibold">Utilisateur</th>
                <th className="py-3 px-4 font-semibold">Statut</th>
                <th className="py-3 px-4 font-semibold">Plateforme</th>
                <th className="py-3 px-4 font-semibold">Version</th>
                <th className="py-3 px-4 font-semibold">Date preuve</th>
                <th className="py-3 px-4 font-semibold">Facultatifs</th>
                <th className="py-3 px-4 font-semibold text-right">Audit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {loading && !data ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                      Chargement du registre des consentements...
                    </span>
                  </td>
                </tr>
              ) : (data?.users || []).length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500">
                    Aucun utilisateur ne correspond aux filtres sélectionnés.
                  </td>
                </tr>
              ) : (
                (data?.users || []).map((row) => (
                  <tr key={row.uid} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white truncate max-w-[220px]">
                        {row.email || row.displayName || 'Compte sans e-mail'}
                      </div>
                      <div className="font-mono text-[10px] text-slate-500 truncate max-w-[220px]">
                        {row.uid}
                      </div>
                    </td>
                    <td className="py-3 px-4">{renderStatusLabel(row)}</td>
                    <td className="py-3 px-4">{renderPlatformLabel(row.platform)}</td>
                    <td className="py-3 px-4 font-mono text-slate-300 tabular-nums">
                      {row.consentVersion ? `v${row.consentVersion}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-300 font-mono tabular-nums">
                      {row.status === 'accepted'
                        ? formatDateTimeFr(row.acceptedAt)
                        : row.status === 'refused'
                        ? formatDateTimeFr(row.refusedAt)
                        : row.status === 'withdrawn'
                        ? formatDateTimeFr(row.withdrawnAt)
                        : 'Jamais répondu'}
                    </td>
                    <td className="py-3 px-4 text-[11px] text-slate-400">
                      {row.status === 'accepted' ? (
                        <span>
                          Notifs: {row.optionalConsents.notifications ? 'Oui' : 'Non'} · Géo+:{' '}
                          {row.optionalConsents.locationEnhancements ? 'Oui' : 'Non'}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => openDetail(row)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-200 inline-flex items-center gap-1.5 transition-colors tabular-nums"
                      >
                        <History className="w-3.5 h-3.5 text-blue-400" />
                        Historique ({row.historyCount})
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Immutable Consent History Modal */}
      {detailModal.open && (
        <div
          className="fixed inset-0 z-[130000] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-display text-base font-bold text-white truncate">
                  Preuve &amp; Historique de consentement
                </h3>
                <p className="text-xs font-mono text-slate-400 truncate">
                  {detailModal.row?.email || detailModal.row?.uid}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setDetailModal({ open: false, loading: false, row: null, detail: null })
                }
                className="p-1.5 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {detailModal.loading ? (
                <div className="py-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                  Chargement du journal immuable...
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-950/70 border border-slate-800 rounded-xl p-4 tabular-nums">
                    <div>
                      <span className="text-slate-500 block">Statut actuel</span>
                      <span className="font-semibold text-white">
                        {detailModal.detail?.status.consentStatus || 'pending'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Première / Dernière acceptation</span>
                      <span className="font-mono text-slate-200">
                        {formatDateTimeFr(detailModal.detail?.record?.acceptedAt)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Plateforme d&apos;origine</span>
                      <span className="font-mono text-slate-200 uppercase">
                        {detailModal.detail?.record?.platform || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Versions enregistrées</span>
                      <span className="font-mono text-slate-200">
                        {detailModal.detail?.record
                          ? `CGU ${detailModal.detail.record.termsVersion} · Conf. ${detailModal.detail.record.privacyVersion}`
                          : 'Aucune'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Journal chronologique immuable ({detailModal.detail?.record?.history?.length || 0})
                    </h4>
                    {(detailModal.detail?.record?.history || []).length === 0 ? (
                      <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800 text-xs text-slate-500">
                        Aucune décision de consentement enregistrée pour cet utilisateur (en attente).
                      </div>
                    ) : (
                      (detailModal.detail?.record?.history || []).map((entry) => (
                        <div
                          key={entry.id}
                          className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-mono font-bold text-blue-400 uppercase">
                              {entry.action} · {entry.platform}
                            </span>
                            <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                              {formatDateTimeFr(entry.timestamp)}
                            </span>
                          </div>
                          <p className="text-slate-300">{entry.detail}</p>
                          <div className="text-[11px] font-mono text-slate-500">
                            v{entry.consentVersion} · Notifs:{' '}
                            {entry.optionalConsents.notifications ? 'Oui' : 'Non'} · Géo+:{' '}
                            {entry.optionalConsents.locationEnhancements ? 'Oui' : 'Non'}
                            {entry.ip ? ` · IP ${entry.ip}` : ''}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

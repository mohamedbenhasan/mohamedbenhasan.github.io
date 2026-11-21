import React, { useCallback, useEffect, useState } from 'react';
import {
  Ticket,
  Plus,
  Download,
  Copy,
  Check,
  Ban,
  Power,
  Search,
  Loader2,
  Eye,
  X,
  RefreshCw,
} from 'lucide-react';
import {
  AdminOverviewStats,
  RedeemCodeRecord,
  RedeemDurationCode,
} from '../../types';
import { superAdminService } from '../../services/SuperAdminService';
import { toast } from '../../services/NotificationService';
import { formatDateFr, formatDateTimeFr } from './SuperAdminShared';

interface Props {
  refreshTick: number;
  onChanged: () => void;
}

export const RedeemCodesSection: React.FC<Props> = ({ refreshTick, onChanged }) => {
  const [codes, setCodes] = useState<RedeemCodeRecord[]>([]);
  const [stats, setStats] = useState<AdminOverviewStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Generator state
  const [plan, setPlan] = useState<'PREMIUM' | 'FAMILY' | 'BUSINESS'>('PREMIUM');
  const [durationCode, setDurationCode] = useState<RedeemDurationCode>('1m');
  const [count, setCount] = useState(5);
  const [maxUses, setMaxUses] = useState(1);
  const [expiresDate, setExpiresDate] = useState('');
  const [campaign, setCampaign] = useState('');
  const [note, setNote] = useState('');
  const [generating, setGenerating] = useState(false);

  // Plaintext generated codes shown ONCE right after generation
  const [freshPlaintextCodes, setFreshPlaintextCodes] = useState<RedeemCodeRecord[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Filters & usage modal
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [planFilter, setPlanFilter] = useState('ALL');
  const [historyModalCode, setHistoryModalCode] = useState<RedeemCodeRecord | null>(null);

  const loadCodes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await superAdminService.getRedeemCodes();
      setCodes(res.codes);
      setStats(res.stats);
    } catch (err: any) {
      toast.error(err?.message || 'Erreur lors du chargement des codes Redeem.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCodes();
  }, [loadCodes, refreshTick]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    try {
      const expiresAt = expiresDate ? new Date(`${expiresDate}T23:59:59`).getTime() : null;
      const res = await superAdminService.generateRedeemCodes({
        plan,
        durationCode,
        count: Number(count),
        maxUses: Number(maxUses),
        expiresAt,
        campaign: campaign.trim() || undefined,
        note: note.trim() || undefined,
      });
      setFreshPlaintextCodes(res.generatedCodes);
      setCodes(res.maskedCodes);
      setStats(res.stats);
      toast.success(`${res.generatedCodes.length} code(s) généré(s) et hachés (SHA-256).`);
      onChanged();
    } catch (err: any) {
      toast.error(err?.message || 'Erreur de génération.');
    } finally {
      setGenerating(false);
    }
  };

  const handleStatusChange = async (id: string, action: 'revoke' | 'disable' | 'enable') => {
    try {
      const res = await superAdminService.updateRedeemStatus(id, action);
      setStats(res.stats);
      await loadCodes();
      toast.success(
        action === 'revoke'
          ? 'Code révoqué.'
          : action === 'disable'
          ? 'Code désactivé.'
          : 'Code réactivé.'
      );
      onChanged();
    } catch (err: any) {
      toast.error(err?.message || 'Action impossible.');
    }
  };

  const copyText = async (txt: string) => {
    try {
      await navigator.clipboard.writeText(txt);
      setCopiedCode(txt);
      setTimeout(() => setCopiedCode(null), 1800);
    } catch {
      // ignore
    }
  };

  const downloadFreshCsv = () => {
    if (freshPlaintextCodes.length === 0) return;
    const header = ['code', 'plan', 'durationCode', 'maxUses', 'campaign', 'expiresAt'];
    const rows = freshPlaintextCodes.map((c) => [
      c.code,
      c.plan,
      c.durationCode || '1m',
      String(c.maxUses ?? 1),
      `"${(c.campaign || '').replace(/"/g, '""')}"`,
      c.expiresAt ? new Date(c.expiresAt).toISOString() : '',
    ]);
    const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vruguard-codes-clair-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filtered = codes.filter((c) => {
    if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
    if (planFilter !== 'ALL' && c.plan !== planFilter) return false;
    const q = search.trim().toLowerCase();
    if (
      q &&
      !(c.maskedCode || c.code).toLowerCase().includes(q) &&
      !(c.campaign || '').toLowerCase().includes(q) &&
      !(c.usedByEmail || '').toLowerCase().includes(q)
    ) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Stats Strip */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 tabular-nums">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
            <div className="text-[11px] text-slate-400">Total</div>
            <div className="font-display text-xl font-bold text-white">{stats.totalCodes}</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
            <div className="text-[11px] text-slate-400">Disponibles</div>
            <div className="font-display text-xl font-bold text-emerald-400">
              {stats.availableCodes}
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
            <div className="text-[11px] text-slate-400">Utilisés</div>
            <div className="font-display text-xl font-bold text-blue-400">{stats.usedCodes}</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
            <div className="text-[11px] text-slate-400">Expirés</div>
            <div className="font-display text-xl font-bold text-amber-400">{stats.expiredCodes}</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
            <div className="text-[11px] text-slate-400">Désactivés</div>
            <div className="font-display text-xl font-bold text-slate-300">
              {stats.disabledCodes}
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
            <div className="text-[11px] text-slate-400">Révoqués</div>
            <div className="font-display text-xl font-bold text-red-400">{stats.revokedCodes}</div>
          </div>
        </div>
      )}

      {/* Generator Card */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-bold text-white flex items-center gap-2">
              <Ticket className="w-4 h-4 text-emerald-400" />
              Générateur sécurisé de codes Redeem
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Entropie cryptographique + hachage SHA-256 stocké côté serveur. Le texte en clair n’est affiché qu’une seule fois à la création.
            </p>
          </div>
          <button
            type="button"
            onClick={() => superAdminService.downloadRedeemCsv()}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 inline-flex items-center gap-2"
          >
            <Download className="w-3.5 h-3.5" />
            Exporter CSV (masqués)
          </button>
        </div>

        <form onSubmit={handleGenerate} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Formule</label>
            <select
              value={plan}
              onChange={(e) => setPlan(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none"
            >
              <option value="PREMIUM">PREMIUM</option>
              <option value="FAMILY">FAMILY</option>
              <option value="BUSINESS">BUSINESS</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Durée accordée</label>
            <select
              value={durationCode}
              onChange={(e) => setDurationCode(e.target.value as RedeemDurationCode)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none"
            >
              <option value="1m">1 mois (30 jours)</option>
              <option value="3m">3 mois (90 jours)</option>
              <option value="6m">6 mois (180 jours)</option>
              <option value="12m">12 mois (365 jours)</option>
              <option value="24m">24 mois (730 jours)</option>
              <option value="lifetime">À vie (Lifetime)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              Nombre de codes (1–100)
            </label>
            <input
              type="number"
              min={1}
              max={100}
              required
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              Utilisations max / code
            </label>
            <input
              type="number"
              min={1}
              max={1000}
              required
              value={maxUses}
              onChange={(e) => setMaxUses(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              Expiration du code (optionnel)
            </label>
            <input
              type="date"
              value={expiresDate}
              onChange={(e) => setExpiresDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              Campagne / Lot
            </label>
            <input
              type="text"
              value={campaign}
              onChange={(e) => setCampaign(e.target.value)}
              placeholder="Ex. PARTENAIRE-2026"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Note interne</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex. Dotation municipalité"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={generating}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-[#ffffff] text-xs font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Générer les codes
            </button>
          </div>
        </form>

        {/* One-time Plaintext Reveal Banner */}
        {freshPlaintextCodes.length > 0 && (
          <div className="p-4 rounded-2xl bg-emerald-950/35 border border-emerald-500/45 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold text-emerald-300">
                  Codes générés (affichage unique en clair — sauvegardez-les maintenant)
                </p>
                <p className="text-[11px] text-emerald-200/80">
                  Après fermeture ou rafraîchissement, ces codes ne seront visibles que sous forme masquée.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => copyText(freshPlaintextCodes.map((c) => c.code).join('\n'))}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-[#ffffff] text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Tout copier
                </button>
                <button
                  type="button"
                  onClick={downloadFreshCsv}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  CSV en clair
                </button>
                <button
                  type="button"
                  onClick={() => setFreshPlaintextCodes([])}
                  className="p-1.5 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
              {freshPlaintextCodes.map((c) => (
                <div
                  key={c.id || c.code}
                  className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-emerald-300"
                >
                  <span>{c.code}</span>
                  <button
                    type="button"
                    onClick={() => copyText(c.code)}
                    className="text-slate-400 hover:text-white"
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

      {/* Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par préfixe/suffixe masqué, campagne, email..."
            className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white outline-none focus:border-blue-500"
          />
        </div>
        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
          className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none"
        >
          <option value="ALL">Tous les plans</option>
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
          <option value="available">Disponibles</option>
          <option value="used">Utilisés</option>
          <option value="expired">Expirés</option>
          <option value="disabled">Désactivés</option>
          <option value="revoked">Révoqués</option>
        </select>
        <button
          onClick={loadCodes}
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Masked Codes Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Code masqué</th>
                <th className="py-3 px-4">Plan &amp; Durée</th>
                <th className="py-3 px-4">Campagne</th>
                <th className="py-3 px-4">Utilisations</th>
                <th className="py-3 px-4">Expiration</th>
                <th className="py-3 px-4">Statut</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {filtered.map((c) => {
                const rowId = c.id || c.code;
                return (
                  <tr key={rowId} className="hover:bg-slate-800/30">
                    <td className="py-3 px-4 font-mono text-slate-200">{c.maskedCode || c.code}</td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-blue-400">{c.plan}</span>{' '}
                      <span className="text-slate-400">
                        · {c.isLifetime ? 'À vie' : c.durationCode || `${c.durationDays}j`}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      <div>{c.campaign || '—'}</div>
                      {c.note && <div className="text-[11px] text-slate-500">{c.note}</div>}
                    </td>
                    <td className="py-3 px-4 tabular-nums text-slate-300">
                      {c.usesCount ?? 0} / {c.maxUses ?? 1}
                      {c.usedByEmail && (
                        <div className="text-[10px] text-slate-500 truncate max-w-[160px]">
                          {c.usedByEmail}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 tabular-nums text-slate-400">
                      {c.expiresAt ? formatDateFr(c.expiresAt) : 'Aucune'}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`font-semibold ${
                          c.status === 'available'
                            ? 'text-emerald-400'
                            : c.status === 'used'
                            ? 'text-blue-400'
                            : c.status === 'revoked'
                            ? 'text-red-400'
                            : 'text-amber-400'
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => setHistoryModalCode(c)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                          title="Historique d’utilisation"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {c.status === 'available' && (
                          <button
                            onClick={() => handleStatusChange(rowId, 'disable')}
                            className="p-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/30 text-amber-300"
                            title="Désactiver temporairement"
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {c.status === 'disabled' && (
                          <button
                            onClick={() => handleStatusChange(rowId, 'enable')}
                            className="p-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-300"
                            title="Réactiver"
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {c.status !== 'revoked' && c.status !== 'used' && (
                          <button
                            onClick={() => handleStatusChange(rowId, 'revoke')}
                            className="p-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/30 text-red-300"
                            title="Révoquer définitivement"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    Aucun code Redeem trouvé.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Usage History Modal */}
      {historyModalCode && (
        <div
          className="fixed inset-0 z-[125000] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-white">
                Historique · {historyModalCode.maskedCode || historyModalCode.code}
              </h3>
              <button
                onClick={() => setHistoryModalCode(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-xs text-slate-400 space-y-1">
              <div>Créé par : {historyModalCode.createdBy}</div>
              <div>Créé le : {formatDateTimeFr(historyModalCode.createdAt)}</div>
              <div>Note : {historyModalCode.note || '—'}</div>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {(historyModalCode.usageHistory || []).map((u, idx) => (
                <div
                  key={`${u.uid}-${idx}`}
                  className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs flex justify-between"
                >
                  <div>
                    <div className="text-white font-mono">{u.email || u.uid}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{u.uid}</div>
                  </div>
                  <div className="text-slate-400 tabular-nums">{formatDateTimeFr(u.usedAt)}</div>
                </div>
              ))}
              {(!historyModalCode.usageHistory || historyModalCode.usageHistory.length === 0) && (
                <p className="text-xs text-slate-500">Aucune utilisation enregistrée.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useCallback, useEffect, useState } from 'react';
import {
  Accessibility,
  Award,
  CheckCircle2,
  XCircle,
  MessageSquareMore,
  FileText,
  Download,
  X,
  Loader2,
  Plus,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import { AccessibilityRequestRecord, AdminUserSummary } from '../../types';
import { superAdminService } from '../../services/SuperAdminService';
import { toast } from '../../services/NotificationService';
import { formatDateFr, formatDateTimeFr } from './SuperAdminShared';

interface AccessibilityProps {
  refreshTick: number;
  onChanged: () => void;
}

export const AccessibilitySection: React.FC<AccessibilityProps> = ({ refreshTick, onChanged }) => {
  const [requests, setRequests] = useState<AccessibilityRequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedReq, setSelectedReq] = useState<AccessibilityRequestRecord | null>(null);
  const [docPreviewUrl, setDocPreviewUrl] = useState<string | null>(null);
  const [docPreviewMime, setDocPreviewMime] = useState<string>('');
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [comment, setComment] = useState('');
  const [deciding, setDeciding] = useState(false);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await superAdminService.getAccessibilityRequests();
      setRequests(res.requests);
    } catch (err: any) {
      toast.error(err?.message || 'Erreur lors du chargement des dossiers Accessibilité.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests, refreshTick]);

  useEffect(() => {
    return () => {
      if (docPreviewUrl) URL.revokeObjectURL(docPreviewUrl);
    };
  }, [docPreviewUrl]);

  const openDocument = async (req: AccessibilityRequestRecord) => {
    setSelectedReq(req);
    setComment(req.adminComment || '');
    if (docPreviewUrl) {
      URL.revokeObjectURL(docPreviewUrl);
      setDocPreviewUrl(null);
    }
    if (!req.hasDocumentFile) return;

    setLoadingDoc(true);
    try {
      const { blob, mimeType } = await superAdminService.fetchAccessibilityDocumentBlob(req.id);
      const url = URL.createObjectURL(blob);
      setDocPreviewUrl(url);
      setDocPreviewMime(mimeType);
    } catch (err: any) {
      toast.error(err?.message || 'Impossible de charger le justificatif sécurisé.');
    } finally {
      setLoadingDoc(false);
    }
  };

  const handleDecision = async (decision: 'approved' | 'rejected' | 'more_info_required') => {
    if (!selectedReq) return;
    if (decision !== 'approved' && !comment.trim()) {
      toast.error('Un commentaire explicatif est requis pour ce statut.');
      return;
    }
    setDeciding(true);
    try {
      await superAdminService.reviewAccessibilityRequest(
        selectedReq.id,
        decision,
        comment.trim() || undefined
      );
      toast.success(
        decision === 'approved'
          ? 'Dossier approuvé : Premium À vie activé automatiquement.'
          : decision === 'rejected'
          ? 'Dossier refusé et utilisateur notifié.'
          : 'Complément d’information demandé.'
      );
      setSelectedReq(null);
      await loadRequests();
      onChanged();
    } catch (err: any) {
      toast.error(err?.message || 'Action impossible.');
    } finally {
      setDeciding(false);
    }
  };

  const filtered = requests.filter((r) => statusFilter === 'ALL' || r.status === statusFilter);
  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const approvedCount = requests.filter((r) => r.status === 'approved').length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 tabular-nums">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="text-xs text-slate-400">Dossiers reçus</div>
          <div className="font-display text-2xl font-bold text-white mt-1">{requests.length}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="text-xs text-slate-400">En attente de validation</div>
          <div className="font-display text-2xl font-bold text-amber-400 mt-1">{pendingCount}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="text-xs text-slate-400">Approuvés (Premium À vie)</div>
          <div className="font-display text-2xl font-bold text-emerald-400 mt-1">
            {approvedCount}
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <Accessibility className="w-4 h-4 text-blue-400" />
          <span>
            Les justificatifs sont stockés en privé hors racine web et accessibles uniquement par le Super Admin.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none"
          >
            <option value="ALL">Tous statuts</option>
            <option value="pending">En attente</option>
            <option value="more_info_required">Complément demandé</option>
            <option value="approved">Approuvés</option>
            <option value="rejected">Refusés</option>
          </select>
          <button
            onClick={loadRequests}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Demandeur</th>
                <th className="py-3 px-4">Situation / Catégorie</th>
                <th className="py-3 px-4">Document</th>
                <th className="py-3 px-4">Soumis le</th>
                <th className="py-3 px-4">Statut</th>
                <th className="py-3 px-4 text-right">Instruction</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {filtered.map((req) => (
                <tr key={req.id} className="hover:bg-slate-800/30">
                  <td className="py-3 px-4">
                    <div className="font-semibold text-white">{req.fullName}</div>
                    <div className="font-mono text-[11px] text-slate-400">
                      {req.email || req.uid}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-200">{req.disabilityCategory}</div>
                    <div className="text-[11px] text-slate-400 line-clamp-2 max-w-xs">
                      {req.description}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-slate-300">
                    {req.hasDocumentFile ? (
                      <span className="inline-flex items-center gap-1 text-blue-400">
                        <FileText className="w-3.5 h-3.5" />
                        {req.documentName}
                      </span>
                    ) : (
                      <span className="text-slate-500">Aucun fichier</span>
                    )}
                  </td>
                  <td className="py-3 px-4 tabular-nums text-slate-400">
                    {formatDateTimeFr(req.createdAt)}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`font-semibold ${
                        req.status === 'approved'
                          ? 'text-emerald-400'
                          : req.status === 'rejected'
                          ? 'text-red-400'
                          : req.status === 'more_info_required'
                          ? 'text-blue-400'
                          : 'text-amber-400'
                      }`}
                    >
                      {req.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => openDocument(req)}
                      className="px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/35 text-blue-300 text-xs font-semibold"
                    >
                      Examiner
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500">
                    Aucune demande d’accessibilité pour ce filtre.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Review Drawer / Modal */}
      {selectedReq && (
        <div
          className="fixed inset-0 z-[125000] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-mono text-blue-400 uppercase">
                  Instruction Accessibilité
                </p>
                <h3 className="font-display text-lg font-bold text-white">
                  {selectedReq.fullName}
                </h3>
              </div>
              <button
                onClick={() => setSelectedReq(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950 border border-slate-800 rounded-xl p-4">
                <div>
                  <span className="text-slate-500 block">Email / UID</span>
                  <span className="text-slate-200 font-mono">
                    {selectedReq.email || selectedReq.uid}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Catégorie déclarée</span>
                  <span className="text-white font-semibold">{selectedReq.disabilityCategory}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-slate-500 block mb-1">Description</span>
                  <p className="text-slate-300 leading-relaxed">{selectedReq.description}</p>
                </div>
              </div>

              {/* Secure Document Preview */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-400" />
                    Justificatif : {selectedReq.documentName || 'Non joint'}
                  </span>
                  {docPreviewUrl && (
                    <a
                      href={docPreviewUrl}
                      download={selectedReq.documentName || 'justificatif'}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 inline-flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Télécharger
                    </a>
                  )}
                </div>
                {loadingDoc && (
                  <div className="py-6 flex items-center justify-center gap-2 text-slate-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Déchiffrement du document protégé...
                  </div>
                )}
                {!loadingDoc && docPreviewUrl && docPreviewMime.startsWith('image/') && (
                  <img
                    src={docPreviewUrl}
                    alt="Justificatif Accessibilité"
                    className="max-h-72 rounded-lg border border-slate-800 mx-auto object-contain"
                  />
                )}
                {!loadingDoc && docPreviewUrl && docPreviewMime === 'application/pdf' && (
                  <iframe
                    src={docPreviewUrl}
                    title="Justificatif PDF"
                    className="w-full h-72 rounded-lg border border-slate-800 bg-white"
                  />
                )}
              </div>

              {/* Decision History */}
              {selectedReq.history.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-semibold text-slate-400">
                    Historique du dossier
                  </div>
                  {selectedReq.history.map((h, i) => (
                    <div
                      key={i}
                      className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex justify-between gap-2"
                    >
                      <div>
                        <span className="font-mono text-blue-300">{h.action}</span> par {h.actor}
                        {h.comment && <p className="text-slate-300 mt-0.5">{h.comment}</p>}
                      </div>
                      <span className="text-slate-500 tabular-nums">
                        {formatDateTimeFr(h.timestamp)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                  Commentaire / Motif (transmis à l’utilisateur)
                </label>
                <textarea
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Commentaire de validation, motif de refus ou pièce manquante..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex flex-wrap gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={deciding}
                  onClick={() => handleDecision('approved')}
                  className="flex-1 min-w-[160px] py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-[#ffffff] font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Approuver (Premium À vie)
                </button>
                <button
                  type="button"
                  disabled={deciding}
                  onClick={() => handleDecision('more_info_required')}
                  className="flex-1 min-w-[160px] py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-[#ffffff] font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <MessageSquareMore className="w-4 h-4" />
                  Demander complément
                </button>
                <button
                  type="button"
                  disabled={deciding}
                  onClick={() => handleDecision('rejected')}
                  className="flex-1 min-w-[130px] py-2.5 px-3 rounded-xl bg-red-600 hover:bg-red-500 text-[#ffffff] font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4" />
                  Refuser
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface PioneerProps {
  refreshTick: number;
  onChanged: () => void;
}

export const PioneerSection: React.FC<PioneerProps> = ({ refreshTick, onChanged }) => {
  const [pioneers, setPioneers] = useState<AdminUserSummary[]>([]);
  const [whitelisted, setWhitelisted] = useState<
    Array<{ email: string; startDate: number; endDate: number; note?: string }>
  >([]);
  const [loading, setLoading] = useState(true);

  const [grantEmail, setGrantEmail] = useState('');
  const [grantDays, setGrantDays] = useState(730);
  const [grantNote, setGrantNote] = useState('');
  const [saving, setSaving] = useState(false);

  const loadPioneer = useCallback(async () => {
    setLoading(true);
    try {
      const res = await superAdminService.getPioneerData();
      setPioneers(res.pioneers);
      setWhitelisted(res.whitelistedEmails);
    } catch (err: any) {
      toast.error(err?.message || 'Erreur lors du chargement du programme Pioneer.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPioneer();
  }, [loadPioneer, refreshTick]);

  const handleGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grantEmail.trim()) return;
    setSaving(true);
    try {
      await superAdminService.grantPioneer({
        email: grantEmail.trim(),
        durationDays: Number(grantDays),
        note: grantNote.trim() || undefined,
      });
      toast.success('Statut Pioneer / Early Tester accordé.');
      setGrantEmail('');
      setGrantNote('');
      await loadPioneer();
      onChanged();
    } catch (err: any) {
      toast.error(err?.message || 'Impossible d’accorder Pioneer.');
    } finally {
      setSaving(false);
    }
  };

  const handleRevoke = async (payload: { uid?: string; email?: string }) => {
    try {
      await superAdminService.revokePioneer({
        ...payload,
        reason: 'Révocation administrative depuis le module Pioneer',
      });
      toast.success('Statut Pioneer révoqué.');
      await loadPioneer();
      onChanged();
    } catch (err: any) {
      toast.error(err?.message || 'Révocation impossible.');
    }
  };

  const daysRemaining = (endMs?: number | null) => {
    if (!endMs) return 0;
    return Math.max(0, Math.ceil((endMs - Date.now()) / 86_400_000));
  };

  return (
    <div className="space-y-6">
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div>
          <h2 className="font-display text-base font-bold text-white flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-400" />
            Accorder le statut Pioneer / Early Tester (2 ans Premium offerts)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Si l’email n’a pas encore de compte, il est pré-enregistré et activé dès sa première connexion.
          </p>
        </div>

        <form onSubmit={handleGrant} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <input
            type="email"
            required
            value={grantEmail}
            onChange={(e) => setGrantEmail(e.target.value)}
            placeholder="email@domaine.com"
            className="sm:col-span-2 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-amber-500"
          />
          <input
            type="number"
            min={1}
            max={1825}
            value={grantDays}
            onChange={(e) => setGrantDays(Number(e.target.value))}
            className="bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white outline-none"
            title="Durée en jours (730 = 2 ans)"
          />
          <button
            type="submit"
            disabled={saving}
            className="py-2 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-[#ffffff] text-xs font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Accorder Pioneer
          </button>
          <input
            type="text"
            value={grantNote}
            onChange={(e) => setGrantNote(e.target.value)}
            placeholder="Note interne (optionnel) : bêta testeur Bordeaux, partenaire..."
            className="sm:col-span-4 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white outline-none"
          />
        </form>
      </section>

      {/* Active Pioneer Accounts */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-display text-sm font-bold text-white">
            Comptes Pioneer actifs ({pioneers.length})
          </h3>
          <button
            onClick={loadPioneer}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 uppercase">
              <tr>
                <th className="py-3 px-4">Utilisateur</th>
                <th className="py-3 px-4">Badge</th>
                <th className="py-3 px-4">Début → Fin</th>
                <th className="py-3 px-4">Jours restants</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {pioneers.map((u) => (
                <tr key={u.uid} className="hover:bg-slate-800/30">
                  <td className="py-3 px-4">
                    <div className="font-semibold text-white">{u.displayName || 'Sans nom'}</div>
                    <div className="font-mono text-[11px] text-slate-400">{u.email || u.uid}</div>
                  </td>
                  <td className="py-3 px-4 text-amber-400 font-semibold">
                    {u.subscription.earlyTesterBadge || 'Early Tester'}
                  </td>
                  <td className="py-3 px-4 tabular-nums text-slate-300">
                    {formatDateFr(u.subscription.earlyTesterStartDate)} →{' '}
                    {formatDateFr(u.subscription.earlyTesterEndDate)}
                  </td>
                  <td className="py-3 px-4 tabular-nums font-mono text-emerald-400">
                    {daysRemaining(u.subscription.earlyTesterEndDate)} j
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handleRevoke({ uid: u.uid, email: u.email || undefined })}
                      className="px-2.5 py-1 rounded-lg bg-red-500/15 hover:bg-red-500/30 text-red-300 text-xs font-semibold inline-flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      Révoquer
                    </button>
                  </td>
                </tr>
              ))}
              {pioneers.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    Aucun compte Pioneer actif.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Pre-whitelisted Emails */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800">
          <h3 className="font-display text-sm font-bold text-white">
            Emails pré-approuvés en attente d’inscription ({whitelisted.length})
          </h3>
        </div>
        <div className="divide-y divide-slate-800/70">
          {whitelisted.map((w) => (
            <div key={w.email} className="px-5 py-3 flex items-center justify-between text-xs">
              <div>
                <div className="font-mono text-white">{w.email}</div>
                <div className="text-[11px] text-slate-400 tabular-nums">
                  {formatDateFr(w.startDate)} → {formatDateFr(w.endDate)}
                  {w.note ? ` · ${w.note}` : ''}
                </div>
              </div>
              <button
                onClick={() => handleRevoke({ email: w.email })}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-red-950/60 text-slate-300 hover:text-red-300 text-xs"
              >
                Retirer
              </button>
            </div>
          ))}
          {whitelisted.length === 0 && (
            <div className="p-6 text-center text-xs text-slate-500">
              Aucun email pré-approuvé supplémentaire.
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

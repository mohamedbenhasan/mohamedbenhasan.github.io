import React, { useCallback, useEffect, useState } from 'react';
import {
  ScrollText,
  Bell,
  LifeBuoy,
  Search,
  Send,
  Loader2,
  Building2,
  MessageSquare,
  RefreshCw,
  AlertCircle,
  X,
} from 'lucide-react';
import {
  AdminNotificationRecord,
  AuditLogEntry,
  BusinessQuoteRequest,
  SupportTicketRecord,
  SupportTicketStatus,
} from '../../types';
import { superAdminService } from '../../services/SuperAdminService';
import { toast } from '../../services/NotificationService';
import { formatDateTimeFr } from './SuperAdminShared';

// ===============================================================
// 1. Audit Logs Section
// ===============================================================

export const AuditLogsSection: React.FC<{ refreshTick: number }> = ({ refreshTick }) => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('ALL');
  const [outcome, setOutcome] = useState('ALL');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await superAdminService.getAuditLogs({
        category: category !== 'ALL' ? category : undefined,
        outcome: outcome !== 'ALL' ? outcome : undefined,
        search: search.trim() || undefined,
        limit: 250,
      });
      setLogs(res.logs);
    } catch (err: any) {
      toast.error(err?.message || 'Erreur lors du chargement des logs d’audit.');
    } finally {
      setLoading(false);
    }
  }, [category, outcome, search]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs, refreshTick]);

  return (
    <div className="space-y-5">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrer par action, email, cible ou détail..."
            className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white outline-none focus:border-blue-500"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none"
        >
          <option value="ALL">Toutes catégories</option>
          <option value="auth">Auth</option>
          <option value="user">Utilisateurs</option>
          <option value="subscription">Abonnements</option>
          <option value="redeem">Codes Redeem</option>
          <option value="accessibility">Accessibilité</option>
          <option value="pioneer">Pioneer</option>
          <option value="settings">Paramètres</option>
          <option value="notification">Notifications</option>
          <option value="support">Support</option>
          <option value="security">Sécurité</option>
        </select>
        <select
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
          className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none"
        >
          <option value="ALL">Tous résultats</option>
          <option value="success">Succès</option>
          <option value="denied">Refusés (403)</option>
          <option value="failed">Échecs</option>
        </select>
        <button
          onClick={loadLogs}
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Catégorie</th>
                <th className="py-3 px-4">Acteur</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Cible / Détail</th>
                <th className="py-3 px-4 text-right">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {logs.map((l) => {
                const isOpen = expandedId === l.id;
                const hasDiff = l.oldValue !== undefined || l.newValue !== undefined;
                return (
                  <React.Fragment key={l.id}>
                    <tr
                      onClick={() => hasDiff && setExpandedId(isOpen ? null : l.id)}
                      className={`hover:bg-slate-800/30 ${hasDiff ? 'cursor-pointer' : ''}`}
                    >
                      <td className="py-3 px-4 tabular-nums text-slate-400 whitespace-nowrap">
                        {formatDateTimeFr(l.timestamp)}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-300">
                        {l.category}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-300">
                        {l.adminEmail}
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-blue-300">
                        {l.action}
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        <div>{l.detail}</div>
                        {(l.targetEmail || l.targetUid) && (
                          <div className="text-[10px] font-mono text-slate-500">
                            Cible : {l.targetEmail || l.targetUid}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span
                          className={`font-semibold ${
                            l.outcome === 'success'
                              ? 'text-emerald-400'
                              : l.outcome === 'denied'
                              ? 'text-red-400'
                              : 'text-amber-400'
                          }`}
                        >
                          {l.outcome}
                        </span>
                      </td>
                    </tr>
                    {isOpen && hasDiff && (
                      <tr className="bg-slate-950/70">
                        <td colSpan={6} className="p-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] font-mono">
                            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 overflow-x-auto">
                              <div className="text-slate-500 mb-1">Ancienne valeur</div>
                              <pre className="text-slate-300">
                                {JSON.stringify(l.oldValue ?? null, null, 2)}
                              </pre>
                            </div>
                            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 overflow-x-auto">
                              <div className="text-slate-500 mb-1">Nouvelle valeur</div>
                              <pre className="text-emerald-300">
                                {JSON.stringify(l.newValue ?? null, null, 2)}
                              </pre>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {logs.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500">
                    Aucun log d’audit correspondant.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ===============================================================
// 2. Admin Notifications Section
// ===============================================================

export const NotificationsSection: React.FC<{
  refreshTick: number;
  onChanged: () => void;
}> = ({ refreshTick, onChanged }) => {
  const [notifications, setNotifications] = useState<AdminNotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState<AdminNotificationRecord['type']>('info');
  const [targetScope, setTargetScope] = useState<AdminNotificationRecord['targetScope']>('all');
  const [targetEmail, setTargetEmail] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await superAdminService.getAdminNotifications();
      setNotifications(res.notifications);
    } catch (err: any) {
      toast.error(err?.message || 'Erreur lors du chargement des notifications.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications, refreshTick]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;
    if (targetScope !== 'specific_user') {
      setConfirmOpen(true);
    } else {
      executeSend();
    }
  };

  const executeSend = async () => {
    setSending(true);
    try {
      await superAdminService.sendAdminNotification({
        title: title.trim(),
        message: message.trim(),
        type,
        targetScope,
        targetEmail: targetScope === 'specific_user' ? targetEmail.trim() : undefined,
      });
      toast.success('Notification envoyée et enregistrée.');
      setTitle('');
      setMessage('');
      setTargetEmail('');
      setConfirmOpen(false);
      await loadNotifications();
      onChanged();
    } catch (err: any) {
      toast.error(err?.message || 'Envoi impossible.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div>
          <h2 className="font-display text-base font-bold text-white flex items-center gap-2">
            <Bell className="w-4 h-4 text-blue-400" />
            Envoyer une notification plateforme
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Diffusée en temps réel aux utilisateurs connectés lors de leur synchronisation de session.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Ciblage</label>
              <select
                value={targetScope}
                onChange={(e) => setTargetScope(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none"
              >
                <option value="all">Tous les utilisateurs</option>
                <option value="FREE">Plan FREE uniquement</option>
                <option value="PREMIUM">Plan PREMIUM uniquement</option>
                <option value="FAMILY">Plan FAMILY uniquement</option>
                <option value="BUSINESS">Plan BUSINESS uniquement</option>
                <option value="specific_user">Utilisateur spécifique (Email)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none"
              >
                <option value="info">Information</option>
                <option value="success">Succès / Bonne nouvelle</option>
                <option value="warning">Avertissement</option>
                <option value="error">Alerte critique</option>
              </select>
            </div>
            {targetScope === 'specific_user' && (
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Email utilisateur *
                </label>
                <input
                  type="email"
                  required
                  value={targetEmail}
                  onChange={(e) => setTargetEmail(e.target.value)}
                  placeholder="utilisateur@domaine.com"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Titre *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex. Mise à jour sécurité VruGuard"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Message *</label>
            <textarea
              rows={3}
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Contenu de la notification..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={sending}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-[#ffffff] text-xs font-semibold inline-flex items-center gap-2 disabled:opacity-50"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Envoyer la notification
            </button>
          </div>
        </form>
      </section>

      <section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-display text-sm font-bold text-white">
            Historique des diffusions ({notifications.length})
          </h3>
          <button
            onClick={loadNotifications}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="divide-y divide-slate-800/70">
          {notifications.map((n) => (
            <div key={n.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white">{n.title}</span>
                  <span className="font-mono text-[11px] text-blue-400">{n.targetScope}</span>
                  {n.targetEmail && (
                    <span className="font-mono text-[11px] text-slate-400">({n.targetEmail})</span>
                  )}
                </div>
                <p className="text-slate-300">{n.message}</p>
              </div>
              <div className="text-right text-[11px] text-slate-500 tabular-nums shrink-0">
                <div>{formatDateTimeFr(n.createdAt)}</div>
                <div>
                  Destinataires est. : {n.recipientCount} · Lus : {n.readByUids.length}
                </div>
              </div>
            </div>
          ))}
          {notifications.length === 0 && (
            <div className="p-8 text-center text-xs text-slate-500">
              Aucune notification envoyée pour le moment.
            </div>
          )}
        </div>
      </section>

      {/* Bulk confirmation modal */}
      {confirmOpen && (
        <div className="fixed inset-0 z-[125000] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/40 rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-white flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400" />
                Confirmer l’envoi groupé
              </h3>
              <button onClick={() => setConfirmOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Vous allez diffuser « <strong className="text-white">{title}</strong> » au segment{' '}
              <strong className="text-blue-400">{targetScope}</strong>. Confirmez-vous l’envoi ?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmOpen(false)}
                className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Annuler
              </button>
              <button
                onClick={executeSend}
                disabled={sending}
                className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-[#ffffff] text-xs font-semibold inline-flex items-center justify-center gap-2"
              >
                {sending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirmer l’envoi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ===============================================================
// 3. Support, Business Quotes & Feedback Section
// ===============================================================

export const SupportSection: React.FC<{
  refreshTick: number;
  onChanged: () => void;
}> = ({ refreshTick, onChanged }) => {
  const [tab, setTab] = useState<'tickets' | 'quotes' | 'feedback'>('tickets');
  const [tickets, setTickets] = useState<SupportTicketRecord[]>([]);
  const [quotes, setQuotes] = useState<BusinessQuoteRequest[]>([]);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [incidentsCount, setIncidentsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [noteText, setNoteText] = useState<Record<string, string>>({});

  const loadSupport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await superAdminService.getSupportOverview();
      setTickets(res.tickets);
      setQuotes(res.businessQuotes);
      setFeedbacks(res.feedbacks);
      setIncidentsCount(res.incidentsCount);
    } catch (err: any) {
      toast.error(err?.message || 'Erreur lors du chargement du support.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSupport();
  }, [loadSupport, refreshTick]);

  const handleReply = async (id: string) => {
    const msg = (replyText[id] || '').trim();
    if (!msg) return;
    try {
      await superAdminService.replySupportTicket(id, msg);
      setReplyText((prev) => ({ ...prev, [id]: '' }));
      toast.success('Réponse envoyée et utilisateur notifié.');
      await loadSupport();
      onChanged();
    } catch (err: any) {
      toast.error(err?.message || 'Erreur lors de la réponse.');
    }
  };

  const handleStatus = async (id: string, status: SupportTicketStatus) => {
    try {
      await superAdminService.updateSupportTicketStatus(id, status);
      toast.success(`Statut mis à jour : ${status}`);
      await loadSupport();
      onChanged();
    } catch (err: any) {
      toast.error(err?.message || 'Impossible de modifier le statut.');
    }
  };

  const handleAddNote = async (id: string) => {
    const n = (noteText[id] || '').trim();
    if (!n) return;
    try {
      await superAdminService.addSupportNote(id, n);
      setNoteText((prev) => ({ ...prev, [id]: '' }));
      toast.success('Note interne ajoutée.');
      await loadSupport();
    } catch (err: any) {
      toast.error(err?.message || 'Impossible d’ajouter la note.');
    }
  };

  const handleQuoteStatus = async (id: string, status: BusinessQuoteRequest['status']) => {
    try {
      await superAdminService.updateBusinessQuote(id, { status });
      toast.success('Statut devis mis à jour.');
      await loadSupport();
      onChanged();
    } catch (err: any) {
      toast.error(err?.message || 'Mise à jour impossible.');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex p-1 bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setTab('tickets')}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${
              tab === 'tickets' ? 'bg-blue-600 text-[#ffffff]' : 'text-slate-400 hover:text-white'
            }`}
          >
            <LifeBuoy className="w-3.5 h-3.5" />
            Tickets ({tickets.length})
          </button>
          <button
            onClick={() => setTab('quotes')}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${
              tab === 'quotes' ? 'bg-blue-600 text-[#ffffff]' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            Devis Business ({quotes.length})
          </button>
          <button
            onClick={() => setTab('feedback')}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${
              tab === 'feedback' ? 'bg-blue-600 text-[#ffffff]' : 'text-slate-400 hover:text-white'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Retours &amp; Incidents ({feedbacks.length} / {incidentsCount})
          </button>
        </div>

        <button
          onClick={loadSupport}
          className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {tab === 'tickets' && (
        <div className="space-y-4">
          {tickets.map((t) => (
            <div
              key={t.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 text-xs"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-display text-sm font-bold text-white">{t.subject}</span>
                    <span className="font-mono text-[11px] text-blue-400">{t.category}</span>
                    <span className="font-mono text-[11px] text-amber-400">{t.priority}</span>
                  </div>
                  <div className="text-slate-400 mt-0.5">
                    {t.name} ({t.email}) · {formatDateTimeFr(t.createdAt)}
                  </div>
                </div>
                <select
                  value={t.status}
                  onChange={(e) => handleStatus(t.id, e.target.value as SupportTicketStatus)}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none"
                >
                  <option value="open">Ouvert</option>
                  <option value="in_progress">En cours</option>
                  <option value="resolved">Résolu</option>
                  <option value="closed">Fermé</option>
                </select>
              </div>

              <p className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 leading-relaxed">
                {t.message}
              </p>

              {t.replies.length > 0 && (
                <div className="space-y-2 pl-3 border-l-2 border-blue-500/40">
                  {t.replies.map((r) => (
                    <div key={r.id} className="bg-slate-950/60 rounded-lg p-2.5">
                      <div className="text-[11px] text-slate-400 flex justify-between">
                        <span className="font-semibold text-blue-300">
                          {r.senderRole === 'admin' ? 'Super Admin' : r.senderEmail}
                        </span>
                        <span>{formatDateTimeFr(r.createdAt)}</span>
                      </div>
                      <p className="text-slate-200 mt-1">{r.message}</p>
                    </div>
                  ))}
                </div>
              )}

              {t.internalNotes.length > 0 && (
                <div className="space-y-1 bg-amber-950/20 border border-amber-500/25 rounded-xl p-3">
                  <div className="text-[10px] font-semibold uppercase text-amber-400">
                    Notes internes (privées)
                  </div>
                  {t.internalNotes.map((n) => (
                    <div key={n.id} className="text-[11px] text-amber-200">
                      • {n.note} <span className="text-slate-500">({formatDateTimeFr(n.createdAt)})</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={replyText[t.id] || ''}
                    onChange={(e) => setReplyText({ ...replyText, [t.id]: e.target.value })}
                    placeholder="Répondre à l’utilisateur..."
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none"
                  />
                  <button
                    onClick={() => handleReply(t.id)}
                    className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-[#ffffff] font-semibold"
                  >
                    Répondre
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={noteText[t.id] || ''}
                    onChange={(e) => setNoteText({ ...noteText, [t.id]: e.target.value })}
                    placeholder="Ajouter une note interne..."
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none"
                  />
                  <button
                    onClick={() => handleAddNote(t.id)}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold"
                  >
                    Noter
                  </button>
                </div>
              </div>
            </div>
          ))}
          {tickets.length === 0 && !loading && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-xs text-slate-500">
              Aucun ticket de support enregistré.
            </div>
          )}
        </div>
      )}

      {tab === 'quotes' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 uppercase">
                <tr>
                  <th className="py-3 px-4">Entreprise</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Flotte / Équipe</th>
                  <th className="py-3 px-4">Message</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {quotes.map((q) => (
                  <tr key={q.id} className="hover:bg-slate-800/30">
                    <td className="py-3 px-4 font-semibold text-white">{q.companyName}</td>
                    <td className="py-3 px-4">
                      <div>{q.contactName}</div>
                      <div className="font-mono text-[11px] text-slate-400">{q.email}</div>
                      {q.phone && <div className="text-[11px] text-slate-500">{q.phone}</div>}
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      Équipe : {q.teamSize} · Véhicules : {q.vehicleCount}
                      <div className="text-[11px] text-emerald-400">
                        {q.needsApi ? 'API V2X requise' : 'Standard'}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-300 max-w-xs">{q.message || '—'}</td>
                    <td className="py-3 px-4 tabular-nums text-slate-400">
                      {formatDateTimeFr(q.createdAt)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <select
                        value={q.status}
                        onChange={(e) => handleQuoteStatus(q.id, e.target.value as any)}
                        className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
                      >
                        <option value="new">Nouveau</option>
                        <option value="reviewed">Examiné</option>
                        <option value="approved">Approuvé</option>
                        <option value="closed">Clos</option>
                      </select>
                    </td>
                  </tr>
                ))}
                {quotes.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      Aucune demande de devis Business.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'feedback' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-bold text-white">
              Retours Firestore récents ({feedbacks.length})
            </h3>
            <span className="text-slate-400 tabular-nums">
              Incidents communautaires actifs : {incidentsCount}
            </span>
          </div>
          <div className="space-y-2">
            {feedbacks.map((f: any) => (
              <div
                key={f.id}
                className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex justify-between gap-3"
              >
                <div>
                  <div className="font-semibold text-white">
                    Note : {f.rating ?? '—'}/5 · VRU : {f.vruType || '—'}
                  </div>
                  <p className="text-slate-300 mt-0.5">{f.comment || 'Sans commentaire'}</p>
                </div>
                <span className="text-slate-500 font-mono text-[10px]">{f.userId}</span>
              </div>
            ))}
            {feedbacks.length === 0 && (
              <p className="text-slate-500 py-6 text-center">
                Aucun feedback Firestore remonté (ou collection vide).
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

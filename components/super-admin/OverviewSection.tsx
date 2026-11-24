import React from 'react';
import {
  Users,
  Activity,
  CreditCard,
  Ticket,
  Accessibility,
  Award,
  LifeBuoy,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import { SuperAdminOverviewResponse } from '../../services/SuperAdminService';
import { formatDateTimeFr } from './SuperAdminShared';

interface Props {
  data: SuperAdminOverviewResponse | null;
  loading: boolean;
  onNavigateSection: (section: string) => void;
}

export const OverviewSection: React.FC<Props> = ({ data, loading, onNavigateSection }) => {
  if (loading && !data) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 animate-pulse">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-28 rounded-2xl bg-slate-900 border border-slate-800" />
        ))}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-sm text-slate-400">
        Impossible de charger les indicateurs de la plateforme.
      </div>
    );
  }

  const { kpis, dailySeries, planDistribution, recentAuditLogs } = data;

  return (
    <div className="space-y-6">
      {/* KPI Row 1: Users, Presence, Subscriptions, Redeem */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 tabular-nums">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400">
            <span>Utilisateurs</span>
            <Users className="w-4 h-4 text-blue-400" />
          </div>
          <div className="font-display text-3xl font-bold text-white">{kpis.totalUsers}</div>
          <div className="text-xs text-slate-400 flex flex-wrap gap-x-3 gap-y-1">
            <span className="text-emerald-400">Actifs : {kpis.activeUsers}</span>
            <span>Aujourd’hui : +{kpis.newToday}</span>
            <span>7j : +{kpis.newThisWeek}</span>
          </div>
          {(kpis.bannedUsers > 0 || kpis.suspendedUsers > 0 || kpis.deletedUsers > 0) && (
            <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-800/80">
              Bannis : {kpis.bannedUsers} · Suspendus : {kpis.suspendedUsers} · Supprimés :{' '}
              {kpis.deletedUsers}
            </div>
          )}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400">
            <span>Présence temps réel</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="font-display text-3xl font-bold text-emerald-400">{kpis.onlineUsers}</div>
          <div className="text-xs text-slate-400 flex flex-wrap gap-x-3 gap-y-1">
            <span className="text-amber-400">Inactifs : {kpis.idleUsers}</span>
            <span>Hors ligne : {kpis.offlineUsers}</span>
          </div>
          <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-800/80">
            Calculé via heartbeat authentifié (20s)
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400">
            <span>Abonnements payants / actifs</span>
            <CreditCard className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="font-display text-3xl font-bold text-white">
            {kpis.activeSubscriptions}
          </div>
          <div className="text-xs text-slate-400 flex flex-wrap gap-x-2.5 gap-y-1">
            <span>Free : {kpis.freeUsers}</span>
            <span className="text-blue-400">Prem : {kpis.premiumUsers}</span>
            <span className="text-indigo-400">Fam : {kpis.familyUsers}</span>
            <span className="text-emerald-400">Biz : {kpis.businessUsers}</span>
          </div>
          <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-800/80">
            À vie : {kpis.lifetimeSubscriptions} · Expirés : {kpis.expiredSubscriptions} ·
            Suspendus : {kpis.suspendedSubscriptions}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400">
            <span>Codes Redeem</span>
            <Ticket className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="font-display text-3xl font-bold text-white">{kpis.totalCodes}</div>
          <div className="text-xs text-slate-400 flex flex-wrap gap-x-3 gap-y-1">
            <span className="text-emerald-400">Dispo : {kpis.availableCodes}</span>
            <span className="text-blue-400">Utilisés : {kpis.usedCodes}</span>
          </div>
          <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-800/80">
            Expirés : {kpis.expiredCodes} · Désactivés/Révoqués :{' '}
            {kpis.disabledCodes + kpis.revokedCodes}
          </div>
        </div>
      </section>

      {/* Action Queues Row */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 tabular-nums">
        <button
          onClick={() => onNavigateSection('accessibility')}
          className="text-left bg-slate-900 hover:bg-slate-800/70 border border-slate-800 hover:border-blue-500/40 rounded-2xl p-4 transition-colors flex items-center justify-between"
        >
          <div className="space-y-1">
            <div className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <Accessibility className="w-4 h-4 text-blue-400" />
              Dossiers Accessibilité en attente
            </div>
            <div className="font-display text-2xl font-bold text-white">
              {kpis.pendingAccessibility}
            </div>
          </div>
          <span className="text-xs font-semibold text-blue-400">Examiner →</span>
        </button>

        <button
          onClick={() => onNavigateSection('pioneer')}
          className="text-left bg-slate-900 hover:bg-slate-800/70 border border-slate-800 hover:border-amber-500/40 rounded-2xl p-4 transition-colors flex items-center justify-between"
        >
          <div className="space-y-1">
            <div className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-amber-400" />
              Membres Programme Pioneer
            </div>
            <div className="font-display text-2xl font-bold text-amber-400">
              {kpis.pioneerUsers}
            </div>
          </div>
          <span className="text-xs font-semibold text-amber-400">Gérer →</span>
        </button>

        <button
          onClick={() => onNavigateSection('support')}
          className="text-left bg-slate-900 hover:bg-slate-800/70 border border-slate-800 hover:border-emerald-500/40 rounded-2xl p-4 transition-colors flex items-center justify-between"
        >
          <div className="space-y-1">
            <div className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <LifeBuoy className="w-4 h-4 text-emerald-400" />
              Tickets Support &amp; Devis ouverts
            </div>
            <div className="font-display text-2xl font-bold text-white">
              {kpis.openSupportTickets + kpis.newBusinessQuotes}
            </div>
          </div>
          <span className="text-xs font-semibold text-emerald-400">Traiter →</span>
        </button>
      </section>

      {/* Interactive Recharts Analytics */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-8 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-sm font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-400" />
                Inscriptions &amp; Activations (14 derniers jours)
              </h2>
              <p className="text-xs text-slate-400">
                Données réelles calculées à partir des événements enregistrés.
              </p>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailySeries} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: 12,
                    fontSize: 12,
                    color: '#f8fafc',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="signups"
                  name="Nouveaux comptes"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.2}
                />
                <Area
                  type="monotone"
                  dataKey="activations"
                  name="Activations totales"
                  stroke="#10b981"
                  fill="#10b981"
                  fillOpacity={0.18}
                />
                <Area
                  type="monotone"
                  dataKey="redeemActivations"
                  name="Activations Redeem"
                  stroke="#f59e0b"
                  fill="#f59e0b"
                  fillOpacity={0.14}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="xl:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div>
            <h2 className="font-display text-sm font-bold text-white">
              Répartition des abonnements
            </h2>
            <p className="text-xs text-slate-400">Plans effectifs actifs actuellement.</p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={planDistribution} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: 12,
                    fontSize: 12,
                    color: '#f8fafc',
                  }}
                />
                <Bar dataKey="value" name="Comptes" radius={[8, 8, 0, 0]}>
                  {planDistribution.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Recent Audit Events */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-400" />
            <h2 className="font-display text-sm font-bold text-white">
              Journal d’activité récent
            </h2>
          </div>
          <button
            onClick={() => onNavigateSection('audit')}
            className="text-xs font-semibold text-blue-400 hover:text-blue-300"
          >
            Voir tout l’audit →
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 uppercase border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Horodatage</th>
                <th className="py-3 px-4">Acteur</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Détail</th>
                <th className="py-3 px-4 text-right">Résultat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {recentAuditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-800/30">
                  <td className="py-3 px-4 text-slate-400 tabular-nums whitespace-nowrap">
                    {formatDateTimeFr(log.timestamp)}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-300">{log.adminEmail}</td>
                  <td className="py-3 px-4 font-mono font-semibold text-blue-300">{log.action}</td>
                  <td className="py-3 px-4 text-slate-300">{log.detail}</td>
                  <td className="py-3 px-4 text-right">
                    <span
                      className={`font-semibold ${
                        log.outcome === 'success'
                          ? 'text-emerald-400'
                          : log.outcome === 'denied'
                          ? 'text-red-400'
                          : 'text-amber-400'
                      }`}
                    >
                      {log.outcome}
                    </span>
                  </td>
                </tr>
              ))}
              {recentAuditLogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    Aucun événement journalisé pour le moment.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

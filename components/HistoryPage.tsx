import React, { useState, useEffect } from 'react';
import { historyService, SessionRecord } from '../services/HistoryService';
import { User } from '../types';
import { useAuth } from '../AuthContext';
import { Lock, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { CriticalAlertRecord, notificationService } from '../services/NotificationService';

interface Props {
  user: User | null;
  onBack: () => void;
}

export const HistoryPage: React.FC<Props> = ({ user, onBack }) => {
  const { hasFeature, openUpgradeModal } = useAuth();
  const canViewHistory = hasFeature('safety_history');
  const [history, setHistory] = useState<SessionRecord[]>([]);
  const [criticalAlerts, setCriticalAlerts] = useState<CriticalAlertRecord[]>(() =>
    notificationService.getCriticalHistory()
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = notificationService.subscribe((snap) => {
      setCriticalAlerts(snap.criticalHistory);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!canViewHistory) {
      setLoading(false);
      return;
    }
    const fetchHistory = async () => {
      if (user) {
        setLoading(true);
        const data = await historyService.getHistory(user.id);
        setHistory(data);
        setLoading(false);
      }
    };
    fetchHistory();
  }, [user, canViewHistory]);

  if (!canViewHistory) {
    return (
      <div className="min-h-[100vh] flex flex-col items-center justify-center bg-slate-950 text-white p-6">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-5">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Lock size={26} />
          </div>
          <h2 className="text-xl font-bold text-white">Historique avancé réservé à Premium</h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            Cette fonctionnalité est disponible avec VruGuard Premium. Passez à Premium pour bénéficier du SOS, gérer vos contacts d&apos;urgence et profiter d&apos;une protection avancée.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={() => openUpgradeModal('safety_history')}
              className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-sm transition-colors"
            >
              Découvrir Premium
            </button>
            <button
              onClick={onBack}
              className="flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl text-sm transition-colors"
            >
              Retour
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100vh] bg-slate-950 text-white p-6 overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              SESSION HISTORY
            </h1>
            <p className="text-slate-400 mt-1">Archive of safety telemetry and quantum fusion analysis.</p>
          </div>
          <button 
            onClick={onBack}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            BACK TO DASHBOARD
          </button>
        </div>

        {/* Critical Security Alerts Log */}
        {criticalAlerts.length > 0 && (
          <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" />
                <div>
                  <h2 className="text-base font-bold text-white">
                    Journal des alertes de sécurité critiques
                  </h2>
                  <p className="text-xs text-slate-400">
                    Conservées automatiquement même après acquittement.
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono tabular-nums text-slate-400">
                {criticalAlerts.length} alerte(s)
              </span>
            </div>

            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {criticalAlerts.map((alert) => (
                <div
                  key={`${alert.id}-${alert.createdAt}`}
                  className="rounded-xl border border-slate-800 bg-slate-950/80 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[11px] font-semibold text-red-400 mb-0.5">
                      <span>{alert.category}</span>
                      <span aria-hidden="true" className="text-slate-600">·</span>
                      <span className="font-mono tabular-nums text-slate-400 font-normal">
                        {new Date(alert.createdAt).toLocaleString('fr-FR')}
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-white">{alert.title}</div>
                    {alert.description && (
                      <div className="text-xs text-slate-400 mt-0.5">{alert.description}</div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {alert.consultedAt ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Consultée
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => notificationService.markHistoryConsulted(alert.id, alert.createdAt)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors"
                      >
                        Marquer consultée
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* List */}
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-20 bg-slate-900/50 rounded-2xl border border-slate-800">
              <svg className="animate-spin h-8 w-8 text-blue-500 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <h3 className="text-xl font-bold text-slate-300">Loading History...</h3>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-20 bg-slate-900/50 rounded-2xl border border-slate-800">
              <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-600">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
              </div>
              <h3 className="text-xl font-bold text-slate-300">No History Found</h3>
              <p className="text-slate-500 mt-2">Complete a simulation session to generate telemetry records.</p>
            </div>
          ) : (
            history.map((session) => (
              <div key={session.id} className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-blue-500/30 transition-colors">
                <div className="flex flex-col md:flex-row justify-between gap-6">
                  
                  {/* Left: Meta */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="px-2 py-1 bg-blue-500/10 text-blue-400 text-xs font-bold rounded uppercase">
                        {session.context.environment.replace('_', ' ')}
                      </span>
                      <span className="text-slate-500 text-sm font-mono">
                        {new Date(session.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-white mb-1">
                      {session.user.name} <span className="text-slate-500 font-normal">({session.user.organization})</span>
                    </h3>
                    <div className="text-sm text-slate-400 flex gap-4 mt-2">
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                        {session.context.time}
                      </span>
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>
                        {session.context.weather}
                      </span>
                    </div>
                  </div>

                  {/* Right: Metrics */}
                  <div className="flex gap-4 md:gap-8 border-t md:border-t-0 md:border-l border-slate-800 pt-4 md:pt-0 md:pl-8">
                    <div>
                      <div className="text-xs text-slate-500 uppercase mb-1">Avg Error</div>
                      <div className="text-2xl font-mono font-bold text-white">{session.metrics.avgError.toFixed(2)}m</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 uppercase mb-1">Warnings</div>
                      <div className={`text-2xl font-mono font-bold ${session.metrics.collisionWarnings > 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {session.metrics.collisionWarnings}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 uppercase mb-1">Duration</div>
                      <div className="text-2xl font-mono font-bold text-white">
                        {Math.floor(session.duration / 60)}m {session.duration % 60}s
                      </div>
                    </div>
                  </div>

                </div>
                
                {session.summary && (
                  <div className="mt-4 pt-4 border-t border-slate-800/50">
                    <p className="text-sm text-slate-400 italic">"{session.summary}"</p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

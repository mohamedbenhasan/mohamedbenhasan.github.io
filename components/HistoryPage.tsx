import React, { useState, useEffect } from 'react';
import { historyService, SessionRecord } from '../services/HistoryService';
import { User } from '../types';

interface Props {
  user: User | null;
  onBack: () => void;
}

export const HistoryPage: React.FC<Props> = ({ user, onBack }) => {
  const [history, setHistory] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      if (user) {
        setLoading(true);
        const data = await historyService.getHistory(user.id);
        setHistory(data);
        setLoading(false);
      }
    };
    fetchHistory();
  }, [user]);

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 overflow-y-auto">
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

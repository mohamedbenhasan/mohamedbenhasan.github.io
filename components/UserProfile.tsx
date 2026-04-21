import React, { useEffect, useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { User } from '../types';
import { historyService, SessionRecord } from '../services/HistoryService';

interface Props {
  user: User | null;
  onBack: () => void;
  onTrustedContacts?: () => void;
}

export const UserProfile: React.FC<Props> = ({ user, onBack, onTrustedContacts }) => {
  const [history, setHistory] = useState<SessionRecord[]>([]);
  const [stats, setStats] = useState({
    totalSessions: 0,
    totalDuration: 0,
    avgRisk: 0
  });

  useEffect(() => {
    const fetchHistory = async () => {
      if (!user) return;
      try {
        const data = await historyService.getHistory(user.id);
        setHistory(data);

        if (data.length > 0) {
          const totalTime = data.reduce((acc, curr) => acc + curr.duration, 0);
          const totalWarnings = data.reduce((acc, curr) => acc + curr.metrics.collisionWarnings, 0);
          
          setStats({
            totalSessions: data.length,
            totalDuration: totalTime,
            avgRisk: totalWarnings / data.length
          });
        }
      } catch (error) {
        console.error("Failed to fetch history:", error);
      }
    };

    fetchHistory();
  }, [user?.id]);

  if (!user) return null;

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const exportCSV = () => {
    if (history.length === 0) return;

    const headers = ['Session ID', 'Date', 'Duration (s)', 'Environment', 'Weather', 'Time of Day', 'Avg Error (m)', 'Warnings', 'Quantum Fusion'];
    const rows = history.map(s => [
      s.id,
      new Date(s.timestamp).toISOString(),
      s.duration.toFixed(1),
      s.context.environment,
      s.context.weather,
      s.context.time,
      s.metrics.avgError.toFixed(4),
      s.metrics.collisionWarnings,
      s.metrics.quantumFusionActive ? 'Yes' : 'No'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `user_history_${user.id}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportPDF = () => {
    if (history.length === 0) return;

    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(18);
    doc.text('User Activity Report', 14, 22);
    
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`User: ${user.name} (${user.email})`, 14, 30);
    doc.text(`Organization: ${user.organization}`, 14, 36);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 42);

    // Stats Summary
    doc.text('Summary Statistics:', 14, 52);
    doc.text(`Total Sessions: ${stats.totalSessions}`, 14, 58);
    doc.text(`Total Duration: ${formatDuration(stats.totalDuration)}`, 14, 64);
    doc.text(`Avg Risk Events: ${stats.avgRisk.toFixed(2)}`, 14, 70);

    // Table
    const tableData = history.map(s => [
      new Date(s.timestamp).toLocaleDateString(),
      s.context.environment,
      `${s.duration.toFixed(0)}s`,
      s.metrics.collisionWarnings,
      s.metrics.avgError.toFixed(3)
    ]);

    autoTable(doc, {
      startY: 75,
      head: [['Date', 'Environment', 'Duration', 'Warnings', 'RMSE (m)']],
      body: tableData,
    });

    doc.save(`user_report_${user.id}.pdf`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button 
            onClick={onBack}
            className="mb-4 text-slate-400 hover:text-white flex items-center gap-2 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold">User Profile</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Profile Card */}
          <div className="md:col-span-1 space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center">
              <div className="w-24 h-24 bg-blue-600 rounded-full flex items-center justify-center text-4xl font-bold text-white mx-auto mb-4 shadow-lg shadow-blue-900/20">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <h2 className="text-xl font-bold text-white">{user.name}</h2>
              <p className="text-slate-400 text-sm mb-4">{user.email}</p>
              
              <div className="flex justify-center gap-2 mb-6">
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${user.role === 'ADMIN' ? 'bg-purple-900/30 text-purple-400 border-purple-500/30' : 'bg-blue-900/30 text-blue-400 border-blue-500/30'}`}>
                  {user.role}
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700">
                  {user.organization}
                </span>
              </div>

              <div className="border-t border-slate-800 pt-6 text-left space-y-3">
                <div>
                  <label className="text-xs text-slate-500 uppercase font-bold">User ID</label>
                  <div className="font-mono text-xs text-slate-300 truncate">{user.id}</div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 uppercase font-bold">Access Level</label>
                  <div className="text-sm text-slate-300">{user.role === 'ADMIN' ? 'Full System Control' : 'Standard Operations'}</div>
                </div>
              </div>

              <div className="border-t border-slate-800 pt-6 mt-6">
                <button 
                  onClick={onTrustedContacts}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-white font-medium py-3 rounded-xl border border-slate-700 flex items-center justify-center gap-2 transition-colors"
                >
                  <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                  Manage Trusted Contacts
                </button>
              </div>
            </div>
          </div>

          {/* Stats & Activity */}
          <div className="md:col-span-2 space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl">
                <div className="text-slate-500 text-xs font-bold uppercase mb-1">Total Sessions</div>
                <div className="text-2xl font-mono font-bold text-white">{stats.totalSessions}</div>
              </div>
              <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl">
                <div className="text-slate-500 text-xs font-bold uppercase mb-1">Total Flight Time</div>
                <div className="text-2xl font-mono font-bold text-white">{formatDuration(stats.totalDuration)}</div>
              </div>
              <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl">
                <div className="text-slate-500 text-xs font-bold uppercase mb-1">Avg Risk Events</div>
                <div className={`text-2xl font-mono font-bold ${stats.avgRisk > 2 ? 'text-red-400' : 'text-green-400'}`}>
                  {stats.avgRisk.toFixed(1)}
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                <h3 className="font-bold text-white">Recent Activity</h3>
                <div className="flex gap-2">
                   <button onClick={exportCSV} disabled={history.length === 0} className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1 rounded border border-slate-700 transition-colors disabled:opacity-50">
                     CSV
                   </button>
                   <button onClick={exportPDF} disabled={history.length === 0} className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1 rounded border border-slate-700 transition-colors disabled:opacity-50">
                     PDF
                   </button>
                </div>
              </div>
              <div className="divide-y divide-slate-800">
                {history.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-sm">No activity recorded yet.</div>
                ) : (
                  history.slice(0, 5).map((session) => (
                    <div key={session.id} className="p-4 hover:bg-slate-800/50 transition-colors flex justify-between items-center">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-bold text-slate-200">
                            {session.context.environment.replace('_', ' ')} Simulation
                          </span>
                          <span className="text-xs text-slate-500 font-mono">
                            {new Date(session.timestamp).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 flex gap-3">
                          <span>{Math.floor(session.duration / 60)}m {Math.floor(session.duration % 60)}s</span>
                          <span>•</span>
                          <span>{session.metrics.collisionWarnings} Warnings</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-mono text-slate-500">RMSE</div>
                        <div className="text-sm font-mono text-blue-400">{session.metrics.avgError.toFixed(2)}m</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { X, Filter, RefreshCw, Trash2 } from 'lucide-react';
import { DENMMessage, DENMEventType, RiskLevel } from '../types';
import { V2XService } from '../services/V2XService';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, getDocs, deleteDoc, doc } from 'firebase/firestore';

interface Props {
  onClose: () => void;
}

export const V2XConsoleModal: React.FC<Props> = ({ onClose }) => {
  const [messages, setMessages] = useState<DENMMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterRisk, setFilterRisk] = useState<string>('ALL');

  useEffect(() => {
    const q = query(collection(db, 'denm_events'), orderBy('timestamp', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as DENMMessage));
      setMessages(msgs);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching DENM events:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleCleanup = async () => {
    await V2XService.cleanupExpiredMessages();
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'denm_events', id));
    } catch (error) {
      console.error("Error deleting message:", error);
    }
  };

  const filteredMessages = messages.filter(msg => {
    if (filterType !== 'ALL' && msg.eventType !== filterType) return false;
    if (filterRisk !== 'ALL' && msg.riskLevel !== filterRisk) return false;
    return true;
  });

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-6xl h-[80vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-950/50">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <span className="text-indigo-500">📡</span> V2X Developer Console
            </h2>
            <p className="text-slate-400 text-sm mt-1">Monitor and manage Decentralized Environmental Notification Messages (DENM)</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors bg-slate-800 hover:bg-slate-700 p-2 rounded-full">
            <X size={24} />
          </button>
        </div>

        {/* Filters & Actions */}
        <div className="p-4 border-b border-slate-800 bg-slate-900 flex flex-wrap gap-4 items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-slate-400" />
              <select 
                value={filterType} 
                onChange={(e) => setFilterType(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2"
              >
                <option value="ALL">All Event Types</option>
                {Object.values(DENMEventType).map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            
            <div className="flex items-center gap-2">
              <select 
                value={filterRisk} 
                onChange={(e) => setFilterRisk(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2"
              >
                <option value="ALL">All Risk Levels</option>
                {Object.values(RiskLevel).map(level => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </div>
          </div>

          <button 
            onClick={handleCleanup}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm transition-colors border border-slate-700"
          >
            <RefreshCw size={16} /> Cleanup Expired
          </button>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-full text-slate-400">Loading messages...</div>
          ) : filteredMessages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-slate-500">No DENM messages found matching criteria.</div>
          ) : (
            <table className="w-full text-sm text-left text-slate-300">
              <thead className="text-xs text-slate-400 uppercase bg-slate-800/50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 rounded-tl-lg">Time</th>
                  <th className="px-4 py-3">Event Type</th>
                  <th className="px-4 py-3">Risk Level</th>
                  <th className="px-4 py-3">Location (Lat, Lng)</th>
                  <th className="px-4 py-3">Sender ID</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 rounded-tr-lg text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMessages.map((msg) => {
                  const isExpired = msg.expiresAt < Date.now();
                  return (
                    <tr key={msg.id} className="border-b border-slate-800 hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs">{new Date(msg.timestamp).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className="bg-slate-800 px-2 py-1 rounded text-xs border border-slate-700">{msg.eventType}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          msg.riskLevel === 'CRITICAL' ? 'bg-red-900/50 text-red-400 border border-red-500/30' : 
                          msg.riskLevel === 'HIGH' ? 'bg-orange-900/50 text-orange-400 border border-orange-500/30' : 
                          'bg-yellow-900/50 text-yellow-400 border border-yellow-500/30'
                        }`}>
                          {msg.riskLevel}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {msg.location.lat.toFixed(4)}, {msg.location.lng.toFixed(4)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500" title={msg.senderId}>
                        {msg.senderId.substring(0, 8)}...
                      </td>
                      <td className="px-4 py-3">
                        {isExpired ? (
                          <span className="text-slate-500 text-xs flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-500"></span> Expired</span>
                        ) : (
                          <span className="text-green-400 text-xs flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Active</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button 
                          onClick={() => handleDelete(msg.id)}
                          className="text-slate-500 hover:text-red-400 transition-colors p-1"
                          title="Delete Record"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

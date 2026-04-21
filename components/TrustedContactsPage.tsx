import React, { useState, useEffect } from 'react';
import { User, Shield, Search, UserPlus, Check, X, Users, AlertTriangle } from 'lucide-react';
import { trustService, TrustedConnection } from '../services/TrustService';
import { auth } from '../firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile } from '../services/conversationsService';
import { toast } from 'sonner';

interface Props {
  onClose?: () => void;
}

export const TrustedContactsPage: React.FC<Props> = ({ onClose }) => {
  const [connections, setConnections] = useState<TrustedConnection[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const myUid = auth.currentUser?.uid;

  useEffect(() => {
    if (!myUid) return;
    const unsub = trustService.subscribeToMyConnections((conns) => {
      setConnections(conns);
    });
    return () => unsub();
  }, [myUid]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !myUid) return;
    
    setIsSearching(true);
    try {
      // Simplified search (Firestore string matching is limited without trigrams, but equality works)
      // Usually you'd use a service like Algolia, but here we just try to match displayName or email
      const q1 = query(collection(db, 'public_profiles'), where('displayName', '==', searchQuery.trim()), limit(5));
      const q2 = query(collection(db, 'public_profiles'), where('email', '==', searchQuery.trim()), limit(5));
      
      const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
      
      const resultsMap = new Map<string, any>();
      snap1.forEach(d => { if (d.data().uid !== myUid) resultsMap.set(d.id, d.data()) });
      snap2.forEach(d => { if (d.data().uid !== myUid) resultsMap.set(d.id, d.data()) });
      
      setSearchResults(Array.from(resultsMap.values()));
    } catch(err) {
      toast.error("Failed to search users.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleAdd = async (targetUid: string) => {
    try {
      await trustService.sendRequest(targetUid);
      toast.success("Request sent!");
      setSearchResults(prev => prev.filter(u => u.uid !== targetUid)); // remove from search results
    } catch (e: any) {
      toast.error(e.message || "Failed to send request.");
    }
  };

  const pendingIncoming = connections.filter(c => c.status === 'pending' && c.initiatorId !== myUid);
  const pendingOutgoing = connections.filter(c => c.status === 'pending' && c.initiatorId === myUid);
  const accepted = connections.filter(c => c.status === 'accepted');

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-200">
      <div className="p-6 border-b border-slate-800 bg-slate-900 flex justify-between items-center shrink-0">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <Shield className="w-6 h-6 text-indigo-400" />
            Trusted Contacts
          </h2>
          <p className="text-sm text-slate-400 mt-1">Manage users who can see your exact location during an SOS.</p>
        </div>
        {onClose && (
           <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors">
             <X className="w-5 h-5" />
           </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 max-w-4xl mx-auto w-full space-y-8">
        
        {/* Search Section */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <UserPlus size={18} className="text-blue-400" />
            Add Trusted Contact
          </h3>
          <form onSubmit={handleSearch} className="flex gap-2 mb-4">
            <input 
              type="text" 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by exact Name or Email..."
              className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
            <button 
              type="submit" 
              disabled={isSearching}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {isSearching ? <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></div> : <Search size={16} />}
              Search
            </button>
          </form>

          {searchResults.length > 0 && (
            <div className="space-y-2 mt-4">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Results</h4>
              {searchResults.map(u => (
                <div key={u.uid} className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center">
                      <User size={16} className="text-slate-400" />
                    </div>
                    <div>
                      <div className="font-medium text-sm text-slate-200">{u.displayName}</div>
                      <div className="text-xs text-slate-500">{u.email}</div>
                    </div>
                  </div>
                  {connections.some(c => c.userA === u.uid || c.userB === u.uid) ? (
                    <span className="text-xs text-slate-500 bg-slate-900 px-2 py-1 rounded">Already added</span>
                  ) : (
                    <button onClick={() => handleAdd(u.uid)} className="text-xs bg-slate-800 hover:bg-slate-700 text-indigo-400 px-3 py-1.5 rounded transition-colors">
                      Send Request
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Active Contacts */}
          <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col">
            <h3 className="font-semibold text-lg mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-green-400" />
                Active Contacts
              </div>
              <span className="text-xs bg-slate-800 border border-slate-700 px-2 py-1 rounded-full text-slate-400">
                {accepted.length}/10
              </span>
            </h3>
            
            <div className="flex-1 space-y-2">
              {accepted.length === 0 ? (
                <div className="text-center text-slate-500 p-8 flex flex-col items-center">
                  <Shield className="w-10 h-10 mb-2 opacity-20" />
                  <p className="text-sm">No trusted contacts yet.</p>
                  <p className="text-xs mt-1">Add friends or family to see your SOS.</p>
                </div>
              ) : (
                accepted.map(c => (
                  <div key={c.id} className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-lg group">
                    <div className="flex items-center gap-3">
                       <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center relative">
                        <User size={16} className="text-slate-400" />
                        {c.otherUser?.isOnline && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-slate-950 rounded-full"></span>}
                      </div>
                      <div>
                        <div className="font-medium text-sm text-slate-200">{c.otherUser?.displayName || 'Unknown User'}</div>
                      </div>
                    </div>
                    <button 
                      onClick={() => trustService.removeConnection(c.id)}
                      className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 p-1.5 rounded bg-slate-900 transition-all"
                      title="Remove contact"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
            
            {accepted.length > 0 && (
               <div className="mt-4 p-3 bg-amber-900/10 border border-amber-500/20 rounded-lg flex gap-3 items-start">
                 <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                 <p className="text-xs text-amber-500/80 leading-relaxed">
                   Active contacts will receive immediate notifications and your exact GPS coordinates when you trigger an SOS.
                 </p>
               </div>
            )}
          </section>

          {/* Pending Requests */}
          <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col gap-6">
            
            {/* Incoming */}
            <div>
              <h3 className="font-semibold text-[15px] mb-3 flex items-center justify-between text-slate-300">
                Incoming Requests
                {pendingIncoming.length > 0 && <span className="bg-indigo-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">{pendingIncoming.length}</span>}
              </h3>
              <div className="space-y-2">
                {pendingIncoming.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No incoming requests.</p>
                ) : (
                  pendingIncoming.map(c => (
                    <div key={c.id} className="flex flex-col p-3 bg-slate-950 border border-slate-800 rounded-lg gap-3">
                       <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center">
                           <User size={16} className="text-slate-400" />
                         </div>
                         <div className="font-medium text-sm text-slate-200">{c.otherUser?.displayName || 'Unknown User'}</div>
                       </div>
                       <div className="flex gap-2">
                         <button 
                           onClick={() => trustService.acceptRequest(c.id)}
                           className="flex-1 bg-green-900/30 hover:bg-green-900/50 text-green-400 border border-green-500/30 py-1.5 rounded transition-colors text-xs flex justify-center items-center gap-1"
                         >
                           <Check size={14} /> Accept
                         </button>
                         <button 
                           onClick={() => trustService.removeConnection(c.id)}
                           className="flex-1 bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-500/30 py-1.5 rounded transition-colors text-xs flex justify-center items-center gap-1"
                         >
                           <X size={14} /> Decline
                         </button>
                       </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Outgoing */}
            <div>
              <h3 className="font-semibold text-[15px] mb-3 text-slate-300">
                Pending Sent
              </h3>
              <div className="space-y-2">
                {pendingOutgoing.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No pending outgoing requests.</p>
                ) : (
                  pendingOutgoing.map(c => (
                    <div key={c.id} className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-lg">
                       <div className="flex items-center gap-3">
                         <div className="font-medium text-sm text-slate-400">{c.otherUser?.displayName || 'Unknown User'}</div>
                       </div>
                       <button 
                         onClick={() => trustService.removeConnection(c.id)}
                         className="text-[10px] text-slate-500 hover:text-red-400 bg-slate-900 px-2 py-1 rounded"
                       >
                         Cancel
                       </button>
                    </div>
                  ))
                )}
              </div>
            </div>

          </section>
        </div>
      </div>
    </div>
  );
};

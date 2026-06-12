import React, { useState, useEffect } from 'react';
import { ArrowLeft, Star, MessageSquare } from 'lucide-react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { ExitFeedback } from '../services/AppFeedbackService';

export const AdminFeedbackDashboard: React.FC<{onBack: () => void}> = ({onBack}) => {
  const [feedbacks, setFeedbacks] = useState<(ExitFeedback & {id: string, createdAt: any})[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'app_feedback'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
       const results: any[] = [];
       snapshot.forEach(doc => {
          results.push({ id: doc.id, ...doc.data() });
       });
       setFeedbacks(results);
       setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const totalReviews = feedbacks.length;
  const avgRating = totalReviews > 0 ? (feedbacks.reduce((acc, f) => acc + f.rating, 0) / totalReviews).toFixed(1) : '0';
  
  // Stats by tag
  const tagCounts: Record<string, number> = {};
  const vruTypeCounts: Record<string, number> = {};

  feedbacks.forEach(f => {
    // Top Tags
    if (f.categoryTags) {
       f.categoryTags.forEach(tag => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
       });
    }

    // VRU Type Breakdown
    const vruType = f.metadata?.vruType || 'UNKNOWN';
    vruTypeCounts[vruType] = (vruTypeCounts[vruType] || 0) + 1;
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100 overflow-y-auto">
      <div className="h-16 border-b border-slate-800 flex items-center px-4 md:px-6 justify-between bg-slate-900/50 backdrop-blur shrink-0 sticky top-0 z-[2000]">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white">
             <ArrowLeft size={20} />
          </button>
          <h2 className="text-xl font-bold font-sans">Administration des Évaluations</h2>
        </div>
      </div>
      
      <div className="p-6 max-w-6xl mx-auto w-full space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
           {/* Stat Cards */}
           <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-2">
              <span className="text-sm font-bold text-slate-400 uppercase">Total Évaluations</span>
              <span className="text-4xl font-bold text-white">{totalReviews}</span>
           </div>
           
           <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-2">
              <span className="text-sm font-bold text-slate-400 uppercase">Note Moyenne</span>
              <div className="flex items-center gap-2">
                 <span className="text-4xl font-bold text-yellow-400">{avgRating}</span>
                 <Star className="text-yellow-400 fill-yellow-400" size={24} />
              </div>
           </div>

           <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-2">
              <span className="text-sm font-bold text-slate-400 uppercase">Par Mode (VRU)</span>
              <div className="flex flex-wrap gap-1 mt-1">
                 {Object.entries(vruTypeCounts).sort((a,b) => b[1]-a[1]).map(([type, count]) => (
                   <span key={type} className="text-[10px] px-2 py-1 bg-blue-900/20 text-blue-300 border border-blue-900/50 rounded">
                     {type}: {Math.round((count / Math.max(1, totalReviews)) * 100)}%
                   </span>
                 ))}
                 {Object.keys(vruTypeCounts).length === 0 && <span className="text-xs text-slate-500">N/A</span>}
              </div>
           </div>

           <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-2">
              <span className="text-sm font-bold text-slate-400 uppercase">Tags les plus fréquents</span>
              <div className="flex flex-wrap gap-1 mt-1">
                 {Object.entries(tagCounts).sort((a,b) => b[1]-a[1]).slice(0,3).map(([tag, count]) => (
                   <span key={tag} className="text-[10px] px-2 py-1 bg-slate-800 rounded text-slate-300 border border-slate-700">
                     {tag} ({count})
                   </span>
                 ))}
                 {Object.keys(tagCounts).length === 0 && <span className="text-xs text-slate-500">Aucun tag utilisé</span>}
              </div>
           </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 bg-slate-900/50">
             <h3 className="font-bold flex items-center gap-2 text-slate-200">
               <MessageSquare size={18} className="text-blue-400" /> Historique des retours
             </h3>
          </div>
          
          <div className="divide-y divide-slate-800/50">
             {loading ? (
                <div className="p-8 text-center text-slate-500 text-sm">Chargement...</div>
             ) : feedbacks.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-sm">Aucune évaluation pour le moment.</div>
             ) : (
                feedbacks.map(f => (
                  <div key={f.id} className="p-4 hover:bg-slate-800/20 transition-colors">
                     <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1 bg-yellow-500/10 border border-yellow-500/20 px-2 py-1 rounded text-xs font-bold text-yellow-400">
                             {f.rating} <Star size={12} className="fill-yellow-400 hover:fill-yellow-400"/>
                          </div>
                          <span className="text-xs text-slate-500">
                            {f.createdAt?.seconds ? new Date(f.createdAt.seconds * 1000).toLocaleString() : 'Récemment'}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-600">
                          {f.metadata?.vruType || 'UNKNOWN'} | v{f.metadata?.appVersion || 'N/A'}
                        </span>
                     </div>
                     
                     {f.comment && (
                        <p className="text-sm text-slate-300 mt-2 whitespace-pre-wrap">{f.comment}</p>
                     )}
                     
                     {f.categoryTags && f.categoryTags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-3">
                           {f.categoryTags.map((tag: string) => (
                              <span key={tag} className="text-[9px] uppercase px-1.5 py-0.5 bg-blue-900/20 text-blue-300 rounded border border-blue-900/30">
                                {tag}
                              </span>
                           ))}
                        </div>
                     )}
                  </div>
                ))
             )}
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Send, Link, Loader2, ShieldAlert } from 'lucide-react';
import { liveTrackingService, LiveTrackingSession } from '../services/LiveTrackingService';

interface Props {
  onClose: () => void;
}

export const ShareLocationModal: React.FC<Props> = ({ onClose }) => {
  const [session, setSession] = useState<LiveTrackingSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState<string>('');

  useEffect(() => {
    loadSession();
  }, []);

  const loadSession = async () => {
    setLoading(true);
    const active = await liveTrackingService.getMyActiveSession();
    if (active) {
      setSession(active);
      const baseUrl = window.location.origin;
      setShareUrl(`${baseUrl}/?live_track=${active.id}&t=${active.token}`);
    } else {
      setSession(null);
    }
    setLoading(false);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const url = await liveTrackingService.createSession(2); // 2 hours duration
      setShareUrl(url);
      await loadSession();
    } catch (e) {
      console.error(e);
    } finally {
      setGenerating(false);
    }
  };

  const handleStop = async () => {
    await liveTrackingService.stopSession();
    await loadSession();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEmailShare = () => {
    const subject = encodeURIComponent("Suis mon trajet en direct");
    const body = encodeURIComponent(`Salut ! Tu peux suivre ma position en temps réel pendant mon trajet via ce lien sécurisé :\n\n${shareUrl}`);
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100000] flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <Link className="w-5 h-5 text-blue-400" />
            <h2 className="text-xl font-bold text-white">Partage Temps Réel</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex justify-center py-8">
               <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
          ) : session ? (
            <div className="space-y-6">
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-start gap-3">
                 <ShieldAlert className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                 <div>
                   <h3 className="text-sm font-bold text-blue-400 mb-1">Partage Actif</h3>
                   <p className="text-xs text-slate-300">
                     Votre position est actuellement visible via le lien généré. Le partage expirera automatiquement le {new Date(session.expiresAt).toLocaleTimeString()}.
                   </p>
                 </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">Lien Sécurisé</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    readOnly 
                    value={shareUrl}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 outline-none"
                  />
                  <button 
                    onClick={handleCopy}
                    className="px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors flex items-center justify-center"
                  >
                    {copied ? <Check size={18} className="text-green-400" /> : <Copy size={18} />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                 <button 
                   onClick={handleEmailShare}
                   className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl transition-colors"
                 >
                   <Send className="w-4 h-4" /> Envoyer (Email)
                 </button>
                 <button 
                   onClick={handleStop}
                   className="w-full flex items-center justify-center gap-2 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-medium rounded-xl border border-red-500/30 transition-colors"
                 >
                   <X className="w-4 h-4" /> Arrêter le partage
                 </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
               <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                 <Link className="w-8 h-8 text-blue-500" />
               </div>
               <h3 className="text-lg font-bold text-white mb-2">Générer un lien de partage</h3>
               <p className="text-sm text-slate-400 mb-8 max-w-sm mx-auto">
                 Permettez à vos proches ou à l'équipe de supervision de suivre votre GPS en temps réel pendant les 2 prochaines heures.
               </p>
               <button 
                 onClick={handleGenerate}
                 disabled={generating}
                 className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2"
               >
                 {generating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Link className="w-5 h-5" />}
                 Générer le lien sécurisé
               </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

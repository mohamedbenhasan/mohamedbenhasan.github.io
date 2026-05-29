import React, { useState, useEffect } from 'react';
import { Shield, ArrowLeft, Plus, UserPlus, X, MapPin, AlertTriangle, Clock, RefreshCw, Smartphone } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { parentalService, ParentalLink } from '../services/ParentalService';
import { useAuth } from '../AuthContext';
import { LiveLocation, AlertEvent } from '../types';

interface Props {
  onBack: () => void;
}

const MapController: React.FC<{ lat: number, lng: number }> = ({ lat, lng }) => {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], 16, { animate: true });
  }, [lat, lng, map]);
  return null;
};

// Marker icon
const createCycleIcon = () => {
  return L.divIcon({
    html: `
      <div class="relative w-12 h-12 flex items-center justify-center">
        <div class="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-30"></div>
        <div class="relative w-8 h-8 bg-blue-600 rounded-full border-2 border-white shadow-lg flex items-center justify-center">
          <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
      </div>
    `,
    className: '',
    iconSize: [48, 48],
    iconAnchor: [24, 24]
  });
};

export const ParentalTrackingPage: React.FC<Props> = ({ onBack }) => {
  const { user } = useAuth();
  const [links, setLinks] = useState<ParentalLink[]>([]);
  const [activeLinkId, setActiveLinkId] = useState<string | null>(null);
  const [childLocation, setChildLocation] = useState<LiveLocation | null>(null);
  const [childAlerts, setChildAlerts] = useState<AlertEvent[]>([]);
  
  // Create / Join UI
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinName, setJoinName] = useState('');
  const [joinError, setJoinError] = useState('');

  useEffect(() => {
    const unsub = parentalService.subscribeToMyChildren((newLinks) => {
      setLinks(newLinks);
      // Auto-select first active link if none selected
      if (!activeLinkId && newLinks.length > 0) {
        const active = newLinks.find(l => l.status === 'active');
        if (active) setActiveLinkId(active.id);
      }
    });
    return () => unsub();
  }, [activeLinkId]);

  useEffect(() => {
    let unsub = () => {};
    if (activeLinkId) {
      const activeLink = links.find(l => l.id === activeLinkId);
      if (activeLink && activeLink.childId && activeLink.status === 'active') {
        unsub = parentalService.subscribeToChildTelemetry(
          activeLink.childId,
          (loc) => setChildLocation(loc),
          (alerts) => {
            // keep max 20 alerts
            setChildAlerts(alerts.slice(0, 20));
          }
        );
      } else {
        setChildLocation(null);
        setChildAlerts([]);
      }
    }
    return () => unsub();
  }, [activeLinkId, links]);

  const handleGenerateCode = async () => {
    const code = await parentalService.createInviteLink();
    setInviteCode(code);
    setActiveLinkId(code);
  };

  const handleJoin = async () => {
    setJoinError('');
    try {
      await parentalService.joinFamilyCode(joinCode, joinName);
      setShowJoinModal(false);
      setJoinCode('');
      setJoinName('');
    } catch (e: any) {
      setJoinError(e.message);
    }
  };

  const activeLink = links.find(l => l.id === activeLinkId);

  const formatAgo = (timestamp: any) => {
    if (!timestamp) return '';
    const timeMs = typeof timestamp.toMillis === 'function' ? timestamp.toMillis() : (typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime());
    if (isNaN(timeMs)) return '';
    const s = Math.floor((Date.now() - timeMs) / 1000);
    if (s < 60) return `il y a ${s} sec`;
    if (s < 3600) return `il y a ${Math.floor(s/60)} min`;
    return `il y a ${Math.floor(s/3600)} h`;
  };

  return (
    <div className="min-h-[100vh] w-full bg-slate-950 flex flex-col font-sans">
      {/* Header */}
      <div className="h-16 border-b border-slate-800 bg-slate-900/80 backdrop-blur flex items-center px-4 md:px-6 shrink-0 z-20 justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
             <Shield className="w-5 h-5 text-indigo-400" />
             <span className="font-bold text-white text-lg hidden sm:block">Contrôle Parental</span>
             <span className="font-bold text-white text-lg sm:hidden">Parental</span>
          </div>
        </div>
        <div className="flex gap-2">
           <button 
             onClick={() => setShowJoinModal(true)}
             className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-lg text-indigo-300 transition-colors flex items-center gap-2"
           >
             <UserPlus className="w-4 h-4" /> <span className="hidden sm:inline">Rattacher Enfant</span>
           </button>
           <button 
             onClick={() => {
               setShowInviteModal(true);
               handleGenerateCode();
             }}
             className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold rounded-lg text-white transition-colors flex items-center gap-2"
           >
             <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Nouveau Suivi</span>
           </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative flex-col md:flex-row">
        
        {/* Sidebar / List (Desktop) */}
        <div className="hidden md:flex w-80 bg-slate-900 border-r border-slate-800 flex-col shrink-0 z-10 h-full">
          <div className="p-4 border-b border-slate-800 bg-slate-900/50">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Enfants Suivis</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {links.length === 0 ? (
              <div className="text-center py-8">
                 <Shield className="w-8 h-8 text-slate-700 mx-auto mb-3" />
                 <p className="text-sm text-slate-400">Aucun suivi actif.</p>
                 <button onClick={() => { setShowInviteModal(true); handleGenerateCode(); }} className="text-indigo-400 text-sm mt-2 hover:underline">
                   Ajouter un enfant
                 </button>
              </div>
            ) : (
               links.map(link => (
                 <div 
                   key={link.id}
                   onClick={() => setActiveLinkId(link.id)}
                   className={`p-3 rounded-xl border cursor-pointer transition-all ${
                     activeLinkId === link.id ? 'bg-indigo-900/20 border-indigo-500/50' : 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800'
                   }`}
                 >
                   <div className="flex justify-between items-start mb-2">
                     <span className="font-bold text-white max-w-[150px] truncate">
                       {link.childName || 'Enfant ' + link.inviteCode}
                     </span>
                     {link.status === 'active' && <span className="flex h-2 w-2 relative mt-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span></span>}
                     {link.status === 'pending' && <span className="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">En attente</span>}
                     {link.status === 'paused' && <span className="text-[10px] bg-orange-900/50 text-orange-400 px-2 py-0.5 rounded-full border border-orange-500/20">En pause</span>}
                   </div>
                   <div className="text-xs text-slate-400 flex justify-between items-center">
                     <span>Code: <span className="font-mono text-indigo-300">{link.inviteCode}</span></span>
                     {link.status !== 'pending' && (
                       <button onClick={(e) => { e.stopPropagation(); parentalService.revokeLink(link.id); }} className="text-red-400 hover:text-red-300">Révoquer</button>
                     )}
                   </div>
                 </div>
               ))
            )}
          </div>
        </div>

        {/* Main Content (Map & Alerts) */}
        <div className="flex-1 relative flex flex-col min-h-0">
          
          {/* Mobile horizontal list */}
           <div className="md:hidden z-[1000] bg-slate-900 border-b border-slate-800 shrink-0">
             <div className="flex overflow-x-auto p-3 gap-3 custom-scrollbar hide-scrollbar">
               {links.length === 0 ? (
                 <div className="text-xs text-slate-500 px-2 py-1">Aucun suivi.</div>
               ) : (
                  links.map(link => (
                    <div 
                      key={link.id}
                      onClick={() => setActiveLinkId(link.id)}
                      className={`px-4 py-2 shrink-0 rounded-full border cursor-pointer transition-all flex items-center gap-2 ${
                        activeLinkId === link.id ? 'bg-indigo-900/30 border-indigo-500' : 'bg-slate-800 border-slate-700'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${link.status==='active'?'bg-green-500':(link.status==='pending'?'bg-slate-500':'bg-orange-500')}`}></span>
                      <span className="font-bold text-white text-xs max-w-[120px] truncate">
                        {link.childName || 'Enfant ' + link.inviteCode}
                      </span>
                    </div>
                  ))
               )}
             </div>
           </div>
          {activeLink && activeLink.status === 'active' && activeLink.childId ? (
             <div className="flex-1 relative flex flex-col min-h-[350px]">
               <div className="flex-1 relative z-0 w-full h-full">
                  {childLocation ? (
                    <MapContainer 
                      center={[childLocation.lat, childLocation.lng]} 
                      zoom={16} 
                      className="h-full w-full absolute inset-0"
                      zoomControl={false}
                    >
                      <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
                      <Marker position={[childLocation.lat, childLocation.lng]} icon={createCycleIcon()}>
                        <Popup className="custom-popup">
                          <div className="text-center p-1 font-sans">
                            <div className="font-bold text-slate-800">{activeLink.childName || 'Enfant'}</div>
                            <div className="text-xs text-slate-500 mt-1">Mise à jour: {formatAgo(childLocation.timestamp)}</div>
                          </div>
                        </Popup>
                      </Marker>
                      <MapController lat={childLocation.lat} lng={childLocation.lng} />
                    </MapContainer>
                  ) : (
                    <div className="h-full w-full absolute inset-0 flex items-center justify-center bg-slate-900 border-[10px] border-slate-950">
                      <div className="animate-pulse flex flex-col items-center">
                        <MapPin className="w-12 h-12 text-slate-600 mb-4" />
                        <div className="text-lg text-slate-500 font-medium">Localisation en cours...</div>
                      </div>
                    </div>
                  )}

               {/* Live Information Overlay */}
               <div className="absolute top-4 left-4 z-[400] flex flex-col gap-2 pointer-events-none">
                 <div className="bg-slate-900/90 backdrop-blur border border-slate-700 px-3 py-2 rounded-lg shadow-xl inline-flex items-center gap-3">
                   <div className="p-1.5 bg-green-500/20 rounded-full">
                     <span className="block w-2.5 h-2.5 bg-green-500 rounded-full animate-ping opacity-75"></span>
                   </div>
                   <div className="flex flex-col">
                     <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">État Connexion</span>
                     <span className="text-sm font-medium text-white">{childLocation ? 'Connecté & En mouvement' : 'En attente de signal...'}</span>
                   </div>
                 </div>
                 {childLocation && (
                   <div className="bg-slate-900/90 backdrop-blur border border-slate-700 px-3 py-2 rounded-lg shadow-xl inline-flex items-center gap-3">
                     <Clock className="w-4 h-4 text-indigo-400" />
                     <span className="text-xs text-slate-300 font-medium">{formatAgo(childLocation.timestamp)}</span>
                   </div>
                 )}
               </div>

               {/* Alerts Panel */}
               <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:top-4 md:bottom-4 md:w-72 h-[180px] max-h-[40%] md:max-h-none md:h-auto bg-slate-900/95 backdrop-blur shadow-2xl border border-slate-700 rounded-xl z-[400] flex flex-col overflow-hidden transition-transform">
                  <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-800/50">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                       <AlertTriangle className="w-4 h-4 text-orange-400" /> Historique Alertes
                    </h4>
                    <span className="bg-slate-700 text-xs text-white px-2 py-0.5 rounded-full">{childAlerts.length}</span>
                  </div>
                  <div className="flex-1 overflow-y-auto min-h-0 p-2 space-y-2">
                    {childAlerts.length === 0 ? (
                      <div className="text-center py-6 text-slate-500 text-xs">Aucune alerte récente.</div>
                    ) : (
                      childAlerts.map(alert => (
                        <div key={alert.id} className="p-2.5 bg-slate-800/50 border border-slate-700/50 rounded-lg shrink-0">
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-xs font-bold text-orange-400">Alerte Collision</span>
                            <span className="text-[10px] text-slate-500">{formatAgo(alert.timestamp)}</span>
                          </div>
                          <div className="text-[10px] text-slate-400">Gravité : {alert.riskLevel || 'Importante'}</div>
                        </div>
                      ))
                    )}
                  </div>
               </div>
               </div>
             </div>
          ) : (
            <div className="h-full flex-1 flex flex-col items-center justify-center text-center p-6 bg-slate-900/50 overflow-y-auto">
               {activeLink?.status === 'pending' ? (
                 <>
                   <RefreshCw className="w-16 h-16 text-indigo-400 mb-6 mx-auto animate-spin" style={{ animationDuration: '3s' }} />
                   <h2 className="text-2xl font-bold text-white mb-2">En l'attente de l'enfant</h2>
                   <p className="text-slate-400 max-w-sm mb-6">
                     Transmettez ce code à votre enfant pour qu'il le saisisse dans son application ("Rattacher Enfant").
                   </p>
                   <div className="bg-slate-950 p-4 border border-slate-700 rounded-xl inline-block">
                     <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Code de liaison</div>
                     <div className="text-4xl font-mono text-indigo-400 tracking-widest">{activeLink.inviteCode}</div>
                   </div>
                 </>
               ) : (
                 <>
                   <Smartphone className="w-16 h-16 text-slate-600 mb-6 mx-auto" />
                   <h2 className="text-xl font-bold text-slate-500 mb-2">Aucun suivi actif sélectionné</h2>
                   <p className="text-slate-600 text-sm max-w-sm">
                     Sélectionnez un profil enfant dans le menu latéral ou créez un nouveau lien de suivi.
                   </p>
                 </>
               )}
            </div>
          )}
        </div>

      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md overflow-hidden relative shadow-2xl">
            <div className="p-6">
              <button onClick={() => setShowInviteModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X className="w-5 h-5"/></button>
              <div className="w-12 h-12 bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                 <Shield className="w-6 h-6 text-indigo-400" />
              </div>
              <h2 className="text-xl font-bold text-center text-white mb-2">Créer un suivi parental</h2>
              <p className="text-sm text-slate-400 text-center mb-6">
                Un code vient d'être généré. Donnez-le à votre enfant pour établir la liaison persistante.
              </p>
              
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 text-center">
                 <div className="text-3xl font-mono tracking-[0.3em] text-indigo-400 font-bold">
                   {inviteCode}
                 </div>
              </div>
              <p className="text-xs text-slate-500 text-center mt-4">
                Une fois la liaison effectuée, vous pourrez voir sa position et ses alertes en temps réel sur cet écran.
              </p>
            </div>
            <div className="p-4 bg-slate-800/50 border-t border-slate-800 flex justify-end">
              <button onClick={() => setShowInviteModal(false)} className="px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-500">Terminer & Attendre</button>
            </div>
          </div>
        </div>
      )}

      {/* Join Modal (Child Side Simulation, though child can join from same screen for simplicity) */}
      {showJoinModal && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md overflow-hidden relative shadow-2xl">
            <div className="p-6">
              <button onClick={() => setShowJoinModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X className="w-5 h-5"/></button>
              <h2 className="text-xl font-bold text-white mb-4">Rattacher un parent</h2>
              <p className="text-sm text-slate-400 mb-6">
                Saisissez le code à 6 caractères généré par votre parent pour autoriser le suivi.
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Code de liaison</label>
                  <input 
                    type="text" 
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value)}
                    maxLength={6}
                    placeholder="ex: A1B2C3"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white uppercase font-mono tracking-widest text-center outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Votre Prénom (Optionnel)</label>
                  <input 
                    type="text" 
                    value={joinName}
                    onChange={(e) => setJoinName(e.target.value)}
                    placeholder="Pour vous identifier"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
              
              {joinError && <div className="mt-4 p-3 bg-red-900/20 border border-red-500/30 text-red-400 text-sm rounded-lg">{joinError}</div>}
              
              <button 
                onClick={handleJoin}
                disabled={joinCode.length !== 6}
                className="w-full mt-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl transition-colors"
              >
                Autoriser le Suivi
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

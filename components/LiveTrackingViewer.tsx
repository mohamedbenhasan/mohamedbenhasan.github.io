import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Shield, Clock, AlertTriangle, MapPin, Loader2 } from 'lucide-react';
import { liveTrackingService, LiveTrackingSession } from '../services/LiveTrackingService';

interface Props {
  sessionId: string;
  token: string;
  onExit: () => void;
}

// Marker icon
const createCycleIcon = () => {
  return L.divIcon({
    html: `
      <div class="relative w-12 h-12 flex items-center justify-center">
        <div class="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-30"></div>
        <div class="relative w-8 h-8 bg-blue-600 rounded-full border-2 border-white shadow-lg flex items-center justify-center">
          <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.5 19.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM6.5 19.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z"/>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14.5l-2-5-3 1M14.5 9.5l3-1"/>
          </svg>
        </div>
      </div>
    `,
    className: '',
    iconSize: [48, 48],
    iconAnchor: [24, 24]
  });
};

const MapController: React.FC<{ lat: number, lng: number }> = ({ lat, lng }) => {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], 16);
  }, [lat, lng, map]);
  return null;
};

export const LiveTrackingViewer: React.FC<Props> = ({ sessionId, token, onExit }) => {
  const [session, setSession] = useState<LiveTrackingSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = liveTrackingService.subscribeToSession(sessionId, token, (updatedSession) => {
      setLoading(false);
      if (!updatedSession) {
        setError("Ce lien de partage n'est plus valide ou a expiré.");
      } else {
        setSession(updatedSession);
      }
    });

    return () => unsubscribe();
  }, [sessionId, token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
        <p className="font-mono tracking-widest text-sm text-slate-400">CONNEXION AU FLUX DE VOYAGE...</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold mb-2">Partage terminé</h2>
          <p className="text-slate-400 mb-8">{error || "Le trajet n'est plus partagé."}</p>
          <button 
            onClick={onExit}
            className="w-full bg-slate-800 hover:bg-slate-700 text-white font-medium py-3 rounded-lg transition-colors"
          >
            Retourner à l'accueil
          </button>
        </div>
      </div>
    );
  }

  const { lastLocation } = session;
  const positionText = lastLocation ? "Position en direct" : "En attente de la position...";

  return (
    <div className="h-screen w-full flex flex-col bg-slate-950">
      {/* Header */}
      <div className="h-16 border-b border-slate-800 bg-slate-900/80 backdrop-blur flex items-center px-6 justify-between z-10 shrink-0">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-blue-500" />
          <span className="font-bold text-white text-lg">VRU<span className="text-blue-500">Guard</span> Viewer</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-blue-500/10 text-blue-400 px-3 py-1.5 rounded-full border border-blue-500/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider hidden sm:block">En direct</span>
          </div>
          <button onClick={onExit} className="bg-slate-800 hover:bg-slate-700 text-sm px-4 py-2 rounded-lg text-white font-medium transition-colors">
            Fermer
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 relative">
        {lastLocation ? (
          <MapContainer 
            center={[lastLocation.lat, lastLocation.lng]} 
            zoom={16} 
            className="h-full w-full"
            zoomControl={false}
          >
            <TileLayer
              attribution='&copy; Google Maps'
              url={"https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"}
            />
            <Marker position={[lastLocation.lat, lastLocation.lng]} icon={createCycleIcon()}>
              <Popup className="custom-popup">
                <div className="text-center p-1">
                  <div className="font-bold text-slate-800">Usager Protégé</div>
                  <div className="text-xs text-slate-500 mt-1">
                    Mise à jour: {new Date(lastLocation.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </Popup>
            </Marker>
            <MapController lat={lastLocation.lat} lng={lastLocation.lng} />
          </MapContainer>
        ) : (
          <div className="h-full w-full flex items-center justify-center bg-slate-900 border-[10px] border-slate-950">
            <div className="animate-pulse flex flex-col items-center">
              <MapPin className="w-12 h-12 text-slate-600 mb-4" />
              <div className="text-lg text-slate-500 font-medium">Acquisition du signal GPS...</div>
            </div>
          </div>
        )}

        {/* Floating Panel Overlay */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-sm z-[400]">
          <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700 rounded-2xl p-4 shadow-2xl flex items-center justify-between">
             <div className="flex flex-col gap-1">
               <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">État du suivi</div>
               <div className="text-white font-medium">{positionText}</div>
             </div>
             <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 font-mono">
               <Clock className="w-3.5 h-3.5 text-blue-400" />
               Ext. : {new Date(session.expiresAt).toLocaleTimeString()}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

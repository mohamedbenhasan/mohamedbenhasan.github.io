import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polygon, Polyline, Rectangle, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { SimulationState, VRUType, RiskLevel, VRU, Zone } from '../types';
import { INITIAL_CENTER } from '../constants';
import { simulationService } from '../services/SimulationService';
import { mapMatchingService } from '../services/MapMatchingService';
import { moveCoordinate } from '../utils/geo';

// Fix Leaflet default icon issue
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

import { LiveLocation, AlertEvent } from '../services/LiveInteractionService';
import { DENMMessage, Incident, IncidentType, IncidentSeverity } from '../types';

import { infrastructureService } from '../services/InfrastructureService';
import { riskFieldService } from '../services/RiskFieldService';
import { MapSearchBar } from './MapSearchBar';
import { incidentService } from '../services/IncidentService';
import { ReportIncidentModal } from './ReportIncidentModal';
import { AlertTriangle, Construction, Ban, Zap, Layers, Map as MapIcon, Mountain, Moon, Car, Train, Bike, Users, Shield } from 'lucide-react';
import { toast } from 'sonner';

const vruIconCache = new Map<string, L.DivIcon>();

interface Props {
  state: SimulationState;
  dynamicZoom: boolean;
  layerVisibility: {
    mapType?: string;
    zones: boolean;
    vrus: boolean;
    sensors: boolean;
    sectorView: boolean;
    densityHeatmap: boolean;
    riskField: boolean;
    infrastructure: boolean;
    traffic: boolean;
    incidents?: boolean;
    cyclePaths?: boolean;
  };
  setLayerVisibility?: React.Dispatch<React.SetStateAction<any>>;
  setDynamicZoom?: React.Dispatch<React.SetStateAction<boolean>>;
  gridOpacity?: number;
  nearbyUsers?: LiveLocation[];
  activeAlerts?: AlertEvent[];
  activeSosMarkers?: any[];
  denmMessages?: DENMMessage[];
  onDestinationChange?: (dest: { lat: number; lng: number; label?: string; source: 'search' | 'click' } | null) => void;
  searchedLocation?: {lat: number, lng: number} | null;
  destinationLabel?: string | null;
  reportingLocation?: { lat: number; lng: number } | null;
  setReportingLocation?: (loc: { lat: number; lng: number } | null) => void;
  waitingForIncidentClick?: boolean;
  setWaitingForIncidentClick?: (waiting: boolean) => void;
  pmrAnalysis?: any;
}

  const getPosition = (vru: VRU) => {
    return vru.geolocation?.current || vru.position;
  };

  // Custom Hook for Dynamic Zoom and smooth user tracking
  const MapController: React.FC<{ state: SimulationState; dynamicZoom: boolean; isHeadingUp?: boolean }> = ({ state, dynamicZoom, isHeadingUp }) => {
    const map = useMap();
    const lastFlyTime = useRef<number>(0);
    const lastBoundsStr = useRef<string>('');
    const hasInitialZoomedRef = useRef<boolean>(false);
    
    const prevHeadingUp = useRef<boolean | undefined>(undefined);

    useEffect(() => {
      // Invalidate size when heading-up mode changes to prevent gray/unloaded tile areas
      if (prevHeadingUp.current !== isHeadingUp) {
        prevHeadingUp.current = isHeadingUp;
        setTimeout(() => {
          map.invalidateSize();
        }, 350); // wait for CSS transition
      }

      const user = state.vrus.find(v => v.isUserControlled);

      if (isHeadingUp && user) {
        const pos = user.geolocation?.current || user.position;
        // In heading-up mode, we smoothly follow the user
        map.panTo([pos.lat, pos.lng], {
          animate: true,
          duration: 0.3,
          easeLinearity: 1
        });
        hasInitialZoomedRef.current = true;
        return; // Don't do dynamic zoom bounds if heading up
      }

      let shouldZoom = dynamicZoom;
      if (!hasInitialZoomedRef.current && state && state.vrus && state.vrus.length > 0) {
        shouldZoom = true;
      }
      if (!shouldZoom) return;

      const critical = state.vrus.filter(v => v.riskLevel === RiskLevel.CRITICAL || v.riskLevel === RiskLevel.WARNING);
      
      let targets: VRU[] = [];
      if (critical.length > 0) {
        targets = critical;
        if (user && !targets.includes(user)) targets.push(user);
      } else if (user) {
        targets = [user];
      } else {
        targets = state.vrus;
      }

      if (targets.length === 0) return;

      if (!hasInitialZoomedRef.current) {
         hasInitialZoomedRef.current = true;
      }

      const bounds = L.latLngBounds(targets.map(t => {
        const pos = t.geolocation?.current || t.position;
        return [pos.lat, pos.lng];
      }));
      
      const boundsStr = bounds.toBBoxString();
      const now = Date.now();
      
      // Update more frequently for smoother tracking
      if (boundsStr !== lastBoundsStr.current && now - lastFlyTime.current > 500) {
        lastBoundsStr.current = boundsStr;
        lastFlyTime.current = now;
        
        map.flyToBounds(bounds, {
          padding: [50, 50],
          maxZoom: 18, 
          duration: 0.6,
          easeLinearity: 0.25,
          animate: true
        });
      }

    }, [state, dynamicZoom, map, isHeadingUp]);

    return null;
  };

// Custom Hook to fly to searched location
const MapFlyTo: React.FC<{ location?: {lat: number, lng: number} | null }> = ({ location }) => {
  const map = useMap();
  useEffect(() => {
    if (location) {
      map.flyTo([location.lat, location.lng], 16, { duration: 0.6 });
    }
  }, [location, map]);
  return null;
};

// Custom Hook for Map Clicks (Set Destination)
const MapClickHandler = ({ waitingForIncidentClick, onIncidentClick, onMapClick }: { waitingForIncidentClick?: boolean, onIncidentClick?: (latlng: {lat: number, lng: number}) => void, onMapClick?: (latlng: {lat: number, lng: number}) => void }) => {
  useMapEvents({
    click(e) {
      if (waitingForIncidentClick && onIncidentClick) {
        onIncidentClick(e.latlng);
      } else if (onMapClick) {
        onMapClick(e.latlng);
      }
    },
  });
  return null;
};

// Custom Hook for Map Resizing
const MapResizer = () => {
  const map = useMap();
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    const resizeObserver = new ResizeObserver(() => {
      // Debounce invalidateSize to prevent infinite loop
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        map.invalidateSize();
      }, 100);
    });
    const container = map.getContainer();
    resizeObserver.observe(container);
    
    return () => {
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
    };
  }, [map]);
  return null;
};

// Sync viewport with SimulationService
const MapEventHandler = () => {
  const map = useMap();
  
  const syncViewport = () => {
    const bounds = map.getBounds();
    const zoom = map.getZoom();
    simulationService.setViewport({
      northEast: { lat: bounds.getNorthEast().lat, lng: bounds.getNorthEast().lng },
      southWest: { lat: bounds.getSouthWest().lat, lng: bounds.getSouthWest().lng }
    }, zoom);
  };

  useEffect(() => {
    syncViewport();
  }, []);

  useMapEvents({
    moveend: syncViewport,
    zoomend: syncViewport
  });

  return null;
};

export const MapVisualization: React.FC<Props> = ({ state, dynamicZoom, setDynamicZoom, layerVisibility, setLayerVisibility, gridOpacity = 0.4, nearbyUsers = [], activeAlerts = [], activeSosMarkers = [], denmMessages = [], onDestinationChange, searchedLocation, destinationLabel, reportingLocation: propsReportingLocation, setReportingLocation: propsSetReportingLocation, waitingForIncidentClick: propsWaitingForIncidentClick, setWaitingForIncidentClick: propsSetWaitingForIncidentClick, pmrAnalysis }) => {
  const [dismissedDenms, setDismissedDenms] = useState<Set<string>>(new Set());
  const [localReportingLocation, setLocalReportingLocation] = useState<{lat: number, lng: number} | null>(null);
  const [localWaitingForIncidentClick, setLocalWaitingForIncidentClick] = useState(false);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isHeadingUp, setIsHeadingUp] = useState<boolean>(true); // Default to heading up
  const [isLayersMenuOpen, setIsLayersMenuOpen] = useState(false);
  const [selectedPoi, setSelectedPoi] = useState<{lat: number, lng: number, data?: any, loading: boolean} | null>(null);

  const MapInteractionHandler = () => {
    useMapEvents({
      dragstart: () => {
        if (isHeadingUp) {
          setIsHeadingUp(false);
          toast.info("Auto-center disabled. Click the compass to re-center.");
        }
      }
    });
    return null;
  };


  const reportingLocation = propsReportingLocation !== undefined ? propsReportingLocation : localReportingLocation;
  const setReportingLocation = propsSetReportingLocation || setLocalReportingLocation;
  const waitingForIncidentClick = propsWaitingForIncidentClick !== undefined ? propsWaitingForIncidentClick : localWaitingForIncidentClick;
  const setWaitingForIncidentClick = propsSetWaitingForIncidentClick || setLocalWaitingForIncidentClick;

  useEffect(() => {
    incidentService.setOnIncidentsUpdate((newIncidents) => {
      setIncidents([...newIncidents]);
    });
  }, []);

  const handleDismissDenm = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissedDenms(prev => {
      const newSet = new Set(prev);
      newSet.add(id);
      return newSet;
    });
  };
  
  const getVRUIcon = (vru: VRU, inSector: boolean = false, isOnline: boolean = false) => {
    const cacheKey = `${vru.type}-${vru.riskLevel}-${vru.isUserControlled}-${inSector}-${isOnline}-${isHeadingUp}`;
    
    let icon = vruIconCache.get(cacheKey);
    if (!icon) {
      let iconChar = '•';
      switch (vru.type) {
          case VRUType.PEDESTRIAN: iconChar = '🚶'; break;
          case VRUType.CYCLIST: iconChar = '🚴'; break;
          case VRUType.SCOOTER: iconChar = '🛴'; break;
          case VRUType.VEHICLE: iconChar = '🚗'; break;
          case VRUType.MOTORCYCLE: iconChar = '🏍️'; break;
          case VRUType.WHEELCHAIR: iconChar = '🦽'; break;
      }

      const color = vru.riskLevel === RiskLevel.CRITICAL ? '#ef4444' : 
                    vru.riskLevel === RiskLevel.WARNING ? '#f59e0b' : 
                    vru.isUserControlled ? '#3b82f6' : '#64748b';

      const pulseClass = vru.riskLevel === RiskLevel.CRITICAL ? 'animate-pulse-fast' : '';
      
      let borderClass = 'border-white border-2';
      let shadowStyle = 'box-shadow: 0 2px 5px rgba(0,0,0,0.3);';

      if (inSector) {
          if (vru.riskLevel === RiskLevel.WARNING) {
              borderClass = 'border-orange-500 border-4';
              shadowStyle = 'box-shadow: 0 0 15px rgba(249, 115, 22, 0.9);'; 
          } else if (vru.riskLevel === RiskLevel.CRITICAL) {
              borderClass = 'border-red-600 border-4';
              shadowStyle = 'box-shadow: 0 0 20px rgba(239, 68, 68, 1);';
          } else {
              borderClass = 'border-yellow-400 border-4';
          }
      }

      const onlineIndicator = isOnline ? 
        '<div style="position:absolute; top:-2px; right:-2px; width:10px; height:10px; background-color:#22c55e; border-radius:50%; border:2px solid white; box-shadow:0 0 4px rgba(34,197,94,0.8);"></div>' : '';

      icon = L.divIcon({
        className: 'custom-vru-icon',
        html: `
          <div style="
            background-color: ${color};
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            ${shadowStyle}
            font-size: 16px;
            position: relative;
          " class="${pulseClass} ${borderClass}">
            <div style="transform: rotate(${isHeadingUp ? 0 : 0}deg); display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">
              ${iconChar}
            </div>
            ${onlineIndicator}
            ${vru.isUserControlled ? '<div style="position:absolute; bottom:-18px; left:50%; transform:translateX(-50%); background:black; color:white; padding:2px 4px; border-radius:4px; font-size:10px; white-space:nowrap;">YOU</div>' : ''}
          </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });
      
      vruIconCache.set(cacheKey, icon);
    }
    
    return icon;
  };

  // Helper to calculate sector polygon
  const getSectorPolygon = (user: VRU) => {
    if (!user) return null;
    
    const pos = user.geolocation?.current || user.position;
    const radius = 100; // meters
    const headingRad = (user.heading * Math.PI) / 180;
    const halfFovRad = (45 * Math.PI) / 180; // 90 degree total FOV

    // Earth radius approximation for small distances
    const latOffset = (dy: number) => (dy / 111320);
    const lngOffset = (dx: number) => (dx / (111320 * Math.cos(pos.lat * Math.PI / 180)));

    const p1 = {
      lat: pos.lat + latOffset(Math.sin(headingRad - halfFovRad) * radius),
      lng: pos.lng + lngOffset(Math.cos(headingRad - halfFovRad) * radius)
    };

    const p2 = {
      lat: pos.lat + latOffset(Math.sin(headingRad + halfFovRad) * radius),
      lng: pos.lng + lngOffset(Math.cos(headingRad + halfFovRad) * radius)
    };

    return [
      [pos.lat, pos.lng],
      [p1.lat, p1.lng],
      [p2.lat, p2.lng]
    ];
  };

  // Helper to check if point is in sector (simple angle check)
  const isInSector = (user: VRU, target: VRU) => {
    if (user.id === target.id) return false;
    
    const userPos = user.geolocation?.current || user.position;
    const targetPos = target.geolocation?.current || target.position;

    const dx = targetPos.lng - userPos.lng;
    const dy = targetPos.lat - userPos.lat;
    
    // Angle to target
    let angleToTarget = Math.atan2(dy, dx) * 180 / Math.PI; // -180 to 180
    // Adjust for map coordinate system if needed, but atan2(dy, dx) is standard math angle
    // Our heading is 0-360? Or standard math?
    // SimulationService uses: velocity x/y. Heading is derived from velocity usually.
    // Let's assume heading is standard compass or math angle.
    // Actually, let's look at SimulationService: heading: (angle * 180) / Math.PI.
    // And velocity x = cos(angle), y = sin(angle). So heading is math angle (0 is East, 90 is North? No, Y is usually North in map projection but here lat is Y).
    // Wait, lat is Y, lng is X.
    // Math.atan2(dy, dx) -> dy is lat diff, dx is lng diff.
    
    // Normalize angles safely
    const h = user.heading || 0;
    let diff = angleToTarget - h;
    
    if (!Number.isFinite(diff)) return false;
    
    diff = ((diff + 180) % 360 + 360) % 360 - 180;
    
    return Math.abs(diff) <= 45;
  };

  const displayVrus = state.vrus;
  const displayState = { ...state, vrus: displayVrus };

  const userAgent = displayVrus.find(v => v.isUserControlled);
  const sectorPolygon = (layerVisibility.sectorView && userAgent) ? getSectorPolygon(userAgent) : null;
  const currentHeading = userAgent ? (userAgent.heading || 0) : 0;

  return (
    <div className="relative w-full h-full bg-slate-900 overflow-hidden rounded-xl border border-slate-700 shadow-2xl z-0">
      
      {/* Map Controls */}
      <div className="absolute top-20 left-4 z-[2000] flex flex-col gap-2">
         {/* Compass */}
         <button 
           onClick={() => setIsHeadingUp(!isHeadingUp)}
           className="w-10 h-10 bg-slate-900/90 backdrop-blur border border-slate-700 rounded-full shadow-lg flex items-center justify-center hover:bg-slate-800 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
           title={isHeadingUp ? "Switch to North-Up" : "Switch to Heading-Up"}
         >
           <div 
             className="text-white flex flex-col items-center justify-center transition-transform duration-300 ease-out"
             style={{ transform: `rotate(${isHeadingUp ? -currentHeading : 0}deg)` }}
           >
             <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-b-[10px] border-transparent border-b-red-500 mb-[1px]"></div>
             <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[10px] border-transparent border-t-white"></div>
           </div>
         </button>

         {/* Layers Button */}
         {setLayerVisibility && (
           <div className="relative">
             <button
               onClick={() => setIsLayersMenuOpen(!isLayersMenuOpen)}
               className={`w-10 h-10 backdrop-blur border rounded-full shadow-lg flex items-center justify-center transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${isLayersMenuOpen ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-900/90 border-slate-700 hover:bg-slate-800 text-slate-300'}`}
               title="Couches de la carte"
             >
               <Layers className="w-5 h-5" />
             </button>

             {/* Layers Menu Panel */}
             {isLayersMenuOpen && (
               <div className="absolute top-0 left-12 w-72 bg-slate-900/95 backdrop-blur-xl border border-slate-700 rounded-xl shadow-2xl p-4 ml-2 max-h-[70vh] overflow-y-auto custom-scrollbar">
                 <div className="space-y-4">
                   {/* Type de carte */}
                   <div>
                      <div className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">Type de carte</div>
                      <div className="grid grid-cols-5 gap-2">
                        <div 
                          onClick={() => setLayerVisibility({...layerVisibility, mapType: 'default'})}
                          className="flex flex-col items-center gap-1 cursor-pointer group"
                        >
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${layerVisibility.mapType === 'default' ? 'border-2 border-blue-500 bg-blue-500/20 text-blue-400' : 'border border-slate-700 bg-slate-800 text-slate-400 group-hover:border-slate-500 group-hover:text-white'}`}>
                            <MapIcon size={20} />
                          </div>
                          <span className={`text-[9px] text-center ${layerVisibility.mapType === 'default' ? 'text-blue-400 font-medium' : 'text-slate-400'}`}>Par défaut</span>
                        </div>

                        <div 
                          onClick={() => setLayerVisibility({...layerVisibility, mapType: 'vruguard'})}
                          className="flex flex-col items-center gap-1 cursor-pointer group"
                        >
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${layerVisibility.mapType === 'vruguard' ? 'border-2 border-blue-500 bg-blue-500/20 text-blue-400' : 'border border-slate-700 bg-slate-800 text-slate-400 group-hover:border-slate-500 group-hover:text-white'}`}>
                            <Shield size={20} />
                          </div>
                          <span className={`text-[9px] text-center ${layerVisibility.mapType === 'vruguard' ? 'text-blue-400 font-medium' : 'text-slate-400'}`}>VRUGuard</span>
                        </div>

                        <div 
                          onClick={() => setLayerVisibility({...layerVisibility, mapType: 'satellite'})}
                          className="flex flex-col items-center gap-1 cursor-pointer group"
                        >
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${layerVisibility.mapType === 'satellite' ? 'border-2 border-blue-500 bg-blue-500/20 text-blue-400' : 'border border-slate-700 bg-slate-800 text-slate-400 group-hover:border-slate-500 group-hover:text-white'}`}>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                          </div>
                          <span className={`text-[9px] text-center ${layerVisibility.mapType === 'satellite' ? 'text-blue-400 font-medium' : 'text-slate-400'}`}>Satellite</span>
                        </div>

                        <div 
                          onClick={() => setLayerVisibility({...layerVisibility, mapType: 'terrain'})}
                          className="flex flex-col items-center gap-1 cursor-pointer group"
                        >
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${layerVisibility.mapType === 'terrain' ? 'border-2 border-blue-500 bg-blue-500/20 text-blue-400' : 'border border-slate-700 bg-slate-800 text-slate-400 group-hover:border-slate-500 group-hover:text-white'}`}>
                            <Mountain size={20} />
                          </div>
                          <span className={`text-[9px] text-center ${layerVisibility.mapType === 'terrain' ? 'text-blue-400 font-medium' : 'text-slate-400'}`}>Relief</span>
                        </div>

                        <div 
                          onClick={() => setLayerVisibility({...layerVisibility, mapType: 'dark'})}
                          className="flex flex-col items-center gap-1 cursor-pointer group"
                        >
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${layerVisibility.mapType === 'dark' ? 'border-2 border-blue-500 bg-blue-500/20 text-blue-400' : 'border border-slate-700 bg-slate-800 text-slate-400 group-hover:border-slate-500 group-hover:text-white'}`}>
                            <Moon size={20} />
                          </div>
                          <span className={`text-[9px] text-center ${layerVisibility.mapType === 'dark' ? 'text-blue-400 font-medium' : 'text-slate-400'}`}>Sombre</span>
                        </div>
                      </div>
                   </div>
                   
                   <div className="h-px bg-slate-700/50 my-2" />
                   
                   {/* Détails de la carte */}
                   <div>
                      <div className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">Détails de la carte</div>
                      <div className="grid grid-cols-4 gap-2">
                        <div 
                          onClick={() => setLayerVisibility({...layerVisibility, traffic: !layerVisibility.traffic})}
                          className="flex flex-col items-center gap-1 cursor-pointer group"
                        >
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${layerVisibility.traffic ? 'border-2 border-blue-500 bg-blue-500/20 text-blue-400' : 'border border-slate-700 bg-slate-800 text-slate-400 group-hover:border-slate-500 group-hover:text-white'}`}>
                            <Car size={20} />
                          </div>
                          <span className={`text-[9px] text-center ${layerVisibility.traffic ? 'text-blue-400 font-medium' : 'text-slate-400'}`}>Trafic</span>
                        </div>

                        <div 
                          onClick={() => setLayerVisibility({...layerVisibility, incidents: !layerVisibility.incidents})}
                          className="flex flex-col items-center gap-1 cursor-pointer group"
                        >
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${layerVisibility.incidents ? 'border-2 border-blue-500 bg-blue-500/20 text-blue-400' : 'border border-slate-700 bg-slate-800 text-slate-400 group-hover:border-slate-500 group-hover:text-white'}`}>
                            <Train size={20} />
                          </div>
                          <span className={`text-[9px] text-center leading-tight ${layerVisibility.incidents ? 'text-blue-400 font-medium' : 'text-slate-400'}`}>Transports</span>
                        </div>

                        <div 
                          onClick={() => setLayerVisibility({...layerVisibility, cyclePaths: !layerVisibility.cyclePaths})}
                          className="flex flex-col items-center gap-1 cursor-pointer group"
                        >
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${layerVisibility.cyclePaths ? 'border-2 border-blue-500 bg-blue-500/20 text-blue-400' : 'border border-slate-700 bg-slate-800 text-slate-400 group-hover:border-slate-500 group-hover:text-white'}`}>
                            <Bike size={20} />
                          </div>
                          <span className={`text-[9px] text-center ${layerVisibility.cyclePaths ? 'text-blue-400 font-medium' : 'text-slate-400'}`}>Vélo</span>
                        </div>

                        <div 
                          onClick={() => setLayerVisibility({...layerVisibility, infrastructure: !layerVisibility.infrastructure})}
                          className="flex flex-col items-center gap-1 cursor-pointer group"
                        >
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${layerVisibility.infrastructure ? 'border-2 border-blue-500 bg-blue-500/20 text-blue-400' : 'border border-slate-700 bg-slate-800 text-slate-400 group-hover:border-slate-500 group-hover:text-white'}`}>
                            <Users size={20} />
                          </div>
                          <span className={`text-[9px] text-center leading-tight ${layerVisibility.infrastructure ? 'text-blue-400 font-medium' : 'text-slate-400'}`}>Street View</span>
                        </div>
                      </div>
                   </div>

                   <div className="h-px bg-slate-700/50 my-2" />
                   
                   <div>
                      <div className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">Couches Avancées</div>
                      <div className="space-y-3">
                        {setDynamicZoom && (
                          <label className="flex items-center justify-between cursor-pointer group">
                             <span className="text-xs text-slate-300 group-hover:text-white transition-colors">Dynamic Auto-Zoom</span>
                             <div 
                               onClick={() => setDynamicZoom(!dynamicZoom)}
                               className={`w-10 h-5 rounded-full relative transition-colors ${dynamicZoom ? 'bg-blue-600' : 'bg-slate-700'}`}
                             >
                                <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${dynamicZoom ? 'left-6' : 'left-1'}`} />
                             </div>
                          </label>
                        )}
                        <label className="flex items-center gap-2 cursor-pointer group">
                           <input 
                             type="checkbox" 
                             checked={layerVisibility.zones}
                             onChange={(e) => setLayerVisibility({...layerVisibility, zones: e.target.checked})}
                             className="rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500/20"
                           />
                           <span className="text-xs text-slate-400 group-hover:text-slate-200">Risk Zones</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer group">
                           <input 
                             type="checkbox" 
                             checked={layerVisibility.vrus}
                             onChange={(e) => setLayerVisibility({...layerVisibility, vrus: e.target.checked})}
                             className="rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500/20"
                           />
                           <span className="text-xs text-slate-400 group-hover:text-slate-200">VRU Entities</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer group">
                           <input 
                             type="checkbox" 
                             checked={layerVisibility.sensors}
                             onChange={(e) => setLayerVisibility({...layerVisibility, sensors: e.target.checked})}
                             className="rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500/20"
                           />
                           <span className="text-xs text-slate-400 group-hover:text-slate-200">Sensor Rays</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer group">
                           <input 
                             type="checkbox" 
                             checked={layerVisibility.sectorView}
                             onChange={(e) => setLayerVisibility({...layerVisibility, sectorView: e.target.checked})}
                             className="rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500/20"
                           />
                           <span className="text-xs text-slate-400 group-hover:text-slate-200">Sector View (90°)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer group">
                           <input 
                             type="checkbox" 
                             checked={layerVisibility.densityHeatmap}
                             onChange={(e) => setLayerVisibility({...layerVisibility, densityHeatmap: e.target.checked})}
                             className="rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500/20"
                           />
                           <span className="text-xs text-slate-400 group-hover:text-slate-200">Density Heatmap</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer group">
                           <input 
                             type="checkbox" 
                             checked={layerVisibility.riskField}
                             onChange={(e) => setLayerVisibility({...layerVisibility, riskField: e.target.checked})}
                             className="rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500/20"
                           />
                           <span className="text-xs text-slate-400 group-hover:text-slate-200">Probabilistic Risk Grid</span>
                        </label>
                      </div>
                   </div>
                 </div>
               </div>
             )}
           </div>
         )}
      </div>

      <div style={{
          position: 'absolute',
          top: isHeadingUp ? '-25%' : '0',
          left: isHeadingUp ? '-25%' : '0',
          width: isHeadingUp ? '150%' : '100%',
          height: isHeadingUp ? '150%' : '100%',
          transform: isHeadingUp ? `rotate(${-currentHeading}deg)` : 'rotate(0deg)',
          transformOrigin: '50% 50%',
          transition: 'transform 0.3s linear'
      }}>
      <MapContainer 
        center={[INITIAL_CENTER.lat, INITIAL_CENTER.lng]} 
        zoom={16} 
        maxZoom={22}
        zoomDelta={0.5}
        zoomSnap={0}
        wheelPxPerZoomLevel={60}
        wheelDebounceTime={40}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
        attributionControl={false}
        preferCanvas={true}
      >
        <MapInteractionHandler />
        <TileLayer
          key={layerVisibility.mapType || 'default'}
          attribution='&copy; Google Maps'
          url={
            layerVisibility.mapType === 'satellite' 
              ? "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
              : layerVisibility.mapType === 'terrain'
                ? "https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}"
                : layerVisibility.mapType === 'dark'
                  ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                  : layerVisibility.mapType === 'vruguard'
                    ? "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    : "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
          }
          className="map-tiles"
          maxNativeZoom={20}
          maxZoom={22}
        />

        {/* Real-time Traffic Overlay */}
        {layerVisibility.traffic && (
          <TileLayer
            url="https://mt0.google.com/vt/lyrs=h,traffic&x={x}&y={y}&z={z}"
            attribution="Traffic data &copy; Google"
            opacity={0.8}
            maxNativeZoom={19}
            maxZoom={22}
          />
        )}

        {/* Real-time Transit Overlay */}
        {layerVisibility.incidents && (
          <TileLayer
            url="https://mt0.google.com/vt/lyrs=h,transit&x={x}&y={y}&z={z}"
            attribution="Transit data &copy; Google"
            opacity={0.8}
            maxNativeZoom={19}
            maxZoom={22}
          />
        )}

        {/* Cycle Paths Overlay */}
        {layerVisibility.cyclePaths && (
          <TileLayer
            url="https://tile.waymarkedtrails.org/cycling/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://waymarkedtrails.org">Waymarked Trails</a>'
            opacity={0.8}
            maxNativeZoom={18}
            maxZoom={22}
          />
        )}

        {/* Street View Coverage Overlay */}
        {layerVisibility.infrastructure && (
          <TileLayer
            url="https://mt0.google.com/vt/lyrs=svv&x={x}&y={y}&z={z}"
            attribution="Street View &copy; Google"
            opacity={0.6}
            maxNativeZoom={19}
            maxZoom={22}
          />
        )}

        <MapController state={displayState} dynamicZoom={dynamicZoom} isHeadingUp={isHeadingUp} />
        <MapClickHandler 
          waitingForIncidentClick={waitingForIncidentClick}
          onIncidentClick={(latlng) => {
            setReportingLocation(latlng);
            setWaitingForIncidentClick(false);
          }}
          onMapClick={(latlng) => {
            setSelectedPoi({ lat: latlng.lat, lng: latlng.lng, loading: true });
            fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latlng.lat}&lon=${latlng.lng}&zoom=18&addressdetails=1`)
              .then(res => res.json())
              .then(data => {
                if (data && data.display_name) {
                  setSelectedPoi({ lat: latlng.lat, lng: latlng.lng, data, loading: false });
                } else {
                  setSelectedPoi(null); // Close if no data
                }
              })
              .catch(err => {
                console.error("Reverse geocoding failed", err);
                setSelectedPoi(null);
              });
          }}
        />
        <MapResizer />
        <MapEventHandler />
        <MapFlyTo location={searchedLocation} />

        {/* Density Heatmap Layer */}
        {layerVisibility.densityHeatmap && displayVrus.map(vru => {
          const density = vru.riskFactors?.dynamic.localDensity || 0;
          if (density <= 0.05) return null; // Skip very low density
          
          let color = '#10b981'; // Green
          if (density > 0.3) color = '#facc15'; // Yellow
          if (density > 0.6) color = '#ef4444'; // Red
          
          const radius = simulationService.getRiskScoreConfig().densityRadius;
          const pos = vru.geolocation?.current || vru.position;

          return (
             <Circle 
               key={`heat-${vru.id}`}
               center={[pos.lat, pos.lng]}
               radius={radius}
               pathOptions={{ 
                 color: 'transparent', 
                 fillColor: color, 
                 fillOpacity: Math.min(density * 0.6, 0.8) 
               }}
             />
          );
        })}

        {/* Zones Layer */}
        {layerVisibility.zones && state.zones.map(zone => {
          if (zone.density === 0) return null;
          
          let color = '#10b981'; 
          if (zone.riskLevel === RiskLevel.WARNING) color = '#f59e0b';
          if (zone.riskLevel === RiskLevel.CRITICAL) color = '#ef4444';

          const intensity = zone.intensity || 0;
          const fillOpacity = 0.1 + (intensity * 0.4); // 0.1 to 0.5
          const weight = 1 + (intensity * 2);

          return (
            <Polygon 
              key={zone.id}
              positions={zone.bounds.map(c => [c.lat, c.lng])}
              pathOptions={{ color: color, fillOpacity: fillOpacity, weight: weight }}
              eventHandlers={{
                mouseover: (e) => {
                  const layer = e.target;
                  layer.setStyle({ fillOpacity: fillOpacity + 0.2, weight: weight + 1, fill: true });
                },
                mouseout: (e) => {
                  const layer = e.target;
                  layer.setStyle({ fillOpacity: fillOpacity, weight: weight });
                }
              }}
            >
              <Popup>
                <div className="text-slate-900 min-w-[120px]">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-1 mb-2">
                    <span className="font-bold text-xs uppercase text-slate-500">Zone ID</span>
                    <span className="font-mono text-xs font-bold">{zone.id.split('-')[0]}</span>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Risk Level</span>
                      <span className="font-bold" style={{ color }}>{zone.riskLevel}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Density</span>
                      <span className="font-mono">{zone.density.toFixed(1)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Intensity</span>
                      <span className="font-mono">{(intensity * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                </div>
              </Popup>
            </Polygon>
          );
        })}

        {/* Sector View Layer */}
        {sectorPolygon && (
          <Polygon 
            positions={sectorPolygon as any}
            pathOptions={{ color: '#facc15', fillColor: '#facc15', fillOpacity: 0.15, weight: 1, dashArray: '5, 5' }}
          />
        )}

        {/* Alternative Routes Layer */}
        {state.alternativeRoutes && state.alternativeRoutes.map((route, idx) => (
          <Polyline 
            key={`alt-route-${idx}`}
            positions={route.coordinates.map(c => [c.lat, c.lng])}
            pathOptions={{ color: '#94a3b8', weight: 4, dashArray: '5, 10', opacity: 0.5 }}
            eventHandlers={{
              click: () => simulationService.selectRoute(route)
            }}
          />
        ))}

        {/* Selected Route Layer */}
        {state.route && (
          <>
            <Polyline 
              positions={state.route.coordinates.map(c => [c.lat, c.lng])}
              pathOptions={{ 
                color: state.route.type === 'SAFEST' ? '#10b981' : '#3b82f6', 
                weight: 5, 
                opacity: 0.8 
              }}
            />
            <Marker 
              position={[
                state.route.coordinates[state.route.coordinates.length - 1].lat,
                state.route.coordinates[state.route.coordinates.length - 1].lng
              ]}
              icon={L.divIcon({
                className: 'bg-transparent',
                html: `<div class="cursor-pointer transition-transform hover:scale-110 flex items-center justify-center w-8 h-8 rounded-full bg-red-500 border-[3px] border-white shadow-xl text-white">
                         <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                       </div>`,
                iconSize: [32, 32],
                iconAnchor: [16, 32]
              })}
            >
              <Tooltip direction="top" offset={[0, -32]} className="font-sans font-semibold px-2 py-1 bg-slate-900 border-none shadow-lg text-white rounded-lg">
                {destinationLabel || "Destination"}
              </Tooltip>
              <Popup className="custom-popup" offset={[0, -28]}>
                 <div className="p-3 bg-slate-900 border border-slate-700 text-white rounded-lg shadow-xl min-w-[200px] font-sans">
                   <div className="font-bold text-base border-b border-slate-700 pb-2 mb-2 line-clamp-2" title={destinationLabel || "Destination"}>
                     {destinationLabel || "Destination"}
                   </div>
                   <div className="flex flex-col gap-1">
                     <div className="text-sm text-slate-300 flex items-center gap-2">
                       <span className="text-xs font-semibold px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full">Point d'intérêt</span>
                     </div>
                     {state.route.distance > 0 && (
                       <div className="text-sm font-semibold text-emerald-400 mt-1">
                         🛣️ {(state.route.distance / 1000).toFixed(2)} km
                       </div>
                     )}
                     {state.route.duration > 0 && (
                       <div className="text-sm text-slate-300">
                         ⏱️ {Math.ceil(state.route.duration / 60)} min
                       </div>
                     )}
                   </div>
                   <div className="mt-3">
                     <button
                       onClick={() => toast.success("Itinéraire déjà en cours")}
                       className="w-full py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-md transition-colors"
                     >
                       Détailler l'itinéraire
                     </button>
                   </div>
                 </div>
              </Popup>
            </Marker>
          </>
        )}

        {/* Infrastructure Layer */}
        {layerVisibility.infrastructure && infrastructureService.getWays().map(way => {
          let color = '#475569'; // default state, subtle slate
          let weight = 2;
          let dashArray = '';
          let opacity = 0.3; // Low opacity to blend with map

          // Determine styling based on type
          switch (way.type) {
            case 'ROAD':
              color = '#334155';
              weight = 4;
              opacity = 0.3;
              break;
            case 'HIGH_RISK_ROAD':
              color = '#ef4444';
              weight = 4;
              opacity = 0.4;
              break;
            case 'CYCLEWAY':
              color = '#10b981';
              weight = 3;
              opacity = 0.4;
              break;
            case 'SIDEWALK':
            case 'PEDESTRIAN_ZONE':
              // Soft cyan instead of harsh blue to blend without visual offset/error
              color = '#06b6d4'; 
              weight = 2;
              opacity = 0.3;
              break;
            case 'CROSSWALK':
              color = '#f59e0b';
              weight = 4;
              dashArray = '4, 8';
              opacity = 0.4;
              break;
          }

          return (
            <Polyline
              key={`infra-${way.id}`}
              positions={way.geometry.map(c => [c.lat, c.lng])}
              pathOptions={{ color, weight, dashArray, opacity, lineCap: 'round', lineJoin: 'round' }}
            >
              <Popup className="custom-popup border-none">
                <div className="flex flex-col gap-1.5 min-w-[160px] p-1 font-sans">
                  <div className="flex items-center gap-2 border-b border-slate-200 pb-2 mb-1">
                    <span className="text-xl">🛣️</span>
                    <strong className="text-slate-800 font-bold capitalize tracking-tight">
                      {way.type.replace(/_/g, ' ')}
                    </strong>
                  </div>
                  {way.tags.name && (
                    <div className="text-[13px] font-semibold text-slate-700 leading-tight">
                      {way.tags.name}
                    </div>
                  )}
                  {way.tags.highway && (
                    <div className="flex items-center mt-1">
                      <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200 text-xs font-mono font-medium shadow-sm">
                        {way.tags.highway}
                      </span>
                    </div>
                  )}
                </div>
              </Popup>
            </Polyline>
          );
        })}

        {/* Probabilistic Risk Field (Grid) Layer */}
        {layerVisibility.riskField && (() => {
          const riskField = riskFieldService.updateRiskField(displayVrus);
          if (!riskField) return null;
          
          // Performance optimization: Only render cells with meaningful risk
          // Rendering 2500 SVG rectangles 10 times a second freezes the browser
          return riskField.cells
            .filter(cell => cell.riskValue > 0.02)
            .map(cell => {
              // Color mapping: green (0) -> yellow (0.5) -> red (1)
              const hue = (1 - cell.riskValue) * 120; // 120 is green, 0 is red
              const color = `hsl(${hue}, 100%, 50%)`;
              
              const halfRes = riskField.resolution / 2;
              const p1 = moveCoordinate(cell.center, -halfRes, -halfRes);
              const p2 = moveCoordinate(cell.center, halfRes, halfRes);
              const bounds: [number, number][] = [[p1.lat, p1.lng], [p2.lat, p2.lng]];

              const opacity = Math.min(cell.riskValue * 0.7 + 0.1, gridOpacity);

              return (
                <Rectangle
                  key={cell.id}
                  bounds={bounds as any}
                  pathOptions={{
                    color: 'transparent', // Remove faint border for better blending
                    fillColor: color,
                    fillOpacity: opacity,
                    weight: 0
                  }}
                />
              );
            });
        })()}

        {/* Sensor Rays Layer */}
        {layerVisibility.sensors && displayVrus.map(vru => {
          if (!vru.isUserControlled) return null;
          const pos = vru.geolocation?.current || vru.position;
          return vru.sensors.map(sensor => {
            if (sensor.active && sensor.reading) {
              return (
                <React.Fragment key={`${vru.id}-${sensor.id}`}>
                  <Polyline 
                    positions={[
                      [pos.lat, pos.lng],
                      [sensor.reading.lat, sensor.reading.lng]
                    ]}
                    pathOptions={{ color: 'rgba(255,255,255,0.4)', weight: 1, dashArray: '5, 5' }}
                  />
                  <Circle 
                    center={[sensor.reading.lat, sensor.reading.lng]}
                    pathOptions={{ color: 'cyan', fillColor: 'cyan', fillOpacity: 0.5 }}
                    radius={1}
                  />
                </React.Fragment>
              );
            }
            return null;
          });
        })}

        {/* Predicted Paths Layer */}
        {layerVisibility.vrus && displayVrus.map(vru => {
          if (!vru.predictedPath || vru.predictedPath.length === 0 || vru.riskLevel === RiskLevel.SAFE) return null;
          
          let color = '#94a3b8'; // default gray
          if (vru.riskLevel === RiskLevel.CRITICAL) color = '#ef4444'; // red
          else if (vru.riskLevel === RiskLevel.WARNING) color = '#f59e0b'; // orange
          else if (vru.riskLevel === RiskLevel.HIGH) color = '#cbd5e1'; // lighter gray
          
          return (
            <Polyline
              key={`path-${vru.id}`}
              positions={vru.predictedPath.map(c => [c.lat, c.lng])}
              pathOptions={{ 
                color: color, 
                weight: 2, 
                dashArray: '4, 4', 
                opacity: 0.8 
              }}
            />
          );
        })}

        {/* PMR Analysis Segments */}
        {pmrAnalysis && pmrAnalysis.segments.map((segment: any, i: number) => {
          let color = '#3b82f6';
          if (segment.status === 'ADAPTE') color = '#22c55e';
          else if (segment.status === 'PARTIELLEMENT_ADAPTE') color = '#f59e0b';
          else if (segment.status === 'NON_ADAPTE') color = '#ef4444';
          else if (segment.status === 'INCONNU') color = '#94a3b8';

          return (
            <Polyline
              key={`pmr-seg-${i}`}
              positions={segment.path.map((c: any) => [c.lat, c.lng])}
              pathOptions={{ color, weight: 6, opacity: 0.8 }}
            />
          );
        })}

        {/* PMR Obstacles */}
        {pmrAnalysis && pmrAnalysis.segments.flatMap((s: any) => s.obstacles).map((obs: any, i: number) => {
          const obsIcon = L.divIcon({
            className: 'custom-obs-icon',
            html: `<div style="background:#ef4444; color:white; border-radius:50%; width:20px; height:20px; display:flex; align-items:center; justify-content:center; border:2px solid white; font-size:10px;">⚠️</div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          });
          return (
            <Marker key={`obs-${i}`} position={[obs.location.lat, obs.location.lng]} icon={obsIcon}>
              <Popup className="custom-popup border-none" minWidth={200}>
                <div className="flex flex-col gap-1.5 p-1 font-sans text-slate-800">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-1">
                    <strong className="text-slate-900 font-bold text-sm">
                      Obstacle PMR
                    </strong>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">
                      ⚠️
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 mb-1">
                     <div className="font-semibold text-slate-800 mb-1">Type: {obs.type}</div>
                     {obs.description}
                  </div>
                  {onDestinationChange && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onDestinationChange({ lat: obs.location.lat, lng: obs.location.lng, label: `Obstacle PMR (${obs.type})`, source: 'click' });
                      }}
                      className="mt-2 w-full flex items-center justify-center py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm font-medium transition-colors gap-2 text-xs"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
                      Naviguer vers
                    </button>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* VRUs Layer */}
        {layerVisibility.vrus && displayVrus.map(vru => {
          const inSector = layerVisibility.sectorView && userAgent ? isInSector(userAgent, vru) : false;
          const pos = vru.geolocation?.current || vru.position; // this is the effective position (can be map matched)

          // Map Matching Debug UI
          const isMapMatched = vru.matchedWayId !== undefined;
          const showMapMatchDebug = vru.gpsPosition && isMapMatched; // Or check mapMatchingService config

          return (
            <React.Fragment key={vru.id}>
              {/* Debug: Raw GPS Point */}
              {showMapMatchDebug && mapMatchingService.getDebugMode() && (
                <Marker 
                  position={[vru.gpsPosition.lat, vru.gpsPosition.lng]}
                  icon={L.divIcon({
                    className: 'bg-transparent',
                    html: `<div class="w-2 h-2 bg-slate-500 rounded-full border border-white"></div>`,
                    iconSize: [8, 8],
                    iconAnchor: [4, 4]
                  })}
                >
                  <Tooltip>Raw GPS</Tooltip>
                </Marker>
              )}
              {/* Debug: Line connecting GPS to Matched */}
              {showMapMatchDebug && mapMatchingService.getDebugMode() && (
                 <Polyline 
                   positions={[[vru.gpsPosition.lat, vru.gpsPosition.lng], [vru.matchedPosition!.lat, vru.matchedPosition!.lng]]}
                   pathOptions={{ color: '#94a3b8', weight: 1, dashArray: '2, 4' }}
                 />
              )}

              <Marker 
                position={[pos.lat, pos.lng]} 
                icon={getVRUIcon(vru, inSector, vru.isUserControlled)}
              >
                <Popup className="custom-popup border-none" minWidth={200}>
                  <div className="flex flex-col gap-1.5 p-1 font-sans text-slate-800">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-1">
                      <strong className="text-slate-900 font-bold capitalize text-sm">
                        {vru.type.replace(/_/g, ' ')}
                      </strong>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${vru.riskLevel === RiskLevel.CRITICAL ? 'bg-red-100 text-red-700' : vru.riskLevel === RiskLevel.WARNING ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                        {vru.riskLevel}
                      </span>
                    </div>
                    
                    <div className="text-xs text-slate-600 space-y-1">
                      <div className="flex justify-between">
                        <span>Vitesse:</span>
                        <span className="font-medium text-slate-900">{Math.sqrt(vru.velocity.x**2 + vru.velocity.y**2).toFixed(1)} km/h</span>
                      </div>
                      
                      {mapMatchingService.getDebugMode() && vru.mapMatchingConfidence !== undefined && (
                         <div className="flex justify-between text-[10px] text-blue-600 font-bold border-t border-slate-100 pt-1 mt-1">
                            <span>Précision Map:</span>
                            <span>{(vru.mapMatchingConfidence * 100).toFixed(0)}%</span>
                         </div>
                      )}
                      
                      {vru.isUserControlled && (
                        <div className="mt-2 pt-2 border-t border-slate-100 text-[10px]">
                          <div className="flex items-center gap-1">
                            <span className="font-semibold text-slate-500">Source:</span> 
                            <span className={`px-1.5 py-0.5 rounded ${vru.locationSource === 'INDOOR_ANCHOR' ? 'bg-purple-100 text-purple-700 font-bold' : vru.locationSource === 'DEAD_RECKONING' ? 'bg-orange-100 text-orange-700' : 'bg-slate-100'}`}>
                              {vru.locationSource || 'GPS'}
                            </span>
                          </div>
                          {vru.locationFloor !== undefined && (
                            <div className="mt-0.5"><span className="font-semibold text-slate-500">Étage:</span> {vru.locationFloor}</div>
                          )}
                          {vru.locationApartment !== undefined && (
                            <div className="mt-0.5"><span className="font-semibold text-slate-500">Apt:</span> {vru.locationApartment}</div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {!vru.isUserControlled && onDestinationChange && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          onDestinationChange({ lat: pos.lat, lng: pos.lng, label: vru.type, source: 'click' });
                        }}
                        className="mt-2 w-full flex items-center justify-center py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm font-medium transition-colors gap-2 text-xs"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
                        Naviguer vers
                      </button>
                    )}
                  </div>
                </Popup>
              
              {/* Accuracy Circle for User */}
              {vru.isUserControlled && (
                 <Circle 
                   center={[pos.lat, pos.lng]}
                   radius={vru.localizationError}
                   pathOptions={{ color: '#3b82f6', fillOpacity: 0.1, weight: 1, dashArray: '5, 5' }}
                 />
              )}
            </Marker>
            </React.Fragment>
          );
        })}

        {/* Render VRUS... */}
        {/* Nearby Users map rendering removed */}

        {/* Render Active Alerts from Cloud */}
        {activeAlerts.map((alert) => (
          <Circle
            key={`alert-${alert.id}`}
            center={[alert.lat, alert.lng]}
            radius={30}
            pathOptions={{
              color: alert.riskLevel === 'CRITICAL' ? '#ef4444' : '#f59e0b',
              fillColor: alert.riskLevel === 'CRITICAL' ? '#ef4444' : '#f59e0b',
              fillOpacity: 0.3,
              weight: 2,
              dashArray: '5, 5'
            }}
          >
            <Popup className="custom-popup">
              <div className="p-2 bg-slate-900 text-white rounded-lg border border-red-500 shadow-xl min-w-[150px]">
                <div className="font-bold text-red-400 border-b border-slate-700 pb-1 mb-1">⚠️ {alert.riskLevel} ALERT</div>
                <div className="text-xs text-slate-300">Area under high collision risk</div>
              </div>
            </Popup>
          </Circle>
        ))}

        {/* Render DENM Messages */}
        {denmMessages && denmMessages.filter(msg => !dismissedDenms.has(msg.id)).map((msg) => (
          <Circle
            key={`denm-${msg.id}`}
            center={[msg.location.lat, msg.location.lng]}
            radius={50}
            pathOptions={{
              color: msg.riskLevel === 'CRITICAL' ? '#ef4444' : '#f59e0b',
              fillColor: msg.riskLevel === 'CRITICAL' ? '#ef4444' : '#f59e0b',
              fillOpacity: 0.2,
              weight: 3,
              dashArray: '10, 10'
            }}
          >
            <Tooltip direction="top" offset={[0, -20]} opacity={0.9} permanent className="bg-slate-900 border-slate-700 text-white">
              <div className="text-[10px] font-bold flex flex-col items-center gap-1">
                <span className="flex items-center gap-1">📡 {msg.eventType.replace('_', ' ')}</span>
                <span className={`px-1.5 py-0.5 rounded text-[9px] ${msg.riskLevel === 'CRITICAL' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                  {msg.riskLevel}
                </span>
              </div>
            </Tooltip>
            <Popup className="custom-popup">
              <div className="p-3 bg-slate-900 text-white rounded-lg border border-red-500 shadow-2xl min-w-[200px]">
                <div className="font-bold text-red-400 border-b border-slate-700 pb-2 mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span>📡</span> V2X DENM
                  </div>
                  <button 
                    onClick={(e) => handleDismissDenm(msg.id, e)}
                    className="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded px-2 py-1 text-[10px] transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
                <div className="text-xs text-slate-300 mb-1"><strong>Type:</strong> {msg.eventType.replace('_', ' ')}</div>
                <div className="text-xs text-slate-300 mb-1"><strong>Risk:</strong> {msg.riskLevel}</div>
                <div className="text-xs text-slate-300 mb-1"><strong>Sender:</strong> {msg.senderId.substring(0, 8)}...</div>
                <div className="text-[10px] text-slate-500 mt-2">Expires: {new Date(msg.expiresAt).toLocaleTimeString()}</div>
                {onDestinationChange && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onDestinationChange({ lat: msg.location.lat, lng: msg.location.lng, label: `DENM: ${msg.eventType.replace('_', ' ')}`, source: 'click' });
                    }}
                    className="mt-2 w-full flex items-center justify-center py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm font-medium transition-colors gap-2 text-xs"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
                    Naviguer vers
                  </button>
                )}
              </div>
            </Popup>
          </Circle>
        ))}

        {/* Incidents Layer */}
        {layerVisibility.incidents !== false && incidents.map(incident => {
          let iconChar = '⚠️';
          let color = '#f59e0b'; // amber
          
          if (incident.severity === IncidentSeverity.HIGH) color = '#ef4444'; // red
          else if (incident.severity === IncidentSeverity.LOW) color = '#eab308'; // yellow

          switch (incident.type) {
            case IncidentType.ROADWORKS: iconChar = '🚧'; break;
            case IncidentType.ROAD_CLOSED: iconChar = '⛔'; break;
            case IncidentType.SIDEWALK_CLOSED: iconChar = '🚷'; break;
            case IncidentType.DANGER: iconChar = '⚠️'; break;
            case IncidentType.ACCIDENT: iconChar = '💥'; break;
            case IncidentType.OBSTACLE: iconChar = '📦'; break;
          }

          const incidentIcon = L.divIcon({
            className: 'custom-incident-icon',
            html: `
              <div style="
                background-color: ${color};
                width: 24px;
                height: 24px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                border: 2px solid white;
                box-shadow: 0 2px 5px rgba(0,0,0,0.3);
                font-size: 12px;
              ">
                ${iconChar}
              </div>
            `,
            iconSize: [24, 24],
            iconAnchor: [12, 12]
          });

          return (
            <Marker key={incident.id} position={[incident.location.lat, incident.location.lng]} icon={incidentIcon}>
              <Popup className="custom-popup">
                <div className="p-3 bg-slate-900 text-white rounded-lg border border-slate-700 shadow-2xl min-w-[200px]">
                  <div className="font-bold border-b border-slate-700 pb-2 mb-2 flex items-center gap-2" style={{ color }}>
                    {iconChar} {incident.type.replace('_', ' ')}
                  </div>
                  {incident.description && <div className="text-sm text-slate-300 mb-2">{incident.description}</div>}
                  <div className="text-xs text-slate-400 flex items-center justify-between mt-2">
                    <span>Severity: <span style={{ color }}>{incident.severity}</span></span>
                    <span>{Math.round((Date.now() - incident.createdAt) / 60000)}m ago</span>
                  </div>
                  <div className="flex gap-2 mt-3 pt-2 border-t border-slate-800">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        incidentService.upvoteIncident(incident.id);
                      }}
                      className="flex-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 py-1 rounded transition-colors"
                    >
                      👍 Confirm ({incident.upvotes})
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        incidentService.reportSpam(incident.id);
                      }}
                      className="text-xs bg-red-900/30 hover:bg-red-900/50 text-red-400 px-2 py-1 rounded transition-colors"
                      title="Report as spam/fake"
                    >
                      <Ban size={12} />
                    </button>
                  </div>
                  {onDestinationChange && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onDestinationChange({ lat: incident.location.lat, lng: incident.location.lng, label: `${incident.type.replace('_', ' ')} Incident`, source: 'click' });
                      }}
                      className="mt-2 w-full flex items-center justify-center py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm font-medium transition-colors gap-2 text-xs"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
                      Naviguer vers
                    </button>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Active SOS Markers */}
        {activeSosMarkers && activeSosMarkers.map(alert => {
          if (!alert.privateInfo) return null; // exact matching is done via private info
          
          const sosIcon = L.divIcon({
            className: 'custom-sos-icon',
            html: `
              <div class="relative flex items-center justify-center">
                <div class="absolute w-12 h-12 bg-red-500 rounded-full animate-ping opacity-50"></div>
                <div style="
                  background-color: #ef4444; /* red-500 */
                  width: 32px;
                  height: 32px;
                  border-radius: 50%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  border: 3px solid white;
                  box-shadow: 0 4px 10px rgba(239,68,68,0.7);
                  font-size: 16px;
                  z-index: 10;
                  color: white;
                ">
                  🚨
                </div>
              </div>
            `,
            iconSize: [32, 32],
            iconAnchor: [16, 16]
          });

          return (
            <Marker key={alert.id} position={[alert.privateInfo.lat, alert.privateInfo.lng]} icon={sosIcon}>
              <Popup className="custom-popup">
                <div className="p-4 bg-slate-900 text-white rounded-lg border border-red-500 shadow-2xl min-w-[200px]">
                  <div className="font-bold text-red-400 border-b border-red-900/50 pb-2 mb-3 flex items-center gap-2 text-lg">
                    🚨 SOS DETECTED
                  </div>
                  <div className="mb-2">
                    <span className="text-slate-400 text-xs">User:</span>
                    <div className="font-semibold">{alert.privateInfo.displayName || 'Unknown User'}</div>
                  </div>
                  <div className="mb-2">
                    <span className="text-slate-400 text-xs">Type:</span>
                    <div className="text-sm">{alert.vruType}</div>
                  </div>
                  <div className="text-xs text-slate-500 mt-2">
                    {Math.round((Date.now() - alert.createdAt) / 60000)}m ago
                  </div>
                  <button 
                    onClick={() => {
                        window.open(`https://www.google.com/maps/dir/?api=1&destination=${alert.privateInfo!.lat},${alert.privateInfo!.lng}`, '_blank');
                    }}
                    className="mt-3 w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded text-sm font-medium transition-colors"
                  >
                    Navigate to Help
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {selectedPoi && (
          <Popup position={[selectedPoi.lat, selectedPoi.lng]} onClose={() => setSelectedPoi(null)} className="custom-popup">
            <div className="flex flex-col gap-3 min-w-[240px] p-2 font-sans bg-white text-slate-800 rounded-lg">
              {selectedPoi.loading ? (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <>
                  <div>
                    <strong className="text-sm font-bold text-slate-900 block leading-tight">
                      {selectedPoi.data?.name || selectedPoi.data?.display_name?.split(',')[0]}
                    </strong>
                    <span className="text-[11px] text-slate-500 leading-tight block mt-1">
                      {selectedPoi.data?.display_name?.split(',').slice(1).join(',')}
                    </span>
                    {selectedPoi.data?.type && (
                      <span className="inline-block px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-mono mt-2 uppercase tracking-tight">
                        {selectedPoi.data?.type.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                  <button 
                    className="mt-1 w-full bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs py-2 px-3 rounded-md flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                    onClick={() => {
                      const name = selectedPoi.data?.name || selectedPoi.data?.display_name?.split(',')[0] || "Destination";
                      simulationService.setDestination(selectedPoi.lat, selectedPoi.lng, name);
                      if (onDestinationChange) {
                        onDestinationChange({lat: selectedPoi.lat, lng: selectedPoi.lng, source: 'click'});
                      }
                      setSelectedPoi(null);
                    }}
                  >
                    <span>🧭</span> Définir comme destination
                  </button>
                </>
              )}
            </div>
          </Popup>
        )}

      </MapContainer>
      </div>

      <div className="fixed bottom-24 right-6 z-[100000]">
        <button 
          onClick={() => {
            const user = displayVrus.find(v => v.isUserControlled);
            if (user) {
              const pos = user.geolocation?.current || user.position;
              setReportingLocation(pos);
            } else {
              toast.info("Click on the map to place an incident marker");
              setWaitingForIncidentClick(true);
            }
          }}
          className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold py-3 px-4 rounded-full shadow-lg flex items-center gap-2 transition-transform hover:scale-105"
        >
          <AlertTriangle size={18} />
          <span className="hidden sm:inline">Report Issue</span>
        </button>
      </div>

      {reportingLocation && (
        <ReportIncidentModal 
          location={reportingLocation} 
          onClose={() => setReportingLocation(null)} 
          onReported={() => setReportingLocation(null)} 
        />
      )}
    </div>
  );
};

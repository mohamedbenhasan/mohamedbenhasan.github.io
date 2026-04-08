import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polygon, Polyline, Rectangle, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { SimulationState, VRUType, RiskLevel, VRU, Zone } from '../types';
import { INITIAL_CENTER } from '../constants';
import { simulationService } from '../services/SimulationService';
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
import { DENMMessage } from '../types';

import { infrastructureService } from '../services/InfrastructureService';
import { riskFieldService } from '../services/RiskFieldService';

interface Props {
  state: SimulationState;
  dynamicZoom: boolean;
  layerVisibility: {
    zones: boolean;
    vrus: boolean;
    sensors: boolean;
    sectorView: boolean;
    densityHeatmap: boolean;
    riskField: boolean;
    infrastructure: boolean;
    traffic: boolean;
  };
  nearbyUsers?: LiveLocation[];
  activeAlerts?: AlertEvent[];
  denmMessages?: DENMMessage[];
}

  const getPosition = (vru: VRU) => {
    return vru.geolocation?.current || vru.position;
  };

  // Custom Hook for Dynamic Zoom
  const MapController: React.FC<{ state: SimulationState; dynamicZoom: boolean }> = ({ state, dynamicZoom }) => {
    const map = useMap();
    const lastFlyTime = useRef<number>(0);
    const lastBoundsStr = useRef<string>('');
    
    useEffect(() => {
      if (!dynamicZoom) return;

      const user = state.vrus.find(v => v.isUserControlled);
      const critical = state.vrus.filter(v => v.riskLevel === RiskLevel.CRITICAL || v.riskLevel === RiskLevel.WARNING);
      
      let targets: VRU[] = [];
      if (critical.length > 0) {
        targets = critical;
        if (user) targets.push(user);
      } else if (user) {
        targets = [user];
      } else {
        targets = state.vrus;
      }

      if (targets.length === 0) return;

      const bounds = L.latLngBounds(targets.map(t => {
        const pos = t.geolocation?.current || t.position;
        return [pos.lat, pos.lng];
      }));
      
      const boundsStr = bounds.toBBoxString();
      const now = Date.now();
      
      // Only fly if bounds changed significantly or every 2 seconds to avoid interrupting animations
      if (boundsStr !== lastBoundsStr.current && now - lastFlyTime.current > 2000) {
        lastBoundsStr.current = boundsStr;
        lastFlyTime.current = now;
        
        map.flyToBounds(bounds, {
          padding: [50, 50],
          maxZoom: 18,
          duration: 1.5,
          animate: true
        });
      }

    }, [state, dynamicZoom, map]);

    return null;
  };

// Custom Hook for Map Clicks (Set Destination)
const MapClickHandler = () => {
  useMapEvents({
    click(e) {
      simulationService.setDestination(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

// Custom Hook for Map Resizing
const MapResizer = () => {
  const map = useMap();
  useEffect(() => {
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    const container = map.getContainer();
    resizeObserver.observe(container);
    
    return () => {
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

export const MapVisualization: React.FC<Props> = ({ state, dynamicZoom, layerVisibility, nearbyUsers = [], activeAlerts = [], denmMessages = [] }) => {
  const [dismissedDenms, setDismissedDenms] = useState<Set<string>>(new Set());

  const handleDismissDenm = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissedDenms(prev => {
      const newSet = new Set(prev);
      newSet.add(id);
      return newSet;
    });
  };
  
  const getVRUIcon = (vru: VRU, inSector: boolean = false, isOnline: boolean = false) => {
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
            // Nearing critical - Orange highlight with glow
            borderClass = 'border-orange-500 border-4';
            shadowStyle = 'box-shadow: 0 0 15px rgba(249, 115, 22, 0.9);'; 
        } else if (vru.riskLevel === RiskLevel.CRITICAL) {
            // Critical - Red highlight
            borderClass = 'border-red-600 border-4';
            shadowStyle = 'box-shadow: 0 0 20px rgba(239, 68, 68, 1);';
        } else {
            // Safe in sector - Yellow highlight
            borderClass = 'border-yellow-400 border-4';
        }
    }

    const onlineIndicator = isOnline ? 
      '<div style="position:absolute; top:-2px; right:-2px; width:10px; height:10px; background-color:#22c55e; border-radius:50%; border:2px solid white; box-shadow:0 0 4px rgba(34,197,94,0.8);"></div>' : '';

    return L.divIcon({
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
          ${iconChar}
          ${onlineIndicator}
          ${vru.isUserControlled ? '<div style="position:absolute; bottom:-20px; background:black; color:white; padding:2px 4px; border-radius:4px; font-size:10px; white-space:nowrap;">YOU</div>' : ''}
        </div>
      `,
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });
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
    
    // Normalize angles
    const h = user.heading;
    let diff = angleToTarget - h;
    while (diff <= -180) diff += 360;
    while (diff > 180) diff -= 360;
    
    return Math.abs(diff) <= 45;
  };

  const userAgent = state.vrus.find(v => v.isUserControlled);
  const sectorPolygon = (layerVisibility.sectorView && userAgent) ? getSectorPolygon(userAgent) : null;

  return (
    <div className="relative w-full h-full bg-slate-900 overflow-hidden rounded-xl border border-slate-700 shadow-2xl z-0">
      <MapContainer 
        center={[INITIAL_CENTER.lat, INITIAL_CENTER.lng]} 
        zoom={16} 
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          className="map-tiles" // We can filter this in CSS for dark mode
        />

        {/* Real-time Traffic Overlay */}
        {layerVisibility.traffic && (
          <TileLayer
            url="https://mt0.google.com/vt/lyrs=h,traffic&x={x}&y={y}&z={z}"
            attribution="Traffic data &copy; Google"
            opacity={0.8}
            maxZoom={20}
          />
        )}

        <MapController state={state} dynamicZoom={dynamicZoom} />
        <MapClickHandler />
        <MapResizer />
        <MapEventHandler />

        {/* Density Heatmap Layer */}
        {layerVisibility.densityHeatmap && state.vrus.map(vru => {
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
          <Polyline 
            positions={state.route.coordinates.map(c => [c.lat, c.lng])}
            pathOptions={{ 
              color: state.route.type === 'SAFEST' ? '#10b981' : '#3b82f6', 
              weight: 5, 
              opacity: 0.8 
            }}
          />
        )}

        {/* Infrastructure Layer */}
        {layerVisibility.infrastructure && infrastructureService.getWays().map(way => {
          let color = '#94a3b8'; // default gray
          let weight = 2;
          let dashArray = '';
          let opacity = 0.4;

          // Determine styling based on type
          switch (way.type) {
            case 'ROAD':
              color = '#475569';
              weight = 4;
              break;
            case 'HIGH_RISK_ROAD':
              color = '#ef4444';
              weight = 4;
              opacity = 0.6;
              break;
            case 'CYCLEWAY':
              color = '#10b981';
              weight = 3;
              break;
            case 'SIDEWALK':
            case 'PEDESTRIAN_ZONE':
              color = '#3b82f6';
              weight = 3;
              break;
            case 'CROSSWALK':
              color = '#f59e0b';
              weight = 4;
              dashArray = '5, 10';
              break;
          }

          return (
            <Polyline
              key={`infra-${way.id}`}
              positions={way.geometry.map(c => [c.lat, c.lng])}
              pathOptions={{ color, weight, dashArray, opacity }}
            >
              <Popup>
                <div className="text-slate-800">
                  <strong>{way.type}</strong><br/>
                  {way.tags.name && <span>{way.tags.name}<br/></span>}
                  {way.tags.highway && <span className="text-xs text-slate-500">highway: {way.tags.highway}</span>}
                </div>
              </Popup>
            </Polyline>
          );
        })}

        {/* Probabilistic Risk Field (Grid) Layer */}
        {layerVisibility.riskField && (() => {
          const riskField = riskFieldService.updateRiskField(state.vrus);
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

              const opacity = Math.min(cell.riskValue * 0.7 + 0.1, 0.8);

              return (
                <Rectangle
                  key={cell.id}
                  bounds={bounds as any}
                  pathOptions={{
                    color: 'rgba(255,255,255,0.05)', // Very faint border for grid lines
                    fillColor: color,
                    fillOpacity: opacity,
                    weight: 0.5
                  }}
                />
              );
            });
        })()}

        {/* Sensor Rays Layer */}
        {layerVisibility.sensors && state.vrus.map(vru => {
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
        {layerVisibility.vrus && state.vrus.map(vru => {
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

        {/* VRUs Layer */}
        {layerVisibility.vrus && state.vrus.map(vru => {
          const inSector = layerVisibility.sectorView && userAgent ? isInSector(userAgent, vru) : false;
          const pos = vru.geolocation?.current || vru.position;
          return (
            <Marker 
              key={vru.id} 
              position={[pos.lat, pos.lng]} 
              icon={getVRUIcon(vru, inSector, vru.isUserControlled)}
            >
              <Popup>
                <div className="text-slate-800">
                  <strong>{vru.type}</strong><br/>
                  Risk: {vru.riskLevel}<br/>
                  Speed: {Math.sqrt(vru.velocity.x**2 + vru.velocity.y**2).toFixed(1)} m/s
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
          );
        })}

        {/* Render Nearby Users from Cloud */}
        {layerVisibility.vrus && nearbyUsers.map((user) => {
          const isOnline = user.timestamp && (Date.now() - user.timestamp.toMillis() < 15000);
          const onlineIndicator = isOnline ? 
            '<div style="position:absolute; top:-2px; right:-2px; width:10px; height:10px; background-color:#22c55e; border-radius:50%; border:2px solid white; box-shadow:0 0 4px rgba(34,197,94,0.8);"></div>' : '';
            
          return (
            <Marker
              key={`cloud-${user.userId}`}
              position={[user.lat, user.lng]}
              icon={L.divIcon({
                className: 'bg-transparent',
                html: `<div class="flex items-center justify-center w-8 h-8 rounded-full bg-purple-500/20 border-2 border-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)] text-lg backdrop-blur-sm relative">
                         ${user.type === 'CAR' ? '🚗' : user.type === 'BICYCLE' ? '🚲' : '🚶'}
                         ${onlineIndicator}
                       </div>`,
                iconSize: [32, 32],
                iconAnchor: [16, 16]
              })}
            >
              <Popup className="custom-popup">
                <div className="p-2 bg-slate-900 text-white rounded-lg border border-slate-700 shadow-xl min-w-[150px]">
                  <div className="font-bold border-b border-slate-700 pb-1 mb-1 text-purple-400">Cloud VRU</div>
                  <div className="text-xs text-slate-300">ID: {user.userId.substring(0, 8)}...</div>
                  <div className="text-xs text-slate-300">Type: {user.type}</div>
                  <div className={`text-xs mt-1 font-semibold ${isOnline ? 'text-green-400' : 'text-slate-500'}`}>
                    {isOnline ? '● Online' : '○ Offline'}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

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
              </div>
            </Popup>
          </Circle>
        ))}

      </MapContainer>
      
      <div className="absolute top-4 left-4 z-[400] bg-slate-900/90 backdrop-blur px-3 py-2 rounded border border-slate-700 text-xs text-slate-400 flex flex-col gap-1 shadow-lg">
        <span className="font-bold text-white">OPENSTREETMAP | LEAFLET</span>
        <span className={`text-[10px] ${dynamicZoom ? 'text-blue-400' : 'text-slate-500'}`}>
          {dynamicZoom ? 'DYNAMIC ZOOM ACTIVE' : 'FIXED VIEW'}
        </span>
        <span className="text-[10px] text-slate-500 mt-1">Click map to set route destination</span>
      </div>
    </div>
  );
};

import React, { useEffect, useState, useRef } from 'react';
import { CloudRain, Wind, ThermometerSun, Eye, AlertTriangle, X, RefreshCw, MapPin, Navigation } from 'lucide-react';
import { weatherService, WeatherData } from '../services/weatherService';
import { computeImpact, EnvironmentImpact } from '../utils/environmentImpact';

interface SmartConditionsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  userLocation: { lat: number; lng: number } | null;
  mapCenter: { lat: number; lng: number };
  destination: { lat: number; lng: number } | null;
  onImpactChange?: (impact: EnvironmentImpact | null) => void;
}

type LocationMode = 'nearby' | 'destination';

export const SmartConditionsPanel: React.FC<SmartConditionsPanelProps> = ({
  isOpen,
  onClose,
  userLocation,
  mapCenter,
  destination,
  onImpactChange
}) => {
  const [mode, setMode] = useState<LocationMode>('nearby');
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [impact, setImpact] = useState<EnvironmentImpact | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  const fetchWeather = async (lat: number, lng: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await weatherService.fetchWeather(lat, lng);
      setWeather(data);
      const newImpact = computeImpact(data.current, data.hourly, new Date());
      setImpact(newImpact);
      if (onImpactChange) onImpactChange(newImpact);
    } catch (err) {
      setError("Météo indisponible");
    } finally {
      setLoading(false);
    }
  };

  const targetLat = mode === 'destination' && destination ? destination.lat : (userLocation ? userLocation.lat : mapCenter.lat);
  const targetLng = mode === 'destination' && destination ? destination.lng : (userLocation ? userLocation.lng : mapCenter.lng);
  
  // Round to 2 decimal places for dependency to avoid constant refetching on small movements
  const roundedLat = Math.round(targetLat * 100) / 100;
  const roundedLng = Math.round(targetLng * 100) / 100;

  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      fetchWeather(targetLat, targetLng);
    }, 500);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [mode, roundedLat, roundedLng]);

  if (!isOpen) return null;

  const getImpactColor = (level: string) => {
    switch (level) {
      case 'High': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'Medium': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'Low': return 'bg-green-500/20 text-green-400 border-green-500/30';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  const currentHourIndex = new Date().getHours();

  return (
    <div 
      className="w-full sm:w-80 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl shadow-2xl flex flex-col overflow-hidden"
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-slate-800 bg-slate-800/50">
        <div className="flex items-center gap-2">
          <ThermometerSun className="w-5 h-5 text-blue-400" />
          <h3 className="text-sm font-semibold text-white">Smart Conditions</h3>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Mode Selector */}
      <div className="flex p-2 gap-1 bg-slate-800/30">
        <button
          onClick={() => setMode('nearby')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-colors ${mode === 'nearby' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
        >
          <MapPin className="w-3.5 h-3.5" />
          Autour de moi
        </button>
        <button
          onClick={() => setMode('destination')}
          disabled={!destination}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-colors ${mode === 'destination' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'} disabled:opacity-50 disabled:cursor-not-allowed`}
          title={!destination ? "Aucune destination active" : ""}
        >
          <Navigation className="w-3.5 h-3.5" />
          Destination
        </button>
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col gap-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
        {!userLocation && mode === 'nearby' && (
          <div className="text-[10px] text-amber-400/80 bg-amber-400/10 p-1.5 rounded text-center">
            Position non autorisée, utilisation du centre de la carte.
          </div>
        )}

        {loading && !weather ? (
          <div className="flex flex-col items-center justify-center py-8 text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mb-2" />
            <span className="text-xs">Chargement des conditions...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-6 text-slate-400 text-center">
            <AlertTriangle className="w-8 h-8 text-red-400 mb-2" />
            <span className="text-sm text-red-400 mb-3">{error}</span>
            <button 
              onClick={() => {
                const lat = mode === 'destination' && destination ? destination.lat : (userLocation ? userLocation.lat : mapCenter.lat);
                const lng = mode === 'destination' && destination ? destination.lng : (userLocation ? userLocation.lng : mapCenter.lng);
                fetchWeather(lat, lng);
              }}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-xs text-white transition-colors"
            >
              Réessayer
            </button>
          </div>
        ) : weather && impact ? (
          <>
            {/* Now Section */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-white flex items-start">
                  {Math.round(weather.current.temperature_2m)}<span className="text-lg text-slate-400 mt-1">°C</span>
                </div>
                <div className="text-xs text-slate-400">
                  Ressenti {Math.round(weather.current.apparent_temperature)}°C
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 text-xs text-slate-300">
                <div className="flex items-center gap-1.5">
                  <Wind className="w-3.5 h-3.5 text-slate-400" />
                  {weather.current.wind_speed_10m} km/h (Rafales {weather.current.wind_gusts_10m})
                </div>
                <div className="flex items-center gap-1.5">
                  <CloudRain className="w-3.5 h-3.5 text-blue-400" />
                  {weather.current.precipitation} mm
                </div>
              </div>
            </div>

            {/* Impact Sécurité */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Impact Sécurité</h4>
              <div className="grid grid-cols-2 gap-2">
                <div className={`flex items-center justify-between px-2 py-1.5 rounded border ${getImpactColor(impact.slippery)}`}>
                  <span className="text-xs font-medium">Glissance</span>
                  <span className="text-[10px] uppercase font-bold">{impact.slippery}</span>
                </div>
                <div className={`flex items-center justify-between px-2 py-1.5 rounded border ${getImpactColor(impact.visibility)}`}>
                  <span className="text-xs font-medium">Visibilité</span>
                  <span className="text-[10px] uppercase font-bold">{impact.visibility}</span>
                </div>
                <div className={`flex items-center justify-between px-2 py-1.5 rounded border ${getImpactColor(impact.wind)}`}>
                  <span className="text-xs font-medium">Vent</span>
                  <span className="text-[10px] uppercase font-bold">{impact.wind}</span>
                </div>
                <div className={`flex items-center justify-between px-2 py-1.5 rounded border ${getImpactColor(impact.heat)}`}>
                  <span className="text-xs font-medium">Chaleur</span>
                  <span className="text-[10px] uppercase font-bold">{impact.heat}</span>
                </div>
              </div>
              
              {/* Advice */}
              <div className="mt-2 bg-blue-900/20 border border-blue-500/30 rounded p-2">
                <ul className="space-y-1">
                  {impact.adviceText.map((advice, idx) => (
                    <li key={idx} className="text-[11px] text-blue-200 flex items-start gap-1.5">
                      <span className="text-blue-400 mt-0.5">•</span>
                      {advice}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Prochaines heures */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Prochaines heures</h4>
              <div className="flex justify-between gap-2">
                {[0, 1, 2].map((offset) => {
                  const idx = currentHourIndex + offset;
                  if (idx >= weather.hourly.time.length) return null;
                  
                  const timeStr = new Date(weather.hourly.time[idx]).getHours() + "h";
                  const temp = Math.round(weather.hourly.temperature_2m[idx]);
                  const precipProb = weather.hourly.precipitation_probability[idx];
                  
                  return (
                    <div key={offset} className="flex-1 flex flex-col items-center bg-slate-800/50 rounded py-2 border border-slate-700/50">
                      <span className="text-[10px] text-slate-400 mb-1">{offset === 0 ? 'Maintenant' : timeStr}</span>
                      <span className="text-sm font-bold text-white mb-1">{temp}°</span>
                      <div className="flex items-center gap-1 text-[10px] text-blue-400">
                        <CloudRain className="w-3 h-3" />
                        {precipProb}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};

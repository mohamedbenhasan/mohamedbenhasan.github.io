import React, { useState, useEffect, useRef } from 'react';
import { Search, X, MapPin, Loader2 } from 'lucide-react';

interface MapSearchBarProps {
  onDestinationChange: (dest: { lat: number; lng: number; label?: string; source: 'search' | 'click' } | null) => void;
  initialQuery?: string;
}

interface SearchResult {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
}

export const MapSearchBar: React.FC<MapSearchBarProps> = ({ onDestinationChange, initialQuery = '' }) => {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  // Parse coordinates from string
  const parseCoordinates = (input: string): { lat: number; lng: number } | null => {
    // Match formats like "36.8065, 10.1815" or "36.8065 10.1815" or "-36.8, 10.1"
    const regex = /^\s*(-?\d+(?:\.\d+)?)\s*(?:,|\s)\s*(-?\d+(?:\.\d+)?)\s*$/;
    const match = input.match(regex);
    if (match) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return { lat, lng };
      }
    }
    return null;
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const searchTimeout = setTimeout(async () => {
      if (!query.trim() || query === initialQuery) {
        setResults([]);
        setIsOpen(false);
        setError(null);
        return;
      }

      // Check if it's a coordinate first
      const coords = parseCoordinates(query);
      if (coords) {
        setResults([{
          place_id: -1,
          lat: coords.lat.toString(),
          lon: coords.lng.toString(),
          display_name: `Coordinates: ${coords.lat}, ${coords.lng}`
        }]);
        setIsOpen(true);
        setError(null);
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`);
        if (!response.ok) throw new Error('Service unavailable');
        const data = await response.json();
        setResults(data);
        setIsOpen(true);
        if (data.length === 0) {
          setError('Aucun résultat');
        }
      } catch (err) {
        setError('Service indisponible');
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(searchTimeout);
  }, [query, initialQuery]);

  const handleSelect = (result: SearchResult) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    
    setQuery(result.display_name);
    setIsOpen(false);
    
    // Emit event
    onDestinationChange({
      lat,
      lng,
      label: result.display_name,
      source: 'search'
    });
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    setError(null);
    onDestinationChange(null); // Clear destination
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className="relative flex items-center bg-slate-900/80 border border-slate-700 rounded-lg overflow-hidden">
        <div className="pl-3 text-slate-400">
          <Search size={16} />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (query && query !== initialQuery) setIsOpen(true); }}
          placeholder="Rechercher une destination ou lat, lng..."
          className="w-full bg-transparent text-white px-3 py-2 outline-none placeholder-slate-500 text-sm"
        />
        {isLoading && (
          <div className="pr-3 text-slate-400">
            <Loader2 size={16} className="animate-spin" />
          </div>
        )}
        {query && !isLoading && (
          <button onClick={handleClear} className="pr-3 text-slate-400 hover:text-white transition-colors">
            <X size={16} />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (query.trim().length > 0) && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-lg shadow-xl overflow-hidden max-h-60 overflow-y-auto z-[1010]">
          {error ? (
            <div className="p-3 text-sm text-slate-400 text-center">{error}</div>
          ) : results.length > 0 ? (
            <ul className="py-1">
              {results.map((result) => (
                <li key={result.place_id}>
                  <button
                    onClick={() => handleSelect(result)}
                    className="w-full text-left px-3 py-2 hover:bg-slate-800 flex items-start gap-2 transition-colors"
                  >
                    <MapPin size={14} className="text-blue-400 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-slate-200 line-clamp-2">{result.display_name}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </div>
  );
};

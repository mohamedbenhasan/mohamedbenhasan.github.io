import { Coordinates } from '../types';

export interface GeocodingResult {
  name: string;
  lat: number;
  lng: number;
  displayName?: string;
}

class GeocodingService {
  private cache: Map<string, GeocodingResult[]> = new Map();
  private lastRequestTime = 0;
  private readonly rateLimitMs = 1000;

  public async search(query: string): Promise<GeocodingResult[]> {
    const q = query.trim().toLowerCase();
    if (this.cache.has(q)) {
      return this.cache.get(q)!;
    }

    const now = Date.now();
    const timeToWait = Math.max(0, this.lastRequestTime + this.rateLimitMs - now);
    if (timeToWait > 0) {
      await new Promise(resolve => setTimeout(resolve, timeToWait));
    }
    
    this.lastRequestTime = Date.now();

    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=3&addressdetails=1`, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'VRU-Guard-App' // Nominatim requires a User-Agent
        }
      });

      if (!response.ok) {
        throw new Error('Geocoding request failed');
      }

      const data = await response.json();
      const results: GeocodingResult[] = data.map((item: any) => ({
        name: item.name || item.address?.road || item.display_name.split(',')[0],
        displayName: item.display_name,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon)
      }));

      this.cache.set(q, results);
      return results;
    } catch (e) {
      console.error("Geocoding error:", e);
      return [];
    }
  }
}

export const geocodingService = new GeocodingService();

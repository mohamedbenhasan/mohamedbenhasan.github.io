import { Coordinates } from '../types';

export interface POI {
  id: string;
  name: string;
  type: string;
  lat: number;
  lng: number;
  distance?: number;
  tags: Record<string, string>;
}

export class OverpassService {
  private async queryOverpass(query: string): Promise<any> {
    const url = 'https://overpass-api.de/api/interpreter';
    const response = await fetch(url, {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    if (!response.ok) {
      throw new Error(`Overpass API error: ${response.status}`);
    }

    return await response.json();
  }

  // Calculate distance between two coords using Haversine formula
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  public async findNearbyPOI(coords: Coordinates, type: string, radius: number = 1500): Promise<POI[]> {
    let nodeQuery = '';
    
    // Map generic terms to OSM tags
    switch (type) {
      case 'pharmacy':
        nodeQuery = `node["amenity"="pharmacy"]`;
        break;
      case 'hospital':
        nodeQuery = `node["amenity"~"hospital|clinic"]`;
        break;
      case 'parking':
        nodeQuery = `node["amenity"="parking"]`;
        break;
      case 'bank':
        nodeQuery = `node["amenity"="bank"]`;
        break;
      case 'atm':
        nodeQuery = `node["amenity"="atm"]`;
        break;
      case 'restaurant':
        nodeQuery = `node["amenity"~"restaurant|fast_food|cafe"]`;
        break;
      case 'supermarket':
        nodeQuery = `node["shop"~"supermarket|convenience|grocery"]`;
        break;
      case 'fuel':
      case 'gas':
        nodeQuery = `node["amenity"="fuel"]`;
        break;
      default:
        // Generic fallback search by name if type is unknown
        nodeQuery = `node["name"~"${type}",i]`;
    }

    // Overpass QL query: find nodes, ways, and relations in radius around lat,lng
    // Reduced timeout to 10s and default radius to 1500 to keep it fast for voice commands
    const query = `
      [out:json][timeout:10];
      (
        ${nodeQuery.replace(/node/g, 'nwr')}(around:${radius},${coords.lat},${coords.lng});
      );
      out center;
    `;

    try {
      const data = await this.queryOverpass(query);
      
      const results: POI[] = data.elements
        .filter((el: any) => el.tags && el.tags.name)
        .map((el: any) => {
          // For ways/relations, Overpass 'out center' provides center lat/lon
          const lat = el.lat || el.center?.lat;
          const lon = el.lon || el.center?.lon;
          
          if (!lat || !lon) return null;

          return {
            id: el.id.toString(),
            name: el.tags.name,
            type: type,
            lat: lat,
            lng: lon,
            tags: el.tags,
            distance: this.calculateDistance(coords.lat, coords.lng, lat, lon)
          };
        })
        .filter((poi: POI | null) => poi !== null)
        .sort((a: POI, b: POI) => (a.distance || 0) - (b.distance || 0));

      return results.slice(0, 3); // Return top 3
    } catch (e) {
      console.error("Failed to fetch POIs", e);
      return [];
    }
  }
}

export const overpassService = new OverpassService();

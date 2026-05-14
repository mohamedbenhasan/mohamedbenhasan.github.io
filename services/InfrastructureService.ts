import { Coordinates, ViewportBounds, OsmWay, InfrastructureType, VRUType, ZoneSafetyLevel } from '../types';
import { getDistance } from '../utils/geo';

class InfrastructureService {
  private ways: OsmWay[] = [];
  private lastFetchedBounds: ViewportBounds | null = null;
  private isFetching = false;

  public getWays(): OsmWay[] {
    return this.ways;
  }

  public async fetchInfrastructure(bounds: ViewportBounds): Promise<OsmWay[]> {
    if (this.isFetching) return this.ways;
    
    // Check if bounds are within lastFetchedBounds
    if (this.lastFetchedBounds && this.isWithin(bounds, this.lastFetchedBounds)) {
      return this.ways;
    }

    this.isFetching = true;
    try {
      // Expand bounds slightly for caching (approx 1km)
      const expandedBounds = this.expandBounds(bounds, 0.01); 
      
      const query = `
        [out:json][timeout:25];
        (
          way["highway"](${expandedBounds.southWest.lat},${expandedBounds.southWest.lng},${expandedBounds.northEast.lat},${expandedBounds.northEast.lng});
        );
        out geom;
      `;
      
      const endpoints = [
        'https://overpass-api.de/api/interpreter',
        'https://lz4.overpass-api.de/api/interpreter',
        'https://z.overpass-api.de/api/interpreter'
      ];

      let data = null;
      let lastError = null;

      for (const url of endpoints) {
        try {
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: `data=${encodeURIComponent(query)}`
          });
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} from ${url}`);
          }
          
          data = await response.json();
          break; // Success, exit the loop
        } catch (err) {
          console.warn(`Failed to fetch from ${url}, trying next endpoint...`, err);
          lastError = err;
        }
      }

      if (!data) {
        console.warn("All Overpass API endpoints failed, using cached or empty infrastructure data.");
        return this.ways;
      }
      
      this.ways = this.parseOsmData(data.elements);
      this.lastFetchedBounds = expandedBounds;
    } catch (e) {
      console.warn("Failed to fetch infrastructure:", e);
    } finally {
      this.isFetching = false;
    }
    return this.ways;
  }

  public getNearestInfrastructure(pos: Coordinates, radius: number = 30): OsmWay | null {
    let nearestWay: OsmWay | null = null;
    let minDistance = radius;

    for (const way of this.ways) {
      const dist = this.distanceToWay(pos, way);
      if (dist < minDistance) {
        minDistance = dist;
        nearestWay = way;
      }
    }

    return nearestWay;
  }

  private distanceToWay(pos: Coordinates, way: OsmWay): number {
    let minDistance = Infinity;
    for (let i = 0; i < way.geometry.length - 1; i++) {
      const dist = this.distanceToSegment(pos, way.geometry[i], way.geometry[i+1]);
      if (dist < minDistance) {
        minDistance = dist;
      }
    }
    return minDistance;
  }

  private distanceToSegment(p: Coordinates, v: Coordinates, w: Coordinates): number {
    const l2 = Math.pow(v.lat - w.lat, 2) + Math.pow(v.lng - w.lng, 2);
    if (l2 === 0) return getDistance(p, v);
    
    let t = ((p.lat - v.lat) * (w.lat - v.lat) + (p.lng - v.lng) * (w.lng - v.lng)) / l2;
    t = Math.max(0, Math.min(1, t));
    
    const projection = {
      lat: v.lat + t * (w.lat - v.lat),
      lng: v.lng + t * (w.lng - v.lng)
    };
    
    return getDistance(p, projection);
  }

  private isWithin(inner: ViewportBounds, outer: ViewportBounds): boolean {
    return inner.southWest.lat >= outer.southWest.lat &&
           inner.southWest.lng >= outer.southWest.lng &&
           inner.northEast.lat <= outer.northEast.lat &&
           inner.northEast.lng <= outer.northEast.lng;
  }

  private expandBounds(bounds: ViewportBounds, margin: number): ViewportBounds {
    return {
      southWest: {
        lat: bounds.southWest.lat - margin,
        lng: bounds.southWest.lng - margin
      },
      northEast: {
        lat: bounds.northEast.lat + margin,
        lng: bounds.northEast.lng + margin
      }
    };
  }

  private parseOsmData(elements: any[]): OsmWay[] {
    return elements.filter(el => el.type === 'way' && el.geometry).map(el => {
      const tags = el.tags || {};
      const type = this.determineInfrastructureType(tags);
      const safetyLevel = this.determineSafetyLevel(type);
      
      return {
        id: el.id,
        tags,
        geometry: el.geometry.map((g: any) => ({ lat: g.lat, lng: g.lon })),
        type,
        safetyLevel
      };
    });
  }

  private determineInfrastructureType(tags: any): InfrastructureType {
    const highway = tags.highway;
    if (!highway) return InfrastructureType.UNKNOWN;

    switch (highway) {
      case 'motorway':
      case 'motorway_link':
      case 'trunk':
      case 'trunk_link':
      case 'primary':
      case 'primary_link':
        return InfrastructureType.HIGH_RISK_ROAD;
      case 'secondary':
      case 'tertiary':
      case 'unclassified':
      case 'residential':
      case 'service':
        return InfrastructureType.ROAD;
      case 'cycleway':
        return InfrastructureType.CYCLEWAY;
      case 'footway':
      case 'path':
      case 'pedestrian':
      case 'steps':
        return InfrastructureType.SIDEWALK;
      case 'crossing':
        return InfrastructureType.CROSSWALK;
      default:
        return InfrastructureType.UNKNOWN;
    }
  }

  private determineSafetyLevel(type: InfrastructureType): Record<VRUType, ZoneSafetyLevel> {
    return {
      [VRUType.PEDESTRIAN]: this.getPedestrianSafety(type),
      [VRUType.CYCLIST]: this.getCyclistSafety(type),
      [VRUType.SCOOTER]: this.getCyclistSafety(type),
      [VRUType.WHEELCHAIR]: this.getPedestrianSafety(type),
      [VRUType.VEHICLE]: this.getVehicleSafety(type),
      [VRUType.MOTORCYCLE]: this.getVehicleSafety(type)
    };
  }

  private getPedestrianSafety(type: InfrastructureType): ZoneSafetyLevel {
    switch (type) {
      case InfrastructureType.SIDEWALK:
      case InfrastructureType.PEDESTRIAN_ZONE:
      case InfrastructureType.CROSSWALK:
        return ZoneSafetyLevel.SAFE;
      case InfrastructureType.ROAD:
      case InfrastructureType.CYCLEWAY:
      case InfrastructureType.INTERSECTION:
        return ZoneSafetyLevel.DANGEROUS;
      case InfrastructureType.HIGH_RISK_ROAD:
        return ZoneSafetyLevel.RESTRICTED;
      default:
        return ZoneSafetyLevel.MODERATE;
    }
  }

  private getCyclistSafety(type: InfrastructureType): ZoneSafetyLevel {
    switch (type) {
      case InfrastructureType.CYCLEWAY:
        return ZoneSafetyLevel.SAFE;
      case InfrastructureType.ROAD:
        return ZoneSafetyLevel.MODERATE;
      case InfrastructureType.HIGH_RISK_ROAD:
      case InfrastructureType.SIDEWALK:
      case InfrastructureType.PEDESTRIAN_ZONE:
        return ZoneSafetyLevel.RESTRICTED;
      default:
        return ZoneSafetyLevel.MODERATE;
    }
  }

  private getVehicleSafety(type: InfrastructureType): ZoneSafetyLevel {
    switch (type) {
      case InfrastructureType.ROAD:
      case InfrastructureType.HIGH_RISK_ROAD:
      case InfrastructureType.INTERSECTION:
        return ZoneSafetyLevel.SAFE;
      case InfrastructureType.SIDEWALK:
      case InfrastructureType.PEDESTRIAN_ZONE:
      case InfrastructureType.CYCLEWAY:
        return ZoneSafetyLevel.RESTRICTED;
      default:
        return ZoneSafetyLevel.MODERATE;
    }
  }
}

export const infrastructureService = new InfrastructureService();

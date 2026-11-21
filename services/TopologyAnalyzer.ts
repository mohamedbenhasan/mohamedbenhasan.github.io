import { Coordinates } from '../types';
import { getDistance } from '../utils/geo';

export interface RoadSegment {
  id: string;
  type: 'ROAD' | 'INTERSECTION' | 'ROUNDABOUT';
  coordinates: Coordinates[]; // Polyline or Polygon center
  curvature: number; // 0-1 (0 = straight, 1 = hairpin)
  visibility: number; // 0-1 (1 = clear, 0 = blind)
  tags: Record<string, string>; // OSM tags
}

// Mock Road Network
const ROAD_NETWORK: RoadSegment[] = [
  {
    id: 'r1',
    type: 'INTERSECTION',
    coordinates: [{ lat: 48.8566, lng: 2.3522 }],
    curvature: 0,
    visibility: 0.8,
    tags: { highway: 'traffic_signals' }
  },
  {
    id: 'r2',
    type: 'ROUNDABOUT',
    coordinates: [{ lat: 48.8580, lng: 2.3540 }],
    curvature: 0.9,
    visibility: 0.6,
    tags: { junction: 'roundabout' }
  },
  {
    id: 'r3',
    type: 'ROAD',
    coordinates: [{ lat: 48.8590, lng: 2.3550 }],
    curvature: 0.7, // Sharp curve
    visibility: 0.4, // Poor visibility
    tags: { highway: 'residential', curve: 'sharp' }
  },
  {
    id: 'c1',
    type: 'ROAD', // Cycleway
    coordinates: [{ lat: 48.8600, lng: 2.3560 }],
    curvature: 0.1,
    visibility: 1.0,
    tags: { highway: 'cycleway' }
  },
  {
    id: 's1',
    type: 'ROAD', // Sidewalk
    coordinates: [{ lat: 48.8610, lng: 2.3570 }],
    curvature: 0.1,
    visibility: 1.0,
    tags: { highway: 'footway', foot: 'designated' }
  },
  {
    id: 'p1',
    type: 'ROAD', // Pedestrian Zone
    coordinates: [{ lat: 48.8620, lng: 2.3580 }],
    curvature: 0.1,
    visibility: 1.0,
    tags: { highway: 'pedestrian', area: 'yes' }
  }
];

export class TopologyAnalyzer {

  public determineInfrastructureType(tags: Record<string, string>): 'ROAD' | 'CYCLEWAY' | 'SIDEWALK' | 'PEDESTRIAN_ZONE' | 'INTERSECTION' | 'CROSSWALK' | 'ROUNDABOUT' {
    if (tags.junction === 'roundabout') return 'ROUNDABOUT';
    if (tags.highway === 'traffic_signals' || tags.highway === 'crossing') return 'INTERSECTION'; // Simplified
    if (tags.highway === 'cycleway' || tags.cycleway === 'lane' || tags.cycleway === 'track') return 'CYCLEWAY';
    if (tags.highway === 'footway' || tags.highway === 'path' || tags.foot === 'designated') return 'SIDEWALK';
    if (tags.highway === 'pedestrian' || tags.area === 'yes') return 'PEDESTRIAN_ZONE';
    if (tags.highway === 'crossing' || tags.crossing === 'zebra') return 'CROSSWALK';
    
    return 'ROAD'; // Default
  }

  public analyzeTopology(position: Coordinates, heading: number): {
    intersectionDist: number;
    curvature: number;
    isRoundabout: boolean;
    visibility: number;
    score: number;
    infrastructureType?: 'ROAD' | 'CYCLEWAY' | 'SIDEWALK' | 'PEDESTRIAN_ZONE' | 'INTERSECTION' | 'CROSSWALK' | 'ROUNDABOUT';
  } {
    // Find nearest segment
    let nearestSegment: RoadSegment | null = null;
    let minDistance = Infinity;

    for (const segment of ROAD_NETWORK) {
      // Simple distance to point (for mock purposes)
      // In real app, distance to polyline
      const dist = getDistance(position, segment.coordinates[0]);
      if (dist < minDistance) {
        minDistance = dist;
        nearestSegment = segment;
      }
    }

    // Defaults
    let intersectionDist = 1000;
    let curvature = 0.1;
    let isRoundabout = false;
    let visibility = 1.0;
    let infraType: any = 'ROAD';

    if (nearestSegment && minDistance < 50) {
      // We are "on" or near this segment
      infraType = this.determineInfrastructureType(nearestSegment.tags);
      
      if (nearestSegment.type === 'INTERSECTION') {
        intersectionDist = minDistance;
        infraType = 'INTERSECTION';
      } else if (nearestSegment.type === 'ROUNDABOUT') {
        isRoundabout = true;
        curvature = 0.8; // Roundabouts are curved
        infraType = 'ROUNDABOUT';
      } else {
        curvature = nearestSegment.curvature;
      }

      visibility = nearestSegment.visibility;
    } else {
      // Procedural generation for areas outside mock zones
      // Simulate curvature based on position hash
      const hash = Math.abs(Math.sin(position.lat * 5000 + position.lng * 5000));
      curvature = hash > 0.8 ? 0.7 : 0.1;
      
      // Simulate intersection proximity periodically
      const gridX = Math.floor(position.lat * 1000);
      const gridY = Math.floor(position.lng * 1000);
      if ((gridX + gridY) % 10 === 0) {
        intersectionDist = 20; // Simulated intersection
        infraType = 'INTERSECTION';
      }
    }

    // Normalize Scores
    // Intersection: 0m = 1.0 risk, >100m = 0.0 risk
    const normIntersection = Math.max(0, 1 - (intersectionDist / 100));
    
    // Curvature: 0-1 directly
    const normCurvature = curvature;

    // Roundabout: 0 or 1
    const normRoundabout = isRoundabout ? 1.0 : 0.0;

    // Visibility: 1=Clear (Low Risk), 0=Blind (High Risk)
    // Invert for Risk Score: 1 - visibility
    const normVisibilityRisk = 1 - visibility;

    // Weighted Topology Score
    const score = (
      (normIntersection * 0.4) +
      (normCurvature * 0.3) +
      (normRoundabout * 0.2) +
      (normVisibilityRisk * 0.1)
    );

    return {
      intersectionDist: normIntersection,
      curvature: normCurvature,
      isRoundabout: isRoundabout,
      visibility: normVisibilityRisk,
      score: Math.min(1, score),
      infrastructureType: infraType
    };
  }
}

export const topologyAnalyzer = new TopologyAnalyzer();

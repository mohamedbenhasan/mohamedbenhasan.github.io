import { Coordinates, OsmWay, VRU } from '../types';
import { bearingDegrees, angleDiffDegrees, pointToSegmentDistanceMeters, projectPointOnSegment } from '../utils/geo';
import { infrastructureService } from './InfrastructureService';

export interface MapMatchingConfig {
  searchRadius: number;
  maxGapMeters: number;
  scoreMargin: number;
  confidenceThreshold: number;
  weights: {
    a: number; // Angle
    b: number; // Distance
    c: number; // Bikeability
  };
}

export interface MatchResult {
  matchedPosition: Coordinates;
  matchedWayId: number;
  confidence: number;
}

export class MapMatchingService {
  private config: MapMatchingConfig = {
    searchRadius: 15,
    maxGapMeters: 20,
    scoreMargin: 0.15,
    confidenceThreshold: 0.6, // from the user instruction
    weights: { a: 3, b: 1, c: 1 }
  };
  
  private isEnabled: boolean = true;
  private isDebugMode: boolean = false;
  
  public setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
  }
  
  public getEnabled() {
    return this.isEnabled;
  }
  
  public setDebugMode(debug: boolean) {
    this.isDebugMode = debug;
  }
  
  public getDebugMode() {
    return this.isDebugMode;
  }

  public updateConfig(newConfig: Partial<MapMatchingConfig>) {
    this.config = { ...this.config, ...newConfig };
  }

  private computeBikeabilityK(tags: Record<string, string>): number {
    const hw = tags.highway;
    const cw = tags.cycleway;
    
    if (hw === 'cycleway' || cw === 'track' || tags.segregated === 'yes') {
      return 5;
    }
    if (cw === 'lane' || tags['cycleway:left'] === 'lane' || tags['cycleway:right'] === 'lane') {
      return 4;
    }
    if (cw === 'share_busway' || tags.busway) {
      return 3;
    }
    if ((hw === 'path' || hw === 'footway') && tags.bicycle === 'yes' && tags.foot === 'yes') {
      return 2;
    }
    if (tags.oneway === 'yes' && (cw?.startsWith('opposite') || tags['oneway:bicycle'] === 'no')) {
      return 1;
    }
    return 0;
  }

  public match(
    point: Coordinates, 
    heading: number | null, 
    prevPoint: Coordinates | null, 
    nextPoint: Coordinates | null, 
    prevMatchedWayId: number | null
  ): MatchResult | null {
    if (!this.isEnabled) return null;

    // 1. CANDIDATS
    const ways = infrastructureService.getWays(); // Using the cached ways from Overpass
    // Actually we only want to match against cycleway, path, footway, etc.
    const candidates = [];
    
    for (const way of ways) {
       for (let i = 0; i < way.geometry.length - 1; i++) {
         const p1 = way.geometry[i];
         const p2 = way.geometry[i+1];
         // check rough distance via bounding box approximation first for speed, or just use pointToSegmentDistanceMeters
         const dist = pointToSegmentDistanceMeters(point, p1, p2);
         if (dist <= this.config.searchRadius) {
           candidates.push({ way, p1, p2, dist });
         }
       }
    }
    
    if (candidates.length === 0) return null;
    
    // 2. Trajectory Direction
    let trajectoryAngle = 0;
    if (prevPoint && nextPoint) {
      trajectoryAngle = bearingDegrees(prevPoint, nextPoint);
    } else if (heading !== null) {
      trajectoryAngle = heading;
    } else if (prevPoint) {
      trajectoryAngle = bearingDegrees(prevPoint, point);
    } // else fallback to 0 but angle diff will be somewhat chaotic without direction.

    // 3. Score Evaluation
    const { a, b, c } = this.config.weights;
    
    const evaluated = candidates.map(cnd => {
      // Gamma (Angle)
      const segmentBearing = bearingDegrees(cnd.p1, cnd.p2);
      // Cyclists can travel both directions on many ways unless oneway. We could check both directions 
      // but let's take the minimum angle diff between both orientations if not strictly oneway.
      const diff1 = angleDiffDegrees(trajectoryAngle, segmentBearing);
      const diff2 = angleDiffDegrees(trajectoryAngle, (segmentBearing + 180) % 360);
      const alpha = Math.min(diff1, diff2); // Simplify by assuming bi-directional for now, unless we parse oneway strictly
      
      const gamma = (180 - alpha) / 180;
      
      // Lambda (Distance)
      const lambdaScore = (this.config.searchRadius - cnd.dist) / this.config.searchRadius;
      
      // Beta (Bikeability)
      const kappa = this.computeBikeabilityK(cnd.way.tags);
      const beta = kappa / 5;
      
      // Zeta (Global Score)
      const zeta = a * gamma + b * lambdaScore + c * beta;
      const confidence = zeta / (a + b + c);

      const proj = projectPointOnSegment(point, cnd.p1, cnd.p2);
      
      return { 
        ...cnd, 
        gamma, lambdaScore, beta, 
        zeta, confidence, 
        matchedPosition: proj 
      };
    });
    
    evaluated.sort((x, y) => y.zeta - x.zeta);
    let bestMatch = evaluated[0];

    // 4. CONSISTENCY CHECK (topologique)
    if (prevMatchedWayId !== null && bestMatch.way.id !== prevMatchedWayId) {
      // Check if we should stick to prevMatched if it's close in score
      const prevWayMatch = evaluated.find(e => e.way.id === prevMatchedWayId);
      if (prevWayMatch && (bestMatch.zeta - prevWayMatch.zeta) < this.config.scoreMargin) {
        // Fallback to previous segment to avoid jumping
        bestMatch = prevWayMatch;
      }
    }
    
    if (bestMatch.confidence < this.config.confidenceThreshold) {
       return null; // Fallback to raw GPS in consumer
    }
    
    return {
      matchedPosition: bestMatch.matchedPosition,
      matchedWayId: bestMatch.way.id,
      confidence: bestMatch.confidence
    };
  }
}

export const mapMatchingService = new MapMatchingService();

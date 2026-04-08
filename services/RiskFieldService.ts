import { Coordinates, VRU, GridCell, RiskFieldGrid, ViewportBounds, ZoneSafetyLevel, RiskLevel } from '../types';
import { getDistance, moveCoordinate } from '../utils/geo';
import { infrastructureService } from './InfrastructureService';
import { V2XService } from './V2XService';

class RiskFieldService {
  private grid: RiskFieldGrid | null = null;
  private readonly DECAY_RATE = 0.15; // Slightly faster decay for more dynamic feel
  private readonly GAUSSIAN_RADIUS_FACTOR = 5; // Radius of influence relative to sigma

  public updateRiskField(vrus: VRU[], viewport?: ViewportBounds, zoom: number = 16): RiskFieldGrid | null {
    if (!viewport) return this.grid;

    const now = Date.now();
    
    // 1. Calculate adaptive resolution based on zoom
    // Zoom 18: 5m, Zoom 16: 10m, Zoom 14: 20m, Zoom 12: 40m
    const resolution = Math.max(5, Math.pow(2, 18 - zoom) * 5);
    
    // 2. Initialize or update grid based on viewport and resolution
    if (!this.grid || 
        this.grid.resolution !== resolution || 
        this.isViewportChanged(this.grid.bounds, viewport)) {
      const user = vrus.find(v => v.isUserControlled);
      this.grid = this.initializeGridFromViewport(viewport, resolution, zoom, user);
    } else {
      // Decay existing risk values
      this.grid.cells.forEach(cell => {
        const base = cell.baseRisk || 0;
        if (cell.riskValue > base) {
          cell.riskValue = base + (cell.riskValue - base) * (1 - this.DECAY_RATE);
          if (cell.riskValue - base < 0.01) cell.riskValue = base;
        }
      });
    }

    // 3. Accumulate risk from each VRU
    vrus.forEach(vru => {
      // Gaussian parameters
      const speed = Math.sqrt(vru.velocity.x ** 2 + vru.velocity.y ** 2);
      const headingRad = (vru.heading * Math.PI) / 180;
      
      const baseSigma = vru.type === 'VEHICLE' ? 12 : 4;
      const sigmaLong = baseSigma + speed * 1.5;
      const sigmaLat = baseSigma;
      
      // Influence radius (max of long/lat sigma * factor)
      const influenceRadius = Math.max(sigmaLong, sigmaLat) * this.GAUSSIAN_RADIUS_FACTOR;

      // Find cells within influence radius - Optimized with bounding box
      const nearbyCells = this.grid!.cells.filter(cell => {
        const latDiff = Math.abs(cell.center.lat - vru.position.lat);
        const lngDiff = Math.abs(cell.center.lng - vru.position.lng);
        // Approx 1 degree = 111km. influenceRadius is in meters.
        const degreeThreshold = influenceRadius / 111000;
        if (latDiff > degreeThreshold || lngDiff > degreeThreshold) return false;
        
        return getDistance(cell.center, vru.position) < influenceRadius;
      });

      nearbyCells.forEach(cell => {
        const dist = getDistance(vru.position, cell.center);
        const angleToCell = Math.atan2(
          cell.center.lat - vru.position.lat,
          cell.center.lng - vru.position.lng
        );
        
        const relAngle = angleToCell - headingRad;
        const x_rel = dist * Math.cos(relAngle);
        const y_rel = dist * Math.sin(relAngle);
        
        const exponent = -( (x_rel**2 / (2 * sigmaLong**2)) + (y_rel**2 / (2 * sigmaLat**2)) );
        const contribution = Math.exp(exponent);
        
        // Accumulate
        cell.riskValue = Math.min(1, cell.riskValue + contribution * 0.6);
        cell.lastUpdate = now;
      });
    });

    // 4. Accumulate risk from DENM messages
    const activeDenmMessages = V2XService.getActiveMessages();
    activeDenmMessages.forEach(msg => {
      const influenceRadius = msg.riskLevel === RiskLevel.CRITICAL ? 50 : 
                              msg.riskLevel === RiskLevel.HIGH ? 30 : 
                              msg.riskLevel === RiskLevel.WARNING ? 15 : 5;
      
      const riskContribution = msg.riskLevel === RiskLevel.CRITICAL ? 0.9 : 
                               msg.riskLevel === RiskLevel.HIGH ? 0.7 : 
                               msg.riskLevel === RiskLevel.WARNING ? 0.4 : 0.1;

      const nearbyCells = this.grid!.cells.filter(cell => {
        const latDiff = Math.abs(cell.center.lat - msg.location.lat);
        const lngDiff = Math.abs(cell.center.lng - msg.location.lng);
        const degreeThreshold = influenceRadius / 111000;
        if (latDiff > degreeThreshold || lngDiff > degreeThreshold) return false;
        
        return getDistance(cell.center, msg.location) < influenceRadius;
      });

      nearbyCells.forEach(cell => {
        const dist = getDistance(msg.location, cell.center);
        // Simple linear decay for DENM messages
        const contribution = riskContribution * (1 - dist / influenceRadius);
        if (contribution > 0) {
          cell.riskValue = Math.min(1, cell.riskValue + contribution);
          cell.lastUpdate = now;
        }
      });
    });

    return this.grid;
  }

  private isViewportChanged(oldBounds?: ViewportBounds, newBounds?: ViewportBounds): boolean {
    if (!oldBounds || !newBounds) return true;
    // Check if center moved significantly or bounds changed
    const oldCenter = {
      lat: (oldBounds.northEast.lat + oldBounds.southWest.lat) / 2,
      lng: (oldBounds.northEast.lng + oldBounds.southWest.lng) / 2
    };
    const newCenter = {
      lat: (newBounds.northEast.lat + newBounds.southWest.lat) / 2,
      lng: (newBounds.northEast.lng + newBounds.southWest.lng) / 2
    };
    
    return getDistance(oldCenter, newCenter) > 50; // Re-init if moved > 50m
  }

  private initializeGridFromViewport(viewport: ViewportBounds, resolution: number, zoom: number, user?: VRU): RiskFieldGrid {
    const cells: GridCell[] = [];
    
    const latStart = Math.min(viewport.northEast.lat, viewport.southWest.lat);
    const latEnd = Math.max(viewport.northEast.lat, viewport.southWest.lat);
    const lngStart = Math.min(viewport.northEast.lng, viewport.southWest.lng);
    const lngEnd = Math.max(viewport.northEast.lng, viewport.southWest.lng);

    // Calculate cell counts
    const latDist = getDistance({ lat: latStart, lng: lngStart }, { lat: latEnd, lng: lngStart });
    const lngDist = getDistance({ lat: latStart, lng: lngStart }, { lat: latStart, lng: lngEnd });
    
    // Cap at 35x35 (1225 cells) instead of 50x50 (2500) to prevent browser freezing
    const latCount = Math.min(35, Math.floor(latDist / resolution));
    const lngCount = Math.min(35, Math.floor(lngDist / resolution));
    
    const latStep = (latEnd - latStart) / latCount;
    const lngStep = (lngEnd - lngStart) / lngCount;

    for (let i = 0; i < latCount; i++) {
      for (let j = 0; j < lngCount; j++) {
        const cellCenter = {
          lat: latStart + (i + 0.5) * latStep,
          lng: lngStart + (j + 0.5) * lngStep
        };
        
        // Simple pseudo-random function for historical risk hotspots
        const seed = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453;
        let baseRisk = (seed - Math.floor(seed)) > 0.95 ? 0.4 : 0; // 5% of cells have historical risk

        // Add infrastructure risk if user is present
        if (user) {
          const nearestInfra = infrastructureService.getNearestInfrastructure(cellCenter, resolution);
          if (nearestInfra) {
            const safetyLevel = nearestInfra.safetyLevel[user.type];
            if (safetyLevel === ZoneSafetyLevel.DANGEROUS) {
              baseRisk = Math.max(baseRisk, 0.6);
            } else if (safetyLevel === ZoneSafetyLevel.RESTRICTED) {
              baseRisk = Math.max(baseRisk, 0.9);
            } else if (safetyLevel === ZoneSafetyLevel.SAFE) {
              baseRisk = 0; // Safe zones override historical risk
            }
          }
        }

        cells.push({
          id: `cell-${i}-${j}`,
          center: cellCenter,
          riskValue: baseRisk,
          baseRisk: baseRisk,
          lastUpdate: Date.now()
        });
      }
    }

    return {
      cells,
      resolution,
      origin: { lat: (latStart + latEnd) / 2, lng: (lngStart + lngEnd) / 2 },
      bounds: viewport,
      zoom
    };
  }
}

export const riskFieldService = new RiskFieldService();

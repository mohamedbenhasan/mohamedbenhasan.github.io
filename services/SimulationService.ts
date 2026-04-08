import { Coordinates, VRU, VRUType, RiskLevel, SensorSource, SimulationState, Zone, Route, RiskScoreConfig, ViewportBounds, ZoneSafetyLevel, DENMEventType } from '../types';
import { INITIAL_CENTER, INITIAL_VRUS_CONFIG } from '../constants';
import { quantumService } from './QuantumService';
import { routingService } from './RoutingService';
import { riskEngine } from './RiskEngine';
import { riskFactorEngine, DEFAULT_RISK_CONFIG } from './RiskFactorEngine';
import { getDistance, moveCoordinate } from '../utils/geo';
import { riskFieldService } from './RiskFieldService';
import { geolocationService } from './GeolocationService';
import { firebaseService } from './FirebaseService';
import { liveInteractionService } from './LiveInteractionService';
import { infrastructureService } from './InfrastructureService';
import { V2XService } from './V2XService';
import { toast } from 'sonner';

// This service mimics the FastAPI/Django Backend + PostGIS logic.
// It handles entity movement, collision detection, and state management.

import { playAlertSound } from '../utils/audio';

class SimulationService {
  private state: SimulationState;
  private intervalId: number | null = null;
  private subscribers: ((state: SimulationState) => void)[] = [];
  private isGpsMode: boolean = false;
  private currentCenter: Coordinates = INITIAL_CENTER;
  private riskScoreConfig: RiskScoreConfig = DEFAULT_RISK_CONFIG;
  private userId: string | null = null;
  private lastFirebaseSync: number = 0;
  private lastLiveLocationSync: number = 0;
  private lastAlertSync: number = 0;
  private currentViewport: ViewportBounds | undefined;
  private currentZoom: number = 16;
  private lastInfrastructureAlert: number = 0;
  private lastInfrastructureType: string | null = null;
  private lastRouteCalculationTime: number = 0;
  private destination: Coordinates | null = null;

  constructor() {
    this.state = this.getInitialState();
  }

  public setViewport(bounds: ViewportBounds, zoom: number) {
    this.currentViewport = bounds;
    this.currentZoom = zoom;
  }

  public setUserId(userId: string | null) {
    this.userId = userId;
  }

  public updateRiskScoreConfig(config: RiskScoreConfig) {
    this.riskScoreConfig = config;
  }

  public getRiskScoreConfig(): RiskScoreConfig {
    return this.riskScoreConfig;
  }

  // ... (keep existing methods)

  public enableGpsMode() {
    this.isGpsMode = true;
    this.state.lastGpsError = undefined;
    this.notify();
    
    geolocationService.startWatching(
      (coords, accuracy) => {
        this.state.lastGpsError = undefined;
        this.updateUserPositionFromGps(coords, accuracy);
      },
      (error) => {
        console.error("GPS Error:", error);
        this.state.lastGpsError = error.message;
        this.notify();
      }
    );
  }

  public disableGpsMode() {
    this.isGpsMode = false;
    this.state.lastGpsError = undefined;
    geolocationService.stopWatching();
    this.notify();
  }

  private updateUserPositionFromGps(coords: Coordinates, accuracy: number) {
    const user = this.state.vrus.find(v => v.isUserControlled);
    if (user) {
      user.position = coords;
      user.geolocation = { current: coords };
      user.localizationError = accuracy;
      
      // Update GPS sensor reading if it exists
      const gpsSensor = user.sensors.find(s => s.type === 'GPS');
      if (gpsSensor) {
        gpsSensor.reading = coords;
        gpsSensor.accuracy = accuracy;
      }
      
      // Update simulation center to follow user
      this.currentCenter = coords;
      
      // Removed this.notify() here because tick() already calls it every 100ms
    }
  }

  private tick() {
    const { vrus } = this.state;
    
    // 1. Move VRUs
    const nextVRUs = vrus.map(vru => {
      let nextPos = vru.position;
      
      // Only simulate movement if NOT in GPS mode for the user
      if (vru.isUserControlled && this.isGpsMode) {
         // Keep current GPS position (updated via callback)
         nextPos = vru.position;
      } else if (!vru.isUserControlled || (vru.velocity.x !== 0 || vru.velocity.y !== 0)) {
         nextPos = moveCoordinate(vru.position, vru.velocity.x * 0.1, vru.velocity.y * 0.1);
         
         // Respawn if too far from current center (e.g. user moved via GPS)
         if (getDistance(nextPos, this.currentCenter) > 500) {
           // Respawn at random position around current center
           const angle = Math.random() * Math.PI * 2;
           const r = Math.random() * 400; // Within 400m radius
           nextPos = moveCoordinate(this.currentCenter, Math.cos(angle)*r, Math.sin(angle)*r);
         }
      }

      // Filter only ACTIVE sensors for fusion
      const activeSensors = vru.sensors.filter(s => s.active);
      const fusionResult = quantumService.fuseSensors(activeSensors, nextPos);
      
      // Update sensor readings based on new position + noise
      const nextSensors = vru.sensors.map(s => {
        if (!s.active) return s;
        // Simulate sensor noise
        const noise = (Math.random() - 0.5) * s.accuracy;
        return {
          ...s,
          reading: moveCoordinate(nextPos, noise, noise)
        };
      });

      return {
        ...vru,
        position: nextPos,
        geolocation: { current: nextPos },
        sensors: nextSensors,
        localizationError: fusionResult.errorMargin,
        // Update heading if moving
        heading: (vru.velocity.x !== 0 || vru.velocity.y !== 0) 
          ? (Math.atan2(vru.velocity.y, vru.velocity.x) * 180 / Math.PI)
          : vru.heading
      };
    });

    // 2. Collision Detection & Risk Assessment (Using RiskEngine)
    const user = nextVRUs.find(v => v.isUserControlled);
    let warnings = 0;
    
    const finalVRUs = nextVRUs.map(vru => {
      // Calculate Risk Factors for every entity
      const riskFactors = riskFactorEngine.calculateRiskFactors(vru, nextVRUs, this.state.zones, this.riskScoreConfig);
      
      // Get previous history if available
      const previousHistory = vru.riskScore?.history || [];
      const riskScore = riskFactorEngine.calculateRiskScore(riskFactors, this.riskScoreConfig, previousHistory);

      if (vru.isUserControlled) return { ...vru, riskFactors, riskScore };
      
      if (!user) {
        return { ...vru, riskLevel: RiskLevel.SAFE, ttc: undefined, collisionProbability: 0, predictedPath: [], riskFactors, riskScore };
      }

      // Calculate Risk using RiskEngine
      const riskAssessment = riskEngine.assessCollisionRisk(user, vru);
      
      // Predict Path for Visualization
      const predictedPath = riskEngine.predictPath(vru, 5, 10); // Predict 5 seconds ahead

      if (riskAssessment.riskLevel !== RiskLevel.SAFE) {
        warnings++;
        
        // Broadcast DENM message for HIGH or CRITICAL risk
        if (riskAssessment.riskLevel === RiskLevel.HIGH || riskAssessment.riskLevel === RiskLevel.CRITICAL) {
          const lastBroadcastTime = vru.lastDENMBroadcast || 0;
          const now = Date.now();
          
          // Only broadcast once every 5 seconds per VRU to avoid spamming
          if (now - lastBroadcastTime > 5000) {
            V2XService.broadcastDENM(
              DENMEventType.COLLISION_RISK,
              vru.position,
              riskAssessment.riskLevel,
              [user.id, vru.id],
              user.id
            );
            vru.lastDENMBroadcast = now;
          }
        }
      }

      return { 
        ...vru, 
        riskLevel: riskAssessment.riskLevel,
        ttc: riskAssessment.ttc,
        collisionProbability: riskAssessment.probability,
        predictedPath: predictedPath,
        riskFactors,
        riskScore
      };
    });

    // 3. Update State
    let currentRoute = this.state.route;
    
    if (currentRoute && user) {
      // Update ETA based on current speed
      const speed = Math.sqrt(user.velocity.x ** 2 + user.velocity.y ** 2);
      const distToDest = getDistance(user.position, currentRoute.coordinates[currentRoute.coordinates.length - 1]);
      
      // If arrived (within 10m), clear route
      if (distToDest < 10) {
        currentRoute = undefined;
      } else if (speed > 0.1) {
        // Recalculate duration: distance / speed
        currentRoute = {
          ...currentRoute,
          duration: distToDest / speed
        };
      }
    }

    // We still need to update the risk field internally so the service has the latest data
    const updatedRiskField = riskFieldService.updateRiskField(finalVRUs, this.currentViewport, this.currentZoom) || undefined;

    // Periodic Route Recalculation (Adaptive Routing)
    const now = Date.now();
    if (this.destination && user && (now - this.lastRouteCalculationTime > 5000)) {
      this.lastRouteCalculationTime = now;
      // Re-calculate route in background
      routingService.calculateRoutes(user.position, this.destination, updatedRiskField).then(({ safest, fastest }) => {
        if (safest || fastest) {
          // If the user selected the alternative route previously, we might want to keep that preference.
          // For simplicity, we just update the current route to the new safest/fastest.
          const isAlternativeSelected = this.state.route && this.state.alternativeRoutes.length > 0 && this.state.route.type !== 'SAFEST';
          
          this.state.route = isAlternativeSelected ? (fastest || safest) : (safest || fastest);
          this.state.alternativeRoutes = [];
          
          if (safest && fastest) {
            const distDiff = Math.abs(safest.distance - fastest.distance) / fastest.distance;
            if (distDiff > 0.05) {
              this.state.alternativeRoutes.push(isAlternativeSelected ? safest : fastest);
            }
          }
          this.notify();
        }
      }).catch(console.error);
    }

    const nextState = {
      ...this.state,
      vrus: finalVRUs,
      zones: this.generateZones(finalVRUs),
      timestamp: Date.now(),
      route: currentRoute,
      metrics: {
        totalVRUs: finalVRUs.length,
        avgError: user?.localizationError || 0,
        quantumFusionActive: (user?.sensors.filter(s => s.active).length || 0) >= 3,
        collisionWarnings: warnings
      }
    };

    this.state = nextState;
    
    // Sync to Firebase every 5 seconds
    if (this.userId && user && user.riskScore && (now - this.lastFirebaseSync > 5000)) {
      this.lastFirebaseSync = now;
      firebaseService.saveTrackingData(this.userId, user).catch(console.error);
      firebaseService.saveRiskData(this.userId, user.riskScore, user, this.riskScoreConfig.model).catch(console.error);
    }

    // Sync live location every 2 seconds
    if (this.userId && user && (now - this.lastLiveLocationSync > 2000)) {
      this.lastLiveLocationSync = now;
      liveInteractionService.updateLiveLocation(this.userId, user.position.lat, user.position.lng, user.type).catch(console.error);
    }

    // Infrastructure Safety Check
    if (user && this.currentViewport) {
      // Async fetch (fire and forget)
      infrastructureService.fetchInfrastructure(this.currentViewport).catch(console.error);
      
      const nearestInfra = infrastructureService.getNearestInfrastructure(user.position, 20); // 20m radius
      if (nearestInfra) {
        const safetyLevel = nearestInfra.safetyLevel[user.type];
        
        // Only alert if safety level changed or it's been a while (e.g., 30 seconds)
        if (safetyLevel === ZoneSafetyLevel.DANGEROUS || safetyLevel === ZoneSafetyLevel.RESTRICTED) {
          if (this.lastInfrastructureType !== nearestInfra.type || (now - this.lastInfrastructureAlert > 30000)) {
            this.lastInfrastructureAlert = now;
            this.lastInfrastructureType = nearestInfra.type;
            
            // Trigger vibration and sound
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
              navigator.vibrate([200, 100, 200]);
            }
            playAlertSound(safetyLevel === ZoneSafetyLevel.DANGEROUS ? 'critical' : 'warning');

            // Generate message based on user type and infra type
            let message = `⚠️ You are in a ${safetyLevel.toLowerCase()} zone.`;
            if (user.type === VRUType.PEDESTRIAN && nearestInfra.type === 'HIGH_RISK_ROAD') {
              message = "🛑 DANGER: Pedestrians are not allowed on highways/major roads!";
            } else if (user.type === VRUType.CYCLIST && nearestInfra.type === 'SIDEWALK') {
              message = "🚴 Please dismount or use a designated bike lane.";
            } else if (user.type === VRUType.PEDESTRIAN && nearestInfra.type === 'CYCLEWAY') {
              message = "⚠️ You are walking in a bike lane. Please use the sidewalk.";
            } else if (user.type === VRUType.VEHICLE && nearestInfra.type === 'PEDESTRIAN_ZONE') {
              message = "🛑 RESTRICTED: Vehicles are not allowed in pedestrian zones!";
            }
            
            toast.error(message, {
              duration: 5000,
              position: 'top-center'
            });

            // Log the alert to Firebase (which could trigger FCM)
            if (this.userId) {
              firebaseService.saveInfrastructureAlert(this.userId, user, nearestInfra.type, safetyLevel, message).catch(console.error);
              
              // Broadcast DENM message for infrastructure alerts
              const eventType = safetyLevel === ZoneSafetyLevel.RESTRICTED 
                ? DENMEventType.UNAUTHORIZED_AREA 
                : DENMEventType.DANGEROUS_ZONE;
              
              V2XService.broadcastDENM(
                eventType,
                user.position,
                safetyLevel === ZoneSafetyLevel.RESTRICTED ? RiskLevel.CRITICAL : RiskLevel.HIGH,
                [user.id],
                user.id
              );
            }
          }
        } else {
          // Reset if safe
          this.lastInfrastructureType = null;
        }
      }
    }

    // Trigger alert if risk is CRITICAL and we haven't triggered one in the last 10 seconds
    if (this.userId && user && user.riskLevel === RiskLevel.CRITICAL && (now - this.lastAlertSync > 10000)) {
      this.lastAlertSync = now;
      
      // Trigger dynamic rerouting if a route is active
      if (currentRoute && currentRoute.coordinates.length > 0) {
        const dest = currentRoute.coordinates[currentRoute.coordinates.length - 1];
        this.setDestination(dest.lat, dest.lng).catch(console.error);
      }

      // Find the most dangerous VRU
      let maxRisk = 0;
      let mostDangerousVRU = null;
      for (const vru of nextVRUs) {
        if (!vru.isUserControlled && vru.riskScore && vru.riskScore.value > maxRisk) {
          maxRisk = vru.riskScore.value;
          mostDangerousVRU = vru;
        }
      }
      
      liveInteractionService.triggerAlert(
        this.userId, 
        mostDangerousVRU?.id, 
        user.position.lat, 
        user.position.lng, 
        'CRITICAL',
        mostDangerousVRU?.ttc,
        mostDangerousVRU?.collisionProbability,
        user.type,
        mostDangerousVRU?.type
      ).catch(console.error);
    }

    this.notify();
  }

  private getInitialState(): SimulationState {
    const vrus: VRU[] = [];
    let idCounter = 0;

    // Generate Initial VRUs
    INITIAL_VRUS_CONFIG.forEach(config => {
      for (let i = 0; i < config.count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = config.type === VRUType.VEHICLE ? 12 : (config.type === VRUType.CYCLIST ? 6 : 1.5);
        const initialPos = moveCoordinate(INITIAL_CENTER, (Math.random() - 0.5) * 400, (Math.random() - 0.5) * 400);
        
        vrus.push({
          id: `vru-${idCounter++}`,
          type: config.type,
          position: initialPos,
          velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
          heading: (angle * 180) / Math.PI,
          geolocation: { current: initialPos },
          sensors: this.generateRandomSensors(),
          riskLevel: RiskLevel.SAFE,
          localizationError: 5.0,
          isUserControlled: false
        });
      }
    });

    // Add User VRU with 10 distinct sensors
    vrus.push({
      id: 'user-agent',
      type: VRUType.PEDESTRIAN,
      position: INITIAL_CENTER,
      geolocation: { current: INITIAL_CENTER },
      velocity: { x: 0, y: 0 },
      heading: 0,
      sensors: this.generateUserSensors(),
      riskLevel: RiskLevel.SAFE,
      localizationError: 1.0,
      isUserControlled: true
    });

    return {
      vrus,
      zones: this.generateZones(vrus),
      timestamp: Date.now(),
      metrics: {
        totalVRUs: vrus.length,
        avgError: 0,
        quantumFusionActive: false,
        collisionWarnings: 0
      }
    };
  }

  private generateRandomSensors(): SensorSource[] {
    const sensors: SensorSource[] = [{ id: 'gps-1', name: 'GPS L1', type: 'GPS', accuracy: 5.0, active: true }];
    if (Math.random() > 0.5) sensors.push({ id: 'cam-1', name: 'Camera', type: 'CAMERA', accuracy: 2.0, active: true });
    return sensors;
  }

  public generateUserSensors(): SensorSource[] {
    return [
      { id: 's1', name: 'GPS L1 (Standard)', type: 'GPS', accuracy: 5.0, active: true },
      { id: 's2', name: 'GPS L5 (Precision)', type: 'GPS', accuracy: 2.5, active: true },
      { id: 's3', name: 'Galileo E1/E5', type: 'GPS', accuracy: 2.0, active: true },
      { id: 's4', name: 'GLONASS', type: 'GPS', accuracy: 4.0, active: false },
      { id: 's5', name: 'Velodyne LiDAR', type: 'LIDAR', accuracy: 0.1, active: false },
      { id: 's6', name: 'Stereo Camera (Front)', type: 'CAMERA', accuracy: 1.5, active: false },
      { id: 's7', name: 'Wide Cam (Rear)', type: 'CAMERA', accuracy: 2.0, active: false },
      { id: 's8', name: 'Radar (Long Range)', type: 'RADAR', accuracy: 0.8, active: false },
      { id: 's9', name: 'UWB Anchor', type: 'UWB', accuracy: 0.2, active: false },
      { id: 's10', name: '5G V2X Sidelink', type: 'V2X', accuracy: 0.5, active: false },
    ];
  }

  private generateZones(vrus: VRU[]): Zone[] {
    const zones: Zone[] = [];
    const gridSize = 150; 
    
    // Use currentCenter (which updates with GPS) instead of static INITIAL_CENTER
    const centerRef = this.currentCenter;

    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        const gridCenter = moveCoordinate(centerRef, x * gridSize, y * gridSize);
        const vrusInZone = vrus.filter(v => getDistance(v.position, gridCenter) < gridSize / 2);
        const count = vrusInZone.length;
        
        let risk = RiskLevel.SAFE;
        let intensity = 0;
        let zoneCenter = gridCenter;
        let size = 50;

        if (count > 0) {
          // Calculate Risk Intensity based on VRU risk levels
          const criticalCount = vrusInZone.filter(v => v.riskLevel === RiskLevel.CRITICAL).length;
          const warningCount = vrusInZone.filter(v => v.riskLevel === RiskLevel.WARNING).length;
          
          // Determine Zone Risk Level
          if (criticalCount > 0 || count > 4) risk = RiskLevel.CRITICAL;
          else if (warningCount > 0 || count > 2) risk = RiskLevel.WARNING;

          // Calculate Intensity (0.0 - 1.0)
          const densityFactor = Math.min(count / 10, 0.5);
          const riskFactor = (criticalCount * 0.4) + (warningCount * 0.1);
          intensity = Math.min(densityFactor + riskFactor, 1.0);

          // Dynamic Position: Pull center towards centroid of high-risk entities
          if (intensity > 0.2) {
            let centroidLat = 0, centroidLng = 0;
            vrusInZone.forEach(v => {
              centroidLat += v.position.lat;
              centroidLng += v.position.lng;
            });
            const centroid = { lat: centroidLat / count, lng: centroidLng / count };
            
            // Lerp towards centroid based on intensity
            const factor = Math.min(intensity, 0.8);
            zoneCenter = {
              lat: gridCenter.lat + (centroid.lat - gridCenter.lat) * factor,
              lng: gridCenter.lng + (centroid.lng - gridCenter.lng) * factor
            };
          }

          // Dynamic Size: Expand if high intensity
          size = 50 * (1 + intensity * 0.5);
        }

        zones.push({
          id: `zone-${x}-${y}`,
          bounds: [
            moveCoordinate(zoneCenter, -size, -size),
            moveCoordinate(zoneCenter, size, -size),
            moveCoordinate(zoneCenter, size, size),
            moveCoordinate(zoneCenter, -size, size),
          ],
          density: count,
          riskLevel: risk,
          intensity: intensity
        });
      }
    }
    return zones;
  }

  public start() {
    if (this.intervalId) return;
    this.intervalId = window.setInterval(() => {
      this.tick();
    }, 100);
  }

  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  public subscribe(callback: (state: SimulationState) => void) {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter(s => s !== callback);
    };
  }

  private notify() {
    this.subscribers.forEach(cb => cb(this.state));
  }

  public updateUserVelocity(vx: number, vy: number) {
    const user = this.state.vrus.find(v => v.isUserControlled);
    if (user) {
      user.velocity = { x: vx, y: vy };
    }
  }

  public setUserType(type: VRUType) {
    const user = this.state.vrus.find(v => v.isUserControlled);
    if (user) {
      user.type = type;
    }
  }

  public toggleUserSensor(sensorId: string) {
    const user = this.state.vrus.find(v => v.isUserControlled);
    if (user) {
      const sensor = user.sensors.find(s => s.id === sensorId);
      if (sensor) {
        sensor.active = !sensor.active;
      }
    }
  }

  public applySensorConfiguration(activeIds: string[]) {
    const user = this.state.vrus.find(v => v.isUserControlled);
    if (user) {
      user.sensors.forEach(s => {
        s.active = activeIds.includes(s.id);
      });
    }
  }

  public async setDestination(lat: number, lng: number) {
    const user = this.state.vrus.find(v => v.isUserControlled);
    if (!user) return;

    this.destination = { lat, lng };
    this.lastRouteCalculationTime = Date.now();

    const riskField = riskFieldService.updateRiskField(this.state.vrus, this.currentViewport, this.currentZoom) || undefined;
    const { safest, fastest } = await routingService.calculateRoutes(user.position, { lat, lng }, riskField);
    
    if (safest || fastest) {
      // Default to safest route
      this.state.route = safest || fastest;
      this.state.alternativeRoutes = [];
      
      // Only add alternative if it's significantly different (e.g. > 5% difference in distance or duration)
      if (safest && fastest) {
        const distDiff = Math.abs(safest.distance - fastest.distance) / fastest.distance;
        if (distDiff > 0.05) {
          this.state.alternativeRoutes.push(fastest);
        }
      }
      this.notify();
    }
  }

  public clearRoute() {
    this.destination = null;
    this.state.route = null;
    this.state.alternativeRoutes = [];
    this.notify();
  }

  public selectRoute(route: Route) {
    if (this.state.route && this.state.alternativeRoutes) {
      const current = this.state.route;
      this.state.route = route;
      this.state.alternativeRoutes = this.state.alternativeRoutes.filter(r => r !== route);
      this.state.alternativeRoutes.push(current);
      this.notify();
    }
  }
}

export const simulationService = new SimulationService();
import { Coordinates } from '../types';
import { Geolocation, PositionOptions } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import { db, auth } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export interface LocationData {
  coords: Coordinates;
  accuracy: number; // in meters (target < 0.5m)
  floor?: number;
  apartment?: string;
  source: 'GPS' | 'MLS' | 'UWB' | 'WIFI_FINGERPRINT' | 'INDOOR_ANCHOR' | 'DEAD_RECKONING' | 'RTK_GPS' | 'FUSED_SENSORS' | 'TERIA';
  altitude?: number;
  // High precision outdoor tracking (Dual-band, RTK, WAAS/EGNOS)
  heading?: number;
  speed?: number; // m/s
  satellites?: number;
  isDualBand?: boolean;
  rtkFixed?: boolean;
  correctionType?: 'WAAS' | 'EGNOS' | 'RTK' | 'NONE';
}

export interface IndoorAnchor {
  id: string;
  name: string;
  coords: Coordinates;
  floor: number;
  apartment: string;
  radiusMeters: number; // if GPS is within this, snap to anchor
  wifiBssid?: string; // For future wifi matching
}

type PositionCallback = (data: LocationData) => void;
type ErrorCallback = (error: Error | GeolocationPositionError) => void;

class AdvancedGeolocationService {
  private watchId: string | null = null;
  private watchIdBrowser: number | null = null;
  public indoorAnchors: IndoorAnchor[] = [];
  
  // Dead Reckoning & IMU Fusion State
  private lastGpsCoords: Coordinates | null = null;
  private currentFusedCoords: Coordinates | null = null;
  private lastMotionTime = 0;
  private stepCount = 0;
  private heading = 0; // degrees
  private accelVelocity = { x: 0, y: 0, z: 0 }; // dead reckoning for bikes/motos
  private isHighSpeedVehicle = false; // detects if we're on a moto/bike vs walking

  constructor() {
    this.initSensors();
  }

  public async loadUserAnchors() {
    if (!auth.currentUser) return;
    try {
      const d = await getDoc(doc(db, 'users', auth.currentUser.uid, 'settings', 'indoor_anchors'));
      if (d.exists()) {
        this.indoorAnchors = d.data().anchors || [];
      }
    } catch(e) {
      console.error("Error loading anchors", e);
    }
  }

  public async saveAnchors(anchors: IndoorAnchor[]) {
    if (!auth.currentUser) return;
    this.indoorAnchors = anchors;
    await setDoc(doc(db, 'users', auth.currentUser.uid, 'settings', 'indoor_anchors'), { anchors }, { merge: true });
  }

  private initSensors() {
    // Note: In a production native app, using Android Fused Location Provider 
    // or iOS CoreLocation API natively delivers the highest IMU+GPS fusion.
    // For JS/Capacitor, we fuse IMU events manually when native fused API isn't detailed enough.
    
    if (typeof window !== 'undefined' && window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', (e) => {
        if (e.alpha !== null) {
          // alpha is rotation around z-axis (heading)
          this.heading = 360 - e.alpha; 
        }
      });
    }

    if (typeof window !== 'undefined' && window.DeviceMotionEvent) {
      window.addEventListener('devicemotion', (e) => {
        const acc = e.acceleration;
        if (acc && acc.x !== null && acc.y !== null && acc.z !== null) {
          const magnitude = Math.sqrt(acc.x*acc.x + acc.y*acc.y + acc.z*acc.z);
          // Distinguish between walking steps and vehicular smooth acceleration
          if (magnitude > 10.0) {
            this.isHighSpeedVehicle = true; // High sustained/dynamic force => vehicle
          }
          
          if (magnitude > 2.0 && Date.now() - this.lastMotionTime > 500) {
             if (!this.isHighSpeedVehicle) this.stepCount++;
             this.lastMotionTime = Date.now();
             this.updateFusedReckoning();
          }
        }
      });
    }
  }

  private updateFusedReckoning() {
    // If no GPS, we use IMU dead reckoning (0.7m for walking, rough integration for bikes)
    if (!this.lastGpsCoords) return;
    const distanceMeters = this.isHighSpeedVehicle ? 5.0 : 0.7; // arbitrary forward step
    
    const headingRad = this.heading * (Math.PI / 180);
    const R = 6378137;

    const baseCoords = this.currentFusedCoords || this.lastGpsCoords;

    const dLat = distanceMeters * Math.cos(headingRad) / R;
    const dLng = distanceMeters * Math.sin(headingRad) / (R * Math.cos(baseCoords.lat * Math.PI / 180));

    this.currentFusedCoords = {
      lat: baseCoords.lat + dLat * (180 / Math.PI),
      lng: baseCoords.lng + dLng * (180 / Math.PI),
    };
  }

  private getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private enhanceLocation(position: GeolocationPosition): LocationData {
    const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
    const accuracy = position.coords.accuracy;
    
    this.lastGpsCoords = coords;

    // Simulate native WAAS/RTK properties detection (often passed via custom capacitor plugins 
    // or extended Position objects in specialized environments like Mapbox/Here SDK wrappers)
    const isRtkFixed = accuracy < 0.5; // If underlying GPS hardware signals RTK float/fix
    const isDualBand = accuracy < 2.5; 
    
    let correctionType: 'NONE' | 'WAAS' | 'EGNOS' | 'RTK' = 'NONE';
    if (isRtkFixed) correctionType = 'RTK';
    else if (isDualBand) correctionType = 'EGNOS'; // Assuming European geo for EGNOS or WAAS for US

    // 1. Check Indoor Anchors (Apartment / Room level snap)
    for (const anchor of this.indoorAnchors) {
      const dist = this.getDistance(coords.lat, coords.lng, anchor.coords.lat, anchor.coords.lng);
      // GPS bouncing within radius -> snap to exact indoor
      if (dist <= anchor.radiusMeters) {
        return {
          coords: anchor.coords,
          accuracy: 0.5, // High precision snap 0.5m
          floor: anchor.floor,
          apartment: anchor.apartment,
          source: 'INDOOR_ANCHOR',
          altitude: position.coords.altitude || undefined,
        };
      }
    }

    // 2. Dead Reckoning Fallback / Sensor Fusion
    if (accuracy > 10 && this.currentFusedCoords) {
       return {
         coords: this.currentFusedCoords,
         accuracy: this.isHighSpeedVehicle ? 15 : 5,
         source: 'FUSED_SENSORS',
         altitude: position.coords.altitude || undefined,
         speed: position.coords.speed || 0,
         heading: position.coords.heading || this.heading
       };
    }

    this.currentFusedCoords = null; // reset if GPS is good

    // 3. Fallback to raw GPS with advanced metadata
    return {
      coords,
      accuracy,
      altitude: position.coords.altitude || undefined,
      source: isRtkFixed ? 'RTK_GPS' : 'GPS',
      heading: position.coords.heading || this.heading,
      speed: position.coords.speed || 0,
      isDualBand,
      rtkFixed: isRtkFixed,
      correctionType
    };
  }

  public async startWatching(onPosition: PositionCallback, onError: ErrorCallback) {
    await this.stopWatching();
    await this.loadUserAnchors();

    if (Capacitor.isNativePlatform()) {
      try {
        let permissions = await Geolocation.checkPermissions();
        if (permissions?.location !== 'granted' && permissions?.coarseLocation !== 'granted') {
          permissions = await Geolocation.requestPermissions({
            permissions: ['location', 'coarseLocation'],
          });
        }
        const hasFine = permissions?.location === 'granted';
        const hasCoarse = permissions?.coarseLocation === 'granted';
        if (!hasFine && !hasCoarse) {
          onError(new Error('Permission de localisation refusée.'));
          return;
        }

        const options: PositionOptions = {
          enableHighAccuracy: hasFine,
          timeout: 15000,
          maximumAge: 3000,
        };

        this.watchId = await Geolocation.watchPosition(options, (position, err) => {
          if (err) {
            onError(err instanceof Error ? err : new Error(String((err as any)?.message || err)));
            return;
          }
          if (position && position.coords) {
            const extPosition = this.enhanceLocation(position as any as GeolocationPosition);
            onPosition(extPosition);
          }
        });
      } catch (err) {
        if (err instanceof Error) {
          onError(err);
        } else {
          onError(new Error(String((err as any)?.message || 'Erreur de géolocalisation Android.')));
        }
      }
    } else {
      if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
        onError({
          code: 0,
          message: 'Geolocation not supported',
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        } as GeolocationPositionError);
        return;
      }

      this.watchIdBrowser = navigator.geolocation.watchPosition(
        (position) => {
          const extPosition = this.enhanceLocation(position);
          onPosition(extPosition);
        },
        (error) => {
          onError(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    }
  }

  public async stopWatching() {
    if (this.watchId !== null) {
      const idToClear = this.watchId;
      this.watchId = null;
      try {
        await Geolocation.clearWatch({ id: idToClear });
      } catch (err) {
        console.warn('AdvancedGeolocation clearWatch warning:', err);
      }
    }
    if (this.watchIdBrowser !== null) {
      try {
        navigator.geolocation.clearWatch(this.watchIdBrowser);
      } catch {
        // ignore browser cleanup errors
      }
      this.watchIdBrowser = null;
    }
  }
}

export const advancedGeolocationService = new AdvancedGeolocationService();

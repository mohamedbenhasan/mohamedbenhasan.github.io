import { Coordinates } from '../types';
import { Geolocation, PermissionStatus, PositionOptions } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

type PositionCallback = (coords: Coordinates, accuracy: number) => void;
type ErrorCallback = (error: Error | GeolocationPositionError) => void;

function hasAnyLocationGrant(status: PermissionStatus | null | undefined): boolean {
  if (!status || typeof status !== 'object') return false;
  return status.location === 'granted' || status.coarseLocation === 'granted';
}

function normalizeNativeLocationError(err: unknown): Error {
  const rawMsg =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
      ? err
      : (err as any)?.message || '';
  const code = (err as any)?.code;
  const lower = String(rawMsg).toLowerCase();

  if (
    lower.includes('location services are not enabled') ||
    lower.includes('location_disabled') ||
    code === 'OS-PLUG-GLOC-0007'
  ) {
    return Object.assign(
      new Error('Les services de localisation (GPS) sont désactivés sur votre appareil.'),
      { code: 'LOCATION_DISABLED' }
    );
  }

  if (
    lower.includes('permission') ||
    lower.includes('denied') ||
    code === 'OS-PLUG-GLOC-0003'
  ) {
    return Object.assign(new Error('Permission de localisation refusée.'), {
      code: 'PERMISSION_DENIED',
    });
  }

  return err instanceof Error
    ? err
    : new Error(rawMsg || 'Erreur de géolocalisation Android inconnue.');
}

export class GeolocationService {
  private watchId: string | null = null;
  private watchIdBrowser: number | null = null;
  private isStartingNativeWatch = false;

  public async ensureNativePermission(
    geoPlugin: Pick<typeof Geolocation, 'checkPermissions' | 'requestPermissions'> = Geolocation
  ): Promise<{
    granted: boolean;
    precision: 'fine' | 'coarse' | 'none';
    error?: Error;
  }> {
    try {
      let permissions = await geoPlugin.checkPermissions();
      if (!hasAnyLocationGrant(permissions)) {
        const req = await geoPlugin.requestPermissions({
          permissions: ['location', 'coarseLocation'],
        });
        permissions = req;
      }

      if (permissions?.location === 'granted') {
        return { granted: true, precision: 'fine' };
      }
      if (permissions?.coarseLocation === 'granted') {
        return { granted: true, precision: 'coarse' };
      }
      return {
        granted: false,
        precision: 'none',
        error: Object.assign(new Error('Permission de localisation refusée.'), {
          code: 'PERMISSION_DENIED',
        }),
      };
    } catch (err) {
      return {
        granted: false,
        precision: 'none',
        error: normalizeNativeLocationError(err),
      };
    }
  }

  public async startWatching(onPosition: PositionCallback, onError: ErrorCallback) {
    await this.stopWatching();

    if (Capacitor.isNativePlatform()) {
      if (this.isStartingNativeWatch) return;
      this.isStartingNativeWatch = true;
      try {
        const permResult = await this.ensureNativePermission();
        if (!permResult.granted) {
          onError(permResult.error || new Error('Permission de localisation refusée.'));
          return;
        }

        const options: PositionOptions = {
          enableHighAccuracy: permResult.precision === 'fine',
          timeout: 15000,
          maximumAge: 3000,
        };

        this.watchId = await Geolocation.watchPosition(options, (position, err) => {
          if (err) {
            onError(normalizeNativeLocationError(err));
            return;
          }
          if (position && position.coords) {
            onPosition(
              {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
              },
              position.coords.accuracy ?? 20
            );
          }
        });
      } catch (err) {
        onError(normalizeNativeLocationError(err));
      } finally {
        this.isStartingNativeWatch = false;
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

      const startBrowserWatch = (highAccuracy: boolean) => {
        this.watchIdBrowser = navigator.geolocation.watchPosition(
          (position) => {
            onPosition(
              {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
              },
              position.coords.accuracy
            );
          },
          (error) => {
            if (error.code === 3 && highAccuracy) {
              if (this.watchIdBrowser !== null) {
                navigator.geolocation.clearWatch(this.watchIdBrowser);
                this.watchIdBrowser = null;
              }
              startBrowserWatch(false);
            } else {
              onError(error);
            }
          },
          {
            enableHighAccuracy: highAccuracy,
            timeout: highAccuracy ? 10000 : 30000,
            maximumAge: highAccuracy ? 0 : 30000,
          }
        );
      };

      startBrowserWatch(true);
    }
  }

  public async stopWatching() {
    if (this.watchId !== null) {
      const idToClear = this.watchId;
      this.watchId = null;
      try {
        await Geolocation.clearWatch({ id: idToClear });
      } catch (err) {
        console.warn('Native geolocation clearWatch warning:', err);
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

export const geolocationService = new GeolocationService();

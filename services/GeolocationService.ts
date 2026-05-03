import { Coordinates } from '../types';
import { Geolocation, PositionOptions } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

type PositionCallback = (coords: Coordinates, accuracy: number) => void;
type ErrorCallback = (error: Error | GeolocationPositionError) => void;

export class GeolocationService {
  private watchId: string | null = null;
  private watchIdBrowser: number | null = null;

  public async startWatching(onPosition: PositionCallback, onError: ErrorCallback) {
    if (Capacitor.isNativePlatform()) {
      try {
        const permissions = await Geolocation.checkPermissions();
        if (permissions.location !== 'granted') {
          const req = await Geolocation.requestPermissions();
          if (req.location !== 'granted') {
            onError(new Error("Location permission denied."));
            return;
          }
        }

        const options: PositionOptions = {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        };

        this.watchId = await Geolocation.watchPosition(options, (position, err) => {
          if (err) {
            onError(err);
            return;
          }
          if (position) {
            onPosition(
              {
                lat: position.coords.latitude,
                lng: position.coords.longitude
              },
              position.coords.accuracy
            );
          }
        });
      } catch (err) {
        if (err instanceof Error) {
          onError(err);
        } else {
          onError(new Error("Unknown geolocation error"));
        }
      }
    } else {
      if (!('geolocation' in navigator)) {
        onError({ code: 0, message: 'Geolocation not supported', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError);
        return;
      }

      this.watchIdBrowser = navigator.geolocation.watchPosition(
        (position) => {
          onPosition(
            {
              lat: position.coords.latitude,
              lng: position.coords.longitude
            },
            position.coords.accuracy
          );
        },
        (error) => {
          onError(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    }
  }

  public async stopWatching() {
    if (this.watchId !== null) {
      await Geolocation.clearWatch({ id: this.watchId });
      this.watchId = null;
    }
    if (this.watchIdBrowser !== null) {
      navigator.geolocation.clearWatch(this.watchIdBrowser);
      this.watchIdBrowser = null;
    }
  }
}

export const geolocationService = new GeolocationService();

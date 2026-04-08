import { Coordinates } from '../types';

type PositionCallback = (coords: Coordinates, accuracy: number) => void;
type ErrorCallback = (error: GeolocationPositionError) => void;

export class GeolocationService {
  private watchId: number | null = null;

  public startWatching(onPosition: PositionCallback, onError: ErrorCallback) {
    if (!('geolocation' in navigator)) {
      onError({ code: 0, message: 'Geolocation not supported' } as GeolocationPositionError);
      return;
    }

    this.watchId = navigator.geolocation.watchPosition(
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

  public stopWatching() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }
}

export const geolocationService = new GeolocationService();

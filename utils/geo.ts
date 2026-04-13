import { Coordinates } from '../types';

export const EARTH_RADIUS = 6371000; // meters

export function getDistance(a: Coordinates, b: Coordinates): number {
  const R = EARTH_RADIUS;
  const φ1 = a.lat * Math.PI/180;
  const φ2 = b.lat * Math.PI/180;
  const Δφ = (b.lat-a.lat) * Math.PI/180;
  const Δλ = (b.lng-a.lng) * Math.PI/180;

  const x = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));

  return R * c;
}

export function moveCoordinate(coord: Coordinates, dx: number, dy: number): Coordinates {
  const dLat = (dy / EARTH_RADIUS) * (180 / Math.PI);
  const dLng = (dx / (EARTH_RADIUS * Math.cos((Math.PI * coord.lat) / 180))) * (180 / Math.PI);
  return {
    lat: coord.lat + dLat,
    lng: coord.lng + dLng
  };
}

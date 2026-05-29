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

export function bearingDegrees(a: Coordinates, b: Coordinates): number {
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const brng = Math.atan2(y, x) * 180 / Math.PI;
  return (brng + 360) % 360;
}

export function angleDiffDegrees(angle1: number, angle2: number): number {
  const diff = Math.abs(angle1 - angle2) % 360;
  return diff > 180 ? 360 - diff : diff;
}

// Projection using equirectangular approximation for small distances
export function projectPointOnSegment(p: Coordinates, v: Coordinates, w: Coordinates): Coordinates {
  const latRatio = 111320; // approx meters per degree lat
  const lngRatio = 40075000 * Math.cos(v.lat * Math.PI / 180) / 360; // approx meters per degree lng

  const pv = { x: (p.lng - v.lng) * lngRatio, y: (p.lat - v.lat) * latRatio };
  const wv = { x: (w.lng - v.lng) * lngRatio, y: (w.lat - v.lat) * latRatio };

  const dot = pv.x * wv.x + pv.y * wv.y;
  const lenSn = wv.x * wv.x + wv.y * wv.y;

  let t = lenSn === 0 ? 0 : dot / lenSn;
  t = Math.max(0, Math.min(1, t));

  return {
    lat: v.lat + t * (w.lat - v.lat),
    lng: v.lng + t * (w.lng - v.lng)
  };
}

export function pointToSegmentDistanceMeters(p: Coordinates, v: Coordinates, w: Coordinates): number {
  const proj = projectPointOnSegment(p, v, w);
  return getDistance(p, proj);
}

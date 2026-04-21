import { Coordinates, VRUType } from './types';

// San Francisco default center
export const INITIAL_CENTER: Coordinates = {
  lat: 37.7749,
  lng: -122.4194
};

// Simulation Physics
export const SIMULATION_TICK_MS = 100;
export const QUANTUM_FUSION_THRESHOLD = 3; // N sources >= 3 triggers Quantum logic

// Map visuals
export const MAP_STYLES = [
  { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#38414e" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#212a37" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#17263c" }],
  },
];

export const INITIAL_VRUS_CONFIG = [
  { type: VRUType.PEDESTRIAN, count: 5 },
  { type: VRUType.CYCLIST, count: 3 },
  { type: VRUType.SCOOTER, count: 2 },
];

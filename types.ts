// Domain Models

export enum VRUType {
  PEDESTRIAN = 'PEDESTRIAN',
  CYCLIST = 'CYCLIST',
  SCOOTER = 'SCOOTER',
  VEHICLE = 'VEHICLE', // Interaction partner
  MOTORCYCLE = 'MOTORCYCLE',
  WHEELCHAIR = 'WHEELCHAIR'
}

export enum RiskLevel {
  LOW = 'LOW',
  WARNING = 'WARNING',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
  SAFE = 'SAFE' // Keeping SAFE for backward compatibility if needed, though LOW replaces it conceptually
}

export enum RiskCalculationModel {
  ADDITIVE = 'ADDITIVE',
  MULTIPLICATIVE = 'MULTIPLICATIVE'
}

export interface RiskScoreConfig {
  w1_distance: number;
  w2_relativeSpeed: number;
  w3_density: number;
  w4_topology: number;
  w5_infrastructureMismatch: number;
  w6_sensorUncertainty: number;
  densityRadius: number; // meters
  model: RiskCalculationModel;
}

export interface RiskExplanation {
  contributions: {
    distance: number; // %
    relativeSpeed: number; // %
    density: number; // %
    topology: number; // %
    infrastructure: number; // %
    sensor: number; // %
  };
  formula: string;
  recommendation: string;
}

export interface RiskScore {
  value: number; // 0-100
  level: RiskLevel;
  history: { timestamp: number; value: number }[]; // For graph
  confidence: number; // 0-1 (1 = High Confidence)
  integrity: 'HIGH' | 'MEDIUM' | 'LOW' | 'CRITICAL';
  explanation?: RiskExplanation;
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  organization: string;
  role: 'ADMIN' | 'OPERATOR';
}

export interface SensorSource {
  id: string;
  name: string;
  type: 'GPS' | 'LIDAR' | 'CAMERA' | 'UWB' | 'RADAR' | 'V2X';
  accuracy: number; // in meters
  active: boolean;
  reading?: Coordinates; // Raw sensor reading with noise
}

export interface VRU {
  id: string;
  type: VRUType;
  position: Coordinates;
  velocity: { x: number; y: number }; // meters/sec
  heading: number; // degrees
  sensors: SensorSource[];
  riskLevel: RiskLevel;
  localizationError: number; // Estimated error in meters
  isUserControlled?: boolean;
  geolocation?: {
    current: Coordinates;
  };
  
  // Predictive Collision Data
  ttc?: number; // Time To Collision in seconds
  collisionProbability?: number; // 0-100%
  predictedPath?: Coordinates[]; // Future path for visualization
  riskFactors?: RiskFactors; // Detailed risk factor breakdown
  riskScore?: RiskScore; // Multi-parameter risk score
  lastDENMBroadcast?: number; // Timestamp of the last DENM broadcast
}

export enum InfrastructureType {
  ROAD = 'ROAD',
  HIGH_RISK_ROAD = 'HIGH_RISK_ROAD',
  CYCLEWAY = 'CYCLEWAY',
  SIDEWALK = 'SIDEWALK',
  PEDESTRIAN_ZONE = 'PEDESTRIAN_ZONE',
  INTERSECTION = 'INTERSECTION',
  CROSSWALK = 'CROSSWALK',
  UNKNOWN = 'UNKNOWN'
}

export enum ZoneSafetyLevel {
  SAFE = 'SAFE',
  MODERATE = 'MODERATE',
  DANGEROUS = 'DANGEROUS',
  RESTRICTED = 'RESTRICTED'
}

export interface OsmWay {
  id: number;
  tags: Record<string, string>;
  geometry: Coordinates[];
  type: InfrastructureType;
  safetyLevel: Record<VRUType, ZoneSafetyLevel>;
}

export interface RiskFactors {
  spatial: {
    infrastructureType: number; // 0-1 (1 = high risk infra)
    intersectionProximity: number; // 0-1 (1 = very close)
    roadCurvature: number; // 0-1 (1 = sharp curve)
  };
  topology: {
    intersectionDistance: number; // 0-1 (1 = very close)
    curvatureIntensity: number; // 0-1 (1 = sharp)
    isRoundabout: number; // 0 or 1
    visibilityReduction: number; // 0-1 (1 = poor visibility)
    totalScore: number; // 0-1
  };
  dynamic: {
    relativeSpeed: number; // 0-1 (1 = high relative speed)
    agentDistance: number; // 0-1 (1 = very close)
    localDensity: number; // 0-1 (1 = high density)
  };
  compatibility: {
    infrastructureMismatch: number; // 0-1 (1 = highly incompatible)
  };
  sensor: {
    gpsAccuracy: number; // 0-1 (1 = poor accuracy)
    reliabilityScore: number; // 0-1 (1 = low reliability)
  };
  totalScore: number; // 0-1
}

export interface Zone {
  id: string;
  bounds: Coordinates[]; // Polygon
  density: number;
  riskLevel: RiskLevel;
  intensity?: number; // 0 to 1, for visualization
}

export interface Route {
  coordinates: Coordinates[];
  distance: number;
  duration: number;
  type?: 'SAFEST' | 'FASTEST' | 'BALANCED';
  riskScore?: number;
}

export interface ViewportBounds {
  northEast: Coordinates;
  southWest: Coordinates;
}

export interface GridCell {
  id: string;
  center: Coordinates;
  riskValue: number; // 0-1
  baseRisk?: number; // Historical/static risk baseline
  lastUpdate: number;
}

export interface RiskFieldGrid {
  cells: GridCell[];
  resolution: number; // meters per cell side
  origin: Coordinates;
  bounds?: ViewportBounds;
  zoom?: number;
}

export interface SimulationState {
  vrus: VRU[];
  zones: Zone[];
  timestamp: number;
  route?: Route; // Currently selected route
  alternativeRoutes?: Route[]; // Other proposed routes
  metrics: {
    totalVRUs: number;
    avgError: number;
    quantumFusionActive: boolean;
    collisionWarnings: number;
  };
  lastGpsError?: string;
  riskScoreConfig?: RiskScoreConfig;
}

export interface AnalyticsData {
  time: string;
  rmse: number;
  latency: number;
  confidence: number;
}

export interface GeminiRecommendation {
  text: string;
  timestamp: number;
}

export interface OptimizationContext {
  weather: 'CLEAR' | 'RAIN' | 'FOG' | 'SNOW';
  time: 'DAY' | 'NIGHT' | 'DAWN/DUSK';
  environment: 'OPEN_SKY' | 'URBAN_CANYON' | 'TUNNEL' | 'INDOOR';
}

export interface SensorOptimizationResponse {
  recommendedSensorIds: string[];
  reasoning: string;
  estimatedAccuracy: string;
}

export enum DENMEventType {
  COLLISION_RISK = 'COLLISION_RISK',
  DANGEROUS_ZONE = 'DANGEROUS_ZONE',
  UNAUTHORIZED_AREA = 'UNAUTHORIZED_AREA'
}

export interface DENMMessage {
  id: string;
  eventType: DENMEventType;
  location: Coordinates;
  timestamp: number;
  riskLevel: RiskLevel;
  involvedUserIds: string[];
  senderId: string;
  expiresAt: number;
  geohash: string; // For spatial querying
}
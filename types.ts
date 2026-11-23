// Export newly needed types
export interface LiveLocation {
  lat: number;
  lng: number;
  timestamp: number;
  speed?: number;
  heading?: number;
}

export interface AlertEvent {
  id: string;
  type: string;
  severity: 'safe' | 'warning' | 'high' | 'critical';
  timestamp: string;
  location: { lat: number, lng: number };
  description: string;
  mainUserId?: string;
}

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
  gpsPosition?: Coordinates; // Raw un-matched GPS position
  matchedPosition?: Coordinates;
  matchedWayId?: number;
  mapMatchingConfidence?: number;
  velocity: { x: number; y: number }; // meters/sec
  heading: number; // degrees
  sensors: SensorSource[];
  riskLevel: RiskLevel;
  localizationError: number; // Estimated error in meters
  isUserControlled?: boolean;
  geolocation?: {
    current: Coordinates;
  };
  locationSource?: string;
  locationFloor?: number;
  locationApartment?: string;
  locationIsDualBand?: boolean;
  locationCorrectionType?: string;
  locationRtkFixed?: boolean;
  
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

export interface TripRoom {
  id: string;
  type: 'trip' | 'zone';
  tripId?: string;
  routeId?: string;
  zoneKey?: string;
  createdAt: number;
  activeUntil: number;
}

export interface TripMessage {
  id: string;
  userId: string;
  displayName: string;
  text: string;
  createdAt: number;
  messageType: 'info' | 'warning' | 'question';
  relatedIncidentId?: string;
}

export interface RouteStep {
  distance: number;
  duration: number;
  instruction: string;
  location: Coordinates;
  type?: string;
  modifier?: string;
}

export interface Route {
  coordinates: Coordinates[];
  distance: number;
  duration: number;
  type?: 'SAFEST' | 'FASTEST' | 'BALANCED';
  riskScore?: number;
  steps?: RouteStep[]; // Added for audio guidance
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

export enum IncidentType {
  ROADWORKS = 'ROADWORKS',
  ROAD_CLOSED = 'ROAD_CLOSED',
  SIDEWALK_CLOSED = 'SIDEWALK_CLOSED',
  DANGER = 'DANGER',
  ACCIDENT = 'ACCIDENT',
  OBSTACLE = 'OBSTACLE',
  OTHER = 'OTHER'
}

export enum IncidentSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH'
}

export interface Incident {
  id: string;
  type: IncidentType;
  severity: IncidentSeverity;
  description?: string;
  location: Coordinates;
  geohash: string;
  createdAt: number;
  createdByUserId: string;
  expiresAt: number;
  status: 'active' | 'resolved' | 'removed';
  photoUrl?: string;
  upvotes: number;
  reportsCount: number;
}

// SOS and Trusted Contacts Models

export interface TrustedContact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  whatsapp?: string;
  relation?: string;
  priority: number;
  preferredChannel?: 'SMS' | 'WHATSAPP' | 'EMAIL' | 'CALL';
}

export interface SosCategoryConfig {
  id: string; // 'police', 'ambulance', 'fire', 'family', 'assistance', 'custom'
  enabled: boolean;
  name: string;
  selectedContactIds: string[];
  channels: ('SMS' | 'EMAIL' | 'CALL' | 'IN_APP')[];
  messageTemplate: string;
}

export interface SosSettings {
  categories: SosCategoryConfig[];
  liveLocationEnabled: boolean;
  liveLocationDurationMinutes: number;
  antiFalseClick: boolean;
  antiFalseClickType: 'LONG_PRESS' | 'SLIDER';
  securityCheckInEnabled: boolean;
  securityCheckInMinutes: number;
}

export interface SosLog {
  id: string;
  timestamp: number;
  categoryId: string;
  recipientIds: string[];
  status: 'sent' | 'call_initiated' | 'failed' | 'canceled';
  channelsUsed: ('SMS' | 'EMAIL' | 'CALL' | 'IN_APP')[];
}

// ===============================================================
// Subscription, Entitlements, Governance & Super Admin Models
// ===============================================================

export type SubscriptionPlan = 'FREE' | 'PREMIUM' | 'FAMILY' | 'BUSINESS';

export type BillingCycle = 'monthly' | 'annual' | 'custom';

export type SubscriptionStatus = 'active' | 'expired' | 'canceled' | 'pending' | 'suspended';

export type ActivationSource =
  | 'free'
  | 'stripe'
  | 'konnect'
  | 'early_tester'
  | 'pioneer'
  | 'accessibility'
  | 'admin'
  | 'redeem';

export type AdminRole = 'SUPER_ADMIN' | 'ADMIN' | 'OPERATOR';

export type AccountStatus = 'active' | 'suspended' | 'banned' | 'soft_deleted';

export type PresenceState = 'online' | 'idle' | 'offline';

export type FeatureKey =
  | 'sos'
  | 'emergency_contacts'
  | 'auto_emergency_alerts'
  | 'realtime_location_sharing'
  | 'safety_history'
  | 'smart_localization'
  | 'smart_navigation'
  | 'custom_alerts'
  | 'advanced_stats'
  | 'global_risk_heatmap'
  | 'family_profiles'
  | 'family_management'
  | 'family_location_sharing'
  | 'family_emergency_contacts'
  | 'family_safety_alerts'
  | 'family_dashboard'
  | 'family_member_settings'
  | 'business_fleet'
  | 'business_api';

export interface PlanEntitlements {
  canUseSos: boolean;
  canManageEmergencyContacts: boolean;
  maxEmergencyContacts: number;
  canUseAutoAlerts: boolean;
  canShareLiveLocation: boolean;
  canViewSafetyHistory: boolean;
  canUseSmartLocalization: boolean;
  canUseSmartNavigation: boolean;
  canUseCustomAlerts: boolean;
  canUseAdvancedStats: boolean;
  canViewRiskHeatmap: boolean;
  canUseFamilyDashboard: boolean;
  maxFamilyMembers: number;
  canManageFamilySettings: boolean;
  canUseBusinessFeatures: boolean;
}

export type SupportedCurrency = 'TND' | 'EUR';

export type CurrencySource = 'auto' | 'manual';

export interface PlanRegionalConfig {
  id: SubscriptionPlan;
  enabled: boolean;
  monthlyPriceTnd: number | null;
  annualPriceTnd: number | null;
  monthlyPriceEur: number | null;
  annualPriceEur: number | null;
  customPricing?: boolean;
}

export interface PriceChangeHistoryEntry {
  id: string;
  timestamp: number;
  plan: SubscriptionPlan;
  field: string;
  currency?: SupportedCurrency | null;
  oldValue: number | boolean | null;
  newValue: number | boolean | null;
  adminUid: string;
  adminEmail: string;
  reason?: string;
}

export interface PaymentTransaction {
  id: string;
  uid: string;
  plan: SubscriptionPlan;
  billingCycle: BillingCycle;
  amount: number;
  amountTnd?: number;
  currency: SupportedCurrency;
  country?: string | null;
  provider: 'stripe' | 'konnect' | 'early_tester' | 'admin' | 'redeem' | 'accessibility' | 'pioneer';
  providerSessionId?: string;
  status: 'pending' | 'verified' | 'failed' | 'refunded';
  createdAt: number;
  verifiedAt?: number;
}

export type RedeemDurationCode = '1m' | '3m' | '6m' | '12m' | '24m' | 'lifetime';

export type RedeemCodeStatus = 'available' | 'used' | 'expired' | 'disabled' | 'revoked';

export interface RedeemCodeUsageEntry {
  uid: string;
  email?: string | null;
  usedAt: number;
}

export interface RedeemCodeRecord {
  id?: string;
  code: string; // Masked for admin listings after creation (e.g., VRU-PREM-••••-AB12); plaintext returned only on initial generation
  maskedCode?: string;
  codeHash?: string;
  plan: 'PREMIUM' | 'FAMILY' | 'BUSINESS';
  billingCycle: BillingCycle;
  durationCode?: RedeemDurationCode;
  durationDays: number | null;
  isLifetime?: boolean;
  maxUses?: number;
  usesCount?: number;
  expiresAt?: number | null;
  status: RedeemCodeStatus;
  createdAt: number;
  createdBy: string;
  campaign?: string;
  note?: string;
  usedByUid?: string | null;
  usedByEmail?: string | null;
  usedAt?: number | null;
  usageHistory?: RedeemCodeUsageEntry[];
}

export interface ActivationRecord {
  id: string;
  uid: string;
  email?: string | null;
  plan: SubscriptionPlan;
  billingCycle: BillingCycle;
  source: ActivationSource;
  code?: string | null;
  startDate: number;
  endDate: number | null;
  isLifetime?: boolean;
  reason?: string;
  adminEmail?: string;
  activatedAt: number;
}

export interface SubscriptionHistoryEntry {
  id: string;
  action: string;
  oldPlan: SubscriptionPlan;
  newPlan: SubscriptionPlan;
  oldStatus: SubscriptionStatus;
  newStatus: SubscriptionStatus;
  startDate: number;
  endDate: number | null;
  isLifetime?: boolean;
  source: ActivationSource;
  reason?: string;
  adminEmail?: string;
  timestamp: number;
}

export interface AdminOverviewStats {
  totalRecordedSubscriptions: number;
  freeUsers: number;
  premiumUsers: number;
  familyUsers: number;
  businessUsers: number;
  earlyTesterUsers: number;
  lifetimeUsers: number;
  suspendedSubscriptions: number;
  expiredSubscriptions: number;
  totalCodes: number;
  usedCodes: number;
  availableCodes: number;
  revokedCodes: number;
  expiredCodes: number;
  disabledCodes: number;
}

export interface UserSubscription {
  uid: string;
  email?: string | null;
  plan: SubscriptionPlan;
  effectivePlan: SubscriptionPlan;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  startDate: number;
  endDate: number | null;
  isLifetime?: boolean;
  cancelAtPeriodEnd: boolean;
  isEarlyTester: boolean;
  earlyTesterStartDate: number | null;
  earlyTesterEndDate: number | null;
  earlyTesterBadge: string | null;
  isAccessibilityLifetime?: boolean;
  activationSource?: ActivationSource;
  paymentProvider:
    | 'stripe'
    | 'konnect'
    | 'early_tester'
    | 'admin'
    | 'redeem'
    | 'accessibility'
    | 'pioneer'
    | null;
  paymentVerified: boolean;
  lastPaymentRef: string | null;
  updatedAt: number;
  entitlements: PlanEntitlements;
  transactions?: PaymentTransaction[];
  activations?: ActivationRecord[];
  history?: SubscriptionHistoryEntry[];
}

export interface FamilyMemberProfile {
  id: string;
  ownerUid: string;
  memberUid?: string | null;
  name: string;
  relation: 'parent' | 'child' | 'spouse' | 'senior' | 'other';
  vruType: VRUType;
  shareLocation: boolean;
  sosAlertsEnabled: boolean;
  geofenceAlertEnabled: boolean;
  speedAlertThresholdKmh: number;
  emergencyContactPhone?: string;
  status: 'active' | 'paused' | 'pending';
  createdAt: number;
  updatedAt: number;
}

export interface BusinessQuoteRequest {
  id: string;
  uid?: string | null;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  teamSize: string;
  vehicleCount: string;
  needsApi: boolean;
  message: string;
  status: 'new' | 'reviewed' | 'approved' | 'closed';
  internalNote?: string;
  createdAt: number;
  updatedAt?: number;
}

export interface UserSanctionEntry {
  id: string;
  action: 'suspend' | 'ban' | 'unban' | 'soft_delete' | 'restore' | 'revoke_sessions';
  reason: string;
  durationHours?: number | null;
  expiresAt?: number | null;
  adminEmail: string;
  createdAt: number;
}

export interface PresenceRecord {
  uid: string;
  state: PresenceState;
  lastHeartbeatAt: number;
  lastInteractionAt: number;
  sessionId?: string;
  currentPage?: string;
}

export interface AdminUserSummary {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  role: AdminRole;
  createdAt: number | null;
  lastLoginAt: number | null;
  accountStatus: AccountStatus;
  suspensionReason?: string | null;
  suspensionExpiresAt?: number | null;
  banReason?: string | null;
  bannedAt?: number | null;
  softDeletedAt?: number | null;
  presence: PresenceRecord;
  subscription: UserSubscription;
  sanctionHistory: UserSanctionEntry[];
}

export type AccessibilityStatus = 'pending' | 'approved' | 'rejected' | 'more_info_required';

export interface AccessibilityRequestRecord {
  id: string;
  uid: string;
  email: string | null;
  displayName: string | null;
  fullName: string;
  disabilityCategory: string;
  description: string;
  documentName: string;
  documentMimeType: string;
  documentSize: number;
  hasDocumentFile: boolean;
  status: AccessibilityStatus;
  adminComment?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: number | null;
  createdAt: number;
  updatedAt: number;
  history: Array<{
    action: string;
    actor: string;
    comment?: string;
    timestamp: number;
  }>;
}

export type AuditCategory =
  | 'auth'
  | 'user'
  | 'subscription'
  | 'redeem'
  | 'accessibility'
  | 'pioneer'
  | 'settings'
  | 'notification'
  | 'support'
  | 'security'
  | 'android_app'
  | 'consent';

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  adminUid: string;
  adminEmail: string;
  adminRole?: AdminRole | 'USER';
  action: string;
  category: AuditCategory;
  targetUid?: string | null;
  targetEmail?: string | null;
  targetId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  outcome: 'success' | 'denied' | 'failed';
  ip?: string | null;
  detail: string;
}

export interface PlatformSettings {
  platformName: string;
  logoUrl: string;
  contactEmail: string;
  supportEmail: string;
  planPrices: {
    premiumMonthlyTnd: number;
    premiumAnnualTnd: number;
    premiumMonthlyEur: number;
    premiumAnnualEur: number;
    familyMonthlyTnd: number;
    familyAnnualTnd: number;
    familyMonthlyEur: number;
    familyAnnualEur: number;
  };
  regionalPlans?: Record<SubscriptionPlan, PlanRegionalConfig>;
  pioneerProgramEnabled: boolean;
  pioneerDurationDays: number;
  accessibilityProgramEnabled: boolean;
  notificationsEnabled: boolean;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  announcementEnabled: boolean;
  announcementText: string;
  announcementType: 'info' | 'warning' | 'success';
  securitySettings: {
    requireReauthForCriticalActions: boolean;
    adminRateLimitPerMin: number;
    delegatedAdminEmails: string[];
    permissionMatrix: Record<string, string[]>;
  };
  updatedAt: number;
  updatedBy?: string;
}

export interface AdminNotificationRecord {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  targetScope: 'all' | 'PREMIUM' | 'FAMILY' | 'FREE' | 'BUSINESS' | 'specific_user';
  targetUid?: string | null;
  targetEmail?: string | null;
  createdBy: string;
  createdAt: number;
  recipientCount: number;
  readByUids: string[];
}

export type SupportTicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface SupportTicketRecord {
  id: string;
  uid?: string | null;
  email: string;
  name: string;
  subject: string;
  category: 'support' | 'bug' | 'billing' | 'abuse' | 'other';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  message: string;
  status: SupportTicketStatus;
  createdAt: number;
  updatedAt: number;
  replies: Array<{
    id: string;
    senderRole: 'user' | 'admin';
    senderEmail: string;
    message: string;
    createdAt: number;
  }>;
  internalNotes: Array<{
    id: string;
    adminEmail: string;
    note: string;
    createdAt: number;
  }>;
}

export type AndroidReleaseStatus = 'draft' | 'published' | 'disabled';

export type AndroidUpdateType = 'optional' | 'mandatory';

export interface AndroidAppRelease {
  id: string;
  appName: string;
  packageName: string;
  versionName: string;
  versionCode: number;
  fileName: string;
  fileSize: number;
  sha256: string;
  mimeType: string;
  description: string;
  whatsNew: string[];
  releaseDate: string;
  publishedAt: number | null;
  status: AndroidReleaseStatus;
  minAndroidVersion: string;
  minAndroidApi: number;
  updateType: AndroidUpdateType;
  minSupportedVersionCode: number | null;
  isCurrent: boolean;
  isArchived: boolean;
  hasBackup: boolean;
  fileAvailable: boolean;
  downloadsInitiated: number;
  downloadsCompleted: number;
  lastDownloadedAt: number | null;
  uploadedByUid: string;
  uploadedByEmail: string;
  createdAt: number;
  updatedAt: number;
}

export interface AndroidDownloadEvent {
  id: string;
  releaseId: string;
  versionName: string;
  versionCode: number;
  status: 'initiated' | 'completed' | 'aborted';
  source: 'web' | 'android_app' | 'qr' | 'admin';
  bytesTotal: number;
  bytesSent: number;
  initiatedAt: number;
  completedAt: number | null;
  country?: string | null;
}

export interface AndroidAppSettings {
  downloadsEnabled: boolean;
  appName: string;
  packageName: string;
  description: string;
  minSupportedVersionCode: number;
  retentionKeepCount: number;
  maxApkSizeBytes: number;
  updatedAt: number;
  updatedBy: string;
}

export interface AndroidDownloadStats {
  totalInitiated: number;
  totalCompleted: number;
  todayInitiated: number;
  todayCompleted: number;
  weekInitiated: number;
  weekCompleted: number;
  lastDownloadedAt: number | null;
  storageUsedBytes: number;
  storageAvailableBytes: number | null;
  byVersion: Array<{
    releaseId: string;
    versionName: string;
    versionCode: number;
    status: AndroidReleaseStatus;
    isCurrent: boolean;
    initiated: number;
    completed: number;
    lastDownloadedAt: number | null;
  }>;
  dailySeries: Array<{
    date: string;
    label: string;
    initiated: number;
    completed: number;
  }>;
}

export interface AndroidLatestVersionResponse {
  downloadsEnabled: boolean;
  available: boolean;
  appName: string;
  packageName: string;
  description: string;
  releaseId: string | null;
  versionName: string | null;
  versionCode: number | null;
  downloadUrl: string | null;
  fileSize: number | null;
  sha256: string | null;
  releaseDate: string | null;
  publishedAt: number | null;
  whatsNew: string[];
  releaseDescription: string | null;
  minAndroidVersion: string | null;
  minAndroidApi: number | null;
  fileName?: string | null;
  disabledReason?: string | null;
  updateType: AndroidUpdateType;
  mandatory: boolean;
  updateAvailable: boolean;
  minSupportedVersionCode: number;
  mandatoryReason: string | null;
}

export type ConsentStatus = 'pending' | 'accepted' | 'refused' | 'withdrawn';

export type ConsentPlatform = 'web' | 'android';

export interface OptionalConsents {
  notifications: boolean;
  locationEnhancements: boolean;
}

export type ConsentAuditAction =
  | 'accepted'
  | 'refused'
  | 'withdrawn'
  | 'preferences_updated';

export interface ConsentAuditEntry {
  id: string;
  action: ConsentAuditAction;
  consentVersion: string;
  termsVersion: string;
  privacyVersion: string;
  platform: ConsentPlatform;
  timestamp: number;
  ip?: string | null;
  optionalConsents: OptionalConsents;
  detail: string;
}

export interface UserConsentRecord {
  userId: string;
  email: string | null;
  status: ConsentStatus;
  consentVersion: string;
  termsVersion: string;
  privacyVersion: string;
  acceptedAt: number | null;
  refusedAt: number | null;
  withdrawnAt: number | null;
  platform: ConsentPlatform | null;
  optionalConsents: OptionalConsents;
  history: ConsentAuditEntry[];
  updatedAt: number;
}

export interface ConsentStatusResponse {
  consentStatus: ConsentStatus;
  consentVersion: string | null;
  termsVersion: string | null;
  privacyVersion: string | null;
  currentConsentVersion: string;
  currentTermsVersion: string;
  currentPrivacyVersion: string;
  acceptedAt: number | null;
  refusedAt: number | null;
  withdrawnAt: number | null;
  platform: ConsentPlatform | null;
  accessAllowed: boolean;
  requiresConsent: boolean;
  optionalConsents: OptionalConsents;
  historyCount: number;
  updatedAt: number | null;
}

export interface AdminConsentUserRow {
  uid: string;
  email: string | null;
  displayName: string | null;
  status: ConsentStatus;
  consentVersion: string | null;
  termsVersion: string | null;
  privacyVersion: string | null;
  acceptedAt: number | null;
  refusedAt: number | null;
  withdrawnAt: number | null;
  platform: ConsentPlatform | null;
  optionalConsents: OptionalConsents;
  accessAllowed: boolean;
  historyCount: number;
  updatedAt: number | null;
  accountCreatedAt: number | null;
}

export interface AdminConsentsOverviewResponse {
  stats: {
    totalUsers: number;
    acceptedCount: number;
    refusedCount: number;
    pendingCount: number;
    withdrawnCount: number;
    acceptanceRatePct: number;
    lastAcceptedAt: number | null;
    currentConsentVersion: string;
    currentTermsVersion: string;
    currentPrivacyVersion: string;
  };
  users: AdminConsentUserRow[];
}

// ===============================================================
// Global Incident & Risk Heatmap Models
// ===============================================================

export type HeatmapCategory =
  | 'INCIDENT'
  | 'TRAFFIC'
  | 'WEATHER'
  | 'INFRASTRUCTURE'
  | 'EXTERNAL_ALERT';

export type HeatmapSourceId =
  | 'VRUGUARD_USER'
  | 'TRAFFIC_API'
  | 'OPEN_METEO'
  | 'OPENSTREETMAP'
  | 'OFFICIAL_ALERT';

export type HeatmapRiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' | 'UNKNOWN';

export type HeatmapSeverityTier = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export type HeatmapCoverageLevel = 'FULL' | 'PARTIAL' | 'NONE';

export type HeatmapPeriodPreset = 'realtime' | '24h' | '7d' | '30d' | 'custom';

export type HeatmapCompareOffset = 'none' | '24h' | '7d' | '30d' | 'custom';

export interface HeatmapCategoryCoverage {
  category: HeatmapCategory;
  label: string;
  level: HeatmapCoverageLevel;
  providers: string[];
  note: string;
}

export interface HeatmapRegionalFeedDirectoryItem {
  id: string;
  name: string;
  scope: 'GLOBAL' | 'REGIONAL';
  regionLabel: string;
  categories: HeatmapCategory[];
  refreshCadenceLabel: string;
  activeInViewport: boolean;
  failoverCapable: boolean;
  statusNote: string;
}

export interface HeatmapRegionCoverageSummary {
  overallStatus: HeatmapCoverageLevel;
  regionLabel: string;
  summaryNote: string;
  insufficientDataReason?: string | null;
  hasLocalStreetCoverage: boolean;
  hasRegionalLiveTraffic: boolean;
  byCategory: HeatmapCategoryCoverage[];
  knownRegionalFeeds: HeatmapRegionalFeedDirectoryItem[];
}

export interface HeatmapZoneFilter {
  mode: 'viewport' | 'radius' | 'search';
  label?: string;
  center?: Coordinates;
  radiusMeters?: number;
}

export interface HeatmapEvent {
  id: string;
  dedupKey: string;
  geohash: string;
  lat: number;
  lng: number;
  category: HeatmapCategory;
  subType: string;
  title: string;
  description: string;
  source: HeatmapSourceId;
  sourceLabel: string;
  severityScore: number; // 0-100 intrinsic severity of hazard nature
  severityTier: HeatmapSeverityTier;
  reliability: number; // 0-1 credibility/confirmation confidence
  confirmations: number; // number of deduplicated reports merged
  natureWeight: number; // VRU vulnerability multiplier
  collectedAt: number;
  lastUpdatedAt: number;
  expiresAt: number | null;
  status: 'active' | 'expired' | 'resolved';
  metadata?: Record<string, string | number | boolean | null>;
}

export interface HeatmapCell {
  cellId: string;
  geohash: string;
  center: Coordinates;
  riskScore: number; // 0-100 calculated real danger index
  riskLevel: HeatmapRiskLevel;
  heatIntensity: number; // 0-1 calibrated intensity for Leaflet heatLayer
  rawEventCount: number; // total confirmations / deduplicated events (for Density vs Danger display)
  dedupEventCount: number;
  dominantCategory: HeatmapCategory;
  categoryBreakdown: Partial<Record<HeatmapCategory, number>>;
  categoryMaxSeverity: Partial<Record<HeatmapCategory, number>>;
  synergyBonus: number;
  reliabilityAvg: number;
  sources: HeatmapSourceId[];
  topIssueSummary: string;
  lastUpdatedAt: number;
  collectedAt: number;
  deltaScore?: number | null; // Difference vs comparison period
  previousRiskScore?: number | null;
}

export type HeatmapHeatPoint = [number, number, number]; // [lat, lng, intensity 0..1]

export interface HeatmapWeatherSummary {
  temperatureC: number | null;
  precipitationMm: number | null;
  windSpeedKmh: number | null;
  windGustsKmh: number | null;
  visibilityM: number | null;
  weatherCode: number | null;
  conditionLabel: string;
  riskFlags: string[];
  fetchedAt: number;
  providerName?: string;
}

export interface HeatmapSourceStatus {
  source: HeatmapSourceId;
  label: string;
  active: boolean;
  configured: boolean;
  eventCount: number;
  mode: 'live' | 'cached' | 'derived' | 'unavailable';
  detail: string;
  lastSyncAt: number;
  coverageScope: 'GLOBAL' | 'REGIONAL';
  coverageLevel: HeatmapCoverageLevel;
  fallbackUsed?: string | null;
  refreshCadenceLabel: string;
  nextSyncAt: number;
}

export interface HeatmapPreferences {
  uid: string;
  globalMode: boolean;
  categories: HeatmapCategory[];
  period: HeatmapPeriodPreset;
  customStartAt?: number | null;
  customEndAt?: number | null;
  severities: HeatmapSeverityTier[];
  sources: HeatmapSourceId[];
  zoneFilter: HeatmapZoneFilter;
  compareOffset: HeatmapCompareOffset;
  updatedAt: number;
}

export interface HeatmapHistoricalCompareSummary {
  enabled: boolean;
  referenceLabel: string;
  referenceStartAt: number;
  referenceEndAt: number;
  currentAvgRisk: number;
  previousAvgRisk: number;
  deltaAvgRisk: number;
  aggravatedZones: number;
  improvedZones: number;
  stableZones: number;
  currentCriticalCells: number;
  previousCriticalCells: number;
}

export interface HeatmapQueryRequest {
  bounds: ViewportBounds;
  zoom: number;
  categories: HeatmapCategory[];
  period: HeatmapPeriodPreset;
  customStartAt?: number | null;
  customEndAt?: number | null;
  severities: HeatmapSeverityTier[];
  sources: HeatmapSourceId[];
  zoneFilter?: HeatmapZoneFilter;
  compareOffset?: HeatmapCompareOffset;
  compareStartAt?: number | null;
  compareEndAt?: number | null;
}

export interface HeatmapQueryResponse {
  generatedAt: number;
  periodStartAt: number;
  periodEndAt: number;
  isHistorical: boolean;
  heatPoints: HeatmapHeatPoint[];
  cells: HeatmapCell[];
  weatherSummary: HeatmapWeatherSummary | null;
  sourceStatuses: HeatmapSourceStatus[];
  coverage: HeatmapRegionCoverageSummary;
  stats: {
    regionRiskIndex: number | null;
    regionRiskLevel: HeatmapRiskLevel;
    insufficientData: boolean;
    totalCells: number;
    criticalCells: number;
    highCells: number;
    moderateCells: number;
    lowCells: number;
    dedupEventsCount: number;
    rawConfirmationsCount: number;
  };
  comparison?: HeatmapHistoricalCompareSummary | null;
}

export interface HeatmapZoneDetailRequest {
  lat: number;
  lng: number;
  zoom?: number;
  radiusMeters?: number;
  categories: HeatmapCategory[];
  period: HeatmapPeriodPreset;
  customStartAt?: number | null;
  customEndAt?: number | null;
  severities: HeatmapSeverityTier[];
  sources: HeatmapSourceId[];
  compareOffset?: HeatmapCompareOffset;
  compareStartAt?: number | null;
  compareEndAt?: number | null;
}

export interface HeatmapZoneDetailResponse {
  center: Coordinates;
  radiusMeters: number;
  cellId: string;
  riskScore: number | null;
  riskLevel: HeatmapRiskLevel;
  coverageStatus: HeatmapCoverageLevel;
  hasSufficientData: boolean;
  coverageNote: string;
  unknownSafeWarning?: string | null;
  rawEventCount: number;
  dedupEventCount: number;
  densityVsDangerNote: string;
  synergyBonus: number;
  categoryScores: Array<{
    category: HeatmapCategory;
    maxSeverity: number;
    count: number;
  }>;
  weather: HeatmapWeatherSummary | null;
  events: HeatmapEvent[];
  sources: HeatmapSourceId[];
  collectedAt: number | null;
  lastUpdatedAt: number | null;
  comparison?: {
    previousRiskScore: number | null;
    previousRiskLevel: HeatmapRiskLevel;
    previousEventCount: number;
    deltaScore: number | null;
    trend: 'aggravated' | 'improved' | 'stable' | 'unknown';
    referenceLabel: string;
  } | null;
}




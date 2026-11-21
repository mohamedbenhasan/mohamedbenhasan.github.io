import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  AccessibilityRequestRecord,
  AccessibilityStatus,
  AccountStatus,
  ActivationRecord,
  ActivationSource,
  AdminConsentUserRow,
  AdminConsentsOverviewResponse,
  AdminNotificationRecord,
  AdminOverviewStats,
  AdminRole,
  AdminUserSummary,
  AndroidAppRelease,
  AndroidAppSettings,
  AndroidDownloadEvent,
  AndroidDownloadStats,
  AndroidLatestVersionResponse,
  AndroidReleaseStatus,
  AndroidUpdateType,
  AuditCategory,
  AuditLogEntry,
  BillingCycle,
  BusinessQuoteRequest,
  ConsentAuditEntry,
  ConsentPlatform,
  ConsentStatusResponse,
  FamilyMemberProfile,
  OptionalConsents,
  PaymentTransaction,
  PlanRegionalConfig,
  PlatformSettings,
  PresenceRecord,
  PresenceState,
  PriceChangeHistoryEntry,
  RedeemCodeRecord,
  RedeemDurationCode,
  SubscriptionHistoryEntry,
  SubscriptionPlan,
  SubscriptionStatus,
  SupportedCurrency,
  SupportTicketRecord,
  SupportTicketStatus,
  UserConsentRecord,
  UserSanctionEntry,
  UserSubscription,
  VRUType,
} from '../types';
import {
  DEFAULT_REGIONAL_PLANS,
  EARLY_TESTER_DURATION_MS,
  EARLY_TESTER_ROLLOUT_MS,
  MONTH_DURATION_MS,
  RawSubscriptionInput,
  resolveDurationDaysForRedeem,
  resolveEffectiveSubscription,
  YEAR_DURATION_MS,
} from '../utils/subscriptionPlans';
import { computeFileSha256, getAvailableStorageBytes } from './apkValidator';

export interface StoredUserRecord {
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
  suspendedAt?: number | null;
  suspensionExpiresAt?: number | null;
  banReason?: string | null;
  bannedAt?: number | null;
  softDeletedAt?: number | null;
  deletionReason?: string | null;
  revokedAfter?: number | null;
  sanctionHistory: UserSanctionEntry[];
}

interface StoredPresenceRecord {
  uid: string;
  rawState: 'online' | 'idle' | 'offline';
  lastHeartbeatAt: number;
  lastInteractionAt: number;
  sessionId?: string;
  currentPage?: string;
}

interface StoredAccessibilityRecord extends AccessibilityRequestRecord {
  documentStoragePath?: string | null;
}

interface StoredAndroidRelease extends AndroidAppRelease {
  storagePath: string;
  backupPath?: string | null;
}

interface StoreSchema {
  schemaVersion?: number;
  subscriptions: Record<string, RawSubscriptionInput & { email?: string | null }>;
  subscriptionHistory: Record<string, SubscriptionHistoryEntry[]>;
  transactions: Record<string, PaymentTransaction>;
  familyProfiles: Record<string, FamilyMemberProfile[]>;
  businessQuotes: BusinessQuoteRequest[];
  earlyTesterEmails: Record<string, { startDate: number; endDate: number; note?: string }>;
  redeemCodes: Record<string, RedeemCodeRecord>;
  activations: ActivationRecord[];
  userDirectory: Record<string, StoredUserRecord>;
  presence: Record<string, StoredPresenceRecord>;
  accessibilityRequests: StoredAccessibilityRecord[];
  platformSettings: PlatformSettings;
  priceChangeHistory: PriceChangeHistoryEntry[];
  adminNotifications: AdminNotificationRecord[];
  supportTickets: SupportTicketRecord[];
  auditLogs: AuditLogEntry[];
  androidAppSettings: AndroidAppSettings;
  androidReleases: StoredAndroidRelease[];
  androidDownloadEvents: AndroidDownloadEvent[];
  userConsents: Record<string, UserConsentRecord>;
}

export const CURRENT_CONSENT_VERSION = '2026.1';
export const CURRENT_TERMS_VERSION = '2026.1';
export const CURRENT_PRIVACY_VERSION = '2026.1';

const DATA_DIR = path.join(process.cwd(), '.data');
const STORE_PATH = path.join(DATA_DIR, 'subscriptions.json');
const ACCESSIBILITY_DOCS_DIR = path.join(DATA_DIR, 'accessibility_docs');
export const APK_RELEASES_DIR = path.join(DATA_DIR, 'apk_releases');
export const APK_BACKUPS_DIR = path.join(DATA_DIR, 'apk_backups');
export const APK_TMP_DIR = path.join(DATA_DIR, 'apk_tmp');

const DEFAULT_SUPER_ADMIN_EMAILS = ['medbenhasan@gmail.com', 'medbenhasa@gmail.com'];

export function getSuperAdminEmails(): string[] {
  const envRaw = process.env.SUPER_ADMIN_EMAILS;
  if (envRaw && envRaw.trim()) {
    return envRaw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  }
  return DEFAULT_SUPER_ADMIN_EMAILS;
}

function getRolloutCutoffMs(): number {
  const iso = process.env.EARLY_TESTER_ROLLOUT_ISO;
  if (iso) {
    const parsed = Date.parse(iso);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return EARLY_TESTER_ROLLOUT_MS;
}

function createDefaultRegionalPlans(): Record<SubscriptionPlan, PlanRegionalConfig> {
  return {
    FREE: { ...DEFAULT_REGIONAL_PLANS.FREE },
    PREMIUM: { ...DEFAULT_REGIONAL_PLANS.PREMIUM },
    FAMILY: { ...DEFAULT_REGIONAL_PLANS.FAMILY },
    BUSINESS: { ...DEFAULT_REGIONAL_PLANS.BUSINESS },
  };
}

function normalizeRegionalPlansFromSettings(
  planPrices: PlatformSettings['planPrices'],
  existingRegional?: Partial<Record<SubscriptionPlan, Partial<PlanRegionalConfig>>>
): Record<SubscriptionPlan, PlanRegionalConfig> {
  const defaults = createDefaultRegionalPlans();
  return {
    FREE: {
      ...defaults.FREE,
      ...(existingRegional?.FREE || {}),
      id: 'FREE',
      enabled: existingRegional?.FREE?.enabled ?? true,
      monthlyPriceTnd: 0,
      annualPriceTnd: 0,
      monthlyPriceEur: 0,
      annualPriceEur: 0,
    },
    PREMIUM: {
      ...defaults.PREMIUM,
      ...(existingRegional?.PREMIUM || {}),
      id: 'PREMIUM',
      enabled: existingRegional?.PREMIUM?.enabled ?? true,
      monthlyPriceTnd: planPrices.premiumMonthlyTnd,
      annualPriceTnd: planPrices.premiumAnnualTnd,
      monthlyPriceEur: planPrices.premiumMonthlyEur,
      annualPriceEur: planPrices.premiumAnnualEur,
    },
    FAMILY: {
      ...defaults.FAMILY,
      ...(existingRegional?.FAMILY || {}),
      id: 'FAMILY',
      enabled: existingRegional?.FAMILY?.enabled ?? true,
      monthlyPriceTnd: planPrices.familyMonthlyTnd,
      annualPriceTnd: planPrices.familyAnnualTnd,
      monthlyPriceEur: planPrices.familyMonthlyEur,
      annualPriceEur: planPrices.familyAnnualEur,
    },
    BUSINESS: {
      ...defaults.BUSINESS,
      ...(existingRegional?.BUSINESS || {}),
      id: 'BUSINESS',
      enabled: existingRegional?.BUSINESS?.enabled ?? true,
      customPricing: true,
    },
  };
}

function createDefaultPlatformSettings(): PlatformSettings {
  const planPrices = {
    premiumMonthlyTnd: 4.9,
    premiumAnnualTnd: 49,
    premiumMonthlyEur: 3.9,
    premiumAnnualEur: 39,
    familyMonthlyTnd: 9.9,
    familyAnnualTnd: 99,
    familyMonthlyEur: 7.9,
    familyAnnualEur: 79,
  };
  return {
    platformName: 'VruGuard',
    logoUrl: '',
    contactEmail: 'contact@vruguard.me',
    supportEmail: 'support@vruguard.me',
    planPrices,
    regionalPlans: normalizeRegionalPlansFromSettings(planPrices),
    pioneerProgramEnabled: true,
    pioneerDurationDays: 730,
    accessibilityProgramEnabled: true,
    notificationsEnabled: true,
    maintenanceMode: false,
    maintenanceMessage:
      'Une opération de maintenance planifiée est en cours. L’accès complet sera rétabli très prochainement.',
    announcementEnabled: false,
    announcementText: '',
    announcementType: 'info',
    securitySettings: {
      requireReauthForCriticalActions: true,
      adminRateLimitPerMin: 120,
      delegatedAdminEmails: [],
      permissionMatrix: {
        SUPER_ADMIN: [
          'users:read',
          'users:suspend',
          'users:ban',
          'users:delete',
          'subscriptions:write',
          'redeem:write',
          'accessibility:review',
          'pioneer:write',
          'notifications:send',
          'support:write',
          'settings:write',
          'security:write',
          'audit:read',
          'android:read',
          'android:write',
          'consent:read',
        ],
        ADMIN: [
          'users:read',
          'users:suspend',
          'subscriptions:write',
          'redeem:write',
          'accessibility:review',
          'support:write',
          'audit:read',
          'android:read',
          'android:write',
          'consent:read',
        ],
      },
    },
    updatedAt: Date.now(),
    updatedBy: 'system',
  };
}

function createDefaultAndroidAppSettings(): AndroidAppSettings {
  return {
    downloadsEnabled: true,
    appName: 'VruGuard',
    packageName: 'com.vruguard.sentinel',
    description:
      'Application Android VruGuard pour la localisation intelligente, les alertes de proximité VRU, la navigation adaptée et l’assistance SOS.',
    minSupportedVersionCode: 1,
    retentionKeepCount: 3,
    maxApkSizeBytes: 200 * 1024 * 1024, // 200 MB
    updatedAt: Date.now(),
    updatedBy: 'system',
  };
}

function createEmptyStore(): StoreSchema {
  return {
    schemaVersion: 3,
    subscriptions: {},
    subscriptionHistory: {},
    transactions: {},
    familyProfiles: {},
    businessQuotes: [],
    earlyTesterEmails: {},
    redeemCodes: {},
    activations: [],
    userDirectory: {},
    presence: {},
    accessibilityRequests: [],
    platformSettings: createDefaultPlatformSettings(),
    priceChangeHistory: [],
    adminNotifications: [],
    supportTickets: [],
    auditLogs: [],
    androidAppSettings: createDefaultAndroidAppSettings(),
    androidReleases: [],
    androidDownloadEvents: [],
    userConsents: {},
  };
}

function hashRedeemCode(normalizedCode: string): string {
  return crypto.createHash('sha256').update(normalizedCode).digest('hex');
}

function maskRedeemCode(normalizedCode: string): string {
  const parts = normalizedCode.split('-');
  if (parts.length >= 4) {
    return `${parts[0]}-${parts[1]}-••••-${parts[parts.length - 1]}`;
  }
  if (normalizedCode.length > 8) {
    return `${normalizedCode.slice(0, 6)}••••${normalizedCode.slice(-4)}`;
  }
  return 'VRU-••••';
}

class SubscriptionStore {
  private data: StoreSchema;
  private redeemLocks = new Set<string>();
  private consentLocks = new Set<string>();

  constructor() {
    this.data = this.loadFromDisk();
  }

  private ensureDirectories(): void {
    for (const dir of [
      DATA_DIR,
      ACCESSIBILITY_DOCS_DIR,
      APK_RELEASES_DIR,
      APK_BACKUPS_DIR,
      APK_TMP_DIR,
    ]) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  private loadFromDisk(): StoreSchema {
    try {
      this.ensureDirectories();
      if (!fs.existsSync(STORE_PATH)) {
        const initial = createEmptyStore();
        fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2), 'utf8');
        return initial;
      }
      const raw = fs.readFileSync(STORE_PATH, 'utf8');
      const parsed = JSON.parse(raw) as Partial<StoreSchema> & { auditLogs?: any[] };
      const defaults = createDefaultPlatformSettings();
      const mergedPlanPrices = {
        ...defaults.planPrices,
        ...(parsed.platformSettings?.planPrices || {}),
      };
      const existingMatrix = parsed.platformSettings?.securitySettings?.permissionMatrix || {};
      const migratedMatrix: Record<string, string[]> = {
        ...defaults.securitySettings.permissionMatrix,
        ...existingMatrix,
      };
      for (const roleKey of ['SUPER_ADMIN', 'ADMIN']) {
        const currentPerms = new Set(migratedMatrix[roleKey] || []);
        currentPerms.add('android:read');
        currentPerms.add('android:write');
        currentPerms.add('consent:read');
        migratedMatrix[roleKey] = Array.from(currentPerms);
      }

      const loadedSettings: PlatformSettings = parsed.platformSettings
        ? {
            ...defaults,
            ...parsed.platformSettings,
            planPrices: mergedPlanPrices,
            regionalPlans: normalizeRegionalPlansFromSettings(
              mergedPlanPrices,
              parsed.platformSettings.regionalPlans
            ),
            securitySettings: {
              ...defaults.securitySettings,
              ...(parsed.platformSettings.securitySettings || {}),
              permissionMatrix: migratedMatrix,
            },
          }
        : defaults;

      const normalizedTransactions: Record<string, PaymentTransaction> = {};
      Object.entries(parsed.transactions || {}).forEach(([id, tx]) => {
        const legacyAmount = (tx as any).amountTnd ?? 0;
        normalizedTransactions[id] = {
          ...tx,
          amount: typeof (tx as any).amount === 'number' ? (tx as any).amount : legacyAmount,
          currency: ((tx as any).currency === 'EUR' ? 'EUR' : 'TND') as SupportedCurrency,
        };
      });

      const normalizedAudit: AuditLogEntry[] = (parsed.auditLogs || []).map((entry: any) => ({
        id: entry.id || `aud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        timestamp: entry.timestamp || Date.now(),
        adminUid: entry.adminUid || entry.uid || 'system',
        adminEmail: entry.adminEmail || entry.uid || 'system',
        adminRole: entry.adminRole || 'OPERATOR',
        action: entry.action || 'EVENT',
        category: entry.category || 'subscription',
        targetUid: entry.targetUid || entry.uid || null,
        targetEmail: entry.targetEmail || null,
        targetId: entry.targetId || null,
        oldValue: entry.oldValue,
        newValue: entry.newValue,
        outcome: entry.outcome || 'success',
        ip: entry.ip || null,
        detail: entry.detail || '',
      }));

      const defaultAndroidSettings = createDefaultAndroidAppSettings();
      const loadedAndroidSettings: AndroidAppSettings = {
        ...defaultAndroidSettings,
        ...(parsed.androidAppSettings || {}),
      };

      const needsSchemaMigration =
        !parsed.schemaVersion ||
        parsed.schemaVersion < 3 ||
        !parsed.androidAppSettings ||
        !Array.isArray(parsed.androidReleases) ||
        !Array.isArray(parsed.androidDownloadEvents) ||
        !parsed.userConsents ||
        typeof parsed.userConsents !== 'object';

      const migrated: StoreSchema = {
        schemaVersion: 3,
        subscriptions: parsed.subscriptions || {},
        subscriptionHistory: parsed.subscriptionHistory || {},
        transactions: normalizedTransactions,
        familyProfiles: parsed.familyProfiles || {},
        businessQuotes: parsed.businessQuotes || [],
        earlyTesterEmails: parsed.earlyTesterEmails || {},
        redeemCodes: parsed.redeemCodes || {},
        activations: parsed.activations || [],
        userDirectory: parsed.userDirectory || {},
        presence: parsed.presence || {},
        accessibilityRequests: parsed.accessibilityRequests || [],
        platformSettings: loadedSettings,
        priceChangeHistory: parsed.priceChangeHistory || [],
        adminNotifications: parsed.adminNotifications || [],
        supportTickets: parsed.supportTickets || [],
        auditLogs: normalizedAudit,
        androidAppSettings: loadedAndroidSettings,
        androidReleases: Array.isArray(parsed.androidReleases) ? parsed.androidReleases : [],
        androidDownloadEvents: Array.isArray(parsed.androidDownloadEvents)
          ? parsed.androidDownloadEvents
          : [],
        // Existing users created prior to First Login Consent are NEVER auto-accepted:
        userConsents:
          parsed.userConsents && typeof parsed.userConsents === 'object'
            ? parsed.userConsents
            : {},
      };

      if (needsSchemaMigration) {
        const tmpPath = `${STORE_PATH}.tmp`;
        fs.writeFileSync(tmpPath, JSON.stringify(migrated, null, 2), 'utf8');
        fs.renameSync(tmpPath, STORE_PATH);
      }

      return migrated;
    } catch (err) {
      console.error('Failed to load subscription store, initializing fresh store:', err);
      return createEmptyStore();
    }
  }

  private persist(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const tmpPath = `${STORE_PATH}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(this.data, null, 2), 'utf8');
      fs.renameSync(tmpPath, STORE_PATH);
    } catch (err) {
      console.error('Failed to persist subscription store:', err);
    }
  }

  // --- Immutable Audit Logs ---

  public recordAuditLog(params: {
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
    outcome?: 'success' | 'denied' | 'failed';
    ip?: string | null;
    detail: string;
  }): AuditLogEntry {
    const entry: AuditLogEntry = {
      id: `aud_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      timestamp: Date.now(),
      adminUid: params.adminUid,
      adminEmail: params.adminEmail,
      adminRole: params.adminRole || 'OPERATOR',
      action: params.action,
      category: params.category,
      targetUid: params.targetUid ?? null,
      targetEmail: params.targetEmail ?? null,
      targetId: params.targetId ?? null,
      oldValue: params.oldValue,
      newValue: params.newValue,
      outcome: params.outcome || 'success',
      ip: params.ip ?? null,
      detail: params.detail,
    };
    this.data.auditLogs.unshift(entry);
    if (this.data.auditLogs.length > 5000) {
      this.data.auditLogs.length = 5000;
    }
    this.persist();
    return entry;
  }

  private addAudit(uid: string, action: string, detail: string, category: AuditCategory = 'subscription'): void {
    this.data.auditLogs.unshift({
      id: `aud_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      timestamp: Date.now(),
      adminUid: uid,
      adminEmail: uid,
      action,
      category,
      targetUid: uid,
      outcome: 'success',
      detail,
    });
    if (this.data.auditLogs.length > 5000) {
      this.data.auditLogs.length = 5000;
    }
  }

  public listAuditLogs(options?: {
    category?: string;
    outcome?: string;
    search?: string;
    limit?: number;
  }): AuditLogEntry[] {
    const q = (options?.search || '').trim().toLowerCase();
    const limit = Math.min(500, Math.max(1, options?.limit || 200));
    return this.data.auditLogs
      .filter((log) => {
        if (options?.category && options.category !== 'ALL' && log.category !== options.category) {
          return false;
        }
        if (options?.outcome && options.outcome !== 'ALL' && log.outcome !== options.outcome) {
          return false;
        }
        if (!q) return true;
        return (
          log.action.toLowerCase().includes(q) ||
          log.detail.toLowerCase().includes(q) ||
          log.adminEmail.toLowerCase().includes(q) ||
          (log.targetEmail || '').toLowerCase().includes(q) ||
          (log.targetUid || '').toLowerCase().includes(q)
        );
      })
      .slice(0, limit);
  }

  // --- Role & Security Resolution ---

  public resolveUserRole(email: string | null | undefined, emailVerified: boolean): AdminRole {
    if (!email || !emailVerified) return 'OPERATOR';
    const clean = email.toLowerCase().trim();
    if (getSuperAdminEmails().includes(clean)) return 'SUPER_ADMIN';
    const delegated = (this.data.platformSettings.securitySettings.delegatedAdminEmails || []).map((e) =>
      e.toLowerCase().trim()
    );
    if (delegated.includes(clean)) return 'ADMIN';
    return 'OPERATOR';
  }

  public isAuthorizedAdminEmail(email: string | null | undefined, emailVerified: boolean): boolean {
    const role = this.resolveUserRole(email, emailVerified);
    return role === 'SUPER_ADMIN' || role === 'ADMIN';
  }

  public hasPermission(role: AdminRole, permission: string): boolean {
    if (role === 'SUPER_ADMIN') return true;
    const perms = this.data.platformSettings.securitySettings.permissionMatrix?.[role] || [];
    return perms.includes(permission);
  }

  // --- User Directory & Governance ---

  public upsertDirectoryUser(input: {
    uid: string;
    email?: string | null;
    displayName?: string | null;
    photoURL?: string | null;
    emailVerified?: boolean;
    createdAt?: number | null;
    lastLoginAt?: number | null;
  }): StoredUserRecord {
    const now = Date.now();
    const existing = this.data.userDirectory[input.uid];
    const resolvedEmail = input.email !== undefined ? input.email : existing?.email ?? null;
    const resolvedVerified =
      input.emailVerified !== undefined ? input.emailVerified : existing?.emailVerified ?? false;
    const computedRole = this.resolveUserRole(resolvedEmail, resolvedVerified);

    if (!existing) {
      const created: StoredUserRecord = {
        uid: input.uid,
        email: resolvedEmail,
        displayName: input.displayName ?? null,
        photoURL: input.photoURL ?? null,
        emailVerified: resolvedVerified,
        role: computedRole,
        createdAt: input.createdAt ?? now,
        lastLoginAt: input.lastLoginAt ?? now,
        accountStatus: 'active',
        sanctionHistory: [],
      };
      this.data.userDirectory[input.uid] = created;
      this.persist();
      return created;
    }

    let changed = false;
    if (resolvedEmail && existing.email !== resolvedEmail) {
      existing.email = resolvedEmail;
      changed = true;
    }
    if (input.displayName && existing.displayName !== input.displayName) {
      existing.displayName = input.displayName;
      changed = true;
    }
    if (input.photoURL !== undefined && existing.photoURL !== input.photoURL) {
      existing.photoURL = input.photoURL;
      changed = true;
    }
    if (input.emailVerified !== undefined && existing.emailVerified !== input.emailVerified) {
      existing.emailVerified = input.emailVerified;
      changed = true;
    }
    if (input.createdAt && (!existing.createdAt || input.createdAt < existing.createdAt)) {
      existing.createdAt = input.createdAt;
      changed = true;
    }
    if (input.lastLoginAt && (!existing.lastLoginAt || input.lastLoginAt > existing.lastLoginAt)) {
      existing.lastLoginAt = input.lastLoginAt;
      changed = true;
    }
    if (existing.role !== computedRole) {
      existing.role = computedRole;
      changed = true;
    }

    // Auto-expire temporary suspensions cleanly
    if (
      existing.accountStatus === 'suspended' &&
      existing.suspensionExpiresAt &&
      existing.suspensionExpiresAt <= now
    ) {
      existing.accountStatus = 'active';
      existing.suspensionReason = null;
      existing.suspensionExpiresAt = null;
      changed = true;
    }

    if (changed) {
      this.persist();
    }
    return existing;
  }

  public getUserGovernance(uid: string): StoredUserRecord | null {
    const rec = this.data.userDirectory[uid];
    if (!rec) return null;
    const now = Date.now();
    if (
      rec.accountStatus === 'suspended' &&
      rec.suspensionExpiresAt &&
      rec.suspensionExpiresAt <= now
    ) {
      rec.accountStatus = 'active';
      rec.suspensionReason = null;
      rec.suspensionExpiresAt = null;
      this.persist();
    }
    return rec;
  }

  public suspendUser(params: {
    targetUid: string;
    reason: string;
    durationHours: number;
    adminUid: string;
    adminEmail: string;
    ip?: string | null;
  }): StoredUserRecord {
    const now = Date.now();
    const user =
      this.data.userDirectory[params.targetUid] ||
      this.upsertDirectoryUser({ uid: params.targetUid });

    const safeHours = Math.max(1, Math.min(24 * 365, Math.floor(params.durationHours || 24)));
    const expiresAt = now + safeHours * 60 * 60 * 1000;
    const oldStatus = user.accountStatus;

    user.accountStatus = 'suspended';
    user.suspensionReason = params.reason.trim();
    user.suspendedAt = now;
    user.suspensionExpiresAt = expiresAt;
    user.revokedAfter = now;
    user.sanctionHistory.unshift({
      id: `sanc_${now}_${crypto.randomBytes(3).toString('hex')}`,
      action: 'suspend',
      reason: user.suspensionReason,
      durationHours: safeHours,
      expiresAt,
      adminEmail: params.adminEmail,
      createdAt: now,
    });

    // Force offline presence immediately
    if (this.data.presence[params.targetUid]) {
      this.data.presence[params.targetUid].rawState = 'offline';
    }

    this.recordAuditLog({
      adminUid: params.adminUid,
      adminEmail: params.adminEmail,
      adminRole: 'SUPER_ADMIN',
      action: 'USER_SUSPENDED',
      category: 'user',
      targetUid: params.targetUid,
      targetEmail: user.email,
      oldValue: { accountStatus: oldStatus },
      newValue: { accountStatus: 'suspended', expiresAt, reason: user.suspensionReason },
      ip: params.ip,
      detail: `Compte suspendu pour ${safeHours}h : ${user.suspensionReason}`,
    });

    this.persist();
    return user;
  }

  public banUser(params: {
    targetUid: string;
    reason: string;
    adminUid: string;
    adminEmail: string;
    ip?: string | null;
  }): StoredUserRecord {
    const now = Date.now();
    const user =
      this.data.userDirectory[params.targetUid] ||
      this.upsertDirectoryUser({ uid: params.targetUid });
    const oldStatus = user.accountStatus;

    user.accountStatus = 'banned';
    user.banReason = params.reason.trim();
    user.bannedAt = now;
    user.suspensionReason = null;
    user.suspensionExpiresAt = null;
    user.revokedAfter = now;
    user.sanctionHistory.unshift({
      id: `sanc_${now}_${crypto.randomBytes(3).toString('hex')}`,
      action: 'ban',
      reason: user.banReason,
      adminEmail: params.adminEmail,
      createdAt: now,
    });

    if (this.data.presence[params.targetUid]) {
      this.data.presence[params.targetUid].rawState = 'offline';
    }

    this.recordAuditLog({
      adminUid: params.adminUid,
      adminEmail: params.adminEmail,
      adminRole: 'SUPER_ADMIN',
      action: 'USER_BANNED',
      category: 'user',
      targetUid: params.targetUid,
      targetEmail: user.email,
      oldValue: { accountStatus: oldStatus },
      newValue: { accountStatus: 'banned', reason: user.banReason },
      ip: params.ip,
      detail: `Compte banni définitivement : ${user.banReason}`,
    });

    this.persist();
    return user;
  }

  public unbanOrReactivateUser(params: {
    targetUid: string;
    reason?: string;
    adminUid: string;
    adminEmail: string;
    ip?: string | null;
  }): StoredUserRecord {
    const now = Date.now();
    const user =
      this.data.userDirectory[params.targetUid] ||
      this.upsertDirectoryUser({ uid: params.targetUid });
    const oldStatus = user.accountStatus;

    user.accountStatus = 'active';
    user.banReason = null;
    user.suspensionReason = null;
    user.suspensionExpiresAt = null;
    user.softDeletedAt = null;
    user.deletionReason = null;
    user.sanctionHistory.unshift({
      id: `sanc_${now}_${crypto.randomBytes(3).toString('hex')}`,
      action: 'unban',
      reason: params.reason?.trim() || 'Réactivation manuelle par Super Admin',
      adminEmail: params.adminEmail,
      createdAt: now,
    });

    this.recordAuditLog({
      adminUid: params.adminUid,
      adminEmail: params.adminEmail,
      adminRole: 'SUPER_ADMIN',
      action: 'USER_REACTIVATED',
      category: 'user',
      targetUid: params.targetUid,
      targetEmail: user.email,
      oldValue: { accountStatus: oldStatus },
      newValue: { accountStatus: 'active' },
      ip: params.ip,
      detail: `Compte réactivé (${oldStatus} -> active). Motif : ${params.reason || 'Réactivation admin'}`,
    });

    this.persist();
    return user;
  }

  public revokeUserSessions(params: {
    targetUid: string;
    reason?: string;
    adminUid: string;
    adminEmail: string;
    ip?: string | null;
  }): StoredUserRecord {
    const now = Date.now();
    const user =
      this.data.userDirectory[params.targetUid] ||
      this.upsertDirectoryUser({ uid: params.targetUid });
    user.revokedAfter = now;
    user.sanctionHistory.unshift({
      id: `sanc_${now}_${crypto.randomBytes(3).toString('hex')}`,
      action: 'revoke_sessions',
      reason: params.reason?.trim() || 'Révocation forcée des sessions actives',
      adminEmail: params.adminEmail,
      createdAt: now,
    });
    if (this.data.presence[params.targetUid]) {
      this.data.presence[params.targetUid].rawState = 'offline';
    }

    this.recordAuditLog({
      adminUid: params.adminUid,
      adminEmail: params.adminEmail,
      adminRole: 'SUPER_ADMIN',
      action: 'USER_SESSIONS_REVOKED',
      category: 'security',
      targetUid: params.targetUid,
      targetEmail: user.email,
      ip: params.ip,
      detail: `Sessions utilisateur révoquées (${user.email || params.targetUid})`,
    });
    this.persist();
    return user;
  }

  public softDeleteUser(params: {
    targetUid: string;
    reason: string;
    adminUid: string;
    adminEmail: string;
    ip?: string | null;
  }): StoredUserRecord {
    const now = Date.now();
    const user =
      this.data.userDirectory[params.targetUid] ||
      this.upsertDirectoryUser({ uid: params.targetUid });
    const oldStatus = user.accountStatus;

    user.accountStatus = 'soft_deleted';
    user.softDeletedAt = now;
    user.deletionReason = params.reason.trim();
    user.revokedAfter = now;
    user.sanctionHistory.unshift({
      id: `sanc_${now}_${crypto.randomBytes(3).toString('hex')}`,
      action: 'soft_delete',
      reason: user.deletionReason,
      adminEmail: params.adminEmail,
      createdAt: now,
    });
    if (this.data.presence[params.targetUid]) {
      this.data.presence[params.targetUid].rawState = 'offline';
    }

    this.recordAuditLog({
      adminUid: params.adminUid,
      adminEmail: params.adminEmail,
      adminRole: 'SUPER_ADMIN',
      action: 'USER_SOFT_DELETED',
      category: 'user',
      targetUid: params.targetUid,
      targetEmail: user.email,
      oldValue: { accountStatus: oldStatus },
      newValue: { accountStatus: 'soft_deleted', reason: user.deletionReason },
      ip: params.ip,
      detail: `Suppression logique (soft delete) du compte : ${user.deletionReason}`,
    });

    this.persist();
    return user;
  }

  public hardDeleteUser(params: {
    targetUid: string;
    reason: string;
    adminUid: string;
    adminEmail: string;
    ip?: string | null;
  }): { deletedUid: string; targetEmail: string | null } {
    const user = this.data.userDirectory[params.targetUid];
    const targetEmail = user?.email || this.data.subscriptions[params.targetUid]?.email || null;

    delete this.data.userDirectory[params.targetUid];
    delete this.data.subscriptions[params.targetUid];
    delete this.data.subscriptionHistory[params.targetUid];
    delete this.data.familyProfiles[params.targetUid];
    delete this.data.presence[params.targetUid];
    delete this.data.userConsents[params.targetUid];

    this.recordAuditLog({
      adminUid: params.adminUid,
      adminEmail: params.adminEmail,
      adminRole: 'SUPER_ADMIN',
      action: 'USER_HARD_DELETED',
      category: 'user',
      targetUid: params.targetUid,
      targetEmail,
      oldValue: { uid: params.targetUid, email: targetEmail },
      newValue: { deleted: true },
      ip: params.ip,
      detail: `Suppression définitive du compte (${targetEmail || params.targetUid}). Motif : ${params.reason}`,
    });

    this.persist();
    return { deletedUid: params.targetUid, targetEmail };
  }

  // --- Live Presence Tracking ---

  public updatePresenceHeartbeat(params: {
    uid: string;
    state: 'online' | 'idle';
    lastInteractionAt?: number;
    sessionId?: string;
    currentPage?: string;
  }): PresenceRecord {
    const now = Date.now();
    const record: StoredPresenceRecord = {
      uid: params.uid,
      rawState: params.state === 'idle' ? 'idle' : 'online',
      lastHeartbeatAt: now,
      lastInteractionAt: params.lastInteractionAt || now,
      sessionId: params.sessionId,
      currentPage: params.currentPage,
    };
    this.data.presence[params.uid] = record;
    this.persist();
    return this.computePresenceState(params.uid, now);
  }

  public markPresenceOffline(uid: string): void {
    const existing = this.data.presence[uid];
    if (existing) {
      existing.rawState = 'offline';
      existing.lastHeartbeatAt = Date.now();
      this.persist();
    }
  }

  public computePresenceState(uid: string, nowMs: number = Date.now()): PresenceRecord {
    const raw = this.data.presence[uid];
    if (!raw || raw.rawState === 'offline') {
      return {
        uid,
        state: 'offline',
        lastHeartbeatAt: raw?.lastHeartbeatAt || 0,
        lastInteractionAt: raw?.lastInteractionAt || 0,
        sessionId: raw?.sessionId,
        currentPage: raw?.currentPage,
      };
    }

    const sinceHeartbeat = nowMs - raw.lastHeartbeatAt;
    const sinceInteraction = nowMs - (raw.lastInteractionAt || raw.lastHeartbeatAt);

    let state: PresenceState = 'offline';
    if (sinceHeartbeat <= 50_000 && raw.rawState === 'online' && sinceInteraction <= 95_000) {
      state = 'online';
    } else if (sinceHeartbeat <= 130_000) {
      state = 'idle';
    } else {
      state = 'offline';
    }

    return {
      uid,
      state,
      lastHeartbeatAt: raw.lastHeartbeatAt,
      lastInteractionAt: raw.lastInteractionAt,
      sessionId: raw.sessionId,
      currentPage: raw.currentPage,
    };
  }

  public listPresenceSummary(): {
    onlineCount: number;
    idleCount: number;
    offlineCount: number;
    records: PresenceRecord[];
  } {
    const now = Date.now();
    const uids = new Set<string>([
      ...Object.keys(this.data.userDirectory),
      ...Object.keys(this.data.subscriptions),
      ...Object.keys(this.data.presence),
    ]);

    let onlineCount = 0;
    let idleCount = 0;
    let offlineCount = 0;
    const records: PresenceRecord[] = [];

    uids.forEach((uid) => {
      const p = this.computePresenceState(uid, now);
      records.push(p);
      if (p.state === 'online') onlineCount += 1;
      else if (p.state === 'idle') idleCount += 1;
      else offlineCount += 1;
    });

    return { onlineCount, idleCount, offlineCount, records };
  }

  // --- Subscriptions & History ---

  private appendSubscriptionHistory(uid: string, entry: Omit<SubscriptionHistoryEntry, 'id'>): void {
    const list = this.data.subscriptionHistory[uid] || [];
    list.unshift({
      id: `subh_${entry.timestamp}_${crypto.randomBytes(3).toString('hex')}`,
      ...entry,
    });
    if (list.length > 100) list.length = 100;
    this.data.subscriptionHistory[uid] = list;
  }

  public getUserSubscription(
    uid: string,
    options?: { email?: string | null; userCreatedAtMs?: number | null }
  ): UserSubscription {
    const now = Date.now();
    let record = this.data.subscriptions[uid];

    if (!record) {
      record = {
        uid,
        email: options?.email || null,
        plan: 'FREE',
        status: 'active',
        billingCycle: 'monthly',
        startDate: now,
        endDate: null,
        isLifetime: false,
        cancelAtPeriodEnd: false,
        isEarlyTester: false,
        earlyTesterStartDate: null,
        earlyTesterEndDate: null,
        isAccessibilityLifetime: false,
        activationSource: 'free',
        paymentProvider: null,
        paymentVerified: false,
        lastPaymentRef: null,
        updatedAt: now,
      };
      this.data.subscriptions[uid] = record;
    } else if (options?.email && !record.email) {
      record.email = options.email;
    }

    const cutoffMs = getRolloutCutoffMs();
    const createdMs = options?.userCreatedAtMs ?? null;
    const normalizedEmail = (options?.email || record.email || '').toLowerCase().trim();
    const whitelistedEmail = normalizedEmail ? this.data.earlyTesterEmails[normalizedEmail] : undefined;

    if (!record.isEarlyTester && this.data.platformSettings.pioneerProgramEnabled) {
      const pioneerDurationMs =
        (this.data.platformSettings.pioneerDurationDays || 730) * 24 * 60 * 60 * 1000;
      if (createdMs !== null && createdMs > 0 && createdMs < cutoffMs) {
        record.isEarlyTester = true;
        record.earlyTesterStartDate = createdMs;
        record.earlyTesterEndDate = createdMs + Math.max(pioneerDurationMs, EARLY_TESTER_DURATION_MS);
        record.paymentProvider = record.paymentProvider || 'early_tester';
        record.activationSource = record.activationSource === 'free' ? 'pioneer' : record.activationSource;
        record.updatedAt = now;
        this.recordActivation({
          uid,
          email: record.email,
          plan: 'PREMIUM',
          billingCycle: 'annual',
          source: 'early_tester',
          code: null,
          startDate: createdMs,
          endDate: record.earlyTesterEndDate,
          activatedAt: now,
        });
        this.addAudit(
          uid,
          'EARLY_TESTER_AUTO_PRESERVED',
          `Pre-rollout account (${new Date(createdMs).toISOString()}) granted 2-year Pioneer Premium`,
          'pioneer'
        );
      } else if (whitelistedEmail) {
        record.isEarlyTester = true;
        record.earlyTesterStartDate = whitelistedEmail.startDate;
        record.earlyTesterEndDate = whitelistedEmail.endDate;
        record.paymentProvider = record.paymentProvider || 'early_tester';
        record.activationSource = record.activationSource === 'free' ? 'pioneer' : record.activationSource;
        record.updatedAt = now;
        this.recordActivation({
          uid,
          email: record.email,
          plan: 'PREMIUM',
          billingCycle: 'annual',
          source: 'pioneer',
          code: null,
          startDate: whitelistedEmail.startDate,
          endDate: whitelistedEmail.endDate,
          activatedAt: now,
        });
        this.addAudit(
          uid,
          'EARLY_TESTER_WHITELIST_APPLIED',
          `Pioneer email whitelist applied for ${normalizedEmail}`,
          'pioneer'
        );
      }
    }

    const resolved = resolveEffectiveSubscription(record, now);
    if (record.plan !== 'FREE' && resolved.effectivePlan === 'FREE' && record.status === 'active') {
      record.status = record.cancelAtPeriodEnd ? 'canceled' : 'expired';
      record.updatedAt = now;
      this.addAudit(uid, 'SUBSCRIPTION_EXPIRED', `Plan ${record.plan} expired and reverted to FREE`);
    }

    this.persist();

    const transactions = Object.values(this.data.transactions)
      .filter((t) => t.uid === uid)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 20);

    const activations = this.data.activations
      .filter((a) => a.uid === uid)
      .sort((a, b) => b.activatedAt - a.activatedAt)
      .slice(0, 30);

    const history = (this.data.subscriptionHistory[uid] || []).slice(0, 50);

    return {
      ...resolved,
      transactions,
      activations,
      history,
    };
  }

  public adminUpdateUserSubscription(params: {
    targetUid: string;
    targetEmail?: string | null;
    action: 'assign' | 'extend' | 'suspend' | 'reactivate' | 'grant_lifetime' | 'downgrade_free';
    plan?: SubscriptionPlan;
    billingCycle?: BillingCycle;
    durationDays?: number | null;
    startDate?: number;
    endDate?: number | null;
    isLifetime?: boolean;
    reason: string;
    activationType?: ActivationSource;
    adminUid: string;
    adminEmail: string;
    ip?: string | null;
  }): UserSubscription {
    const now = Date.now();
    const before = this.getUserSubscription(params.targetUid, { email: params.targetEmail });
    const record = this.data.subscriptions[params.targetUid];

    const oldPlan = before.effectivePlan;
    const oldStatus = before.status;

    if (params.action === 'suspend') {
      record.status = 'suspended';
      record.updatedAt = now;
    } else if (params.action === 'reactivate') {
      record.status = 'active';
      record.updatedAt = now;
    } else if (params.action === 'downgrade_free') {
      record.plan = 'FREE';
      record.status = 'active';
      record.endDate = null;
      record.isLifetime = false;
      record.isAccessibilityLifetime = false;
      record.activationSource = 'admin';
      record.paymentProvider = 'admin';
      record.paymentVerified = false;
      record.updatedAt = now;
    } else if (params.action === 'extend') {
      const addDays = Math.max(1, Math.floor(params.durationDays || 30));
      const baseEnd =
        record.endDate && record.endDate > now ? record.endDate : now;
      record.endDate = baseEnd + addDays * 24 * 60 * 60 * 1000;
      if (record.plan === 'FREE') {
        record.plan = params.plan && params.plan !== 'FREE' ? params.plan : 'PREMIUM';
      }
      record.status = 'active';
      record.paymentVerified = true;
      record.paymentProvider = 'admin';
      record.activationSource = params.activationType || 'admin';
      record.updatedAt = now;
    } else if (params.action === 'grant_lifetime') {
      const targetPlan = params.plan && params.plan !== 'FREE' ? params.plan : 'PREMIUM';
      record.plan = targetPlan;
      record.status = 'active';
      record.billingCycle = 'custom';
      record.startDate = params.startDate || now;
      record.endDate = null;
      record.isLifetime = true;
      record.isAccessibilityLifetime = params.activationType === 'accessibility';
      record.activationSource = params.activationType || 'admin';
      record.paymentProvider = params.activationType === 'accessibility' ? 'accessibility' : 'admin';
      record.paymentVerified = true;
      record.cancelAtPeriodEnd = false;
      record.updatedAt = now;
    } else {
      // assign / manual edit
      const nextPlan = params.plan || 'PREMIUM';
      if (nextPlan === 'FREE') {
        record.plan = 'FREE';
        record.status = 'active';
        record.endDate = null;
        record.isLifetime = false;
        record.isAccessibilityLifetime = false;
        record.paymentVerified = false;
        record.paymentProvider = 'admin';
        record.activationSource = 'admin';
      } else {
        const isLifetime = Boolean(params.isLifetime);
        const start = params.startDate || now;
        let end: number | null = null;
        if (!isLifetime) {
          if (params.endDate !== undefined) {
            end = params.endDate;
          } else if (params.durationDays && params.durationDays > 0) {
            end = start + params.durationDays * 24 * 60 * 60 * 1000;
          } else {
            end =
              start +
              (params.billingCycle === 'annual' ? YEAR_DURATION_MS : MONTH_DURATION_MS);
          }
        }
        record.plan = nextPlan;
        record.status = 'active';
        record.billingCycle = isLifetime ? 'custom' : params.billingCycle || 'custom';
        record.startDate = start;
        record.endDate = end;
        record.isLifetime = isLifetime;
        record.isAccessibilityLifetime = params.activationType === 'accessibility' && isLifetime;
        record.activationSource = params.activationType || 'admin';
        record.paymentProvider = params.activationType === 'accessibility' ? 'accessibility' : 'admin';
        record.paymentVerified = true;
        record.cancelAtPeriodEnd = false;
      }
      record.updatedAt = now;
    }

    const after = resolveEffectiveSubscription(record, now);

    this.appendSubscriptionHistory(params.targetUid, {
      action: params.action,
      oldPlan,
      newPlan: after.effectivePlan,
      oldStatus,
      newStatus: after.status,
      startDate: after.startDate,
      endDate: after.endDate,
      isLifetime: after.isLifetime,
      source: params.activationType || 'admin',
      reason: params.reason,
      adminEmail: params.adminEmail,
      timestamp: now,
    });

    if (params.action === 'assign' || params.action === 'extend' || params.action === 'grant_lifetime') {
      this.recordActivation({
        uid: params.targetUid,
        email: record.email || params.targetEmail || null,
        plan: after.effectivePlan,
        billingCycle: after.billingCycle,
        source: params.activationType || 'admin',
        code: null,
        startDate: after.startDate,
        endDate: after.endDate,
        isLifetime: after.isLifetime,
        reason: params.reason,
        adminEmail: params.adminEmail,
        activatedAt: now,
      });
    }

    this.recordAuditLog({
      adminUid: params.adminUid,
      adminEmail: params.adminEmail,
      adminRole: 'SUPER_ADMIN',
      action: `SUBSCRIPTION_${params.action.toUpperCase()}`,
      category: 'subscription',
      targetUid: params.targetUid,
      targetEmail: record.email || params.targetEmail || null,
      oldValue: { plan: oldPlan, status: oldStatus, endDate: before.endDate },
      newValue: {
        plan: after.effectivePlan,
        status: after.status,
        endDate: after.endDate,
        isLifetime: after.isLifetime,
      },
      ip: params.ip,
      detail: `Abonnement modifié (${oldPlan}/${oldStatus} -> ${after.effectivePlan}/${after.status}). Motif : ${params.reason}`,
    });

    this.persist();
    return this.getUserSubscription(params.targetUid);
  }

  private recordActivation(entry: Omit<ActivationRecord, 'id'>): ActivationRecord {
    const record: ActivationRecord = {
      id: `act_${entry.activatedAt}_${crypto.randomBytes(3).toString('hex')}`,
      ...entry,
    };
    this.data.activations.unshift(record);
    if (this.data.activations.length > 3000) {
      this.data.activations.length = 3000;
    }
    return record;
  }

  public createPendingTransaction(params: {
    uid: string;
    plan: SubscriptionPlan;
    billingCycle: BillingCycle;
    amount?: number;
    amountTnd?: number;
    currency?: SupportedCurrency;
    country?: string | null;
    provider: 'stripe' | 'konnect';
    providerSessionId: string;
  }): PaymentTransaction {
    const now = Date.now();
    const currency: SupportedCurrency = params.currency || 'TND';
    const amount = params.amount ?? params.amountTnd ?? 0;
    const tx: PaymentTransaction = {
      id: `tx_${now}_${crypto.randomBytes(3).toString('hex')}`,
      uid: params.uid,
      plan: params.plan,
      billingCycle: params.billingCycle,
      amount,
      amountTnd: currency === 'TND' ? amount : undefined,
      currency,
      country: params.country ?? null,
      provider: params.provider,
      providerSessionId: params.providerSessionId,
      status: 'pending',
      createdAt: now,
    };
    this.data.transactions[tx.id] = tx;
    this.persist();
    return tx;
  }

  public findTransactionByProviderSession(providerSessionId: string): PaymentTransaction | undefined {
    return Object.values(this.data.transactions).find(
      (tx) => tx.providerSessionId === providerSessionId
    );
  }

  public activateVerifiedSubscription(params: {
    uid: string;
    email?: string | null;
    plan: SubscriptionPlan;
    billingCycle: BillingCycle;
    provider: 'stripe' | 'konnect' | 'admin' | 'redeem';
    paymentRef: string;
    amount?: number;
    amountTnd?: number;
    currency?: SupportedCurrency;
    country?: string | null;
    code?: string | null;
    durationDays?: number | null;
    isLifetime?: boolean;
  }): UserSubscription {
    const now = Date.now();
    const existing = this.data.subscriptions[params.uid] || {
      uid: params.uid,
      email: params.email || null,
      isEarlyTester: false,
      earlyTesterStartDate: null,
      earlyTesterEndDate: null,
    };

    const existingTx = this.findTransactionByProviderSession(params.paymentRef);
    const currency: SupportedCurrency = params.currency || existingTx?.currency || 'TND';
    const amount = params.amount ?? params.amountTnd ?? existingTx?.amount ?? 0;

    if (existingTx) {
      existingTx.status = 'verified';
      existingTx.verifiedAt = now;
      existingTx.amount = amount;
      existingTx.currency = currency;
      if (params.country !== undefined) {
        existingTx.country = params.country;
      }
      if (currency === 'TND') {
        existingTx.amountTnd = amount;
      }
    } else {
      const txId = `tx_${now}_${crypto.randomBytes(3).toString('hex')}`;
      this.data.transactions[txId] = {
        id: txId,
        uid: params.uid,
        plan: params.plan,
        billingCycle: params.billingCycle,
        amount,
        amountTnd: currency === 'TND' ? amount : undefined,
        currency,
        country: params.country ?? null,
        provider: params.provider,
        providerSessionId: params.paymentRef,
        status: 'verified',
        createdAt: now,
        verifiedAt: now,
      };
    }

    const durationMs =
      params.durationDays && params.durationDays > 0
        ? params.durationDays * 24 * 60 * 60 * 1000
        : params.billingCycle === 'annual'
        ? YEAR_DURATION_MS
        : MONTH_DURATION_MS;

    const baseStart =
      !params.isLifetime &&
      existing.plan === params.plan &&
      existing.status === 'active' &&
      existing.endDate &&
      existing.endDate > now
        ? existing.endDate
        : now;

    const computedEndDate =
      params.isLifetime || params.plan === 'BUSINESS' ? null : baseStart + durationMs;

    this.data.subscriptions[params.uid] = {
      ...existing,
      uid: params.uid,
      email: params.email || existing.email || null,
      plan: params.plan,
      status: 'active',
      billingCycle: params.billingCycle,
      startDate: existing.startDate || now,
      endDate: computedEndDate,
      isLifetime: Boolean(params.isLifetime),
      cancelAtPeriodEnd: false,
      activationSource: params.provider,
      paymentProvider: params.provider,
      paymentVerified: true,
      lastPaymentRef: params.paymentRef,
      updatedAt: now,
    };

    this.recordActivation({
      uid: params.uid,
      email: params.email || existing.email || null,
      plan: params.plan,
      billingCycle: params.billingCycle,
      source: params.provider,
      code: params.code || null,
      startDate: baseStart,
      endDate: computedEndDate,
      isLifetime: Boolean(params.isLifetime),
      activatedAt: now,
    });

    this.appendSubscriptionHistory(params.uid, {
      action: 'activate',
      oldPlan: existing.plan || 'FREE',
      newPlan: params.plan,
      oldStatus: existing.status || 'active',
      newStatus: 'active',
      startDate: baseStart,
      endDate: computedEndDate,
      isLifetime: Boolean(params.isLifetime),
      source: params.provider,
      reason: params.code ? `Activation via code Redeem ${params.code}` : `Activation ${params.provider}`,
      timestamp: now,
    });

    this.addAudit(
      params.uid,
      'SUBSCRIPTION_ACTIVATED',
      `Plan ${params.plan} (${params.billingCycle}) verified via ${params.provider} ref=${params.paymentRef}`
    );
    this.persist();

    return this.getUserSubscription(params.uid);
  }

  public scheduleCancellation(uid: string): UserSubscription {
    const now = Date.now();
    const record = this.data.subscriptions[uid];
    if (!record || record.plan === 'FREE') {
      return this.getUserSubscription(uid);
    }
    record.cancelAtPeriodEnd = true;
    record.updatedAt = now;
    this.addAudit(uid, 'SUBSCRIPTION_CANCEL_SCHEDULED', `Cancellation scheduled at period end for ${record.plan}`);
    this.persist();
    return this.getUserSubscription(uid);
  }

  // --- Pioneer / Early Tester Program ---

  public grantEarlyTester(params: {
    uid?: string;
    email?: string;
    startDate?: number;
    durationDays?: number;
    note?: string;
    adminEmail?: string;
    adminUid?: string;
    ip?: string | null;
  }): UserSubscription | null {
    const now = Date.now();
    const start = params.startDate || now;
    const days = params.durationDays || this.data.platformSettings.pioneerDurationDays || 730;
    const end = start + days * 24 * 60 * 60 * 1000;

    if (params.email) {
      const cleanEmail = params.email.toLowerCase().trim();
      this.data.earlyTesterEmails[cleanEmail] = { startDate: start, endDate: end, note: params.note };
      Object.values(this.data.subscriptions).forEach((sub) => {
        if ((sub.email || '').toLowerCase().trim() === cleanEmail) {
          sub.isEarlyTester = true;
          sub.earlyTesterStartDate = start;
          sub.earlyTesterEndDate = end;
          sub.paymentProvider = sub.paymentProvider || 'early_tester';
          sub.activationSource = sub.activationSource || 'pioneer';
          sub.updatedAt = now;
        }
      });
    }

    let resolvedUid = params.uid;
    if (!resolvedUid && params.email) {
      const clean = params.email.toLowerCase().trim();
      const matched = Object.values(this.data.userDirectory).find(
        (u) => (u.email || '').toLowerCase().trim() === clean
      );
      if (matched) resolvedUid = matched.uid;
    }

    let updated: UserSubscription | null = null;
    if (resolvedUid) {
      const existing = this.data.subscriptions[resolvedUid] || {
        uid: resolvedUid,
        plan: 'FREE' as SubscriptionPlan,
        status: 'active' as const,
        billingCycle: 'monthly' as BillingCycle,
        startDate: now,
        endDate: null,
        cancelAtPeriodEnd: false,
      };
      this.data.subscriptions[resolvedUid] = {
        ...existing,
        uid: resolvedUid,
        email: params.email || existing.email || null,
        isEarlyTester: true,
        earlyTesterStartDate: start,
        earlyTesterEndDate: end,
        activationSource: 'pioneer',
        paymentProvider: existing.paymentProvider || 'early_tester',
        updatedAt: now,
      };
      this.recordActivation({
        uid: resolvedUid,
        email: params.email || existing.email || null,
        plan: 'PREMIUM',
        billingCycle: 'annual',
        source: 'pioneer',
        code: null,
        startDate: start,
        endDate: end,
        reason: params.note || 'Programme Pioneer',
        adminEmail: params.adminEmail,
        activatedAt: now,
      });
    }

    this.recordAuditLog({
      adminUid: params.adminUid || 'admin',
      adminEmail: params.adminEmail || 'admin',
      adminRole: 'SUPER_ADMIN',
      action: 'PIONEER_GRANTED',
      category: 'pioneer',
      targetUid: resolvedUid || null,
      targetEmail: params.email || null,
      newValue: { startDate: start, endDate: end, days },
      ip: params.ip,
      detail: `Accès Pioneer (${days} jours Premium gratuit) attribué à ${params.email || resolvedUid}`,
    });

    this.persist();
    if (resolvedUid) {
      updated = this.getUserSubscription(resolvedUid);
    }
    return updated;
  }

  public revokePioneerAccess(params: {
    uid?: string;
    email?: string;
    reason: string;
    adminUid: string;
    adminEmail: string;
    ip?: string | null;
  }): void {
    const now = Date.now();
    if (params.email) {
      delete this.data.earlyTesterEmails[params.email.toLowerCase().trim()];
    }
    if (params.uid && this.data.subscriptions[params.uid]) {
      const sub = this.data.subscriptions[params.uid];
      sub.isEarlyTester = false;
      sub.earlyTesterEndDate = now;
      sub.updatedAt = now;
    }
    this.recordAuditLog({
      adminUid: params.adminUid,
      adminEmail: params.adminEmail,
      adminRole: 'SUPER_ADMIN',
      action: 'PIONEER_REVOKED',
      category: 'pioneer',
      targetUid: params.uid || null,
      targetEmail: params.email || null,
      ip: params.ip,
      detail: `Avantage Pioneer retiré (${params.email || params.uid}). Motif : ${params.reason}`,
    });
    this.persist();
  }

  public listPioneerData(): {
    pioneers: AdminUserSummary[];
    whitelistedEmails: Array<{ email: string; startDate: number; endDate: number; note?: string }>;
  } {
    const allUsers = this.listAllUsersSummary();
    const pioneers = allUsers.filter((u) => u.subscription.isEarlyTester);
    const whitelistedEmails = Object.entries(this.data.earlyTesterEmails).map(([email, info]) => ({
      email,
      ...info,
    }));
    return { pioneers, whitelistedEmails };
  }

  // --- Family Profiles Management ---

  public getFamilyProfiles(ownerUid: string): FamilyMemberProfile[] {
    return this.data.familyProfiles[ownerUid] || [];
  }

  public addFamilyProfile(
    ownerUid: string,
    payload: {
      name: string;
      relation: FamilyMemberProfile['relation'];
      vruType?: VRUType;
      emergencyContactPhone?: string;
      shareLocation?: boolean;
      sosAlertsEnabled?: boolean;
      geofenceAlertEnabled?: boolean;
      speedAlertThresholdKmh?: number;
    },
    maxMembers: number
  ): FamilyMemberProfile {
    const existing = this.data.familyProfiles[ownerUid] || [];
    if (existing.length >= maxMembers) {
      throw new Error(`Limite de ${maxMembers} profils familiaux atteinte pour cet abonnement.`);
    }
    const now = Date.now();
    const profile: FamilyMemberProfile = {
      id: `fam_${now}_${crypto.randomBytes(3).toString('hex')}`,
      ownerUid,
      memberUid: null,
      name: payload.name.trim(),
      relation: payload.relation,
      vruType: payload.vruType || VRUType.PEDESTRIAN,
      shareLocation: payload.shareLocation ?? true,
      sosAlertsEnabled: payload.sosAlertsEnabled ?? true,
      geofenceAlertEnabled: payload.geofenceAlertEnabled ?? false,
      speedAlertThresholdKmh: payload.speedAlertThresholdKmh ?? 25,
      emergencyContactPhone: payload.emergencyContactPhone?.trim() || '',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
    this.data.familyProfiles[ownerUid] = [...existing, profile];
    this.addAudit(ownerUid, 'FAMILY_PROFILE_ADDED', `Added family member profile ${profile.name}`);
    this.persist();
    return profile;
  }

  public updateFamilyProfile(
    ownerUid: string,
    profileId: string,
    updates: Partial<Omit<FamilyMemberProfile, 'id' | 'ownerUid' | 'createdAt'>>
  ): FamilyMemberProfile {
    const list = this.data.familyProfiles[ownerUid] || [];
    const idx = list.findIndex((p) => p.id === profileId);
    if (idx === -1) {
      throw new Error('Profil familial introuvable.');
    }
    const updated: FamilyMemberProfile = {
      ...list[idx],
      ...updates,
      updatedAt: Date.now(),
    };
    list[idx] = updated;
    this.data.familyProfiles[ownerUid] = list;
    this.persist();
    return updated;
  }

  public removeFamilyProfile(ownerUid: string, profileId: string): void {
    const list = this.data.familyProfiles[ownerUid] || [];
    this.data.familyProfiles[ownerUid] = list.filter((p) => p.id !== profileId);
    this.persist();
  }

  // --- Business Quotes ---

  public createBusinessQuote(
    input: Omit<BusinessQuoteRequest, 'id' | 'status' | 'createdAt'>
  ): BusinessQuoteRequest {
    const quote: BusinessQuoteRequest = {
      ...input,
      id: `biz_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      status: 'new',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.data.businessQuotes.unshift(quote);
    this.persist();
    return quote;
  }

  public updateBusinessQuote(params: {
    id: string;
    status?: BusinessQuoteRequest['status'];
    internalNote?: string;
    adminUid: string;
    adminEmail: string;
  }): BusinessQuoteRequest {
    const quote = this.data.businessQuotes.find((q) => q.id === params.id);
    if (!quote) throw new Error('Demande Business introuvable.');
    if (params.status) quote.status = params.status;
    if (params.internalNote !== undefined) quote.internalNote = params.internalNote;
    quote.updatedAt = Date.now();
    this.recordAuditLog({
      adminUid: params.adminUid,
      adminEmail: params.adminEmail,
      adminRole: 'SUPER_ADMIN',
      action: 'BUSINESS_QUOTE_UPDATED',
      category: 'support',
      targetId: quote.id,
      detail: `Devis ${quote.companyName} mis à jour (${quote.status})`,
    });
    this.persist();
    return quote;
  }

  public listAllSubscriptionsForAdmin(): UserSubscription[] {
    return Object.keys(this.data.subscriptions).map((uid) => this.getUserSubscription(uid));
  }

  public listBusinessQuotesForAdmin(): BusinessQuoteRequest[] {
    return this.data.businessQuotes;
  }

  // --- Redeem Codes (Cryptographic + Hashed + Masked + Atomic Lock) ---

  private normalizeCode(rawCode: string): string {
    return rawCode.trim().toUpperCase().replace(/\s+/g, '');
  }

  private generateRandomChunk(length: number): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = crypto.randomBytes(length);
    let out = '';
    for (let i = 0; i < length; i++) {
      out += alphabet[bytes[i] % alphabet.length];
    }
    return out;
  }

  public generateRedeemCodes(params: {
    plan: 'PREMIUM' | 'FAMILY' | 'BUSINESS';
    billingCycle?: BillingCycle;
    durationCode?: RedeemDurationCode;
    count: number;
    maxUses?: number;
    expiresAt?: number | null;
    campaign?: string;
    createdBy: string;
    adminUid?: string;
    note?: string;
    ip?: string | null;
  }): RedeemCodeRecord[] {
    const safeCount = Math.min(100, Math.max(1, Math.floor(params.count || 1)));
    const safeMaxUses = Math.min(1000, Math.max(1, Math.floor(params.maxUses || 1)));
    const durationCode: RedeemDurationCode =
      params.durationCode || (params.billingCycle === 'annual' ? '12m' : '1m');
    const durationDays = resolveDurationDaysForRedeem(durationCode);
    const isLifetime = durationCode === 'lifetime';
    const billingCycle: BillingCycle =
      durationCode === '12m' || durationCode === '24m'
        ? 'annual'
        : durationCode === '1m'
        ? 'monthly'
        : 'custom';

    const prefix =
      params.plan === 'FAMILY'
        ? 'VRU-FAM'
        : params.plan === 'BUSINESS'
        ? 'VRU-BIZ'
        : 'VRU-PREM';
    const now = Date.now();
    const plaintextCreated: RedeemCodeRecord[] = [];

    for (let i = 0; i < safeCount; i++) {
      let plainCode = '';
      let codeHash = '';
      let guard = 0;
      do {
        plainCode = `${prefix}-${this.generateRandomChunk(4)}-${this.generateRandomChunk(4)}-${this.generateRandomChunk(4)}`;
        codeHash = hashRedeemCode(plainCode);
        guard++;
      } while (
        (this.data.redeemCodes[codeHash] || this.data.redeemCodes[plainCode]) &&
        guard < 10
      );

      const id = `rc_${now}_${crypto.randomBytes(4).toString('hex')}`;
      const maskedCode = maskRedeemCode(plainCode);

      // Persist ONLY the hash + maskedCode (never storing plaintext secret code on disk for new codes)
      const storedRecord: RedeemCodeRecord = {
        id,
        code: maskedCode,
        maskedCode,
        codeHash,
        plan: params.plan,
        billingCycle,
        durationCode,
        durationDays,
        isLifetime,
        maxUses: safeMaxUses,
        usesCount: 0,
        expiresAt: params.expiresAt ?? null,
        status: 'available',
        createdAt: now,
        createdBy: params.createdBy,
        campaign: params.campaign?.trim() || undefined,
        note: params.note?.trim() || undefined,
        usedByUid: null,
        usedByEmail: null,
        usedAt: null,
        usageHistory: [],
      };
      this.data.redeemCodes[id] = storedRecord;

      // Return plaintext ONCE in the generation response so admin can copy/export immediately
      plaintextCreated.push({
        ...storedRecord,
        code: plainCode,
      });
    }

    this.recordAuditLog({
      adminUid: params.adminUid || params.createdBy,
      adminEmail: params.createdBy,
      adminRole: 'SUPER_ADMIN',
      action: 'REDEEM_CODES_GENERATED',
      category: 'redeem',
      newValue: {
        count: plaintextCreated.length,
        plan: params.plan,
        durationCode,
        maxUses: safeMaxUses,
        campaign: params.campaign || null,
      },
      ip: params.ip,
      detail: `Génération de ${plaintextCreated.length} code(s) Redeem ${params.plan} (${durationCode}, maxUses=${safeMaxUses})`,
    });
    this.persist();
    return plaintextCreated;
  }

  private findRedeemRecordByInput(normalizedCode: string): RedeemCodeRecord | undefined {
    const hash = hashRedeemCode(normalizedCode);
    // Direct lookup by key (legacy plaintext key or hashed id)
    if (this.data.redeemCodes[normalizedCode]) return this.data.redeemCodes[normalizedCode];
    return Object.values(this.data.redeemCodes).find(
      (rec) => rec.codeHash === hash || rec.code === normalizedCode
    );
  }

  public redeemCodeForUser(params: {
    uid: string;
    email?: string | null;
    code: string;
    expectedPlan?: 'PREMIUM' | 'FAMILY' | 'BUSINESS';
  }): { subscription: UserSubscription; activation: ActivationRecord; codeRecord: RedeemCodeRecord } {
    const normalized = this.normalizeCode(params.code || '');
    if (!normalized) {
      throw new Error('Veuillez saisir un code Redeem valide.');
    }

    const lockKey = hashRedeemCode(normalized);
    if (this.redeemLocks.has(lockKey)) {
      throw new Error('Traitement simultané détecté. Veuillez réessayer dans un instant.');
    }
    this.redeemLocks.add(lockKey);

    try {
      const codeRecord = this.findRedeemRecordByInput(normalized);
      if (!codeRecord) {
        throw new Error('Code Redeem introuvable. Vérifiez la saisie ou contactez un administrateur.');
      }

      const now = Date.now();
      if (codeRecord.expiresAt && codeRecord.expiresAt <= now) {
        codeRecord.status = 'expired';
        this.persist();
        throw new Error('Ce code Redeem est expiré.');
      }
      if (codeRecord.status === 'revoked') {
        throw new Error('Ce code Redeem a été révoqué par un administrateur.');
      }
      if (codeRecord.status === 'disabled') {
        throw new Error('Ce code Redeem est temporairement désactivé.');
      }
      if (codeRecord.status === 'expired') {
        throw new Error('Ce code Redeem est expiré.');
      }

      const maxUses = codeRecord.maxUses || 1;
      const currentUses = codeRecord.usesCount ?? (codeRecord.status === 'used' ? 1 : 0);
      if (codeRecord.status === 'used' || currentUses >= maxUses) {
        throw new Error('Ce code Redeem a déjà atteint sa limite d’utilisation.');
      }

      if (
        (codeRecord.usageHistory || []).some((entry) => entry.uid === params.uid) ||
        codeRecord.usedByUid === params.uid
      ) {
        throw new Error('Vous avez déjà utilisé ce code Redeem sur votre compte.');
      }

      if (params.expectedPlan && codeRecord.plan !== params.expectedPlan) {
        throw new Error(
          `Ce code correspond à l'abonnement ${codeRecord.plan}. Sélectionnez la formule ${codeRecord.plan} pour l'activer.`
        );
      }

      if (!this.isPlanEnabled(codeRecord.plan)) {
        throw new Error(`La formule ${codeRecord.plan} est actuellement désactivée par l’administration.`);
      }

      const nextUses = currentUses + 1;
      codeRecord.usesCount = nextUses;
      codeRecord.usedByUid = params.uid;
      codeRecord.usedByEmail = params.email || null;
      codeRecord.usedAt = now;
      codeRecord.usageHistory = [
        ...(codeRecord.usageHistory || []),
        { uid: params.uid, email: params.email || null, usedAt: now },
      ];
      if (nextUses >= maxUses) {
        codeRecord.status = 'used';
      }

      const prices = this.data.platformSettings.planPrices;
      const amountTnd =
        codeRecord.plan === 'FAMILY'
          ? codeRecord.billingCycle === 'annual'
            ? prices.familyAnnualTnd
            : prices.familyMonthlyTnd
          : codeRecord.plan === 'PREMIUM'
          ? codeRecord.billingCycle === 'annual'
            ? prices.premiumAnnualTnd
            : prices.premiumMonthlyTnd
          : 0;

      const maskedLabel = codeRecord.maskedCode || maskRedeemCode(normalized);

      const subscription = this.activateVerifiedSubscription({
        uid: params.uid,
        email: params.email || null,
        plan: codeRecord.plan,
        billingCycle: codeRecord.billingCycle,
        provider: 'redeem',
        paymentRef: maskedLabel,
        amount: amountTnd,
        currency: 'TND',
        code: maskedLabel,
        durationDays: codeRecord.durationDays,
        isLifetime: Boolean(codeRecord.isLifetime),
      });

      const activation = this.data.activations.find(
        (a) => a.uid === params.uid && a.code === maskedLabel
      ) || {
        id: `act_${now}`,
        uid: params.uid,
        email: params.email || null,
        plan: codeRecord.plan,
        billingCycle: codeRecord.billingCycle,
        source: 'redeem',
        code: maskedLabel,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        isLifetime: Boolean(codeRecord.isLifetime),
        activatedAt: now,
      };

      this.recordAuditLog({
        adminUid: params.uid,
        adminEmail: params.email || params.uid,
        adminRole: 'USER',
        action: 'REDEEM_CODE_REDEEMED',
        category: 'redeem',
        targetUid: params.uid,
        targetEmail: params.email || null,
        targetId: codeRecord.id || maskedLabel,
        newValue: { plan: codeRecord.plan, durationCode: codeRecord.durationCode || codeRecord.billingCycle },
        detail: `Code ${maskedLabel} utilisé par ${params.email || params.uid} (${codeRecord.plan})`,
      });

      this.persist();
      return {
        subscription,
        activation,
        codeRecord: { ...codeRecord, code: maskedLabel },
      };
    } finally {
      this.redeemLocks.delete(lockKey);
    }
  }

  public updateRedeemCodeStatus(params: {
    idOrCode: string;
    action: 'revoke' | 'disable' | 'enable';
    adminUid: string;
    adminEmail: string;
    ip?: string | null;
  }): RedeemCodeRecord {
    const trimmed = params.idOrCode.trim();
    const record =
      this.data.redeemCodes[trimmed] ||
      this.data.redeemCodes[this.normalizeCode(trimmed)] ||
      Object.values(this.data.redeemCodes).find(
        (r) => r.id === trimmed || r.maskedCode === trimmed || r.code === trimmed
      );

    if (!record) {
      throw new Error('Code Redeem introuvable.');
    }
    if (record.status === 'used' && params.action !== 'enable') {
      throw new Error('Ce code a déjà été entièrement utilisé.');
    }

    const oldStatus = record.status;
    if (params.action === 'revoke') {
      record.status = 'revoked';
    } else if (params.action === 'disable') {
      record.status = 'disabled';
    } else if (params.action === 'enable') {
      if (record.expiresAt && record.expiresAt <= Date.now()) {
        throw new Error('Impossible de réactiver un code expiré.');
      }
      record.status =
        (record.usesCount || 0) >= (record.maxUses || 1) ? 'used' : 'available';
    }

    this.recordAuditLog({
      adminUid: params.adminUid,
      adminEmail: params.adminEmail,
      adminRole: 'SUPER_ADMIN',
      action: `REDEEM_CODE_${params.action.toUpperCase()}`,
      category: 'redeem',
      targetId: record.id || record.code,
      oldValue: { status: oldStatus },
      newValue: { status: record.status },
      ip: params.ip,
      detail: `Code ${record.maskedCode || maskRedeemCode(record.code)} : ${oldStatus} -> ${record.status}`,
    });
    this.persist();
    return this.sanitizeRedeemForAdmin(record);
  }

  public revokeRedeemCode(rawCode: string, adminEmail: string): RedeemCodeRecord {
    return this.updateRedeemCodeStatus({
      idOrCode: rawCode,
      action: 'revoke',
      adminUid: adminEmail,
      adminEmail,
    });
  }

  private sanitizeRedeemForAdmin(rec: RedeemCodeRecord): RedeemCodeRecord {
    const now = Date.now();
    let computedStatus = rec.status;
    if (computedStatus === 'available' && rec.expiresAt && rec.expiresAt <= now) {
      computedStatus = 'expired';
    }
    const masked = rec.maskedCode || maskRedeemCode(rec.code);
    return {
      ...rec,
      id: rec.id || rec.code,
      code: masked,
      maskedCode: masked,
      codeHash: undefined,
      status: computedStatus,
    };
  }

  public listRedeemCodesForAdmin(): RedeemCodeRecord[] {
    return Object.values(this.data.redeemCodes)
      .map((rec) => this.sanitizeRedeemForAdmin(rec))
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  public listRecentActivationsForAdmin(limit = 50): ActivationRecord[] {
    return this.data.activations
      .slice()
      .sort((a, b) => b.activatedAt - a.activatedAt)
      .slice(0, limit);
  }

  // --- Accessibility Program (Free Lifetime Premium upon Document Review) ---

  public submitAccessibilityRequest(params: {
    uid: string;
    email: string | null;
    displayName: string | null;
    fullName: string;
    disabilityCategory: string;
    description: string;
    documentName: string;
    documentMimeType: string;
    documentBase64?: string;
  }): AccessibilityRequestRecord {
    if (!this.data.platformSettings.accessibilityProgramEnabled) {
      throw new Error('Le programme Accessibilité est temporairement fermé aux nouvelles demandes.');
    }

    const existingPending = this.data.accessibilityRequests.find(
      (r) => r.uid === params.uid && (r.status === 'pending' || r.status === 'more_info_required')
    );

    const now = Date.now();
    const id = existingPending ? existingPending.id : `acc_${now}_${crypto.randomBytes(4).toString('hex')}`;

    let storagePath: string | null = existingPending?.documentStoragePath || null;
    let docSize = existingPending?.documentSize || 0;

    if (params.documentBase64) {
      if (!fs.existsSync(ACCESSIBILITY_DOCS_DIR)) {
        fs.mkdirSync(ACCESSIBILITY_DOCS_DIR, { recursive: true });
      }
      const cleanBase64 = params.documentBase64.replace(/^data:[^;]+;base64,/, '');
      const buf = Buffer.from(cleanBase64, 'base64');
      if (buf.length > 8 * 1024 * 1024) {
        throw new Error('Le justificatif ne doit pas dépasser 8 Mo.');
      }
      const safeExt = path.extname(params.documentName || '').replace(/[^a-zA-Z0-9.]/g, '').slice(0, 10) || '.bin';
      const filename = `${id}_${now}${safeExt}`;
      storagePath = path.join(ACCESSIBILITY_DOCS_DIR, filename);
      fs.writeFileSync(storagePath, buf);
      docSize = buf.length;
    }

    if (existingPending) {
      existingPending.fullName = params.fullName.trim();
      existingPending.disabilityCategory = params.disabilityCategory.trim();
      existingPending.description = params.description.trim();
      if (params.documentName) existingPending.documentName = params.documentName;
      if (params.documentMimeType) existingPending.documentMimeType = params.documentMimeType;
      existingPending.documentSize = docSize;
      existingPending.documentStoragePath = storagePath;
      existingPending.hasDocumentFile = Boolean(storagePath);
      existingPending.status = 'pending';
      existingPending.updatedAt = now;
      existingPending.history.unshift({
        action: 'RESUBMITTED',
        actor: params.email || params.uid,
        comment: 'Complément de dossier transmis',
        timestamp: now,
      });
      this.persist();
      return this.stripAccessibilityPrivatePath(existingPending);
    }

    const record: StoredAccessibilityRecord = {
      id,
      uid: params.uid,
      email: params.email,
      displayName: params.displayName,
      fullName: params.fullName.trim(),
      disabilityCategory: params.disabilityCategory.trim(),
      description: params.description.trim(),
      documentName: params.documentName || 'justificatif',
      documentMimeType: params.documentMimeType || 'application/octet-stream',
      documentSize: docSize,
      documentStoragePath: storagePath,
      hasDocumentFile: Boolean(storagePath),
      status: 'pending',
      adminComment: null,
      reviewedBy: null,
      reviewedAt: null,
      createdAt: now,
      updatedAt: now,
      history: [
        {
          action: 'SUBMITTED',
          actor: params.email || params.uid,
          comment: 'Demande initiale soumise',
          timestamp: now,
        },
      ],
    };

    this.data.accessibilityRequests.unshift(record);
    this.recordAuditLog({
      adminUid: params.uid,
      adminEmail: params.email || params.uid,
      adminRole: 'USER',
      action: 'ACCESSIBILITY_REQUEST_SUBMITTED',
      category: 'accessibility',
      targetUid: params.uid,
      targetEmail: params.email,
      targetId: record.id,
      detail: `Nouvelle demande programme Accessibilité (${record.disabilityCategory})`,
    });
    this.persist();
    return this.stripAccessibilityPrivatePath(record);
  }

  private stripAccessibilityPrivatePath(rec: StoredAccessibilityRecord): AccessibilityRequestRecord {
    const { documentStoragePath: _ignored, ...safe } = rec;
    return safe;
  }

  public listAccessibilityRequests(uid?: string): AccessibilityRequestRecord[] {
    return this.data.accessibilityRequests
      .filter((r) => (!uid ? true : r.uid === uid))
      .map((r) => this.stripAccessibilityPrivatePath(r))
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  public upsertExternalAccessibilityRequest(rec: AccessibilityRequestRecord): void {
    if (!rec || !rec.id || !rec.uid) return;
    const existing = this.data.accessibilityRequests.find((r) => r.id === rec.id);
    if (!existing) {
      this.data.accessibilityRequests.unshift({
        ...rec,
        documentStoragePath: null,
        history: Array.isArray(rec.history) ? rec.history : [],
      });
      this.persist();
      return;
    }
    if ((rec.updatedAt || 0) > (existing.updatedAt || 0)) {
      existing.fullName = rec.fullName || existing.fullName;
      existing.disabilityCategory = rec.disabilityCategory || existing.disabilityCategory;
      existing.description = rec.description || existing.description;
      existing.documentName = rec.documentName || existing.documentName;
      existing.documentMimeType = rec.documentMimeType || existing.documentMimeType;
      existing.documentSize = rec.documentSize ?? existing.documentSize;
      existing.hasDocumentFile = Boolean(existing.hasDocumentFile || rec.hasDocumentFile);
      existing.status = rec.status || existing.status;
      existing.adminComment = rec.adminComment ?? existing.adminComment;
      existing.reviewedBy = rec.reviewedBy ?? existing.reviewedBy;
      existing.reviewedAt = rec.reviewedAt ?? existing.reviewedAt;
      existing.updatedAt = rec.updatedAt || existing.updatedAt;
      if (Array.isArray(rec.history) && rec.history.length > (existing.history?.length || 0)) {
        existing.history = rec.history;
      }
      this.persist();
    }
  }

  public getAccessibilityDocumentFile(requestId: string): {
    filePath: string;
    mimeType: string;
    fileName: string;
  } | null {
    const rec = this.data.accessibilityRequests.find((r) => r.id === requestId);
    if (!rec || !rec.documentStoragePath || !fs.existsSync(rec.documentStoragePath)) {
      return null;
    }
    return {
      filePath: rec.documentStoragePath,
      mimeType: rec.documentMimeType || 'application/octet-stream',
      fileName: rec.documentName || 'justificatif',
    };
  }

  public reviewAccessibilityRequest(params: {
    requestId: string;
    decision: 'approved' | 'rejected' | 'more_info_required';
    comment?: string;
    adminUid: string;
    adminEmail: string;
    ip?: string | null;
  }): { request: AccessibilityRequestRecord; subscription?: UserSubscription } {
    const rec = this.data.accessibilityRequests.find((r) => r.id === params.requestId);
    if (!rec) {
      throw new Error('Demande Accessibilité introuvable.');
    }
    const now = Date.now();
    const oldStatus: AccessibilityStatus = rec.status;
    rec.status = params.decision;
    rec.adminComment = params.comment?.trim() || null;
    rec.reviewedBy = params.adminEmail;
    rec.reviewedAt = now;
    rec.updatedAt = now;
    rec.history.unshift({
      action: params.decision.toUpperCase(),
      actor: params.adminEmail,
      comment: rec.adminComment || undefined,
      timestamp: now,
    });

    let subscription: UserSubscription | undefined;
    if (params.decision === 'approved') {
      subscription = this.adminUpdateUserSubscription({
        targetUid: rec.uid,
        targetEmail: rec.email,
        action: 'grant_lifetime',
        plan: 'PREMIUM',
        isLifetime: true,
        activationType: 'accessibility',
        reason: `Programme Accessibilité approuvé (${rec.id})`,
        adminUid: params.adminUid,
        adminEmail: params.adminEmail,
        ip: params.ip,
      });

      this.createAdminNotification({
        title: 'Programme Accessibilité approuvé',
        message:
          'Votre demande au programme Accessibilité a été validée. Votre abonnement VruGuard Premium gratuit à vie est désormais actif.',
        type: 'success',
        targetScope: 'specific_user',
        targetUid: rec.uid,
        targetEmail: rec.email,
        createdBy: params.adminEmail,
        adminUid: params.adminUid,
      });
    } else if (params.decision === 'more_info_required') {
      this.createAdminNotification({
        title: 'Complément requis — Programme Accessibilité',
        message:
          params.comment ||
          'Notre équipe a besoin d’un justificatif complémentaire pour finaliser l’examen de votre dossier Accessibilité.',
        type: 'warning',
        targetScope: 'specific_user',
        targetUid: rec.uid,
        targetEmail: rec.email,
        createdBy: params.adminEmail,
        adminUid: params.adminUid,
      });
    } else if (params.decision === 'rejected') {
      this.createAdminNotification({
        title: 'Réponse Programme Accessibilité',
        message:
          params.comment ||
          'Votre demande au programme Accessibilité n’a pas pu être validée en l’état.',
        type: 'info',
        targetScope: 'specific_user',
        targetUid: rec.uid,
        targetEmail: rec.email,
        createdBy: params.adminEmail,
        adminUid: params.adminUid,
      });
    }

    this.recordAuditLog({
      adminUid: params.adminUid,
      adminEmail: params.adminEmail,
      adminRole: 'SUPER_ADMIN',
      action: `ACCESSIBILITY_${params.decision.toUpperCase()}`,
      category: 'accessibility',
      targetUid: rec.uid,
      targetEmail: rec.email,
      targetId: rec.id,
      oldValue: { status: oldStatus },
      newValue: { status: rec.status, comment: rec.adminComment },
      ip: params.ip,
      detail: `Dossier Accessibilité ${rec.id} (${rec.email || rec.uid}) : ${oldStatus} -> ${rec.status}`,
    });

    this.persist();
    return {
      request: this.stripAccessibilityPrivatePath(rec),
      subscription,
    };
  }

  // --- Platform Settings & Multi-Currency Pricing ---

  public isPlanEnabled(plan: SubscriptionPlan): boolean {
    const regional = this.data.platformSettings.regionalPlans?.[plan];
    if (!regional) return true;
    return regional.enabled !== false;
  }

  public getPlanAmount(
    plan: SubscriptionPlan,
    billingCycle: BillingCycle,
    currency: SupportedCurrency
  ): number {
    const regional = this.data.platformSettings.regionalPlans?.[plan];
    const prices = this.data.platformSettings.planPrices;
    let raw: number | null | undefined;
    if (plan === 'PREMIUM') {
      raw =
        currency === 'TND'
          ? billingCycle === 'annual'
            ? regional?.annualPriceTnd ?? prices.premiumAnnualTnd
            : regional?.monthlyPriceTnd ?? prices.premiumMonthlyTnd
          : billingCycle === 'annual'
          ? regional?.annualPriceEur ?? prices.premiumAnnualEur
          : regional?.monthlyPriceEur ?? prices.premiumMonthlyEur;
    } else if (plan === 'FAMILY') {
      raw =
        currency === 'TND'
          ? billingCycle === 'annual'
            ? regional?.annualPriceTnd ?? prices.familyAnnualTnd
            : regional?.monthlyPriceTnd ?? prices.familyMonthlyTnd
          : billingCycle === 'annual'
          ? regional?.annualPriceEur ?? prices.familyAnnualEur
          : regional?.monthlyPriceEur ?? prices.familyMonthlyEur;
    } else if (plan === 'FREE') {
      raw = 0;
    } else {
      raw = null;
    }
    if (raw === null || raw === undefined || !Number.isFinite(raw) || raw <= 0) {
      throw new Error('Ce plan nécessite un devis personnalisé ou n’est pas tarifé.');
    }
    return raw;
  }

  public getPriceChangeHistory(limit = 150): PriceChangeHistoryEntry[] {
    return this.data.priceChangeHistory.slice(0, limit);
  }

  public getPlatformSettings(): PlatformSettings {
    return this.data.platformSettings;
  }

  public getPublicPlatformConfig() {
    const s = this.data.platformSettings;
    return {
      platformName: s.platformName,
      logoUrl: s.logoUrl,
      contactEmail: s.contactEmail,
      supportEmail: s.supportEmail,
      planPrices: s.planPrices,
      regionalPlans: s.regionalPlans,
      pioneerProgramEnabled: s.pioneerProgramEnabled,
      accessibilityProgramEnabled: s.accessibilityProgramEnabled,
      maintenanceMode: s.maintenanceMode,
      maintenanceMessage: s.maintenanceMessage,
      announcementEnabled: s.announcementEnabled,
      announcementText: s.announcementText,
      announcementType: s.announcementType,
    };
  }

  private appendPriceHistoryEntry(entry: Omit<PriceChangeHistoryEntry, 'id' | 'timestamp'>): void {
    this.data.priceChangeHistory.unshift({
      id: `prc_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      timestamp: Date.now(),
      ...entry,
    });
    if (this.data.priceChangeHistory.length > 1000) {
      this.data.priceChangeHistory.length = 1000;
    }
  }

  public updatePlatformSettings(params: {
    updates: Partial<PlatformSettings> & { reason?: string };
    adminUid: string;
    adminEmail: string;
    ip?: string | null;
  }): PlatformSettings {
    const oldSettings: PlatformSettings = JSON.parse(JSON.stringify(this.data.platformSettings));
    const oldRegional = normalizeRegionalPlansFromSettings(
      oldSettings.planPrices,
      oldSettings.regionalPlans
    );
    const u = params.updates;
    const reason = typeof u.reason === 'string' && u.reason.trim() ? u.reason.trim().slice(0, 240) : undefined;

    if (u.platformName !== undefined) {
      this.data.platformSettings.platformName = String(u.platformName).slice(0, 80) || 'VruGuard';
    }
    if (u.logoUrl !== undefined) {
      this.data.platformSettings.logoUrl = String(u.logoUrl).slice(0, 500);
    }
    if (u.contactEmail !== undefined) {
      this.data.platformSettings.contactEmail = String(u.contactEmail).slice(0, 150);
    }
    if (u.supportEmail !== undefined) {
      this.data.platformSettings.supportEmail = String(u.supportEmail).slice(0, 150);
    }

    const sanitizePrice = (val: unknown, fallback: number): number => {
      const n = Number(val);
      if (!Number.isFinite(n) || n < 0) return fallback;
      return Math.round(n * 100) / 100;
    };

    if (u.planPrices) {
      this.data.platformSettings.planPrices = {
        premiumMonthlyTnd: sanitizePrice(u.planPrices.premiumMonthlyTnd, oldSettings.planPrices.premiumMonthlyTnd),
        premiumAnnualTnd: sanitizePrice(u.planPrices.premiumAnnualTnd, oldSettings.planPrices.premiumAnnualTnd),
        premiumMonthlyEur: sanitizePrice(u.planPrices.premiumMonthlyEur, oldSettings.planPrices.premiumMonthlyEur),
        premiumAnnualEur: sanitizePrice(u.planPrices.premiumAnnualEur, oldSettings.planPrices.premiumAnnualEur),
        familyMonthlyTnd: sanitizePrice(u.planPrices.familyMonthlyTnd, oldSettings.planPrices.familyMonthlyTnd),
        familyAnnualTnd: sanitizePrice(u.planPrices.familyAnnualTnd, oldSettings.planPrices.familyAnnualTnd),
        familyMonthlyEur: sanitizePrice(u.planPrices.familyMonthlyEur, oldSettings.planPrices.familyMonthlyEur),
        familyAnnualEur: sanitizePrice(u.planPrices.familyAnnualEur, oldSettings.planPrices.familyAnnualEur),
      };
    }

    if (u.regionalPlans) {
      const currentReg = normalizeRegionalPlansFromSettings(
        this.data.platformSettings.planPrices,
        this.data.platformSettings.regionalPlans
      );
      const nextPrem = u.regionalPlans.PREMIUM;
      const nextFam = u.regionalPlans.FAMILY;

      if (nextPrem) {
        this.data.platformSettings.planPrices.premiumMonthlyTnd = sanitizePrice(
          nextPrem.monthlyPriceTnd,
          this.data.platformSettings.planPrices.premiumMonthlyTnd
        );
        this.data.platformSettings.planPrices.premiumAnnualTnd = sanitizePrice(
          nextPrem.annualPriceTnd,
          this.data.platformSettings.planPrices.premiumAnnualTnd
        );
        this.data.platformSettings.planPrices.premiumMonthlyEur = sanitizePrice(
          nextPrem.monthlyPriceEur,
          this.data.platformSettings.planPrices.premiumMonthlyEur
        );
        this.data.platformSettings.planPrices.premiumAnnualEur = sanitizePrice(
          nextPrem.annualPriceEur,
          this.data.platformSettings.planPrices.premiumAnnualEur
        );
      }

      if (nextFam) {
        this.data.platformSettings.planPrices.familyMonthlyTnd = sanitizePrice(
          nextFam.monthlyPriceTnd,
          this.data.platformSettings.planPrices.familyMonthlyTnd
        );
        this.data.platformSettings.planPrices.familyAnnualTnd = sanitizePrice(
          nextFam.annualPriceTnd,
          this.data.platformSettings.planPrices.familyAnnualTnd
        );
        this.data.platformSettings.planPrices.familyMonthlyEur = sanitizePrice(
          nextFam.monthlyPriceEur,
          this.data.platformSettings.planPrices.familyMonthlyEur
        );
        this.data.platformSettings.planPrices.familyAnnualEur = sanitizePrice(
          nextFam.annualPriceEur,
          this.data.platformSettings.planPrices.familyAnnualEur
        );
      }

      const mergedRegional: Record<SubscriptionPlan, PlanRegionalConfig> = {
        FREE: {
          ...currentReg.FREE,
          enabled: u.regionalPlans.FREE?.enabled ?? currentReg.FREE.enabled,
        },
        PREMIUM: {
          ...currentReg.PREMIUM,
          enabled: nextPrem?.enabled ?? currentReg.PREMIUM.enabled,
          monthlyPriceTnd: this.data.platformSettings.planPrices.premiumMonthlyTnd,
          annualPriceTnd: this.data.platformSettings.planPrices.premiumAnnualTnd,
          monthlyPriceEur: this.data.platformSettings.planPrices.premiumMonthlyEur,
          annualPriceEur: this.data.platformSettings.planPrices.premiumAnnualEur,
        },
        FAMILY: {
          ...currentReg.FAMILY,
          enabled: nextFam?.enabled ?? currentReg.FAMILY.enabled,
          monthlyPriceTnd: this.data.platformSettings.planPrices.familyMonthlyTnd,
          annualPriceTnd: this.data.platformSettings.planPrices.familyAnnualTnd,
          monthlyPriceEur: this.data.platformSettings.planPrices.familyMonthlyEur,
          annualPriceEur: this.data.platformSettings.planPrices.familyAnnualEur,
        },
        BUSINESS: {
          ...currentReg.BUSINESS,
          enabled: u.regionalPlans.BUSINESS?.enabled ?? currentReg.BUSINESS.enabled,
        },
      };
      this.data.platformSettings.regionalPlans = mergedRegional;
    } else {
      this.data.platformSettings.regionalPlans = normalizeRegionalPlansFromSettings(
        this.data.platformSettings.planPrices,
        this.data.platformSettings.regionalPlans
      );
    }

    const newRegional = this.data.platformSettings.regionalPlans!;
    (['FREE', 'PREMIUM', 'FAMILY', 'BUSINESS'] as SubscriptionPlan[]).forEach((planId) => {
      const prev = oldRegional[planId];
      const next = newRegional[planId];
      if (prev.enabled !== next.enabled) {
        this.appendPriceHistoryEntry({
          plan: planId,
          field: 'enabled',
          currency: null,
          oldValue: prev.enabled,
          newValue: next.enabled,
          adminUid: params.adminUid,
          adminEmail: params.adminEmail,
          reason,
        });
      }
      const trackedFields: Array<{
        key: 'monthlyPriceTnd' | 'annualPriceTnd' | 'monthlyPriceEur' | 'annualPriceEur';
        currency: SupportedCurrency;
      }> = [
        { key: 'monthlyPriceTnd', currency: 'TND' },
        { key: 'annualPriceTnd', currency: 'TND' },
        { key: 'monthlyPriceEur', currency: 'EUR' },
        { key: 'annualPriceEur', currency: 'EUR' },
      ];
      trackedFields.forEach(({ key, currency }) => {
        if (prev[key] !== next[key]) {
          this.appendPriceHistoryEntry({
            plan: planId,
            field: key,
            currency,
            oldValue: prev[key],
            newValue: next[key],
            adminUid: params.adminUid,
            adminEmail: params.adminEmail,
            reason,
          });
        }
      });
    });

    if (u.pioneerProgramEnabled !== undefined) {
      this.data.platformSettings.pioneerProgramEnabled = Boolean(u.pioneerProgramEnabled);
    }
    if (u.pioneerDurationDays !== undefined) {
      this.data.platformSettings.pioneerDurationDays = Math.max(30, Math.min(3650, Number(u.pioneerDurationDays) || 730));
    }
    if (u.accessibilityProgramEnabled !== undefined) {
      this.data.platformSettings.accessibilityProgramEnabled = Boolean(u.accessibilityProgramEnabled);
    }
    if (u.notificationsEnabled !== undefined) {
      this.data.platformSettings.notificationsEnabled = Boolean(u.notificationsEnabled);
    }
    if (u.maintenanceMode !== undefined) {
      this.data.platformSettings.maintenanceMode = Boolean(u.maintenanceMode);
    }
    if (u.maintenanceMessage !== undefined) {
      this.data.platformSettings.maintenanceMessage = String(u.maintenanceMessage).slice(0, 500);
    }
    if (u.announcementEnabled !== undefined) {
      this.data.platformSettings.announcementEnabled = Boolean(u.announcementEnabled);
    }
    if (u.announcementText !== undefined) {
      this.data.platformSettings.announcementText = String(u.announcementText).slice(0, 500);
    }
    if (u.announcementType !== undefined) {
      this.data.platformSettings.announcementType = u.announcementType;
    }
    if (u.securitySettings) {
      const sec = this.data.platformSettings.securitySettings;
      if (u.securitySettings.requireReauthForCriticalActions !== undefined) {
        sec.requireReauthForCriticalActions = Boolean(u.securitySettings.requireReauthForCriticalActions);
      }
      if (u.securitySettings.adminRateLimitPerMin !== undefined) {
        sec.adminRateLimitPerMin = Math.max(20, Math.min(1000, Number(u.securitySettings.adminRateLimitPerMin) || 120));
      }
      if (Array.isArray(u.securitySettings.delegatedAdminEmails)) {
        sec.delegatedAdminEmails = u.securitySettings.delegatedAdminEmails
          .map((e) => String(e).trim().toLowerCase())
          .filter((e) => e.includes('@') && !getSuperAdminEmails().includes(e));
      }
      if (u.securitySettings.permissionMatrix) {
        sec.permissionMatrix = u.securitySettings.permissionMatrix;
      }
    }

    this.data.platformSettings.updatedAt = Date.now();
    this.data.platformSettings.updatedBy = params.adminEmail;

    this.recordAuditLog({
      adminUid: params.adminUid,
      adminEmail: params.adminEmail,
      adminRole: 'SUPER_ADMIN',
      action: 'PLATFORM_SETTINGS_UPDATED',
      category: 'settings',
      oldValue: {
        maintenanceMode: oldSettings.maintenanceMode,
        announcementEnabled: oldSettings.announcementEnabled,
        planPrices: oldSettings.planPrices,
        regionalPlans: oldRegional,
      },
      newValue: {
        maintenanceMode: this.data.platformSettings.maintenanceMode,
        announcementEnabled: this.data.platformSettings.announcementEnabled,
        planPrices: this.data.platformSettings.planPrices,
        regionalPlans: this.data.platformSettings.regionalPlans,
      },
      ip: params.ip,
      detail: reason
        ? `Tarifs & paramètres mis à jour par ${params.adminEmail} (${reason})`
        : `Paramètres plateforme mis à jour par ${params.adminEmail}`,
    });

    this.persist();
    return this.data.platformSettings;
  }

  // --- Admin Notifications ---

  public createAdminNotification(params: {
    title: string;
    message: string;
    type: AdminNotificationRecord['type'];
    targetScope: AdminNotificationRecord['targetScope'];
    targetUid?: string | null;
    targetEmail?: string | null;
    createdBy: string;
    adminUid?: string;
    ip?: string | null;
  }): AdminNotificationRecord {
    const now = Date.now();
    const users = this.listAllUsersSummary();
    let recipientCount = 0;

    if (params.targetScope === 'specific_user') {
      recipientCount = 1;
    } else if (params.targetScope === 'all') {
      recipientCount = users.length;
    } else {
      recipientCount = users.filter((u) => u.subscription.effectivePlan === params.targetScope).length;
    }

    const notif: AdminNotificationRecord = {
      id: `notif_${now}_${crypto.randomBytes(4).toString('hex')}`,
      title: params.title.trim().slice(0, 140),
      message: params.message.trim().slice(0, 1200),
      type: params.type || 'info',
      targetScope: params.targetScope,
      targetUid: params.targetUid ?? null,
      targetEmail: params.targetEmail ?? null,
      createdBy: params.createdBy,
      createdAt: now,
      recipientCount,
      readByUids: [],
    };

    this.data.adminNotifications.unshift(notif);
    if (this.data.adminNotifications.length > 500) {
      this.data.adminNotifications.length = 500;
    }

    this.recordAuditLog({
      adminUid: params.adminUid || params.createdBy,
      adminEmail: params.createdBy,
      adminRole: 'SUPER_ADMIN',
      action: 'ADMIN_NOTIFICATION_SENT',
      category: 'notification',
      targetUid: params.targetUid ?? null,
      targetEmail: params.targetEmail ?? null,
      targetId: notif.id,
      newValue: { targetScope: notif.targetScope, type: notif.type, title: notif.title },
      ip: params.ip,
      detail: `Notification "${notif.title}" envoyée (cible=${notif.targetScope}, ~${recipientCount} destinataire(s))`,
    });

    this.persist();
    return notif;
  }

  public listAdminNotificationsForAdmin(): AdminNotificationRecord[] {
    return this.data.adminNotifications.slice(0, 200);
  }

  public getNotificationsForUser(uid: string, email: string | null, effectivePlan: SubscriptionPlan): AdminNotificationRecord[] {
    if (!this.data.platformSettings.notificationsEnabled) return [];
    const cleanEmail = (email || '').toLowerCase().trim();
    return this.data.adminNotifications
      .filter((n) => {
        if (n.readByUids.includes(uid)) return false;
        if (n.targetScope === 'all') return true;
        if (n.targetScope === effectivePlan) return true;
        if (n.targetScope === 'specific_user') {
          return n.targetUid === uid || (cleanEmail && (n.targetEmail || '').toLowerCase().trim() === cleanEmail);
        }
        return false;
      })
      .slice(0, 20);
  }

  public markNotificationRead(notifId: string, uid: string): void {
    const notif = this.data.adminNotifications.find((n) => n.id === notifId);
    if (notif && !notif.readByUids.includes(uid)) {
      notif.readByUids.push(uid);
      this.persist();
    }
  }

  // --- Support Tickets ---

  public createSupportTicket(params: {
    uid?: string | null;
    email: string;
    name: string;
    subject: string;
    category: SupportTicketRecord['category'];
    priority?: SupportTicketRecord['priority'];
    message: string;
  }): SupportTicketRecord {
    const now = Date.now();
    const ticket: SupportTicketRecord = {
      id: `tkt_${now}_${crypto.randomBytes(3).toString('hex')}`,
      uid: params.uid ?? null,
      email: params.email.trim().slice(0, 200),
      name: params.name.trim().slice(0, 120),
      subject: params.subject.trim().slice(0, 200),
      category: params.category || 'support',
      priority: params.priority || 'normal',
      message: params.message.trim().slice(0, 4000),
      status: 'open',
      createdAt: now,
      updatedAt: now,
      replies: [],
      internalNotes: [],
    };
    this.data.supportTickets.unshift(ticket);
    this.persist();
    return ticket;
  }

  public listSupportTickets(uid?: string): SupportTicketRecord[] {
    return this.data.supportTickets
      .filter((t) => (!uid ? true : t.uid === uid))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  public replySupportTicket(params: {
    ticketId: string;
    message: string;
    senderRole: 'admin' | 'user';
    senderEmail: string;
    adminUid?: string;
    ip?: string | null;
  }): SupportTicketRecord {
    const ticket = this.data.supportTickets.find((t) => t.id === params.ticketId);
    if (!ticket) throw new Error('Ticket support introuvable.');
    const now = Date.now();
    ticket.replies.push({
      id: `rep_${now}_${crypto.randomBytes(3).toString('hex')}`,
      senderRole: params.senderRole,
      senderEmail: params.senderEmail,
      message: params.message.trim().slice(0, 4000),
      createdAt: now,
    });
    if (params.senderRole === 'admin' && ticket.status === 'open') {
      ticket.status = 'in_progress';
    }
    ticket.updatedAt = now;

    if (params.senderRole === 'admin') {
      if (ticket.uid) {
        this.createAdminNotification({
          title: `Réponse support : ${ticket.subject}`,
          message: params.message.trim().slice(0, 400),
          type: 'info',
          targetScope: 'specific_user',
          targetUid: ticket.uid,
          targetEmail: ticket.email,
          createdBy: params.senderEmail,
          adminUid: params.adminUid,
        });
      }
      this.recordAuditLog({
        adminUid: params.adminUid || params.senderEmail,
        adminEmail: params.senderEmail,
        adminRole: 'SUPER_ADMIN',
        action: 'SUPPORT_TICKET_REPLIED',
        category: 'support',
        targetUid: ticket.uid,
        targetEmail: ticket.email,
        targetId: ticket.id,
        ip: params.ip,
        detail: `Réponse envoyée sur le ticket "${ticket.subject}"`,
      });
    }

    this.persist();
    return ticket;
  }

  public updateSupportTicketStatus(params: {
    ticketId: string;
    status: SupportTicketStatus;
    priority?: SupportTicketRecord['priority'];
    adminUid: string;
    adminEmail: string;
    ip?: string | null;
  }): SupportTicketRecord {
    const ticket = this.data.supportTickets.find((t) => t.id === params.ticketId);
    if (!ticket) throw new Error('Ticket support introuvable.');
    const oldStatus = ticket.status;
    ticket.status = params.status;
    if (params.priority) ticket.priority = params.priority;
    ticket.updatedAt = Date.now();

    this.recordAuditLog({
      adminUid: params.adminUid,
      adminEmail: params.adminEmail,
      adminRole: 'SUPER_ADMIN',
      action: 'SUPPORT_TICKET_STATUS_CHANGED',
      category: 'support',
      targetId: ticket.id,
      oldValue: { status: oldStatus },
      newValue: { status: ticket.status },
      ip: params.ip,
      detail: `Ticket ${ticket.id} : ${oldStatus} -> ${ticket.status}`,
    });

    this.persist();
    return ticket;
  }

  public addSupportInternalNote(params: {
    ticketId: string;
    note: string;
    adminUid: string;
    adminEmail: string;
  }): SupportTicketRecord {
    const ticket = this.data.supportTickets.find((t) => t.id === params.ticketId);
    if (!ticket) throw new Error('Ticket support introuvable.');
    const now = Date.now();
    ticket.internalNotes.unshift({
      id: `note_${now}_${crypto.randomBytes(3).toString('hex')}`,
      adminEmail: params.adminEmail,
      note: params.note.trim().slice(0, 2000),
      createdAt: now,
    });
    ticket.updatedAt = now;
    this.persist();
    return ticket;
  }

  // --- Unified Users & Analytics ---

  public listAllUsersSummary(externalFirestoreUsers?: Array<{
    uid: string;
    email?: string | null;
    displayName?: string | null;
    photoURL?: string | null;
    createdAt?: number | null;
    lastActiveAt?: number | null;
  }>): AdminUserSummary[] {
    if (externalFirestoreUsers?.length) {
      externalFirestoreUsers.forEach((u) => {
        if (!u.uid) return;
        this.upsertDirectoryUser({
          uid: u.uid,
          email: u.email,
          displayName: u.displayName,
          photoURL: u.photoURL,
          createdAt: u.createdAt ?? null,
          lastLoginAt: u.lastActiveAt ?? null,
        });
      });
    }

    const now = Date.now();
    const uids = new Set<string>([
      ...Object.keys(this.data.userDirectory),
      ...Object.keys(this.data.subscriptions),
    ]);

    const summaries: AdminUserSummary[] = [];
    uids.forEach((uid) => {
      const dir = this.getUserGovernance(uid);
      const sub = this.getUserSubscription(uid, {
        email: dir?.email || null,
        userCreatedAtMs: dir?.createdAt || null,
      });
      const presence = this.computePresenceState(uid, now);
      const email = dir?.email || sub.email || null;
      const role = dir?.role || this.resolveUserRole(email, Boolean(dir?.emailVerified));

      summaries.push({
        uid,
        email,
        displayName: dir?.displayName || null,
        photoURL: dir?.photoURL || null,
        emailVerified: Boolean(dir?.emailVerified),
        role,
        createdAt: dir?.createdAt || sub.startDate || null,
        lastLoginAt: dir?.lastLoginAt || (presence.lastHeartbeatAt || null),
        accountStatus: dir?.accountStatus || 'active',
        suspensionReason: dir?.suspensionReason || null,
        suspensionExpiresAt: dir?.suspensionExpiresAt || null,
        banReason: dir?.banReason || null,
        bannedAt: dir?.bannedAt || null,
        softDeletedAt: dir?.softDeletedAt || null,
        presence,
        subscription: sub,
        sanctionHistory: dir?.sanctionHistory || [],
      });
    });

    return summaries.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  public getAdminOverviewStats(): AdminOverviewStats {
    const subs = this.listAllSubscriptionsForAdmin();
    const codes = this.listRedeemCodesForAdmin();
    const now = Date.now();
    return {
      totalRecordedSubscriptions: subs.length,
      freeUsers: subs.filter((s) => s.effectivePlan === 'FREE').length,
      premiumUsers: subs.filter((s) => s.effectivePlan === 'PREMIUM').length,
      familyUsers: subs.filter((s) => s.effectivePlan === 'FAMILY').length,
      businessUsers: subs.filter((s) => s.effectivePlan === 'BUSINESS').length,
      earlyTesterUsers: subs.filter(
        (s) => s.isEarlyTester && s.earlyTesterEndDate && s.earlyTesterEndDate > now
      ).length,
      lifetimeUsers: subs.filter((s) => s.isLifetime && s.status === 'active').length,
      suspendedSubscriptions: subs.filter((s) => s.status === 'suspended').length,
      expiredSubscriptions: subs.filter((s) => s.status === 'expired').length,
      totalCodes: codes.length,
      usedCodes: codes.filter((c) => c.status === 'used').length,
      availableCodes: codes.filter((c) => c.status === 'available').length,
      revokedCodes: codes.filter((c) => c.status === 'revoked').length,
      expiredCodes: codes.filter((c) => c.status === 'expired').length,
      disabledCodes: codes.filter((c) => c.status === 'disabled').length,
    };
  }

  public getOverviewAnalytics(externalFirestoreUsers?: Array<{
    uid: string;
    email?: string | null;
    displayName?: string | null;
    photoURL?: string | null;
    createdAt?: number | null;
    lastActiveAt?: number | null;
  }>) {
    const users = this.listAllUsersSummary(externalFirestoreUsers);
    const stats = this.getAdminOverviewStats();
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayMs = startOfToday.getTime();
    const weekAgoMs = now - 7 * dayMs;

    const newToday = users.filter((u) => u.createdAt && u.createdAt >= todayMs).length;
    const newThisWeek = users.filter((u) => u.createdAt && u.createdAt >= weekAgoMs).length;
    const activeUsers = users.filter((u) => u.accountStatus === 'active').length;
    const bannedUsers = users.filter((u) => u.accountStatus === 'banned').length;
    const suspendedUsers = users.filter((u) => u.accountStatus === 'suspended').length;
    const deletedUsers = users.filter((u) => u.accountStatus === 'soft_deleted').length;

    const onlineUsers = users.filter((u) => u.presence.state === 'online').length;
    const idleUsers = users.filter((u) => u.presence.state === 'idle').length;
    const offlineUsers = users.filter((u) => u.presence.state === 'offline').length;

    // Last 14 days real series computed from genuine timestamps
    const dailySeries: Array<{
      date: string;
      signups: number;
      activations: number;
      redeemActivations: number;
    }> = [];

    for (let i = 13; i >= 0; i--) {
      const d = new Date(todayMs - i * dayMs);
      const dayStart = d.getTime();
      const dayEnd = dayStart + dayMs;
      const label = d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });

      const signups = users.filter(
        (u) => u.createdAt && u.createdAt >= dayStart && u.createdAt < dayEnd
      ).length;
      const activations = this.data.activations.filter(
        (a) => a.activatedAt >= dayStart && a.activatedAt < dayEnd
      ).length;
      const redeemActivations = this.data.activations.filter(
        (a) => a.source === 'redeem' && a.activatedAt >= dayStart && a.activatedAt < dayEnd
      ).length;

      dailySeries.push({ date: label, signups, activations, redeemActivations });
    }

    const planDistribution = [
      { name: 'Free', value: users.filter((u) => u.subscription.effectivePlan === 'FREE').length, color: '#64748b' },
      { name: 'Premium', value: users.filter((u) => u.subscription.effectivePlan === 'PREMIUM').length, color: '#3b82f6' },
      { name: 'Family', value: users.filter((u) => u.subscription.effectivePlan === 'FAMILY').length, color: '#6366f1' },
      { name: 'Business', value: users.filter((u) => u.subscription.effectivePlan === 'BUSINESS').length, color: '#10b981' },
    ];

    const pendingAccessibility = this.data.accessibilityRequests.filter(
      (r) => r.status === 'pending' || r.status === 'more_info_required'
    ).length;
    const openSupportTickets = this.data.supportTickets.filter(
      (t) => t.status === 'open' || t.status === 'in_progress'
    ).length;
    const newBusinessQuotes = this.data.businessQuotes.filter((q) => q.status === 'new').length;

    return {
      kpis: {
        totalUsers: users.length,
        activeUsers,
        newToday,
        newThisWeek,
        bannedUsers,
        suspendedUsers,
        deletedUsers,
        onlineUsers,
        idleUsers,
        offlineUsers,
        freeUsers: planDistribution[0].value,
        premiumUsers: planDistribution[1].value,
        familyUsers: planDistribution[2].value,
        businessUsers: planDistribution[3].value,
        activeSubscriptions: users.filter(
          (u) => u.subscription.effectivePlan !== 'FREE' && u.subscription.status === 'active'
        ).length,
        expiredSubscriptions: stats.expiredSubscriptions,
        suspendedSubscriptions: stats.suspendedSubscriptions,
        lifetimeSubscriptions: stats.lifetimeUsers,
        pioneerUsers: stats.earlyTesterUsers,
        totalCodes: stats.totalCodes,
        availableCodes: stats.availableCodes,
        usedCodes: stats.usedCodes,
        expiredCodes: stats.expiredCodes,
        revokedCodes: stats.revokedCodes,
        disabledCodes: stats.disabledCodes,
        pendingAccessibility,
        openSupportTickets,
        newBusinessQuotes,
      },
      dailySeries,
      planDistribution,
      recentAuditLogs: this.data.auditLogs.slice(0, 15),
    };
  }

  // =========================================================================
  // Android APK Releases, Versioning, Backup/Retention & Download Analytics
  // =========================================================================

  private stripAndroidReleasePaths(rel: StoredAndroidRelease): AndroidAppRelease {
    const fileAvailable = Boolean(rel.storagePath && fs.existsSync(rel.storagePath));
    const hasBackup = Boolean(rel.backupPath && fs.existsSync(rel.backupPath));
    const { storagePath: _sp, backupPath: _bp, ...publicShape } = rel;
    return {
      ...publicShape,
      fileAvailable,
      hasBackup,
    };
  }

  private ensureBackupCopy(rel: StoredAndroidRelease): void {
    this.ensureDirectories();
    if (!rel.storagePath || !fs.existsSync(rel.storagePath)) return;
    const backupTarget = path.join(APK_BACKUPS_DIR, `${rel.id}.bak.apk`);
    if (!fs.existsSync(backupTarget)) {
      fs.copyFileSync(rel.storagePath, backupTarget);
    }
    rel.backupPath = backupTarget;
    rel.hasBackup = true;
  }

  public getAndroidAppSettings(): AndroidAppSettings {
    return { ...this.data.androidAppSettings };
  }

  public updateAndroidAppSettings(params: {
    updates: Partial<
      Pick<
        AndroidAppSettings,
        | 'downloadsEnabled'
        | 'appName'
        | 'packageName'
        | 'description'
        | 'minSupportedVersionCode'
        | 'retentionKeepCount'
        | 'maxApkSizeBytes'
      >
    >;
    adminUid: string;
    adminEmail: string;
    ip?: string | null;
  }): AndroidAppSettings {
    const prev = { ...this.data.androidAppSettings };
    const u = params.updates;

    if (typeof u.downloadsEnabled === 'boolean') {
      this.data.androidAppSettings.downloadsEnabled = u.downloadsEnabled;
    }
    if (typeof u.appName === 'string' && u.appName.trim()) {
      this.data.androidAppSettings.appName = u.appName.trim().slice(0, 80);
    }
    if (typeof u.packageName === 'string' && u.packageName.trim()) {
      this.data.androidAppSettings.packageName = u.packageName.trim().slice(0, 120);
    }
    if (typeof u.description === 'string') {
      this.data.androidAppSettings.description = u.description.trim().slice(0, 1500);
    }
    if (typeof u.minSupportedVersionCode === 'number' && Number.isFinite(u.minSupportedVersionCode)) {
      this.data.androidAppSettings.minSupportedVersionCode = Math.max(
        1,
        Math.floor(u.minSupportedVersionCode)
      );
    }
    if (typeof u.retentionKeepCount === 'number' && Number.isFinite(u.retentionKeepCount)) {
      this.data.androidAppSettings.retentionKeepCount = Math.max(
        1,
        Math.min(20, Math.floor(u.retentionKeepCount))
      );
    }
    if (typeof u.maxApkSizeBytes === 'number' && Number.isFinite(u.maxApkSizeBytes)) {
      this.data.androidAppSettings.maxApkSizeBytes = Math.max(
        5 * 1024 * 1024,
        Math.min(500 * 1024 * 1024, Math.floor(u.maxApkSizeBytes))
      );
    }
    this.data.androidAppSettings.updatedAt = Date.now();
    this.data.androidAppSettings.updatedBy = params.adminEmail;

    this.recordAuditLog({
      adminUid: params.adminUid,
      adminEmail: params.adminEmail,
      adminRole: 'SUPER_ADMIN',
      action: 'ANDROID_SETTINGS_UPDATED',
      category: 'android_app',
      oldValue: {
        downloadsEnabled: prev.downloadsEnabled,
        minSupportedVersionCode: prev.minSupportedVersionCode,
        retentionKeepCount: prev.retentionKeepCount,
      },
      newValue: {
        downloadsEnabled: this.data.androidAppSettings.downloadsEnabled,
        minSupportedVersionCode: this.data.androidAppSettings.minSupportedVersionCode,
        retentionKeepCount: this.data.androidAppSettings.retentionKeepCount,
      },
      ip: params.ip,
      detail: `Paramètres Android mis à jour (téléchargements ${
        this.data.androidAppSettings.downloadsEnabled ? 'activés' : 'désactivés'
      }, versionCode min=${this.data.androidAppSettings.minSupportedVersionCode})`,
    });
    this.persist();
    return this.getAndroidAppSettings();
  }

  public listAndroidReleases(): AndroidAppRelease[] {
    return [...this.data.androidReleases]
      .sort((a, b) => {
        if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
        if (b.versionCode !== a.versionCode) return b.versionCode - a.versionCode;
        return b.createdAt - a.createdAt;
      })
      .map((r) => this.stripAndroidReleasePaths(r));
  }

  public getAndroidReleaseById(id: string): AndroidAppRelease | null {
    const found = this.data.androidReleases.find((r) => r.id === id);
    return found ? this.stripAndroidReleasePaths(found) : null;
  }

  public getCurrentPublishedAndroidRelease(): AndroidAppRelease | null {
    const published = this.data.androidReleases.filter((r) => r.status === 'published');
    if (published.length === 0) return null;
    const explicitCurrent = published.find((r) => r.isCurrent);
    if (explicitCurrent) return this.stripAndroidReleasePaths(explicitCurrent);
    const highest = [...published].sort((a, b) => b.versionCode - a.versionCode)[0];
    return highest ? this.stripAndroidReleasePaths(highest) : null;
  }

  public getLatestPublicAndroidInfo(installedVersionCode?: number | null): AndroidLatestVersionResponse {
    const settings = this.data.androidAppSettings;
    const latest = this.getCurrentPublishedAndroidRelease();

    if (!settings.downloadsEnabled || !latest || !latest.fileAvailable) {
      const disabledReason = !settings.downloadsEnabled
        ? 'Le téléchargement de l’application Android est temporairement désactivé par l’administrateur.'
        : 'Aucune version Android publiée n’est actuellement disponible au téléchargement.';
      return {
        downloadsEnabled: settings.downloadsEnabled,
        available: false,
        appName: latest?.appName || settings.appName,
        packageName: latest?.packageName || settings.packageName,
        description: settings.description,
        releaseId: null,
        versionName: null,
        versionCode: null,
        downloadUrl: null,
        fileName: null,
        disabledReason,
        fileSize: null,
        sha256: null,
        releaseDate: null,
        publishedAt: null,
        whatsNew: [],
        releaseDescription: null,
        minAndroidVersion: null,
        minAndroidApi: null,
        updateType: 'optional',
        mandatory: false,
        updateAvailable: false,
        minSupportedVersionCode: settings.minSupportedVersionCode,
        mandatoryReason: null,
      };
    }

    const hasInstalled =
      typeof installedVersionCode === 'number' &&
      Number.isFinite(installedVersionCode) &&
      installedVersionCode > 0;
    const updateAvailable = hasInstalled ? latest.versionCode > installedVersionCode : true;

    const effectiveMinSupported = Math.max(
      settings.minSupportedVersionCode || 1,
      latest.minSupportedVersionCode || 1
    );

    // Block/mandate only when the installed version is genuinely incompatible (< minSupportedVersionCode)
    // or when release is marked mandatory and installed version is older than latest
    let mandatory = false;
    let mandatoryReason: string | null = null;
    if (hasInstalled && installedVersionCode < effectiveMinSupported) {
      mandatory = true;
      mandatoryReason = `Votre version installée (code ${installedVersionCode}) n’est plus compatible avec les exigences de sécurité VruGuard (minimum requis : code ${effectiveMinSupported}).`;
    } else if (latest.updateType === 'mandatory' && updateAvailable) {
      mandatory = true;
      mandatoryReason =
        'Une mise à jour critique de sécurité et de compatibilité VruGuard est requise pour continuer.';
    }

    return {
      downloadsEnabled: true,
      available: true,
      appName: latest.appName || settings.appName,
      packageName: latest.packageName || settings.packageName,
      description: settings.description,
      releaseId: latest.id,
      versionName: latest.versionName,
      versionCode: latest.versionCode,
      downloadUrl: `/api/android-app/download/${encodeURIComponent(latest.id)}`,
      fileName: latest.fileName,
      disabledReason: null,
      fileSize: latest.fileSize,
      sha256: latest.sha256,
      releaseDate: latest.releaseDate,
      publishedAt: latest.publishedAt,
      whatsNew: latest.whatsNew,
      releaseDescription: latest.description,
      minAndroidVersion: latest.minAndroidVersion,
      minAndroidApi: latest.minAndroidApi,
      updateType: mandatory ? 'mandatory' : latest.updateType,
      mandatory,
      updateAvailable,
      minSupportedVersionCode: effectiveMinSupported,
      mandatoryReason,
    };
  }

  public createAndroidRelease(params: {
    tempFilePath: string;
    originalFileName: string;
    fileSize: number;
    sha256: string;
    mimeType: string;
    appName: string;
    packageName?: string;
    versionName: string;
    versionCode: number;
    description: string;
    whatsNew: string[];
    releaseDate: string;
    status: AndroidReleaseStatus;
    minAndroidVersion: string;
    minAndroidApi: number;
    updateType: AndroidUpdateType;
    minSupportedVersionCode?: number | null;
    setAsCurrent: boolean;
    adminUid: string;
    adminEmail: string;
    ip?: string | null;
  }): AndroidAppRelease {
    this.ensureDirectories();
    const versionCode = Math.floor(Number(params.versionCode));
    if (!Number.isFinite(versionCode) || versionCode < 1) {
      throw new Error('Le code de version (versionCode) doit être un entier positif (>= 1).');
    }

    const versionName = (params.versionName || '').trim();
    if (!versionName || !/^[0-9]+(\.[0-9]+){1,3}(-[a-zA-Z0-9._-]+)?$/.test(versionName)) {
      throw new Error('Format du numéro de version invalide (ex. 1.0.0 ou 1.2.0-beta.1).');
    }

    const duplicateCode = this.data.androidReleases.find((r) => r.versionCode === versionCode);
    if (duplicateCode) {
      throw new Error(
        `Le versionCode ${versionCode} existe déjà (${duplicateCode.versionName}). Utilisez un code de version strictement supérieur pour ne jamais écraser un paquet existant.`
      );
    }

    const now = Date.now();
    const id = `apk_${now}_${crypto.randomBytes(4).toString('hex')}`;
    const safeStorageName = `${id}.apk`;
    const destPath = path.join(APK_RELEASES_DIR, safeStorageName);

    fs.copyFileSync(params.tempFilePath, destPath);
    try {
      fs.unlinkSync(params.tempFilePath);
    } catch {
      // ignore temp cleanup failure
    }

    const shouldBeCurrent = params.status === 'published' && params.setAsCurrent;
    let backupPath: string | null = null;
    if (params.status === 'published') {
      const bakTarget = path.join(APK_BACKUPS_DIR, `${id}.bak.apk`);
      fs.copyFileSync(destPath, bakTarget);
      backupPath = bakTarget;
    }

    if (shouldBeCurrent) {
      this.data.androidReleases.forEach((rel) => {
        if (rel.isCurrent) {
          rel.isCurrent = false;
          rel.isArchived = true;
          rel.updatedAt = now;
        }
      });
    }

    const record: StoredAndroidRelease = {
      id,
      appName: (params.appName || this.data.androidAppSettings.appName || 'VruGuard').trim().slice(0, 80),
      packageName: (
        params.packageName ||
        this.data.androidAppSettings.packageName ||
        'com.vruguard.sentinel'
      ).trim(),
      versionName,
      versionCode,
      fileName: path.basename(params.originalFileName || `VruGuard-${versionName}.apk`),
      fileSize: params.fileSize,
      sha256: params.sha256,
      mimeType: 'application/vnd.android.package-archive',
      description: (params.description || '').trim().slice(0, 3000),
      whatsNew: params.whatsNew
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 30),
      releaseDate: params.releaseDate || new Date(now).toISOString().slice(0, 10),
      publishedAt: params.status === 'published' ? now : null,
      status: params.status,
      minAndroidVersion: (params.minAndroidVersion || 'Android 8.0 (API 26)').trim(),
      minAndroidApi: Number(params.minAndroidApi) || 26,
      updateType: params.updateType === 'mandatory' ? 'mandatory' : 'optional',
      minSupportedVersionCode:
        typeof params.minSupportedVersionCode === 'number' &&
        Number.isFinite(params.minSupportedVersionCode) &&
        params.minSupportedVersionCode >= 1
          ? Math.floor(params.minSupportedVersionCode)
          : null,
      isCurrent: shouldBeCurrent,
      isArchived: false,
      hasBackup: Boolean(backupPath),
      fileAvailable: true,
      downloadsInitiated: 0,
      downloadsCompleted: 0,
      lastDownloadedAt: null,
      uploadedByUid: params.adminUid,
      uploadedByEmail: params.adminEmail,
      createdAt: now,
      updatedAt: now,
      storagePath: destPath,
      backupPath,
    };

    // If this is the very first published release and none is current, promote it automatically
    if (
      record.status === 'published' &&
      !this.data.androidReleases.some((r) => r.status === 'published' && r.isCurrent)
    ) {
      record.isCurrent = true;
    }

    this.data.androidReleases.unshift(record);
    this.recordAuditLog({
      adminUid: params.adminUid,
      adminEmail: params.adminEmail,
      adminRole: 'SUPER_ADMIN',
      action:
        record.status === 'published' ? 'ANDROID_APK_PUBLISHED' : 'ANDROID_APK_UPLOADED',
      category: 'android_app',
      targetId: record.id,
      newValue: {
        versionName: record.versionName,
        versionCode: record.versionCode,
        status: record.status,
        isCurrent: record.isCurrent,
        sha256: record.sha256,
        fileSize: record.fileSize,
      },
      ip: params.ip,
      detail: `APK v${record.versionName} (code ${record.versionCode}) enregistré [${record.status}] · SHA-256 ${record.sha256.slice(0, 12)}…`,
    });
    this.persist();
    return this.stripAndroidReleasePaths(record);
  }

  public updateAndroidReleaseMetadata(params: {
    id: string;
    updates: {
      appName?: string;
      versionName?: string;
      description?: string;
      whatsNew?: string[];
      releaseDate?: string;
      minAndroidVersion?: string;
      minAndroidApi?: number;
      updateType?: AndroidUpdateType;
      minSupportedVersionCode?: number | null;
    };
    adminUid: string;
    adminEmail: string;
    ip?: string | null;
  }): AndroidAppRelease {
    const rel = this.data.androidReleases.find((r) => r.id === params.id);
    if (!rel) {
      throw new Error('Version Android introuvable.');
    }
    const prev = {
      versionName: rel.versionName,
      description: rel.description,
      updateType: rel.updateType,
      minAndroidVersion: rel.minAndroidVersion,
    };
    const u = params.updates;
    if (typeof u.appName === 'string' && u.appName.trim()) {
      rel.appName = u.appName.trim().slice(0, 80);
    }
    if (typeof u.versionName === 'string' && u.versionName.trim()) {
      if (!/^[0-9]+(\.[0-9]+){1,3}(-[a-zA-Z0-9._-]+)?$/.test(u.versionName.trim())) {
        throw new Error('Format de versionName invalide.');
      }
      rel.versionName = u.versionName.trim();
    }
    if (typeof u.description === 'string') {
      rel.description = u.description.trim().slice(0, 3000);
    }
    if (Array.isArray(u.whatsNew)) {
      rel.whatsNew = u.whatsNew.map((s) => s.trim()).filter(Boolean).slice(0, 30);
    }
    if (typeof u.releaseDate === 'string' && u.releaseDate.trim()) {
      rel.releaseDate = u.releaseDate.trim();
    }
    if (typeof u.minAndroidVersion === 'string' && u.minAndroidVersion.trim()) {
      rel.minAndroidVersion = u.minAndroidVersion.trim();
    }
    if (typeof u.minAndroidApi === 'number' && Number.isFinite(u.minAndroidApi)) {
      rel.minAndroidApi = Math.max(21, Math.min(36, Math.floor(u.minAndroidApi)));
    }
    if (u.updateType === 'optional' || u.updateType === 'mandatory') {
      rel.updateType = u.updateType;
    }
    if (u.minSupportedVersionCode !== undefined) {
      rel.minSupportedVersionCode =
        typeof u.minSupportedVersionCode === 'number' &&
        Number.isFinite(u.minSupportedVersionCode) &&
        u.minSupportedVersionCode >= 1
          ? Math.floor(u.minSupportedVersionCode)
          : null;
    }
    rel.updatedAt = Date.now();

    this.recordAuditLog({
      adminUid: params.adminUid,
      adminEmail: params.adminEmail,
      adminRole: 'SUPER_ADMIN',
      action: 'ANDROID_APK_METADATA_UPDATED',
      category: 'android_app',
      targetId: rel.id,
      oldValue: prev,
      newValue: {
        versionName: rel.versionName,
        description: rel.description,
        updateType: rel.updateType,
        minAndroidVersion: rel.minAndroidVersion,
      },
      ip: params.ip,
      detail: `Métadonnées APK v${rel.versionName} (code ${rel.versionCode}) modifiées`,
    });
    this.persist();
    return this.stripAndroidReleasePaths(rel);
  }

  public async setAndroidReleaseStatus(params: {
    id: string;
    action: 'publish' | 'unpublish' | 'disable' | 'restore';
    adminUid: string;
    adminEmail: string;
    ip?: string | null;
  }): Promise<AndroidAppRelease> {
    const rel = this.data.androidReleases.find((r) => r.id === params.id);
    if (!rel) {
      throw new Error('Version Android introuvable.');
    }
    const now = Date.now();
    const oldState = { status: rel.status, isCurrent: rel.isCurrent };

    if (params.action === 'publish' || params.action === 'restore') {
      // Check compatibility before restoring an old version
      if (
        params.action === 'restore' &&
        rel.versionCode < (this.data.androidAppSettings.minSupportedVersionCode || 1)
      ) {
        throw new Error(
          `Impossible de restaurer la version ${rel.versionName} (code ${rel.versionCode}) : elle est inférieure au seuil minimal de sécurité configuré (code ${this.data.androidAppSettings.minSupportedVersionCode}).`
        );
      }

      // Restore from backup if primary file is missing
      if ((!rel.storagePath || !fs.existsSync(rel.storagePath)) && rel.backupPath && fs.existsSync(rel.backupPath)) {
        const recoveredPath = path.join(APK_RELEASES_DIR, `${rel.id}.apk`);
        fs.copyFileSync(rel.backupPath, recoveredPath);
        rel.storagePath = recoveredPath;
      }

      if (!rel.storagePath || !fs.existsSync(rel.storagePath)) {
        throw new Error('Le fichier binaire .apk est introuvable sur le stockage sécurisé.');
      }

      // Verify SHA-256 integrity prior to publishing / restoring
      const currentSha = await computeFileSha256(rel.storagePath);
      if (currentSha !== rel.sha256) {
        throw new Error(
          'Échec de vérification SHA-256 : le fichier APK stocké ne correspond plus à l’empreinte enregistrée.'
        );
      }

      this.ensureBackupCopy(rel);

      // Demote previous current release cleanly while preserving it in history
      this.data.androidReleases.forEach((other) => {
        if (other.id !== rel.id && other.isCurrent) {
          other.isCurrent = false;
          other.isArchived = true;
          other.updatedAt = now;
        }
      });

      rel.status = 'published';
      rel.isCurrent = true;
      rel.isArchived = false;
      if (!rel.publishedAt) {
        rel.publishedAt = now;
      }
      rel.updatedAt = now;
    } else if (params.action === 'unpublish') {
      rel.status = 'draft';
      rel.isCurrent = false;
      rel.updatedAt = now;
    } else if (params.action === 'disable') {
      rel.status = 'disabled';
      rel.isCurrent = false;
      rel.updatedAt = now;
    }

    this.recordAuditLog({
      adminUid: params.adminUid,
      adminEmail: params.adminEmail,
      adminRole: 'SUPER_ADMIN',
      action: `ANDROID_APK_${params.action.toUpperCase()}`,
      category: 'android_app',
      targetId: rel.id,
      oldValue: oldState,
      newValue: { status: rel.status, isCurrent: rel.isCurrent },
      ip: params.ip,
      detail: `Action "${params.action}" sur APK v${rel.versionName} (code ${rel.versionCode})`,
    });
    this.persist();
    return this.stripAndroidReleasePaths(rel);
  }

  public deleteAndroidRelease(params: {
    id: string;
    confirmRetentionOverride?: boolean;
    adminUid: string;
    adminEmail: string;
    ip?: string | null;
  }): void {
    const idx = this.data.androidReleases.findIndex((r) => r.id === params.id);
    if (idx === -1) {
      throw new Error('Version Android introuvable.');
    }
    const rel = this.data.androidReleases[idx];
    if (rel.isCurrent) {
      throw new Error(
        'Protection anti-suppression : impossible de supprimer la version actuellement active. Publiez une autre version ou dépubliez-la d’abord.'
      );
    }
    if (rel.status === 'published') {
      throw new Error(
        'Protection anti-suppression : dépubliez ou désactivez cette version avant de la supprimer.'
      );
    }

    const keepCount = Math.max(1, this.data.androidAppSettings.retentionKeepCount || 3);
    const sortedByRecency = [...this.data.androidReleases].sort(
      (a, b) => b.versionCode - a.versionCode
    );
    const rank = sortedByRecency.findIndex((r) => r.id === rel.id);
    if (rank !== -1 && rank < keepCount && !params.confirmRetentionOverride) {
      throw new Error(
        `Règle de conservation : cette version fait partie des ${keepCount} versions les plus récentes conservées pour restauration. Confirmez explicitement la suppression forcée.`
      );
    }

    if (rel.storagePath && fs.existsSync(rel.storagePath)) {
      try {
        fs.unlinkSync(rel.storagePath);
      } catch {
        // ignore
      }
    }
    if (rel.backupPath && fs.existsSync(rel.backupPath)) {
      try {
        fs.unlinkSync(rel.backupPath);
      } catch {
        // ignore
      }
    }

    this.data.androidReleases.splice(idx, 1);
    this.recordAuditLog({
      adminUid: params.adminUid,
      adminEmail: params.adminEmail,
      adminRole: 'SUPER_ADMIN',
      action: 'ANDROID_APK_DELETED',
      category: 'android_app',
      targetId: rel.id,
      oldValue: {
        versionName: rel.versionName,
        versionCode: rel.versionCode,
        sha256: rel.sha256,
      },
      ip: params.ip,
      detail: `Suppression définitive de l’APK v${rel.versionName} (code ${rel.versionCode})`,
    });
    this.persist();
  }

  public async getAndroidReleaseBinaryForDownload(
    id: string,
    allowUnpublished = false
  ): Promise<{
    release: AndroidAppRelease;
    filePath: string;
    fileName: string;
    fileSize: number;
    sha256: string;
  } | null> {
    const rel = this.data.androidReleases.find((r) => r.id === id);
    if (!rel) return null;
    if (!allowUnpublished) {
      if (!this.data.androidAppSettings.downloadsEnabled || rel.status !== 'published') {
        return null;
      }
    }

    let targetPath = rel.storagePath;
    if (!targetPath || !fs.existsSync(targetPath)) {
      if (rel.backupPath && fs.existsSync(rel.backupPath)) {
        targetPath = rel.backupPath;
      } else {
        return null;
      }
    }

    // Verify integrity before streaming; auto-heal from backup if primary fails checksum
    const actualSha = await computeFileSha256(targetPath);
    if (actualSha !== rel.sha256) {
      if (
        targetPath !== rel.backupPath &&
        rel.backupPath &&
        fs.existsSync(rel.backupPath) &&
        (await computeFileSha256(rel.backupPath)) === rel.sha256
      ) {
        fs.copyFileSync(rel.backupPath, rel.storagePath);
        targetPath = rel.storagePath;
      } else {
        throw new Error('Intégrité SHA-256 de l’APK compromise. Téléchargement bloqué.');
      }
    }

    const stat = fs.statSync(targetPath);
    return {
      release: this.stripAndroidReleasePaths(rel),
      filePath: targetPath,
      fileName: `VruGuard-v${rel.versionName}.apk`,
      fileSize: stat.size,
      sha256: rel.sha256,
    };
  }

  public recordAndroidDownloadInitiated(params: {
    releaseId: string;
    source: 'web' | 'android_app' | 'qr' | 'admin';
    bytesTotal: number;
    country?: string | null;
  }): AndroidDownloadEvent | null {
    const rel = this.data.androidReleases.find((r) => r.id === params.releaseId);
    if (!rel) return null;
    const now = Date.now();
    const evt: AndroidDownloadEvent = {
      id: `dl_${now}_${crypto.randomBytes(4).toString('hex')}`,
      releaseId: rel.id,
      versionName: rel.versionName,
      versionCode: rel.versionCode,
      status: 'initiated',
      source: params.source,
      bytesTotal: params.bytesTotal,
      bytesSent: 0,
      initiatedAt: now,
      completedAt: null,
      country: params.country ?? null,
    };
    rel.downloadsInitiated = (rel.downloadsInitiated || 0) + 1;
    rel.lastDownloadedAt = now;
    this.data.androidDownloadEvents.unshift(evt);
    if (this.data.androidDownloadEvents.length > 5000) {
      this.data.androidDownloadEvents.length = 5000;
    }
    this.persist();
    return evt;
  }

  public markAndroidDownloadFinished(
    eventId: string,
    bytesSent: number,
    outcome: 'completed' | 'aborted'
  ): AndroidDownloadEvent | null {
    const evt = this.data.androidDownloadEvents.find((e) => e.id === eventId);
    if (!evt) return null;
    if (evt.status === 'completed') return evt;

    const now = Date.now();
    evt.bytesSent = Math.max(evt.bytesSent || 0, bytesSent);
    evt.status = outcome;
    if (outcome === 'completed') {
      evt.completedAt = now;
      const rel = this.data.androidReleases.find((r) => r.id === evt.releaseId);
      if (rel) {
        rel.downloadsCompleted = (rel.downloadsCompleted || 0) + 1;
        rel.lastDownloadedAt = now;
      }
    }
    this.persist();
    return evt;
  }

  public getAndroidDownloadStats(): AndroidDownloadStats {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayMs = startOfToday.getTime();
    const weekAgoMs = now - 7 * dayMs;

    const events = this.data.androidDownloadEvents;
    const totalInitiated = events.length;
    const totalCompleted = events.filter((e) => e.status === 'completed').length;
    const todayInitiated = events.filter((e) => e.initiatedAt >= todayMs).length;
    const todayCompleted = events.filter(
      (e) => e.status === 'completed' && (e.completedAt || e.initiatedAt) >= todayMs
    ).length;
    const weekInitiated = events.filter((e) => e.initiatedAt >= weekAgoMs).length;
    const weekCompleted = events.filter(
      (e) => e.status === 'completed' && (e.completedAt || e.initiatedAt) >= weekAgoMs
    ).length;

    const lastDownloadedAt =
      events.length > 0 ? Math.max(...events.map((e) => e.completedAt || e.initiatedAt)) : null;

    let storageUsedBytes = 0;
    this.data.androidReleases.forEach((rel) => {
      if (rel.storagePath && fs.existsSync(rel.storagePath)) {
        storageUsedBytes += fs.statSync(rel.storagePath).size;
      }
      if (rel.backupPath && fs.existsSync(rel.backupPath)) {
        storageUsedBytes += fs.statSync(rel.backupPath).size;
      }
    });

    const storageAvailableBytes = getAvailableStorageBytes(APK_RELEASES_DIR);

    const byVersion = [...this.data.androidReleases]
      .sort((a, b) => b.versionCode - a.versionCode)
      .map((rel) => ({
        releaseId: rel.id,
        versionName: rel.versionName,
        versionCode: rel.versionCode,
        status: rel.status,
        isCurrent: rel.isCurrent,
        initiated: rel.downloadsInitiated || 0,
        completed: rel.downloadsCompleted || 0,
        lastDownloadedAt: rel.lastDownloadedAt || null,
      }));

    const dailySeries: AndroidDownloadStats['dailySeries'] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(todayMs - i * dayMs);
      const dayStart = d.getTime();
      const dayEnd = dayStart + dayMs;
      const iso = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
      const initiated = events.filter(
        (e) => e.initiatedAt >= dayStart && e.initiatedAt < dayEnd
      ).length;
      const completed = events.filter(
        (e) =>
          e.status === 'completed' &&
          (e.completedAt || e.initiatedAt) >= dayStart &&
          (e.completedAt || e.initiatedAt) < dayEnd
      ).length;
      dailySeries.push({ date: iso, label, initiated, completed });
    }

    return {
      totalInitiated,
      totalCompleted,
      todayInitiated,
      todayCompleted,
      weekInitiated,
      weekCompleted,
      lastDownloadedAt,
      storageUsedBytes,
      storageAvailableBytes,
      byVersion,
      dailySeries,
    };
  }

  // =========================================================================
  // First Login Consent & RGPD Compliance (Server-Authoritative & Account-Scoped)
  // =========================================================================

  private isConsentRecordValidForCurrentVersions(record?: UserConsentRecord | null): boolean {
    if (!record) return false;
    return (
      record.status === 'accepted' &&
      record.consentVersion === CURRENT_CONSENT_VERSION &&
      record.termsVersion === CURRENT_TERMS_VERSION &&
      record.privacyVersion === CURRENT_PRIVACY_VERSION &&
      Boolean(record.acceptedAt)
    );
  }

  public getUserConsentStatus(uid: string): ConsentStatusResponse {
    const rec = this.data.userConsents[uid] || null;
    const accessAllowed = this.isConsentRecordValidForCurrentVersions(rec);

    if (!rec) {
      return {
        consentStatus: 'pending',
        consentVersion: null,
        termsVersion: null,
        privacyVersion: null,
        currentConsentVersion: CURRENT_CONSENT_VERSION,
        currentTermsVersion: CURRENT_TERMS_VERSION,
        currentPrivacyVersion: CURRENT_PRIVACY_VERSION,
        acceptedAt: null,
        refusedAt: null,
        withdrawnAt: null,
        platform: null,
        accessAllowed: false,
        requiresConsent: true,
        optionalConsents: {
          notifications: false,
          locationEnhancements: false,
        },
        historyCount: 0,
        updatedAt: null,
      };
    }

    return {
      consentStatus: rec.status,
      consentVersion: rec.consentVersion,
      termsVersion: rec.termsVersion,
      privacyVersion: rec.privacyVersion,
      currentConsentVersion: CURRENT_CONSENT_VERSION,
      currentTermsVersion: CURRENT_TERMS_VERSION,
      currentPrivacyVersion: CURRENT_PRIVACY_VERSION,
      acceptedAt: rec.acceptedAt,
      refusedAt: rec.refusedAt,
      withdrawnAt: rec.withdrawnAt,
      platform: rec.platform,
      accessAllowed,
      requiresConsent: !accessAllowed,
      optionalConsents: {
        notifications: Boolean(rec.optionalConsents?.notifications),
        locationEnhancements: Boolean(rec.optionalConsents?.locationEnhancements),
      },
      historyCount: Array.isArray(rec.history) ? rec.history.length : 0,
      updatedAt: rec.updatedAt,
    };
  }

  public acceptUserConsent(params: {
    uid: string;
    email: string | null;
    platform: ConsentPlatform;
    consentVersion?: string;
    termsVersion?: string;
    privacyVersion?: string;
    acceptedRequired: boolean;
    optionalConsents?: Partial<OptionalConsents>;
    ip?: string | null;
  }): {
    record: UserConsentRecord;
    alreadyAccepted: boolean;
    statusResponse: ConsentStatusResponse;
  } {
    if (!params.uid) {
      throw new Error('Identifiant utilisateur requis.');
    }
    if (params.acceptedRequired !== true) {
      throw new Error(
        'Vous devez accepter explicitement les Conditions Générales d’Utilisation et prendre connaissance de la Politique de Confidentialité.'
      );
    }
    if (params.platform !== 'web' && params.platform !== 'android') {
      throw new Error('Plateforme de consentement non reconnue (web ou android attendu).');
    }

    const reqConsentVer = (params.consentVersion || CURRENT_CONSENT_VERSION).trim();
    const reqTermsVer = (params.termsVersion || CURRENT_TERMS_VERSION).trim();
    const reqPrivacyVer = (params.privacyVersion || CURRENT_PRIVACY_VERSION).trim();
    if (
      reqConsentVer !== CURRENT_CONSENT_VERSION ||
      reqTermsVer !== CURRENT_TERMS_VERSION ||
      reqPrivacyVer !== CURRENT_PRIVACY_VERSION
    ) {
      throw new Error(
        'La version des documents légaux a changé. Veuillez recharger les informations actuelles avant de valider.'
      );
    }

    if (this.consentLocks.has(params.uid)) {
      throw new Error('Traitement de consentement déjà en cours pour ce compte.');
    }
    this.consentLocks.add(params.uid);

    try {
      const now = Date.now();
      const existing = this.data.userConsents[params.uid] || null;

      // Idempotent guard: never overwrite original proof timestamp/platform on double-click or simultaneous Web+Android submit
      if (this.isConsentRecordValidForCurrentVersions(existing)) {
        return {
          record: existing!,
          alreadyAccepted: true,
          statusResponse: this.getUserConsentStatus(params.uid),
        };
      }

      const normalizedOptional: OptionalConsents = {
        notifications: Boolean(params.optionalConsents?.notifications),
        locationEnhancements: Boolean(params.optionalConsents?.locationEnhancements),
      };

      const historyEntry: ConsentAuditEntry = {
        id: `cns_${now}_${crypto.randomBytes(4).toString('hex')}`,
        action: 'accepted',
        consentVersion: CURRENT_CONSENT_VERSION,
        termsVersion: CURRENT_TERMS_VERSION,
        privacyVersion: CURRENT_PRIVACY_VERSION,
        platform: params.platform,
        timestamp: now,
        ip: params.ip ?? null,
        optionalConsents: { ...normalizedOptional },
        detail: `Consentement initial accepté sur ${params.platform.toUpperCase()} (CGU ${CURRENT_TERMS_VERSION}, Confidentialité ${CURRENT_PRIVACY_VERSION})`,
      };

      const nextHistory = [historyEntry, ...(existing?.history || [])].slice(0, 200);

      const record: UserConsentRecord = {
        userId: params.uid,
        email: params.email || existing?.email || null,
        status: 'accepted',
        consentVersion: CURRENT_CONSENT_VERSION,
        termsVersion: CURRENT_TERMS_VERSION,
        privacyVersion: CURRENT_PRIVACY_VERSION,
        acceptedAt: now,
        refusedAt: null,
        withdrawnAt: null,
        platform: params.platform,
        optionalConsents: normalizedOptional,
        history: nextHistory,
        updatedAt: now,
      };

      this.data.userConsents[params.uid] = record;

      this.recordAuditLog({
        adminUid: params.uid,
        adminEmail: params.email || params.uid,
        adminRole: 'USER',
        action: 'FIRST_CONSENT_ACCEPTED',
        category: 'consent',
        targetUid: params.uid,
        targetEmail: params.email || null,
        oldValue: existing ? { status: existing.status, consentVersion: existing.consentVersion } : { status: 'pending' },
        newValue: {
          status: 'accepted',
          platform: params.platform,
          consentVersion: CURRENT_CONSENT_VERSION,
          termsVersion: CURRENT_TERMS_VERSION,
          privacyVersion: CURRENT_PRIVACY_VERSION,
          optionalConsents: normalizedOptional,
        },
        ip: params.ip ?? null,
        detail: `Consentement obligatoire accepté par ${params.email || params.uid} depuis ${params.platform.toUpperCase()}`,
      });

      this.persist();
      return {
        record,
        alreadyAccepted: false,
        statusResponse: this.getUserConsentStatus(params.uid),
      };
    } finally {
      this.consentLocks.delete(params.uid);
    }
  }

  public refuseUserConsent(params: {
    uid: string;
    email: string | null;
    platform: ConsentPlatform;
    ip?: string | null;
  }): ConsentStatusResponse {
    if (params.platform !== 'web' && params.platform !== 'android') {
      throw new Error('Plateforme invalide (web ou android attendu).');
    }
    if (this.consentLocks.has(params.uid)) {
      throw new Error('Traitement déjà en cours pour ce compte.');
    }
    this.consentLocks.add(params.uid);

    try {
      const now = Date.now();
      const existing = this.data.userConsents[params.uid] || null;

      if (this.isConsentRecordValidForCurrentVersions(existing)) {
        throw new Error(
          'Votre consentement initial est déjà enregistré. Utilisez la rétractation RGPD dans votre profil si vous souhaitez le retirer.'
        );
      }

      const emptyOptional: OptionalConsents = {
        notifications: false,
        locationEnhancements: false,
      };

      const entry: ConsentAuditEntry = {
        id: `cns_${now}_${crypto.randomBytes(4).toString('hex')}`,
        action: 'refused',
        consentVersion: CURRENT_CONSENT_VERSION,
        termsVersion: CURRENT_TERMS_VERSION,
        privacyVersion: CURRENT_PRIVACY_VERSION,
        platform: params.platform,
        timestamp: now,
        ip: params.ip ?? null,
        optionalConsents: { ...emptyOptional },
        detail: `Consentement initial refusé sur ${params.platform.toUpperCase()} — accès bloqué`,
      };

      const record: UserConsentRecord = {
        userId: params.uid,
        email: params.email || existing?.email || null,
        status: 'refused',
        consentVersion: CURRENT_CONSENT_VERSION,
        termsVersion: CURRENT_TERMS_VERSION,
        privacyVersion: CURRENT_PRIVACY_VERSION,
        acceptedAt: existing?.acceptedAt ?? null,
        refusedAt: now,
        withdrawnAt: existing?.withdrawnAt ?? null,
        platform: params.platform,
        optionalConsents: emptyOptional,
        history: [entry, ...(existing?.history || [])].slice(0, 200),
        updatedAt: now,
      };

      this.data.userConsents[params.uid] = record;

      this.recordAuditLog({
        adminUid: params.uid,
        adminEmail: params.email || params.uid,
        adminRole: 'USER',
        action: 'FIRST_CONSENT_REFUSED',
        category: 'consent',
        targetUid: params.uid,
        targetEmail: params.email || null,
        oldValue: existing ? { status: existing.status } : { status: 'pending' },
        newValue: { status: 'refused', platform: params.platform },
        ip: params.ip ?? null,
        detail: `Consentement obligatoire refusé par ${params.email || params.uid} (${params.platform.toUpperCase()})`,
      });

      this.persist();
      return this.getUserConsentStatus(params.uid);
    } finally {
      this.consentLocks.delete(params.uid);
    }
  }

  public updateOptionalConsents(params: {
    uid: string;
    email: string | null;
    platform: ConsentPlatform;
    optionalConsents: Partial<OptionalConsents>;
    ip?: string | null;
  }): ConsentStatusResponse {
    const existing = this.data.userConsents[params.uid];
    if (!this.isConsentRecordValidForCurrentVersions(existing)) {
      throw new Error(
        'Le consentement initial obligatoire doit être accepté avant de modifier vos préférences facultatives.'
      );
    }

    const now = Date.now();
    const prevOptional = { ...existing.optionalConsents };
    const nextOptional: OptionalConsents = {
      notifications:
        typeof params.optionalConsents.notifications === 'boolean'
          ? params.optionalConsents.notifications
          : prevOptional.notifications,
      locationEnhancements:
        typeof params.optionalConsents.locationEnhancements === 'boolean'
          ? params.optionalConsents.locationEnhancements
          : prevOptional.locationEnhancements,
    };

    const entry: ConsentAuditEntry = {
      id: `cns_${now}_${crypto.randomBytes(4).toString('hex')}`,
      action: 'preferences_updated',
      consentVersion: existing.consentVersion,
      termsVersion: existing.termsVersion,
      privacyVersion: existing.privacyVersion,
      platform: params.platform,
      timestamp: now,
      ip: params.ip ?? null,
      optionalConsents: { ...nextOptional },
      detail: `Préférences facultatives modifiées (${params.platform.toUpperCase()}) : notifications=${nextOptional.notifications ? 'oui' : 'non'}, géolocalisation_avancée=${nextOptional.locationEnhancements ? 'oui' : 'non'}`,
    };

    existing.optionalConsents = nextOptional;
    existing.updatedAt = now;
    existing.history = [entry, ...(existing.history || [])].slice(0, 200);

    this.recordAuditLog({
      adminUid: params.uid,
      adminEmail: params.email || existing.email || params.uid,
      adminRole: 'USER',
      action: 'CONSENT_PREFERENCES_UPDATED',
      category: 'consent',
      targetUid: params.uid,
      targetEmail: params.email || existing.email || null,
      oldValue: prevOptional,
      newValue: nextOptional,
      ip: params.ip ?? null,
      detail: entry.detail,
    });

    this.persist();
    return this.getUserConsentStatus(params.uid);
  }

  public withdrawUserConsent(params: {
    uid: string;
    email: string | null;
    platform: ConsentPlatform;
    ip?: string | null;
  }): ConsentStatusResponse {
    const now = Date.now();
    const existing = this.data.userConsents[params.uid] || null;

    const emptyOptional: OptionalConsents = {
      notifications: false,
      locationEnhancements: false,
    };

    const entry: ConsentAuditEntry = {
      id: `cns_${now}_${crypto.randomBytes(4).toString('hex')}`,
      action: 'withdrawn',
      consentVersion: existing?.consentVersion || CURRENT_CONSENT_VERSION,
      termsVersion: existing?.termsVersion || CURRENT_TERMS_VERSION,
      privacyVersion: existing?.privacyVersion || CURRENT_PRIVACY_VERSION,
      platform: params.platform,
      timestamp: now,
      ip: params.ip ?? null,
      optionalConsents: { ...emptyOptional },
      detail: `Retrait du consentement demandé par l’utilisateur sur ${params.platform.toUpperCase()} (RGPD)`,
    };

    const record: UserConsentRecord = {
      userId: params.uid,
      email: params.email || existing?.email || null,
      status: 'withdrawn',
      consentVersion: existing?.consentVersion || CURRENT_CONSENT_VERSION,
      termsVersion: existing?.termsVersion || CURRENT_TERMS_VERSION,
      privacyVersion: existing?.privacyVersion || CURRENT_PRIVACY_VERSION,
      // Preserve historical proof of when consent was originally accepted
      acceptedAt: existing?.acceptedAt ?? null,
      refusedAt: existing?.refusedAt ?? null,
      withdrawnAt: now,
      platform: params.platform,
      optionalConsents: emptyOptional,
      history: [entry, ...(existing?.history || [])].slice(0, 200),
      updatedAt: now,
    };

    this.data.userConsents[params.uid] = record;

    this.recordAuditLog({
      adminUid: params.uid,
      adminEmail: params.email || existing?.email || params.uid,
      adminRole: 'USER',
      action: 'USER_CONSENT_WITHDRAWN',
      category: 'consent',
      targetUid: params.uid,
      targetEmail: params.email || existing?.email || null,
      oldValue: existing ? { status: existing.status } : { status: 'pending' },
      newValue: { status: 'withdrawn', platform: params.platform },
      ip: params.ip ?? null,
      detail: `Consentement retiré (RGPD) par ${params.email || params.uid}`,
    });

    this.persist();
    return this.getUserConsentStatus(params.uid);
  }

  public getAdminConsentsOverview(params?: {
    externalFirestoreUsers?: Array<{
      uid: string;
      email?: string | null;
      displayName?: string | null;
      photoURL?: string | null;
      createdAt?: number | null;
      lastActiveAt?: number | null;
    }>;
    statusFilter?: string;
    platformFilter?: string;
    search?: string;
  }): AdminConsentsOverviewResponse {
    const users = this.listAllUsersSummary(params?.externalFirestoreUsers);

    const rows: AdminConsentUserRow[] = users.map((u) => {
      const rec = this.data.userConsents[u.uid] || null;
      const accessAllowed = this.isConsentRecordValidForCurrentVersions(rec);
      return {
        uid: u.uid,
        email: u.email,
        displayName: u.displayName,
        status: rec ? rec.status : 'pending',
        consentVersion: rec?.consentVersion ?? null,
        termsVersion: rec?.termsVersion ?? null,
        privacyVersion: rec?.privacyVersion ?? null,
        acceptedAt: rec?.acceptedAt ?? null,
        refusedAt: rec?.refusedAt ?? null,
        withdrawnAt: rec?.withdrawnAt ?? null,
        platform: rec?.platform ?? null,
        optionalConsents: rec?.optionalConsents || {
          notifications: false,
          locationEnhancements: false,
        },
        accessAllowed,
        historyCount: rec?.history?.length || 0,
        updatedAt: rec?.updatedAt ?? null,
        accountCreatedAt: u.createdAt ?? null,
      };
    });

    const totalUsers = rows.length;
    const acceptedCount = rows.filter((r) => r.status === 'accepted' && r.accessAllowed).length;
    const refusedCount = rows.filter((r) => r.status === 'refused').length;
    const withdrawnCount = rows.filter((r) => r.status === 'withdrawn').length;
    const pendingCount = rows.filter(
      (r) => r.status === 'pending' || (r.status === 'accepted' && !r.accessAllowed)
    ).length;

    const acceptanceRatePct =
      totalUsers > 0 ? Math.round((acceptedCount / totalUsers) * 1000) / 10 : 0;

    const acceptedTimestamps = rows
      .map((r) => r.acceptedAt)
      .filter((ts): ts is number => typeof ts === 'number' && ts > 0);
    const lastAcceptedAt = acceptedTimestamps.length > 0 ? Math.max(...acceptedTimestamps) : null;

    const q = (params?.search || '').trim().toLowerCase();
    const statusFilter = params?.statusFilter || 'ALL';
    const platformFilter = params?.platformFilter || 'ALL';

    const filteredUsers = rows
      .filter((row) => {
        if (statusFilter !== 'ALL' && row.status !== statusFilter) return false;
        if (platformFilter !== 'ALL' && row.platform !== platformFilter) return false;
        if (!q) return true;
        return (
          row.uid.toLowerCase().includes(q) ||
          (row.email || '').toLowerCase().includes(q) ||
          (row.displayName || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (b.updatedAt || b.accountCreatedAt || 0) - (a.updatedAt || a.accountCreatedAt || 0));

    return {
      stats: {
        totalUsers,
        acceptedCount,
        refusedCount,
        pendingCount,
        withdrawnCount,
        acceptanceRatePct,
        lastAcceptedAt,
        currentConsentVersion: CURRENT_CONSENT_VERSION,
        currentTermsVersion: CURRENT_TERMS_VERSION,
        currentPrivacyVersion: CURRENT_PRIVACY_VERSION,
      },
      users: filteredUsers,
    };
  }

  public getAdminUserConsentDetail(uid: string): {
    status: ConsentStatusResponse;
    record: UserConsentRecord | null;
    email: string | null;
    displayName: string | null;
  } {
    const dir = this.getUserGovernance(uid);
    const sub = this.data.subscriptions[uid];
    const record = this.data.userConsents[uid] || null;
    return {
      status: this.getUserConsentStatus(uid),
      record,
      email: record?.email || dir?.email || sub?.email || null,
      displayName: dir?.displayName || null,
    };
  }
}

export const subscriptionStore = new SubscriptionStore();

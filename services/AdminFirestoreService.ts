import {
  Timestamp,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, getFirebaseStorage, handleFirestoreError, OperationType } from '../firebase';
import {
  AccessibilityRequestRecord,
  AccountStatus,
  ActivationRecord,
  ActivationSource,
  AdminConsentUserRow,
  AdminConsentsOverviewResponse,
  AdminNotificationRecord,
  AdminRole,
  AdminUserSummary,
  AndroidAppRelease,
  AndroidAppSettings,
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
  ConsentStatus,
  ConsentStatusResponse,
  PlanRegionalConfig,
  PlatformSettings,
  PresenceRecord,
  PresenceState,
  PriceChangeHistoryEntry,
  RedeemCodeRecord,
  SubscriptionPlan,
  SubscriptionStatus,
  SupportTicketRecord,
  SupportTicketStatus,
  UserConsentRecord,
  UserSanctionEntry,
  UserSubscription,
} from '../types';
import {
  DEFAULT_REGIONAL_PLANS,
  EARLY_TESTER_DURATION_MS,
  resolveEffectiveSubscription,
} from '../utils/subscriptionPlans';
import { buildRedeemOverviewStats, redeemFirestoreService } from './RedeemFirestoreService';
import {
  CLIENT_CONSENT_VERSION,
  CLIENT_PRIVACY_VERSION,
  CLIENT_TERMS_VERSION,
  buildDefaultPendingConsent,
} from './ConsentService';

const DAY_MS = 24 * 60 * 60 * 1000;
const SUPER_ADMIN_EMAILS = ['medbenhasan@gmail.com', 'medbenhasa@gmail.com'];

function toMs(val: any): number | null {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (val && typeof val.toMillis === 'function') return val.toMillis();
  if (val instanceof Date) return val.getTime();
  return null;
}

function isPermissionDeniedError(err: unknown): boolean {
  const code = String((err as any)?.code || '').toLowerCase();
  const msg = String(err instanceof Error ? err.message : err || '').toLowerCase();
  return code === 'permission-denied' || msg.includes('missing or insufficient permissions');
}

function createUniqueId(prefix: string): string {
  const bytes = new Uint8Array(4);
  globalThis.crypto.getRandomValues(bytes);
  const rand = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${prefix}_${Date.now()}_${rand}`;
}

export async function sha256LowerHex(value: string): Promise<string> {
  const clean = value.trim().toLowerCase();
  const data = new TextEncoder().encode(clean);
  const hashBuf = await globalThis.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function isSuperAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return SUPER_ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

function requireSignedInUser() {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Authentification requise.');
  }
  return user;
}

function requireSuperAdminUser() {
  const user = requireSignedInUser();
  if (!user.emailVerified || !isSuperAdminEmail(user.email)) {
    throw new Error('Accès refusé : privilèges Super Admin vérifiés requis.');
  }
  return user;
}

export function createDefaultPlatformSettings(): PlatformSettings {
  const planPrices: PlatformSettings['planPrices'] = {
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
    regionalPlans: {
      FREE: { ...DEFAULT_REGIONAL_PLANS.FREE },
      PREMIUM: { ...DEFAULT_REGIONAL_PLANS.PREMIUM },
      FAMILY: { ...DEFAULT_REGIONAL_PLANS.FAMILY },
      BUSINESS: { ...DEFAULT_REGIONAL_PLANS.BUSINESS },
    },
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

function normalizePlatformSettings(raw?: Record<string, any> | null): PlatformSettings {
  const defaults = createDefaultPlatformSettings();
  if (!raw) return defaults;

  const planPrices = {
    ...defaults.planPrices,
    ...(raw.planPrices || {}),
  };

  const rawRegional = raw.regionalPlans || {};
  const regionalPlans: Record<SubscriptionPlan, PlanRegionalConfig> = {
    FREE: {
      ...DEFAULT_REGIONAL_PLANS.FREE,
      ...(rawRegional.FREE || {}),
      id: 'FREE',
      enabled: rawRegional.FREE?.enabled ?? true,
      monthlyPriceTnd: 0,
      annualPriceTnd: 0,
      monthlyPriceEur: 0,
      annualPriceEur: 0,
    },
    PREMIUM: {
      ...DEFAULT_REGIONAL_PLANS.PREMIUM,
      ...(rawRegional.PREMIUM || {}),
      id: 'PREMIUM',
      enabled: rawRegional.PREMIUM?.enabled ?? true,
      monthlyPriceTnd: rawRegional.PREMIUM?.monthlyPriceTnd ?? planPrices.premiumMonthlyTnd,
      annualPriceTnd: rawRegional.PREMIUM?.annualPriceTnd ?? planPrices.premiumAnnualTnd,
      monthlyPriceEur: rawRegional.PREMIUM?.monthlyPriceEur ?? planPrices.premiumMonthlyEur,
      annualPriceEur: rawRegional.PREMIUM?.annualPriceEur ?? planPrices.premiumAnnualEur,
    },
    FAMILY: {
      ...DEFAULT_REGIONAL_PLANS.FAMILY,
      ...(rawRegional.FAMILY || {}),
      id: 'FAMILY',
      enabled: rawRegional.FAMILY?.enabled ?? true,
      monthlyPriceTnd: rawRegional.FAMILY?.monthlyPriceTnd ?? planPrices.familyMonthlyTnd,
      annualPriceTnd: rawRegional.FAMILY?.annualPriceTnd ?? planPrices.familyAnnualTnd,
      monthlyPriceEur: rawRegional.FAMILY?.monthlyPriceEur ?? planPrices.familyMonthlyEur,
      annualPriceEur: rawRegional.FAMILY?.annualPriceEur ?? planPrices.familyAnnualEur,
    },
    BUSINESS: {
      ...DEFAULT_REGIONAL_PLANS.BUSINESS,
      ...(rawRegional.BUSINESS || {}),
      id: 'BUSINESS',
      enabled: rawRegional.BUSINESS?.enabled ?? true,
      customPricing: true,
    },
  };

  return {
    platformName: String(raw.platformName || defaults.platformName),
    logoUrl: String(raw.logoUrl ?? defaults.logoUrl),
    contactEmail: String(raw.contactEmail || defaults.contactEmail),
    supportEmail: String(raw.supportEmail || defaults.supportEmail),
    planPrices,
    regionalPlans,
    pioneerProgramEnabled: raw.pioneerProgramEnabled ?? defaults.pioneerProgramEnabled,
    pioneerDurationDays: Number(raw.pioneerDurationDays || defaults.pioneerDurationDays),
    accessibilityProgramEnabled:
      raw.accessibilityProgramEnabled ?? defaults.accessibilityProgramEnabled,
    notificationsEnabled: raw.notificationsEnabled ?? defaults.notificationsEnabled,
    maintenanceMode: Boolean(raw.maintenanceMode),
    maintenanceMessage: String(raw.maintenanceMessage ?? defaults.maintenanceMessage),
    announcementEnabled: Boolean(raw.announcementEnabled),
    announcementText: String(raw.announcementText ?? ''),
    announcementType:
      raw.announcementType === 'warning' || raw.announcementType === 'success'
        ? raw.announcementType
        : 'info',
    securitySettings: {
      ...defaults.securitySettings,
      ...(raw.securitySettings || {}),
      delegatedAdminEmails: Array.isArray(raw.securitySettings?.delegatedAdminEmails)
        ? raw.securitySettings.delegatedAdminEmails
        : [],
      permissionMatrix: {
        ...defaults.securitySettings.permissionMatrix,
        ...(raw.securitySettings?.permissionMatrix || {}),
      },
    },
    updatedAt: toMs(raw.updatedAt) ?? defaults.updatedAt,
    updatedBy: String(raw.updatedBy || defaults.updatedBy),
  };
}

export function createDefaultAndroidAppSettings(): AndroidAppSettings {
  return {
    downloadsEnabled: true,
    appName: 'VruGuard',
    packageName: 'com.vruguard.sentinel',
    description:
      'Application Android VruGuard pour la localisation intelligente, les alertes de proximité VRU, la navigation adaptée et l’assistance SOS.',
    minSupportedVersionCode: 1,
    retentionKeepCount: 3,
    maxApkSizeBytes: 200 * 1024 * 1024,
    updatedAt: Date.now(),
    updatedBy: 'system',
  };
}

function normalizeAndroidAppSettings(raw?: Record<string, any> | null): AndroidAppSettings {
  const d = createDefaultAndroidAppSettings();
  if (!raw) return d;
  return {
    downloadsEnabled: raw.downloadsEnabled ?? d.downloadsEnabled,
    appName: String(raw.appName || d.appName),
    packageName: String(raw.packageName || d.packageName),
    description: String(raw.description ?? d.description),
    minSupportedVersionCode: Number(raw.minSupportedVersionCode || d.minSupportedVersionCode),
    retentionKeepCount: Number(raw.retentionKeepCount || d.retentionKeepCount),
    maxApkSizeBytes: Number(raw.maxApkSizeBytes || d.maxApkSizeBytes),
    updatedAt: toMs(raw.updatedAt) ?? d.updatedAt,
    updatedBy: String(raw.updatedBy || d.updatedBy),
  };
}

function computePresenceFromPublicProfile(
  uid: string,
  profile: Record<string, any> | undefined,
  nowMs: number
): PresenceRecord {
  const lastActiveMs = toMs(profile?.lastActiveAt) ?? 0;
  const isOnlineFlag = Boolean(profile?.online);
  let state: PresenceState = 'offline';
  if (lastActiveMs > 0) {
    const age = nowMs - lastActiveMs;
    if (isOnlineFlag && age <= 65_000) {
      state = 'online';
    } else if (age <= 140_000) {
      state = 'idle';
    }
  }
  return {
    uid,
    state,
    lastHeartbeatAt: lastActiveMs,
    lastInteractionAt: lastActiveMs,
  };
}

function mapFirestoreSubscription(
  uid: string,
  subData: Record<string, any> | undefined,
  earlyData: Record<string, any> | undefined,
  email: string | null,
  nowMs: number
): UserSubscription {
  const earlyActive = Boolean(earlyData?.active);
  return resolveEffectiveSubscription(
    {
      uid,
      email: subData?.email ?? email,
      plan: (subData?.basePlan || subData?.plan || 'FREE') as SubscriptionPlan,
      status: (subData?.status || 'active') as SubscriptionStatus,
      billingCycle: (subData?.billingCycle || 'monthly') as BillingCycle,
      startDate: toMs(subData?.startDate) ?? nowMs,
      endDate: toMs(subData?.endDate),
      isLifetime: Boolean(
        subData?.isLifetime ||
          (subData?.endDate === null && subData?.plan && subData.plan !== 'FREE')
      ),
      cancelAtPeriodEnd: Boolean(subData?.cancelAtPeriodEnd),
      isEarlyTester: Boolean(subData?.isEarlyTester || earlyActive),
      earlyTesterStartDate: toMs(subData?.earlyTesterStartDate) ?? toMs(earlyData?.startDate),
      earlyTesterEndDate: toMs(subData?.earlyTesterEndDate) ?? toMs(earlyData?.endDate),
      isAccessibilityLifetime:
        subData?.paymentProvider === 'accessibility' || Boolean(subData?.isAccessibilityLifetime),
      activationSource: subData?.activationSource,
      paymentProvider: subData?.paymentProvider ?? (earlyActive ? 'early_tester' : null),
      paymentVerified: Boolean(subData?.paymentVerified || earlyActive),
      lastPaymentRef: subData?.lastPaymentRef ?? null,
      updatedAt: toMs(subData?.updatedAt) ?? nowMs,
    },
    nowMs
  );
}

function sanitizeRole(rawRole: any, email: string | null, delegatedEmails: string[]): AdminRole {
  if (isSuperAdminEmail(email)) return 'SUPER_ADMIN';
  if (email && delegatedEmails.includes(email.trim().toLowerCase())) return 'ADMIN';
  if (rawRole === 'SUPER_ADMIN' || rawRole === 'ADMIN') return rawRole;
  return 'OPERATOR';
}

function resolveAccountGovernance(
  govData: Record<string, any> | undefined,
  nowMs: number
): {
  accountStatus: AccountStatus;
  suspensionReason: string | null;
  suspensionExpiresAt: number | null;
  banReason: string | null;
  bannedAt: number | null;
  softDeletedAt: number | null;
  deletionReason: string | null;
  revokedAfter: number | null;
  sanctionHistory: UserSanctionEntry[];
} {
  if (!govData) {
    return {
      accountStatus: 'active',
      suspensionReason: null,
      suspensionExpiresAt: null,
      banReason: null,
      bannedAt: null,
      softDeletedAt: null,
      deletionReason: null,
      revokedAfter: null,
      sanctionHistory: [],
    };
  }
  let accountStatus: AccountStatus =
    govData.accountStatus === 'suspended' ||
    govData.accountStatus === 'banned' ||
    govData.accountStatus === 'soft_deleted'
      ? govData.accountStatus
      : 'active';
  const suspensionExpiresAt = toMs(govData.suspensionExpiresAt);
  if (accountStatus === 'suspended' && suspensionExpiresAt && suspensionExpiresAt <= nowMs) {
    accountStatus = 'active';
  }
  return {
    accountStatus,
    suspensionReason: govData.suspensionReason ?? null,
    suspensionExpiresAt,
    banReason: govData.banReason ?? null,
    bannedAt: toMs(govData.bannedAt),
    softDeletedAt: toMs(govData.softDeletedAt),
    deletionReason: govData.deletionReason ?? null,
    revokedAfter: toMs(govData.revokedAfter),
    sanctionHistory: Array.isArray(govData.sanctionHistory) ? govData.sanctionHistory : [],
  };
}

async function getStoredPlatformSettings(): Promise<PlatformSettings> {
  try {
    const snap = await getDoc(doc(db, 'platform_config', 'global'));
    return normalizePlatformSettings(snap.exists() ? (snap.data() as Record<string, any>) : null);
  } catch {
    return createDefaultPlatformSettings();
  }
}

async function enforceRecentReauthIfRequired(): Promise<void> {
  const user = requireSuperAdminUser();
  const settings = await getStoredPlatformSettings();
  if (!settings.securitySettings?.requireReauthForCriticalActions) {
    return;
  }
  const tokenResult = await user.getIdTokenResult();
  const authTimeMs = Date.parse(tokenResult.authTime);
  if (!Number.isFinite(authTimeMs) || Date.now() - authTimeMs > 30 * 60 * 1000) {
    throw Object.assign(
      new Error('Ré-authentification récente (< 30 min) requise pour cette action critique.'),
      { code: 'REAUTH_REQUIRED' }
    );
  }
}

async function writeAuditLog(entry: {
  action: string;
  category: AuditCategory;
  targetUid?: string | null;
  targetEmail?: string | null;
  targetId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  outcome?: 'success' | 'denied' | 'failed';
  detail: string;
}): Promise<void> {
  const current = auth.currentUser;
  if (!current) return;
  const id = createUniqueId('aud');
  const logDoc: AuditLogEntry = {
    id,
    timestamp: Date.now(),
    adminUid: current.uid,
    adminEmail: (current.email || current.uid).slice(0, 256),
    adminRole: isSuperAdminEmail(current.email) ? 'SUPER_ADMIN' : 'USER',
    action: entry.action.slice(0, 100),
    category: entry.category,
    targetUid: entry.targetUid ?? null,
    targetEmail: entry.targetEmail ?? null,
    targetId: entry.targetId ?? null,
    oldValue: entry.oldValue !== undefined ? JSON.parse(JSON.stringify(entry.oldValue)) : null,
    newValue: entry.newValue !== undefined ? JSON.parse(JSON.stringify(entry.newValue)) : null,
    outcome: entry.outcome || 'success',
    ip: null,
    detail: entry.detail.slice(0, 1000),
  };
  await setDoc(doc(db, 'admin_audit_logs', id), logDoc).catch(() => {});
}

async function loadJoinedUserDirectory(): Promise<{
  users: AdminUserSummary[];
  settings: PlatformSettings;
}> {
  const [usersSnap, profilesSnap, subsSnap, earlySnap, govSnap, settings] = await Promise.all([
    getDocs(collection(db, 'users')).catch((err) => {
      if (isPermissionDeniedError(err)) handleFirestoreError(err, OperationType.LIST, 'users');
      return null;
    }),
    getDocs(collection(db, 'public_profiles')).catch(() => null),
    getDocs(collection(db, 'subscriptions')).catch(() => null),
    getDocs(collection(db, 'early_testers')).catch(() => null),
    getDocs(collection(db, 'user_governance')).catch(() => null),
    getStoredPlatformSettings(),
  ]);

  const delegated = (settings.securitySettings?.delegatedAdminEmails || []).map((e) =>
    e.toLowerCase()
  );

  const usersMap = new Map<string, Record<string, any>>();
  usersSnap?.docs.forEach((d) => usersMap.set(d.id, d.data() as Record<string, any>));

  const profileMap = new Map<string, Record<string, any>>();
  profilesSnap?.docs.forEach((d) => profileMap.set(d.id, d.data() as Record<string, any>));

  const subMap = new Map<string, Record<string, any>>();
  subsSnap?.docs.forEach((d) => subMap.set(d.id, d.data() as Record<string, any>));

  const earlyMap = new Map<string, Record<string, any>>();
  earlySnap?.docs.forEach((d) => earlyMap.set(d.id, d.data() as Record<string, any>));

  const govMap = new Map<string, Record<string, any>>();
  govSnap?.docs.forEach((d) => govMap.set(d.id, d.data() as Record<string, any>));

  const allUids = new Set<string>([
    ...usersMap.keys(),
    ...subMap.keys(),
    ...govMap.keys(),
  ]);

  const nowMs = Date.now();
  const summaries: AdminUserSummary[] = [];

  for (const uid of allUids) {
    const u = usersMap.get(uid);
    const p = profileMap.get(uid);
    const s = subMap.get(uid);
    const e = earlyMap.get(uid);
    const g = govMap.get(uid);

    const email: string | null = u?.email ?? s?.email ?? g?.email ?? null;
    const displayName: string | null = u?.displayName ?? p?.displayName ?? null;
    const photoURL: string | null = u?.photoURL ?? p?.photoURL ?? null;
    const createdAt = toMs(u?.createdAt);
    const presence = computePresenceFromPublicProfile(uid, p, nowMs);
    const subscription = mapFirestoreSubscription(uid, s, e, email, nowMs);
    const gov = resolveAccountGovernance(g, nowMs);

    summaries.push({
      uid,
      email,
      displayName,
      photoURL,
      emailVerified: isSuperAdminEmail(email) ? true : Boolean(u?.emailVerified),
      role: sanitizeRole(u?.role, email, delegated),
      createdAt,
      lastLoginAt: presence.lastHeartbeatAt > 0 ? presence.lastHeartbeatAt : createdAt,
      accountStatus: gov.accountStatus,
      suspensionReason: gov.suspensionReason,
      suspensionExpiresAt: gov.suspensionExpiresAt,
      banReason: gov.banReason,
      bannedAt: gov.bannedAt,
      softDeletedAt: gov.softDeletedAt,
      presence,
      subscription,
      sanctionHistory: gov.sanctionHistory,
    });
  }

  return { users: summaries, settings };
}

function buildSubscriptionWritePayload(
  uid: string,
  sub: UserSubscription,
  redeemCodeHash?: string | null
): Record<string, any> {
  return {
    uid,
    email: sub.email ?? null,
    plan: sub.plan,
    basePlan: sub.plan,
    status: sub.status,
    billingCycle: sub.billingCycle,
    startDate: Timestamp.fromMillis(sub.startDate || Date.now()),
    endDate: sub.endDate ? Timestamp.fromMillis(sub.endDate) : null,
    isLifetime: Boolean(sub.isLifetime),
    cancelAtPeriodEnd: Boolean(sub.cancelAtPeriodEnd),
    isEarlyTester: Boolean(sub.isEarlyTester),
    earlyTesterStartDate: sub.earlyTesterStartDate
      ? Timestamp.fromMillis(sub.earlyTesterStartDate)
      : null,
    earlyTesterEndDate: sub.earlyTesterEndDate
      ? Timestamp.fromMillis(sub.earlyTesterEndDate)
      : null,
    activationSource: sub.activationSource || 'admin',
    paymentProvider: sub.paymentProvider ?? 'admin',
    paymentVerified: Boolean(sub.paymentVerified),
    lastPaymentRef: sub.lastPaymentRef ?? null,
    redeemCodeHash: redeemCodeHash ?? null,
    updatedAt: Timestamp.fromMillis(sub.updatedAt || Date.now()),
  };
}

function buildConsentStatusFromDoc(
  raw: Record<string, any> | undefined
): { status: ConsentStatusResponse; record: UserConsentRecord | null } {
  if (!raw) {
    return { status: buildDefaultPendingConsent('web'), record: null };
  }
  const consentStatus: ConsentStatus =
    raw.status === 'accepted' ||
    raw.status === 'refused' ||
    raw.status === 'withdrawn'
      ? raw.status
      : 'pending';
  const consentVersion = typeof raw.consentVersion === 'string' ? raw.consentVersion : null;
  const termsVersion = typeof raw.termsVersion === 'string' ? raw.termsVersion : null;
  const privacyVersion = typeof raw.privacyVersion === 'string' ? raw.privacyVersion : null;
  const acceptedAt = toMs(raw.acceptedAt);
  const refusedAt = toMs(raw.refusedAt);
  const withdrawnAt = toMs(raw.withdrawnAt);
  const updatedAt = toMs(raw.updatedAt);
  const platform: ConsentPlatform = raw.platform === 'android' ? 'android' : 'web';
  const optionalConsents = {
    notifications: Boolean(raw.optionalConsents?.notifications),
    locationEnhancements: Boolean(raw.optionalConsents?.locationEnhancements),
  };
  const matchesCurrentVersions =
    consentVersion === CLIENT_CONSENT_VERSION &&
    termsVersion === CLIENT_TERMS_VERSION &&
    privacyVersion === CLIENT_PRIVACY_VERSION;
  const accessAllowed = consentStatus === 'accepted' && matchesCurrentVersions && acceptedAt !== null;

  const history: ConsentAuditEntry[] = [];
  if (acceptedAt) {
    history.push({
      id: `accept_${acceptedAt}`,
      action: 'accepted',
      consentVersion: consentVersion || CLIENT_CONSENT_VERSION,
      termsVersion: termsVersion || CLIENT_TERMS_VERSION,
      privacyVersion: privacyVersion || CLIENT_PRIVACY_VERSION,
      platform,
      timestamp: acceptedAt,
      optionalConsents,
      detail: 'Consentement requis accepté (CGU & Politique de confidentialité).',
    });
  }
  if (refusedAt) {
    history.push({
      id: `refuse_${refusedAt}`,
      action: 'refused',
      consentVersion: consentVersion || CLIENT_CONSENT_VERSION,
      termsVersion: termsVersion || CLIENT_TERMS_VERSION,
      privacyVersion: privacyVersion || CLIENT_PRIVACY_VERSION,
      platform,
      timestamp: refusedAt,
      optionalConsents,
      detail: 'Consentement refusé par l’utilisateur.',
    });
  }
  if (withdrawnAt) {
    history.push({
      id: `withdraw_${withdrawnAt}`,
      action: 'withdrawn',
      consentVersion: consentVersion || CLIENT_CONSENT_VERSION,
      termsVersion: termsVersion || CLIENT_TERMS_VERSION,
      privacyVersion: privacyVersion || CLIENT_PRIVACY_VERSION,
      platform,
      timestamp: withdrawnAt,
      optionalConsents,
      detail: 'Consentement retiré (RGPD).',
    });
  }
  if (updatedAt && updatedAt !== acceptedAt && updatedAt !== refusedAt && updatedAt !== withdrawnAt) {
    history.push({
      id: `prefs_${updatedAt}`,
      action: 'preferences_updated',
      consentVersion: consentVersion || CLIENT_CONSENT_VERSION,
      termsVersion: termsVersion || CLIENT_TERMS_VERSION,
      privacyVersion: privacyVersion || CLIENT_PRIVACY_VERSION,
      platform,
      timestamp: updatedAt,
      optionalConsents,
      detail: 'Préférences optionnelles mises à jour.',
    });
  }
  history.sort((a, b) => b.timestamp - a.timestamp);

  const statusObj: ConsentStatusResponse = {
    consentStatus,
    consentVersion,
    termsVersion,
    privacyVersion,
    currentConsentVersion: CLIENT_CONSENT_VERSION,
    currentTermsVersion: CLIENT_TERMS_VERSION,
    currentPrivacyVersion: CLIENT_PRIVACY_VERSION,
    acceptedAt,
    refusedAt,
    withdrawnAt,
    platform,
    accessAllowed,
    requiresConsent: !accessAllowed,
    optionalConsents,
    historyCount: history.length,
    updatedAt,
  };

  const record: UserConsentRecord = {
    userId: String(raw.userId || ''),
    email: raw.email ?? null,
    status: consentStatus,
    consentVersion: consentVersion || CLIENT_CONSENT_VERSION,
    termsVersion: termsVersion || CLIENT_TERMS_VERSION,
    privacyVersion: privacyVersion || CLIENT_PRIVACY_VERSION,
    acceptedAt,
    refusedAt,
    withdrawnAt,
    platform,
    optionalConsents,
    history,
    updatedAt: updatedAt || Date.now(),
  };

  return { status: statusObj, record };
}

function normalizeAndroidAppRelease(
  raw: Record<string, any>,
  fallbackId?: string
): AndroidAppRelease {
  const whatsNew = Array.isArray(raw.whatsNew)
    ? raw.whatsNew.map((line) => String(line)).filter(Boolean)
    : [];
  const externalDownloadUrl =
    typeof raw.externalDownloadUrl === 'string' && raw.externalDownloadUrl.trim()
      ? raw.externalDownloadUrl.trim()
      : null;
  const storagePath =
    typeof raw.storagePath === 'string' && raw.storagePath.trim() ? raw.storagePath.trim() : null;
  const uploadedByEmail = String(raw.uploadedByEmail || raw.uploadedBy || 'admin');

  const storageModeRaw = raw.storageMode;
  const storageMode: AndroidAppRelease['storageMode'] =
    storageModeRaw === 'express' ||
    storageModeRaw === 'firebase_storage' ||
    storageModeRaw === 'firestore_chunks' ||
    storageModeRaw === 'external_url'
      ? storageModeRaw
      : externalDownloadUrl
      ? 'external_url'
      : undefined;
  const chunkCount =
    typeof raw.chunkCount === 'number' && Number.isFinite(raw.chunkCount) ? raw.chunkCount : 0;

  return {
    id: String(raw.id || fallbackId || ''),
    appName: String(raw.appName || 'VruGuard'),
    packageName: String(raw.packageName || 'com.vruguard.sentinel'),
    versionName: String(raw.versionName || '1.0.0'),
    versionCode: Number(raw.versionCode || 1),
    fileName: String(raw.fileName || `VruGuard-v${raw.versionName || '1.0.0'}.apk`),
    fileSize: Number(raw.fileSize || 0),
    sha256: String(raw.sha256 || ''),
    mimeType: String(raw.mimeType || 'application/vnd.android.package-archive'),
    description: String(raw.description || ''),
    whatsNew,
    releaseDate: String(raw.releaseDate || ''),
    publishedAt: toMs(raw.publishedAt),
    status:
      raw.status === 'published' || raw.status === 'disabled' || raw.status === 'draft'
        ? raw.status
        : 'draft',
    minAndroidVersion: String(raw.minAndroidVersion || 'Android 8.0 Oreo (API 26)'),
    minAndroidApi: Number(raw.minAndroidApi || 26),
    updateType:
      raw.updateType === 'mandatory' || raw.updateType === 'recommended' ? raw.updateType : 'optional',
    minSupportedVersionCode:
      typeof raw.minSupportedVersionCode === 'number' ? raw.minSupportedVersionCode : null,
    isCurrent: Boolean(raw.isCurrent),
    isArchived: Boolean(raw.isArchived),
    hasBackup: Boolean(raw.hasBackup || externalDownloadUrl || chunkCount > 0),
    fileAvailable:
      typeof raw.fileAvailable === 'boolean'
        ? raw.fileAvailable
        : Boolean(externalDownloadUrl || chunkCount > 0),
    downloadsInitiated: Number(raw.downloadsInitiated || 0),
    downloadsCompleted: Number(raw.downloadsCompleted || 0),
    lastDownloadedAt: toMs(raw.lastDownloadedAt),
    uploadedByUid: String(raw.uploadedByUid || ''),
    uploadedByEmail,
    uploadedBy: String(raw.uploadedBy || uploadedByEmail),
    externalDownloadUrl,
    storagePath,
    storageMode,
    chunkCount,
    createdAt: toMs(raw.createdAt) ?? Date.now(),
    updatedAt: toMs(raw.updatedAt) ?? Date.now(),
  };
}

const APK_FIRESTORE_CHUNK_BYTES = 600 * 1024;
const MAX_FIRESTORE_CHUNKS_APK_BYTES = 45 * 1024 * 1024;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const parts: string[] = [];
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    parts.push(String.fromCharCode(...bytes.subarray(i, i + step)));
  }
  return btoa(parts.join(''));
}

function base64ToUint8Array(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function validateExternalApkUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Lien de téléchargement APK externe invalide (URL complète https:// requise).');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Le lien APK externe doit commencer par https:// ou http://.');
  }
  if (trimmed.length > 1024) {
    throw new Error('Le lien APK externe dépasse 1024 caractères.');
  }
  return trimmed;
}

async function inspectApkAndComputeSha256(
  file: File
): Promise<{ sha256: string; fileSize: number }> {
  if (!file.name.toLowerCase().endsWith('.apk')) {
    throw new Error('Fichier rejeté : veuillez sélectionner un paquet Android (.apk).');
  }
  if (file.size < 128) {
    throw new Error('Fichier APK vide ou invalide.');
  }

  const headSlice = await file.slice(0, Math.min(file.size, 1024 * 1024)).arrayBuffer();
  const headBytes = new Uint8Array(headSlice);
  // Standard ZIP local file header: PK\x03\x04
  if (
    headBytes.length < 4 ||
    headBytes[0] !== 0x50 ||
    headBytes[1] !== 0x4b ||
    headBytes[2] !== 0x03 ||
    headBytes[3] !== 0x04
  ) {
    throw new Error('Fichier APK invalide : archive ZIP (signature PK) non reconnue.');
  }

  const decoder = new TextDecoder('latin1');
  let hasManifest = decoder.decode(headBytes).includes('AndroidManifest.xml');
  if (!hasManifest && file.size > headBytes.length) {
    const tailStart = Math.max(0, file.size - 2 * 1024 * 1024);
    const tailSlice = await file.slice(tailStart, file.size).arrayBuffer();
    hasManifest = decoder.decode(new Uint8Array(tailSlice)).includes('AndroidManifest.xml');
  }
  if (!hasManifest) {
    throw new Error('Fichier APK invalide : AndroidManifest.xml introuvable dans le paquet.');
  }

  const fullBuffer = await file.arrayBuffer();
  const digest = await globalThis.crypto.subtle.digest('SHA-256', fullBuffer);
  const sha256 = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return { sha256, fileSize: file.size };
}

function buildAndroidStats(releases: AndroidAppRelease[]): AndroidDownloadStats {
  const totalInitiated = releases.reduce((s, r) => s + (r.downloadsInitiated || 0), 0);
  const totalCompleted = releases.reduce((s, r) => s + (r.downloadsCompleted || 0), 0);
  const lastDownloadedAt = releases.reduce<number | null>(
    (max, r) => (r.lastDownloadedAt && (!max || r.lastDownloadedAt > max) ? r.lastDownloadedAt : max),
    null
  );
  const storageUsedBytes = releases.reduce((s, r) => s + (r.fileSize || 0), 0);

  const days = 14;
  const dailySeries: AndroidDownloadStats['dailySeries'] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * DAY_MS);
    const iso = d.toISOString().slice(0, 10);
    dailySeries.push({
      date: iso,
      label: d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
      initiated: 0,
      completed: 0,
    });
  }

  return {
    totalInitiated,
    totalCompleted,
    todayInitiated: 0,
    todayCompleted: 0,
    weekInitiated: 0,
    weekCompleted: 0,
    lastDownloadedAt,
    storageUsedBytes,
    storageAvailableBytes: null,
    byVersion: releases.map((r) => ({
      releaseId: r.id,
      versionName: r.versionName,
      versionCode: r.versionCode,
      status: r.status,
      isCurrent: r.isCurrent,
      initiated: r.downloadsInitiated || 0,
      completed: r.downloadsCompleted || 0,
      lastDownloadedAt: r.lastDownloadedAt ?? null,
    })),
    dailySeries,
  };
}

export const adminFirestoreService = {
  // ===============================================================
  // 1. Public Config & Session Governance (All Users)
  // ===============================================================

  async getPublicPlatformConfig(): Promise<{
    platformName: string;
    logoUrl: string;
    contactEmail: string;
    supportEmail: string;
    planPrices: PlatformSettings['planPrices'];
    regionalPlans: Record<SubscriptionPlan, PlanRegionalConfig>;
    pioneerProgramEnabled: boolean;
    accessibilityProgramEnabled: boolean;
    maintenanceMode: boolean;
    maintenanceMessage: string;
    announcementEnabled: boolean;
    announcementText: string;
    announcementType: 'info' | 'warning' | 'success';
  }> {
    const s = await getStoredPlatformSettings();
    return {
      platformName: s.platformName,
      logoUrl: s.logoUrl,
      contactEmail: s.contactEmail,
      supportEmail: s.supportEmail,
      planPrices: s.planPrices,
      regionalPlans: s.regionalPlans || { ...DEFAULT_REGIONAL_PLANS },
      pioneerProgramEnabled: s.pioneerProgramEnabled,
      accessibilityProgramEnabled: s.accessibilityProgramEnabled,
      maintenanceMode: s.maintenanceMode,
      maintenanceMessage: s.maintenanceMessage,
      announcementEnabled: s.announcementEnabled,
      announcementText: s.announcementText,
      announcementType: s.announcementType,
    };
  },

  async getUserGovernanceStatus(
    uid: string,
    authTimeMs?: number
  ): Promise<{
    restricted: boolean;
    accountStatus: AccountStatus;
    restrictionReason: string | null;
    sessionRevoked: boolean;
  }> {
    try {
      const snap = await getDoc(doc(db, 'user_governance', uid));
      if (!snap.exists()) {
        return {
          restricted: false,
          accountStatus: 'active',
          restrictionReason: null,
          sessionRevoked: false,
        };
      }
      const gov = resolveAccountGovernance(snap.data() as Record<string, any>, Date.now());
      const sessionRevoked =
        Boolean(gov.revokedAfter && authTimeMs && gov.revokedAfter > authTimeMs);
      if (gov.accountStatus === 'banned') {
        return {
          restricted: true,
          accountStatus: 'banned',
          restrictionReason: gov.banReason || 'Votre compte a été banni par l’administration.',
          sessionRevoked,
        };
      }
      if (gov.accountStatus === 'suspended') {
        return {
          restricted: true,
          accountStatus: 'suspended',
          restrictionReason:
            gov.suspensionReason || 'Votre compte est temporairement suspendu par l’administration.',
          sessionRevoked,
        };
      }
      if (gov.accountStatus === 'soft_deleted') {
        return {
          restricted: true,
          accountStatus: 'soft_deleted',
          restrictionReason: gov.deletionReason || 'Ce compte a été désactivé par l’administration.',
          sessionRevoked,
        };
      }
      if (sessionRevoked) {
        return {
          restricted: true,
          accountStatus: 'active',
          restrictionReason: 'Votre session a été révoquée par l’administration.',
          sessionRevoked: true,
        };
      }
      return {
        restricted: false,
        accountStatus: 'active',
        restrictionReason: null,
        sessionRevoked: false,
      };
    } catch {
      return {
        restricted: false,
        accountStatus: 'active',
        restrictionReason: null,
        sessionRevoked: false,
      };
    }
  },

  async getUnreadNotificationsForUser(
    uid: string,
    email: string | null,
    effectivePlan: SubscriptionPlan
  ): Promise<AdminNotificationRecord[]> {
    try {
      const scopes = Array.from(new Set(['all', effectivePlan]));
      const queries = [
        getDocs(query(collection(db, 'admin_notifications'), where('targetScope', 'in', scopes))),
        getDocs(query(collection(db, 'admin_notifications'), where('targetUid', '==', uid))),
      ];
      const lowerEmail = email?.trim().toLowerCase() || '';
      if (lowerEmail && email) {
        queries.push(
          getDocs(
            query(
              collection(db, 'admin_notifications'),
              where('targetEmail', '==', email.trim())
            )
          )
        );
      }
      const snaps = await Promise.all(queries.map((p) => p.catch(() => null)));
      const byId = new Map<string, AdminNotificationRecord>();
      snaps.forEach((snap) => {
        snap?.docs.forEach((d) => {
          const item = d.data() as AdminNotificationRecord;
          byId.set(item.id || d.id, item);
        });
      });

      return Array.from(byId.values())
        .filter((n) => {
          if (Array.isArray(n.readByUids) && n.readByUids.includes(uid)) return false;
          if (n.targetScope === 'specific_user') {
            return (
              (n.targetUid && n.targetUid === uid) ||
              (n.targetEmail && n.targetEmail.trim().toLowerCase() === lowerEmail)
            );
          }
          return n.targetScope === 'all' || n.targetScope === effectivePlan;
        })
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    } catch {
      return [];
    }
  },

  async markNotificationRead(notifId: string, uid: string): Promise<void> {
    try {
      await updateDoc(doc(db, 'admin_notifications', notifId), {
        readByUids: arrayUnion(uid),
      });
    } catch {
      // ignore non-critical notification ack errors
    }
  },

  async checkWhitelistedPioneerForUser(email: string | null): Promise<{
    startDate: number;
    endDate: number;
    note?: string;
  } | null> {
    if (!email) return null;
    try {
      const hash = await sha256LowerHex(email);
      const snap = await getDoc(doc(db, 'early_tester_whitelist', hash));
      if (!snap.exists()) return null;
      const data = snap.data() as Record<string, any>;
      const startDate = toMs(data.startDate) ?? Date.now();
      const endDate = toMs(data.endDate) ?? startDate + EARLY_TESTER_DURATION_MS;
      if (endDate <= Date.now()) return null;
      return { startDate, endDate, note: data.note ?? undefined };
    } catch {
      return null;
    }
  },

  async logUnauthorizedRouteAttempt(): Promise<void> {
    const user = auth.currentUser;
    if (!user) return;
    await writeAuditLog({
      action: 'UNAUTHORIZED_SUPER_ADMIN_ROUTE',
      category: 'security',
      targetUid: user.uid,
      targetEmail: user.email || null,
      outcome: 'denied',
      detail: `Tentative d’accès non autorisée à /super-admin par ${user.email || user.uid}`,
    });
  },

  // ===============================================================
  // 2. Super Admin Overview
  // ===============================================================

  async getSuperAdminOverview(): Promise<any> {
    requireSuperAdminUser();
    const [{ users }, codesData, accSnap, ticketsSnap, quotesSnap, auditSnap] = await Promise.all([
      loadJoinedUserDirectory(),
      redeemFirestoreService.listRedeemCodesFromFirestore().catch(() => ({
        codes: [] as RedeemCodeRecord[],
        stats: buildRedeemOverviewStats([], []),
        activations: [] as ActivationRecord[],
      })),
      getDocs(collection(db, 'accessibility_requests')).catch(() => null),
      getDocs(collection(db, 'support_tickets')).catch(() => null),
      getDocs(collection(db, 'business_quotes')).catch(() => null),
      getDocs(collection(db, 'admin_audit_logs')).catch(() => null),
    ]);

    const now = Date.now();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayMs = startOfToday.getTime();
    const weekAgoMs = now - 7 * DAY_MS;

    const totalUsers = users.length;
    const activeUsers = users.filter((u) => u.accountStatus === 'active').length;
    const newToday = users.filter((u) => u.createdAt && u.createdAt >= todayMs).length;
    const newThisWeek = users.filter((u) => u.createdAt && u.createdAt >= weekAgoMs).length;
    const bannedUsers = users.filter((u) => u.accountStatus === 'banned').length;
    const suspendedUsers = users.filter((u) => u.accountStatus === 'suspended').length;
    const deletedUsers = users.filter((u) => u.accountStatus === 'soft_deleted').length;

    const onlineUsers = users.filter((u) => u.presence.state === 'online').length;
    const idleUsers = users.filter((u) => u.presence.state === 'idle').length;
    const offlineUsers = users.filter((u) => u.presence.state === 'offline').length;

    const freeUsers = users.filter((u) => u.subscription.effectivePlan === 'FREE').length;
    const premiumUsers = users.filter((u) => u.subscription.effectivePlan === 'PREMIUM').length;
    const familyUsers = users.filter((u) => u.subscription.effectivePlan === 'FAMILY').length;
    const businessUsers = users.filter((u) => u.subscription.effectivePlan === 'BUSINESS').length;

    const activeSubscriptions = users.filter(
      (u) => u.subscription.effectivePlan !== 'FREE' && u.subscription.status === 'active'
    ).length;
    const expiredSubscriptions = users.filter((u) => u.subscription.status === 'expired').length;
    const suspendedSubscriptions = users.filter(
      (u) => u.subscription.status === 'suspended'
    ).length;
    const lifetimeSubscriptions = users.filter((u) => Boolean(u.subscription.isLifetime)).length;
    const pioneerUsers = users.filter((u) => Boolean(u.subscription.isEarlyTester)).length;

    const pendingAccessibility = accSnap
      ? accSnap.docs.filter((d) => (d.data() as any).status === 'pending').length
      : 0;
    const openSupportTickets = ticketsSnap
      ? ticketsSnap.docs.filter((d) => {
          const st = (d.data() as any).status;
          return st === 'open' || st === 'in_progress';
        }).length
      : 0;
    const newBusinessQuotes = quotesSnap
      ? quotesSnap.docs.filter((d) => (d.data() as any).status === 'new').length
      : 0;

    const recentAuditLogs: AuditLogEntry[] = auditSnap
      ? auditSnap.docs
          .map((d) => d.data() as AuditLogEntry)
          .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
          .slice(0, 20)
      : [];

    // 14-day daily series
    const dailySeries: Array<{
      date: string;
      signups: number;
      activations: number;
      redeemActivations: number;
    }> = [];
    for (let i = 13; i >= 0; i--) {
      const dayStart = todayMs - i * DAY_MS;
      const dayEnd = dayStart + DAY_MS;
      const iso = new Date(dayStart).toISOString().slice(0, 10);
      const signups = users.filter(
        (u) => u.createdAt && u.createdAt >= dayStart && u.createdAt < dayEnd
      ).length;
      const redeemActivations = codesData.activations.filter(
        (a) => a.activatedAt >= dayStart && a.activatedAt < dayEnd
      ).length;
      const subActivations = users.filter(
        (u) =>
          u.subscription.effectivePlan !== 'FREE' &&
          u.subscription.startDate >= dayStart &&
          u.subscription.startDate < dayEnd
      ).length;
      dailySeries.push({
        date: iso,
        signups,
        activations: Math.max(redeemActivations, subActivations),
        redeemActivations,
      });
    }

    const codeStats = buildRedeemOverviewStats(codesData.codes, []);

    return {
      kpis: {
        totalUsers,
        activeUsers,
        newToday,
        newThisWeek,
        bannedUsers,
        suspendedUsers,
        deletedUsers,
        onlineUsers,
        idleUsers,
        offlineUsers,
        freeUsers,
        premiumUsers,
        familyUsers,
        businessUsers,
        activeSubscriptions,
        expiredSubscriptions,
        suspendedSubscriptions,
        lifetimeSubscriptions,
        pioneerUsers,
        totalCodes: codeStats.totalCodes,
        availableCodes: codeStats.availableCodes,
        usedCodes: codeStats.usedCodes,
        expiredCodes: codeStats.expiredCodes,
        revokedCodes: codeStats.revokedCodes,
        disabledCodes: codeStats.disabledCodes,
        pendingAccessibility,
        openSupportTickets,
        newBusinessQuotes,
      },
      dailySeries,
      planDistribution: [
        { name: 'Free', value: freeUsers, color: '#64748b' },
        { name: 'Premium', value: premiumUsers, color: '#3b82f6' },
        { name: 'Family', value: familyUsers, color: '#10b981' },
        { name: 'Business', value: businessUsers, color: '#f59e0b' },
      ],
      recentAuditLogs,
      recentActivations: codesData.activations.slice(0, 30),
      serverCapabilities: { hasAdminIam: false },
    };
  },

  // ===============================================================
  // 3. Users & Presence & Sanctions
  // ===============================================================

  async getUsers(params?: {
    search?: string;
    plan?: string;
    accountStatus?: string;
    presence?: string;
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
    page?: number;
    pageSize?: number;
  }): Promise<{
    users: AdminUserSummary[];
    total: number;
    page: number;
    pageSize: number;
    presenceSummary: {
      onlineCount: number;
      idleCount: number;
      offlineCount: number;
      records: PresenceRecord[];
    };
  }> {
    requireSuperAdminUser();
    const { users: allUsers } = await loadJoinedUserDirectory();

    const onlineCount = allUsers.filter((u) => u.presence.state === 'online').length;
    const idleCount = allUsers.filter((u) => u.presence.state === 'idle').length;
    const offlineCount = allUsers.filter((u) => u.presence.state === 'offline').length;

    let filtered = allUsers;
    const search = (params?.search || '').trim().toLowerCase();
    if (search) {
      filtered = filtered.filter(
        (u) =>
          u.uid.toLowerCase().includes(search) ||
          (u.email || '').toLowerCase().includes(search) ||
          (u.displayName || '').toLowerCase().includes(search)
      );
    }
    if (params?.plan && params.plan !== 'ALL') {
      filtered = filtered.filter((u) => u.subscription.effectivePlan === params.plan);
    }
    if (params?.accountStatus && params.accountStatus !== 'ALL') {
      filtered = filtered.filter((u) => u.accountStatus === params.accountStatus);
    }
    if (params?.presence && params.presence !== 'ALL') {
      filtered = filtered.filter((u) => u.presence.state === params.presence);
    }

    const sortBy = params?.sortBy || 'createdAt';
    const dir = params?.sortDir === 'asc' ? 1 : -1;
    filtered = filtered.slice().sort((a, b) => {
      if (sortBy === 'email') {
        return dir * (a.email || '').localeCompare(b.email || '');
      }
      if (sortBy === 'plan') {
        return dir * a.subscription.effectivePlan.localeCompare(b.subscription.effectivePlan);
      }
      if (sortBy === 'presence') {
        return dir * (a.presence.lastHeartbeatAt - b.presence.lastHeartbeatAt);
      }
      return dir * ((a.createdAt || 0) - (b.createdAt || 0));
    });

    const pageSize = Math.max(1, params?.pageSize || 20);
    const page = Math.max(1, params?.page || 1);
    const total = filtered.length;
    const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

    return {
      users: paged,
      total,
      page,
      pageSize,
      presenceSummary: {
        onlineCount,
        idleCount,
        offlineCount,
        records: allUsers.map((u) => u.presence),
      },
    };
  },

  async getUserDetails(uid: string): Promise<{
    user: AdminUserSummary;
    accessibilityRequests: AccessibilityRequestRecord[];
    supportTickets: SupportTicketRecord[];
    familyProfilesCount: number;
    auditLogs: AuditLogEntry[];
  }> {
    requireSuperAdminUser();
    const [{ users }, accSnap, ticketsSnap, famSnap, auditSnap] = await Promise.all([
      loadJoinedUserDirectory(),
      getDocs(query(collection(db, 'accessibility_requests'), where('uid', '==', uid))).catch(
        () => null
      ),
      getDocs(query(collection(db, 'support_tickets'), where('uid', '==', uid))).catch(() => null),
      getDocs(query(collection(db, 'family_profiles'), where('ownerUid', '==', uid))).catch(
        () => null
      ),
      getDocs(query(collection(db, 'admin_audit_logs'), where('targetUid', '==', uid))).catch(
        () => null
      ),
    ]);

    const user = users.find((u) => u.uid === uid);
    if (!user) {
      throw new Error('Utilisateur introuvable dans Firestore.');
    }

    const accessibilityRequests: AccessibilityRequestRecord[] = accSnap
      ? accSnap.docs
          .map((d) => {
            const { documentDataUrl: _omit, ...rest } = d.data() as Record<string, any>;
            return { ...(rest as AccessibilityRequestRecord), id: rest.id || d.id };
          })
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      : [];

    const supportTickets: SupportTicketRecord[] = ticketsSnap
      ? ticketsSnap.docs
          .map((d) => d.data() as SupportTicketRecord)
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      : [];

    const auditLogs: AuditLogEntry[] = auditSnap
      ? auditSnap.docs
          .map((d) => d.data() as AuditLogEntry)
          .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      : [];

    return {
      user,
      accessibilityRequests,
      supportTickets,
      familyProfilesCount: famSnap ? famSnap.size : 0,
      auditLogs,
    };
  },

  async suspendUser(uid: string, reason: string, durationHours: number): Promise<void> {
    const admin = requireSuperAdminUser();
    if (uid === admin.uid) {
      throw new Error('Auto-suspension interdite.');
    }
    const cleanReason = reason.trim();
    if (!cleanReason) throw new Error('Motif de suspension requis.');
    const safeHours = Math.max(1, Math.min(8760, Number(durationHours) || 24));
    const now = Date.now();
    const expiresAt = now + safeHours * 3600 * 1000;

    try {
      const govRef = doc(db, 'user_governance', uid);
      const prevSnap = await getDoc(govRef);
      const prevData = prevSnap.exists() ? (prevSnap.data() as Record<string, any>) : {};
      const history: UserSanctionEntry[] = Array.isArray(prevData.sanctionHistory)
        ? prevData.sanctionHistory
        : [];
      const entry: UserSanctionEntry = {
        id: createUniqueId('sanc'),
        action: 'suspend',
        reason: cleanReason,
        durationHours: safeHours,
        expiresAt,
        adminEmail: admin.email || admin.uid,
        createdAt: now,
      };
      await setDoc(
        govRef,
        {
          uid,
          email: prevData.email ?? null,
          accountStatus: 'suspended',
          suspensionReason: cleanReason,
          suspendedAt: now,
          suspensionExpiresAt: expiresAt,
          banReason: prevData.banReason ?? null,
          bannedAt: prevData.bannedAt ?? null,
          softDeletedAt: prevData.softDeletedAt ?? null,
          deletionReason: prevData.deletionReason ?? null,
          revokedAfter: now,
          sanctionHistory: [entry, ...history].slice(0, 50),
          updatedAt: now,
        },
        { merge: true }
      );
      await writeAuditLog({
        action: 'USER_SUSPENDED',
        category: 'user',
        targetUid: uid,
        targetEmail: prevData.email ?? null,
        newValue: { durationHours: safeHours, reason: cleanReason },
        detail: `Compte suspendu (${safeHours}h) : ${cleanReason}`,
      });
    } catch (err) {
      if (isPermissionDeniedError(err)) {
        handleFirestoreError(err, OperationType.WRITE, `user_governance/${uid}`);
      }
      throw err;
    }
  },

  async banUser(uid: string, reason: string): Promise<void> {
    const admin = requireSuperAdminUser();
    if (uid === admin.uid) {
      throw new Error('Auto-bannissement interdit.');
    }
    await enforceRecentReauthIfRequired();
    const cleanReason = reason.trim();
    if (!cleanReason) throw new Error('Motif de bannissement requis.');
    const now = Date.now();

    try {
      const govRef = doc(db, 'user_governance', uid);
      const prevSnap = await getDoc(govRef);
      const prevData = prevSnap.exists() ? (prevSnap.data() as Record<string, any>) : {};
      const history: UserSanctionEntry[] = Array.isArray(prevData.sanctionHistory)
        ? prevData.sanctionHistory
        : [];
      const entry: UserSanctionEntry = {
        id: createUniqueId('sanc'),
        action: 'ban',
        reason: cleanReason,
        adminEmail: admin.email || admin.uid,
        createdAt: now,
      };
      await setDoc(
        govRef,
        {
          uid,
          email: prevData.email ?? null,
          accountStatus: 'banned',
          suspensionReason: prevData.suspensionReason ?? null,
          suspendedAt: prevData.suspendedAt ?? null,
          suspensionExpiresAt: null,
          banReason: cleanReason,
          bannedAt: now,
          softDeletedAt: prevData.softDeletedAt ?? null,
          deletionReason: prevData.deletionReason ?? null,
          revokedAfter: now,
          sanctionHistory: [entry, ...history].slice(0, 50),
          updatedAt: now,
        },
        { merge: true }
      );
      await writeAuditLog({
        action: 'USER_BANNED',
        category: 'user',
        targetUid: uid,
        targetEmail: prevData.email ?? null,
        newValue: { reason: cleanReason },
        detail: `Compte banni définitivement : ${cleanReason}`,
      });
    } catch (err) {
      if (isPermissionDeniedError(err)) {
        handleFirestoreError(err, OperationType.WRITE, `user_governance/${uid}`);
      }
      throw err;
    }
  },

  async unbanUser(uid: string, reason = 'Réactivation manuelle'): Promise<void> {
    const admin = requireSuperAdminUser();
    const cleanReason = reason.trim() || 'Réactivation manuelle';
    const now = Date.now();

    try {
      const govRef = doc(db, 'user_governance', uid);
      const prevSnap = await getDoc(govRef);
      const prevData = prevSnap.exists() ? (prevSnap.data() as Record<string, any>) : {};
      const history: UserSanctionEntry[] = Array.isArray(prevData.sanctionHistory)
        ? prevData.sanctionHistory
        : [];
      const entry: UserSanctionEntry = {
        id: createUniqueId('sanc'),
        action: 'unban',
        reason: cleanReason,
        adminEmail: admin.email || admin.uid,
        createdAt: now,
      };
      await setDoc(
        govRef,
        {
          uid,
          email: prevData.email ?? null,
          accountStatus: 'active',
          suspensionReason: null,
          suspendedAt: null,
          suspensionExpiresAt: null,
          banReason: null,
          bannedAt: null,
          softDeletedAt: null,
          deletionReason: null,
          revokedAfter: prevData.revokedAfter ?? null,
          sanctionHistory: [entry, ...history].slice(0, 50),
          updatedAt: now,
        },
        { merge: true }
      );
      await writeAuditLog({
        action: 'USER_UNBANNED',
        category: 'user',
        targetUid: uid,
        targetEmail: prevData.email ?? null,
        detail: `Compte réactivé : ${cleanReason}`,
      });
    } catch (err) {
      if (isPermissionDeniedError(err)) {
        handleFirestoreError(err, OperationType.WRITE, `user_governance/${uid}`);
      }
      throw err;
    }
  },

  async revokeUserSessions(uid: string, reason = 'Révocation administrative'): Promise<void> {
    const admin = requireSuperAdminUser();
    const now = Date.now();
    const cleanReason = reason.trim() || 'Révocation administrative';

    try {
      const govRef = doc(db, 'user_governance', uid);
      const prevSnap = await getDoc(govRef);
      const prevData = prevSnap.exists() ? (prevSnap.data() as Record<string, any>) : {};
      const history: UserSanctionEntry[] = Array.isArray(prevData.sanctionHistory)
        ? prevData.sanctionHistory
        : [];
      const entry: UserSanctionEntry = {
        id: createUniqueId('sanc'),
        action: 'revoke_sessions',
        reason: cleanReason,
        adminEmail: admin.email || admin.uid,
        createdAt: now,
      };
      await setDoc(
        govRef,
        {
          uid,
          email: prevData.email ?? null,
          accountStatus: prevData.accountStatus || 'active',
          suspensionReason: prevData.suspensionReason ?? null,
          suspendedAt: prevData.suspendedAt ?? null,
          suspensionExpiresAt: prevData.suspensionExpiresAt ?? null,
          banReason: prevData.banReason ?? null,
          bannedAt: prevData.bannedAt ?? null,
          softDeletedAt: prevData.softDeletedAt ?? null,
          deletionReason: prevData.deletionReason ?? null,
          revokedAfter: now,
          sanctionHistory: [entry, ...history].slice(0, 50),
          updatedAt: now,
        },
        { merge: true }
      );
      await writeAuditLog({
        action: 'USER_SESSIONS_REVOKED',
        category: 'auth',
        targetUid: uid,
        targetEmail: prevData.email ?? null,
        detail: `Sessions révoquées : ${cleanReason}`,
      });
    } catch (err) {
      if (isPermissionDeniedError(err)) {
        handleFirestoreError(err, OperationType.WRITE, `user_governance/${uid}`);
      }
      throw err;
    }
  },

  async softDeleteUser(uid: string, reason: string): Promise<void> {
    const admin = requireSuperAdminUser();
    if (uid === admin.uid) {
      throw new Error('Auto-suppression interdite.');
    }
    const cleanReason = reason.trim();
    if (!cleanReason) throw new Error('Motif requis.');
    const now = Date.now();

    try {
      const govRef = doc(db, 'user_governance', uid);
      const prevSnap = await getDoc(govRef);
      const prevData = prevSnap.exists() ? (prevSnap.data() as Record<string, any>) : {};
      const history: UserSanctionEntry[] = Array.isArray(prevData.sanctionHistory)
        ? prevData.sanctionHistory
        : [];
      const entry: UserSanctionEntry = {
        id: createUniqueId('sanc'),
        action: 'soft_delete',
        reason: cleanReason,
        adminEmail: admin.email || admin.uid,
        createdAt: now,
      };
      await setDoc(
        govRef,
        {
          uid,
          email: prevData.email ?? null,
          accountStatus: 'soft_deleted',
          suspensionReason: prevData.suspensionReason ?? null,
          suspendedAt: prevData.suspendedAt ?? null,
          suspensionExpiresAt: prevData.suspensionExpiresAt ?? null,
          banReason: prevData.banReason ?? null,
          bannedAt: prevData.bannedAt ?? null,
          softDeletedAt: now,
          deletionReason: cleanReason,
          revokedAfter: now,
          sanctionHistory: [entry, ...history].slice(0, 50),
          updatedAt: now,
        },
        { merge: true }
      );
      await writeAuditLog({
        action: 'USER_SOFT_DELETED',
        category: 'user',
        targetUid: uid,
        targetEmail: prevData.email ?? null,
        detail: `Compte archivé (soft delete) : ${cleanReason}`,
      });
    } catch (err) {
      if (isPermissionDeniedError(err)) {
        handleFirestoreError(err, OperationType.WRITE, `user_governance/${uid}`);
      }
      throw err;
    }
  },

  async hardDeleteUser(uid: string, confirmPhrase: string, reason: string): Promise<void> {
    const admin = requireSuperAdminUser();
    if (uid === admin.uid) {
      throw new Error('Auto-suppression interdite.');
    }
    await enforceRecentReauthIfRequired();
    if (confirmPhrase.trim() !== 'SUPPRIMER DEFINITIVEMENT') {
      throw new Error('Phrase de confirmation invalide (attendu : SUPPRIMER DEFINITIVEMENT).');
    }
    const cleanReason = reason.trim();
    if (!cleanReason) throw new Error('Motif de suppression définitive requis.');

    try {
      const userSnap = await getDoc(doc(db, 'users', uid)).catch(() => null);
      const targetEmail = userSnap?.exists() ? (userSnap.data() as any).email ?? null : null;

      await Promise.all([
        deleteDoc(doc(db, 'users', uid)).catch(() => {}),
        deleteDoc(doc(db, 'public_profiles', uid)).catch(() => {}),
        deleteDoc(doc(db, 'subscriptions', uid)).catch(() => {}),
        deleteDoc(doc(db, 'early_testers', uid)).catch(() => {}),
        deleteDoc(doc(db, 'user_consents', uid)).catch(() => {}),
        deleteDoc(doc(db, 'user_governance', uid)).catch(() => {}),
      ]);

      await writeAuditLog({
        action: 'USER_HARD_DELETED',
        category: 'user',
        targetUid: uid,
        targetEmail,
        detail: `Suppression définitive Firestore effectuée : ${cleanReason}`,
      });
    } catch (err) {
      if (isPermissionDeniedError(err)) {
        handleFirestoreError(err, OperationType.DELETE, `users/${uid}`);
      }
      throw err;
    }
  },

  // ===============================================================
  // 4. Subscriptions Management
  // ===============================================================

  async updateUserSubscription(
    uid: string,
    payload: {
      action: 'assign' | 'extend' | 'suspend' | 'reactivate' | 'grant_lifetime' | 'downgrade_free';
      plan?: SubscriptionPlan;
      billingCycle?: BillingCycle;
      durationDays?: number | null;
      startDate?: number;
      endDate?: number | null;
      isLifetime?: boolean;
      reason: string;
      activationType?: ActivationSource;
      targetEmail?: string | null;
    }
  ): Promise<{ subscription: UserSubscription }> {
    const admin = requireSuperAdminUser();
    const now = Date.now();
    const reason = (payload.reason || '').trim() || 'Modification administrative';

    try {
      const [subSnap, earlySnap, userSnap] = await Promise.all([
        getDoc(doc(db, 'subscriptions', uid)),
        getDoc(doc(db, 'early_testers', uid)),
        getDoc(doc(db, 'users', uid)),
      ]);
      const prevSubData = subSnap.exists() ? (subSnap.data() as Record<string, any>) : undefined;
      const earlyData = earlySnap.exists() ? (earlySnap.data() as Record<string, any>) : undefined;
      const userData = userSnap.exists() ? (userSnap.data() as Record<string, any>) : undefined;

      const email =
        payload.targetEmail?.trim() || prevSubData?.email || userData?.email || null;
      const prevResolved = mapFirestoreSubscription(uid, prevSubData, earlyData, email, now);

      let nextPlan: SubscriptionPlan = payload.plan || prevResolved.plan || 'PREMIUM';
      let nextStatus: SubscriptionStatus = prevResolved.status;
      let nextBillingCycle: BillingCycle = payload.billingCycle || prevResolved.billingCycle || 'monthly';
      let nextStartDate = payload.startDate || prevResolved.startDate || now;
      let nextEndDate: number | null = prevResolved.endDate;
      let nextIsLifetime = Boolean(payload.isLifetime ?? prevResolved.isLifetime);
      let nextSource: ActivationSource = payload.activationType || 'admin';

      if (payload.action === 'downgrade_free') {
        nextPlan = 'FREE';
        nextStatus = 'active';
        nextEndDate = null;
        nextIsLifetime = false;
        nextSource = 'free';
      } else if (payload.action === 'suspend') {
        nextStatus = 'suspended';
      } else if (payload.action === 'reactivate') {
        nextStatus = 'active';
      } else if (payload.action === 'grant_lifetime') {
        nextPlan = payload.plan && payload.plan !== 'FREE' ? payload.plan : 'PREMIUM';
        nextStatus = 'active';
        nextBillingCycle = 'custom';
        nextStartDate = now;
        nextEndDate = null;
        nextIsLifetime = true;
      } else if (payload.action === 'extend') {
        nextStatus = 'active';
        if (nextPlan === 'FREE') nextPlan = 'PREMIUM';
        if (nextIsLifetime) {
          nextEndDate = null;
        } else if (payload.endDate !== undefined) {
          nextEndDate = payload.endDate;
        } else {
          const days = Number(payload.durationDays) || 30;
          const anchor =
            prevResolved.endDate && prevResolved.endDate > now ? prevResolved.endDate : now;
          nextEndDate = anchor + days * DAY_MS;
        }
      } else {
        // assign
        nextStatus = 'active';
        nextStartDate = payload.startDate || now;
        if (nextPlan === 'FREE') {
          nextEndDate = null;
          nextIsLifetime = false;
        } else if (nextIsLifetime) {
          nextBillingCycle = 'custom';
          nextEndDate = null;
        } else if (payload.endDate !== undefined) {
          nextEndDate = payload.endDate;
        } else {
          const days =
            typeof payload.durationDays === 'number' && payload.durationDays > 0
              ? payload.durationDays
              : nextBillingCycle === 'annual'
              ? 365
              : 30;
          nextEndDate = nextStartDate + days * DAY_MS;
        }
      }

      const resolved = resolveEffectiveSubscription(
        {
          uid,
          email,
          plan: nextPlan,
          status: nextStatus,
          billingCycle: nextBillingCycle,
          startDate: nextStartDate,
          endDate: nextEndDate,
          isLifetime: nextIsLifetime,
          cancelAtPeriodEnd: false,
          isEarlyTester: prevResolved.isEarlyTester,
          earlyTesterStartDate: prevResolved.earlyTesterStartDate,
          earlyTesterEndDate: prevResolved.earlyTesterEndDate,
          isAccessibilityLifetime:
            nextSource === 'accessibility' || prevResolved.isAccessibilityLifetime,
          activationSource: nextSource,
          paymentProvider:
            nextPlan === 'FREE'
              ? null
              : nextSource === 'accessibility'
              ? 'accessibility'
              : nextSource === 'redeem'
              ? 'redeem'
              : 'admin',
          paymentVerified: nextPlan !== 'FREE',
          lastPaymentRef: `admin_${now}`,
          updatedAt: now,
        },
        now
      );

      await setDoc(
        doc(db, 'subscriptions', uid),
        buildSubscriptionWritePayload(uid, resolved, prevSubData?.redeemCodeHash ?? null)
      );

      await writeAuditLog({
        action: `SUBSCRIPTION_${payload.action.toUpperCase()}`,
        category: 'subscription',
        targetUid: uid,
        targetEmail: email,
        oldValue: { plan: prevResolved.effectivePlan, status: prevResolved.status },
        newValue: { plan: resolved.effectivePlan, status: resolved.status, isLifetime: nextIsLifetime },
        detail: `Abonnement ${uid} (${payload.action} -> ${resolved.effectivePlan}) : ${reason} [par ${admin.email}]`,
      });

      return { subscription: resolved };
    } catch (err) {
      if (isPermissionDeniedError(err)) {
        handleFirestoreError(err, OperationType.WRITE, `subscriptions/${uid}`);
      }
      throw err;
    }
  },

  // ===============================================================
  // 5. Accessibility Requests
  // ===============================================================

  async getAccessibilityRequests(): Promise<{ requests: AccessibilityRequestRecord[] }> {
    requireSuperAdminUser();
    try {
      const snap = await getDocs(collection(db, 'accessibility_requests'));
      const requests: AccessibilityRequestRecord[] = snap.docs
        .map((d) => {
          const raw = d.data() as Record<string, any>;
          const { documentDataUrl: _omit, ...rest } = raw;
          return {
            ...(rest as AccessibilityRequestRecord),
            id: rest.id || d.id,
            history: Array.isArray(rest.history) ? rest.history : [],
          };
        })
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      return { requests };
    } catch (err) {
      if (isPermissionDeniedError(err)) {
        handleFirestoreError(err, OperationType.LIST, 'accessibility_requests');
      }
      throw err;
    }
  },

  async fetchAccessibilityDocumentBlob(
    requestId: string
  ): Promise<{ blob: Blob; mimeType: string }> {
    requireSuperAdminUser();
    try {
      const snap = await getDoc(doc(db, 'accessibility_requests', requestId));
      if (!snap.exists()) {
        throw new Error('Dossier Accessibilité introuvable.');
      }
      const data = snap.data() as Record<string, any>;
      const dataUrl = data.documentDataUrl as string | null | undefined;
      if (!dataUrl || typeof dataUrl !== 'string') {
        throw new Error('Justificatif binaire non stocké dans ce dossier.');
      }
      const resp = await fetch(dataUrl);
      const blob = await resp.blob();
      return {
        blob,
        mimeType: data.documentMimeType || blob.type || 'application/octet-stream',
      };
    } catch (err) {
      if (isPermissionDeniedError(err)) {
        handleFirestoreError(err, OperationType.GET, `accessibility_requests/${requestId}`);
      }
      throw err;
    }
  },

  async reviewAccessibilityRequest(
    requestId: string,
    decision: 'approved' | 'rejected' | 'more_info_required',
    comment?: string
  ): Promise<{ request: AccessibilityRequestRecord; subscription?: UserSubscription }> {
    const admin = requireSuperAdminUser();
    const now = Date.now();
    const cleanComment = comment?.trim() || null;

    try {
      const reqRef = doc(db, 'accessibility_requests', requestId);
      const reqSnap = await getDoc(reqRef);
      if (!reqSnap.exists()) {
        throw new Error('Dossier Accessibilité introuvable.');
      }
      const raw = reqSnap.data() as Record<string, any>;
      const prevHistory = Array.isArray(raw.history) ? raw.history : [];
      const nextHistory = [
        ...prevHistory,
        {
          action: decision.toUpperCase(),
          actor: admin.email || admin.uid,
          ...(cleanComment ? { comment: cleanComment } : {}),
          timestamp: now,
        },
      ].slice(-20);

      await updateDoc(reqRef, {
        status: decision,
        adminComment: cleanComment,
        reviewedBy: admin.email || admin.uid,
        reviewedAt: now,
        updatedAt: now,
        history: nextHistory,
      });

      const { documentDataUrl: _omit, ...rest } = raw;
      const updatedReq: AccessibilityRequestRecord = {
        ...(rest as AccessibilityRequestRecord),
        id: rest.id || requestId,
        status: decision,
        adminComment: cleanComment,
        reviewedBy: admin.email || admin.uid,
        reviewedAt: now,
        updatedAt: now,
        history: nextHistory,
      };

      let updatedSub: UserSubscription | undefined;
      if (decision === 'approved' && updatedReq.uid) {
        const subResult = await this.updateUserSubscription(updatedReq.uid, {
          action: 'grant_lifetime',
          plan: 'PREMIUM',
          activationType: 'accessibility',
          isLifetime: true,
          targetEmail: updatedReq.email,
          reason: `Programme Accessibilité approuvé (${requestId})`,
        });
        updatedSub = subResult.subscription;
      }

      await writeAuditLog({
        action: `ACCESSIBILITY_${decision.toUpperCase()}`,
        category: 'accessibility',
        targetUid: updatedReq.uid,
        targetEmail: updatedReq.email,
        targetId: requestId,
        newValue: { decision, comment: cleanComment },
        detail: `Dossier Accessibilité ${requestId} -> ${decision}${cleanComment ? ` (${cleanComment})` : ''}`,
      });

      return { request: updatedReq, subscription: updatedSub };
    } catch (err) {
      if (isPermissionDeniedError(err)) {
        handleFirestoreError(err, OperationType.UPDATE, `accessibility_requests/${requestId}`);
      }
      throw err;
    }
  },

  // ===============================================================
  // 6. Pioneer / Early Tester Program
  // ===============================================================

  async getPioneerData(): Promise<{
    pioneers: AdminUserSummary[];
    whitelistedEmails: Array<{ email: string; startDate: number; endDate: number; note?: string }>;
  }> {
    requireSuperAdminUser();
    const [{ users }, whitelistSnap] = await Promise.all([
      loadJoinedUserDirectory(),
      getDocs(collection(db, 'early_tester_whitelist')).catch((err) => {
        if (isPermissionDeniedError(err)) {
          handleFirestoreError(err, OperationType.LIST, 'early_tester_whitelist');
        }
        return null;
      }),
    ]);

    const pioneers = users.filter((u) => u.subscription.isEarlyTester);
    const pioneerEmailSet = new Set(
      pioneers.map((p) => (p.email || '').trim().toLowerCase()).filter(Boolean)
    );

    const whitelistedEmails = whitelistSnap
      ? whitelistSnap.docs
          .map((d) => d.data() as Record<string, any>)
          .filter((w) => w.email && !pioneerEmailSet.has(String(w.email).trim().toLowerCase()))
          .map((w) => ({
            email: String(w.email),
            startDate: toMs(w.startDate) ?? Date.now(),
            endDate: toMs(w.endDate) ?? Date.now() + EARLY_TESTER_DURATION_MS,
            note: w.note ?? undefined,
          }))
          .sort((a, b) => b.startDate - a.startDate)
      : [];

    return { pioneers, whitelistedEmails };
  },

  async grantPioneer(payload: {
    uid?: string;
    email?: string;
    durationDays?: number;
    note?: string;
  }): Promise<void> {
    const admin = requireSuperAdminUser();
    const days = Math.max(1, Math.min(1825, Number(payload.durationDays) || 730));
    const now = Date.now();
    const endDate = now + days * DAY_MS;
    const note = payload.note?.trim() || 'Accordé par Super Admin';
    const cleanEmail = payload.email?.trim() || null;

    let targetUid = payload.uid?.trim() || null;
    if (!targetUid && cleanEmail) {
      const lower = cleanEmail.toLowerCase();
      const { users } = await loadJoinedUserDirectory();
      const match = users.find((u) => (u.email || '').toLowerCase() === lower);
      if (match) targetUid = match.uid;
    }

    try {
      if (targetUid) {
        await setDoc(doc(db, 'early_testers', targetUid), {
          uid: targetUid,
          active: true,
          startDate: Timestamp.fromMillis(now),
          endDate: Timestamp.fromMillis(endDate),
          note,
        });

        const subSnap = await getDoc(doc(db, 'subscriptions', targetUid)).catch(() => null);
        const existingSub = subSnap?.exists() ? (subSnap.data() as Record<string, any>) : undefined;
        const resolved = resolveEffectiveSubscription(
          {
            uid: targetUid,
            email: cleanEmail || existingSub?.email || null,
            plan: (existingSub?.basePlan || existingSub?.plan || 'FREE') as SubscriptionPlan,
            status: (existingSub?.status || 'active') as SubscriptionStatus,
            billingCycle: (existingSub?.billingCycle || 'monthly') as BillingCycle,
            startDate: toMs(existingSub?.startDate) ?? now,
            endDate: toMs(existingSub?.endDate),
            isLifetime: Boolean(existingSub?.isLifetime),
            isEarlyTester: true,
            earlyTesterStartDate: now,
            earlyTesterEndDate: endDate,
            activationSource: existingSub?.activationSource || 'pioneer',
            paymentProvider: existingSub?.paymentProvider ?? 'early_tester',
            paymentVerified: true,
            updatedAt: now,
          },
          now
        );
        await setDoc(
          doc(db, 'subscriptions', targetUid),
          buildSubscriptionWritePayload(targetUid, resolved, existingSub?.redeemCodeHash ?? null)
        );
      }

      if (cleanEmail) {
        const hash = await sha256LowerHex(cleanEmail);
        await setDoc(doc(db, 'early_tester_whitelist', hash), {
          id: hash,
          email: cleanEmail,
          emailLower: cleanEmail.toLowerCase(),
          startDate: now,
          endDate,
          note,
          createdBy: admin.email || admin.uid,
          createdAt: now,
        });
      }

      await writeAuditLog({
        action: 'PIONEER_GRANTED',
        category: 'pioneer',
        targetUid,
        targetEmail: cleanEmail,
        newValue: { days, note },
        detail: `Statut Pioneer accordé (${days}j) à ${cleanEmail || targetUid}`,
      });
    } catch (err) {
      if (isPermissionDeniedError(err)) {
        handleFirestoreError(err, OperationType.WRITE, 'early_testers');
      }
      throw err;
    }
  },

  async revokePioneer(payload: { uid?: string; email?: string; reason: string }): Promise<void> {
    requireSuperAdminUser();
    const now = Date.now();
    const cleanEmail = payload.email?.trim() || null;
    const cleanReason = payload.reason?.trim() || 'Révocation administrative';

    try {
      if (payload.uid) {
        await setDoc(
          doc(db, 'early_testers', payload.uid),
          {
            uid: payload.uid,
            active: false,
            startDate: Timestamp.fromMillis(now),
            endDate: Timestamp.fromMillis(now),
            note: cleanReason,
          },
          { merge: true }
        );
        const subRef = doc(db, 'subscriptions', payload.uid);
        const subSnap = await getDoc(subRef);
        if (subSnap.exists()) {
          await updateDoc(subRef, {
            isEarlyTester: false,
            earlyTesterEndDate: Timestamp.fromMillis(now),
            updatedAt: Timestamp.fromMillis(now),
          });
        }
      }

      if (cleanEmail) {
        const hash = await sha256LowerHex(cleanEmail);
        await deleteDoc(doc(db, 'early_tester_whitelist', hash)).catch(() => {});
      }

      await writeAuditLog({
        action: 'PIONEER_REVOKED',
        category: 'pioneer',
        targetUid: payload.uid ?? null,
        targetEmail: cleanEmail,
        detail: `Statut Pioneer révoqué pour ${cleanEmail || payload.uid} : ${cleanReason}`,
      });
    } catch (err) {
      if (isPermissionDeniedError(err)) {
        handleFirestoreError(err, OperationType.WRITE, 'early_testers');
      }
      throw err;
    }
  },

  // ===============================================================
  // 7. Audit Logs, Settings, Pricing & Security
  // ===============================================================

  async getAuditLogs(params?: {
    category?: string;
    outcome?: string;
    search?: string;
    limit?: number;
  }): Promise<{ logs: AuditLogEntry[] }> {
    requireSuperAdminUser();
    try {
      const snap = await getDocs(collection(db, 'admin_audit_logs'));
      let logs: AuditLogEntry[] = snap.docs
        .map((d) => d.data() as AuditLogEntry)
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

      if (params?.category && params.category !== 'ALL') {
        logs = logs.filter((l) => l.category === params.category);
      }
      if (params?.outcome && params.outcome !== 'ALL') {
        logs = logs.filter((l) => l.outcome === params.outcome);
      }
      if (params?.search && params.search.trim()) {
        const q = params.search.trim().toLowerCase();
        logs = logs.filter(
          (l) =>
            l.action.toLowerCase().includes(q) ||
            l.detail.toLowerCase().includes(q) ||
            l.adminEmail.toLowerCase().includes(q) ||
            (l.targetEmail || '').toLowerCase().includes(q)
        );
      }
      const limitN = Math.max(1, Math.min(500, params?.limit || 250));
      return { logs: logs.slice(0, limitN) };
    } catch (err) {
      if (isPermissionDeniedError(err)) {
        handleFirestoreError(err, OperationType.LIST, 'admin_audit_logs');
      }
      throw err;
    }
  },

  async getPriceHistory(): Promise<PriceChangeHistoryEntry[]> {
    try {
      const snap = await getDocs(collection(db, 'price_history'));
      return snap.docs
        .map((d) => d.data() as PriceChangeHistoryEntry)
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
        .slice(0, 100);
    } catch {
      return [];
    }
  },

  async getSettings(): Promise<{
    settings: PlatformSettings;
    priceHistory: PriceChangeHistoryEntry[];
  }> {
    requireSuperAdminUser();
    const [settings, priceHistory] = await Promise.all([
      getStoredPlatformSettings(),
      this.getPriceHistory(),
    ]);
    return { settings, priceHistory };
  },

  async updateSettings(
    updates: Partial<PlatformSettings> & { reason?: string }
  ): Promise<{
    settings: PlatformSettings;
    priceHistory: PriceChangeHistoryEntry[];
  }> {
    const admin = requireSuperAdminUser();
    await enforceRecentReauthIfRequired();
    const current = await getStoredPlatformSettings();
    const now = Date.now();
    const { reason, ...cleanUpdates } = updates;

    const mergedRaw = {
      ...current,
      ...cleanUpdates,
      planPrices: {
        ...current.planPrices,
        ...(cleanUpdates.planPrices || {}),
      },
      regionalPlans: {
        ...(current.regionalPlans || DEFAULT_REGIONAL_PLANS),
        ...(cleanUpdates.regionalPlans || {}),
      },
      securitySettings: {
        ...current.securitySettings,
        ...(cleanUpdates.securitySettings || {}),
      },
      updatedAt: now,
      updatedBy: admin.email || admin.uid,
    };

    const nextSettings = normalizePlatformSettings(mergedRaw);

    try {
      await setDoc(doc(db, 'platform_config', 'global'), nextSettings);

      // Record pricing changes if any
      const plansToCompare: SubscriptionPlan[] = ['FREE', 'PREMIUM', 'FAMILY', 'BUSINESS'];
      const fieldsToCompare: Array<{
        key: keyof PlanRegionalConfig;
        currency?: 'TND' | 'EUR' | null;
      }> = [
        { key: 'enabled', currency: null },
        { key: 'monthlyPriceTnd', currency: 'TND' },
        { key: 'annualPriceTnd', currency: 'TND' },
        { key: 'monthlyPriceEur', currency: 'EUR' },
        { key: 'annualPriceEur', currency: 'EUR' },
      ];

      const batch = writeBatch(db);
      let hasPriceChanges = false;
      for (const pid of plansToCompare) {
        const oldReg = current.regionalPlans?.[pid] || DEFAULT_REGIONAL_PLANS[pid];
        const newReg = nextSettings.regionalPlans?.[pid] || DEFAULT_REGIONAL_PLANS[pid];
        for (const f of fieldsToCompare) {
          const oldVal = oldReg[f.key] ?? null;
          const newVal = newReg[f.key] ?? null;
          if (oldVal !== newVal) {
            hasPriceChanges = true;
            const entryId = createUniqueId('prc');
            const cleanReason = reason?.trim();
            const entry: PriceChangeHistoryEntry = {
              id: entryId,
              timestamp: now,
              plan: pid,
              field: String(f.key),
              currency: f.currency ?? null,
              oldValue: oldVal as number | boolean | null,
              newValue: newVal as number | boolean | null,
              adminUid: admin.uid,
              adminEmail: admin.email || admin.uid,
              ...(cleanReason ? { reason: cleanReason } : {}),
            };
            batch.set(doc(db, 'price_history', entryId), entry);
          }
        }
      }
      if (hasPriceChanges) {
        await batch.commit();
      }

      await writeAuditLog({
        action: 'PLATFORM_SETTINGS_UPDATED',
        category: 'settings',
        detail: `Paramètres plateforme mis à jour${reason ? ` (${reason})` : ''}`,
      });

      const priceHistory = await this.getPriceHistory();
      return { settings: nextSettings, priceHistory };
    } catch (err) {
      if (isPermissionDeniedError(err)) {
        handleFirestoreError(err, OperationType.WRITE, 'platform_config/global');
      }
      throw err;
    }
  },

  async getPricingManagement(): Promise<{
    planPrices: PlatformSettings['planPrices'];
    regionalPlans: Record<SubscriptionPlan, PlanRegionalConfig>;
    priceHistory: PriceChangeHistoryEntry[];
  }> {
    const { settings, priceHistory } = await this.getSettings();
    return {
      planPrices: settings.planPrices,
      regionalPlans: settings.regionalPlans || { ...DEFAULT_REGIONAL_PLANS },
      priceHistory,
    };
  },

  async updateRegionalPricing(payload: {
    planPrices?: Partial<PlatformSettings['planPrices']>;
    regionalPlans?: Record<SubscriptionPlan, PlanRegionalConfig>;
    reason?: string;
  }): Promise<{
    settings: PlatformSettings;
    planPrices: PlatformSettings['planPrices'];
    regionalPlans: Record<SubscriptionPlan, PlanRegionalConfig>;
    priceHistory: PriceChangeHistoryEntry[];
  }> {
    const current = await getStoredPlatformSettings();
    const res = await this.updateSettings({
      planPrices: {
        ...current.planPrices,
        ...(payload.planPrices || {}),
      },
      regionalPlans: payload.regionalPlans || current.regionalPlans,
      reason: payload.reason,
    });
    return {
      settings: res.settings,
      planPrices: res.settings.planPrices,
      regionalPlans: res.settings.regionalPlans || { ...DEFAULT_REGIONAL_PLANS },
      priceHistory: res.priceHistory,
    };
  },

  async getSecurityOverview(): Promise<{
    securitySettings: PlatformSettings['securitySettings'];
    recentSecurityEvents: AuditLogEntry[];
    hasAdminIam: boolean;
    currentAdmin: { uid: string; email: string | null; role: string; authTimeMs: number };
  }> {
    const admin = requireSuperAdminUser();
    const [settings, logsRes, tokenRes] = await Promise.all([
      getStoredPlatformSettings(),
      this.getAuditLogs({ limit: 150 }),
      admin.getIdTokenResult(),
    ]);
    const recentSecurityEvents = logsRes.logs
      .filter((l) => l.category === 'security' || l.outcome === 'denied' || l.category === 'settings')
      .slice(0, 40);
    const parsedAuth = Date.parse(tokenRes.authTime);

    return {
      securitySettings: settings.securitySettings,
      recentSecurityEvents,
      hasAdminIam: false,
      currentAdmin: {
        uid: admin.uid,
        email: admin.email || null,
        role: 'SUPER_ADMIN',
        authTimeMs: Number.isFinite(parsedAuth) ? parsedAuth : Date.now(),
      },
    };
  },

  // ===============================================================
  // 8. Admin Notifications
  // ===============================================================

  async getAdminNotifications(): Promise<{ notifications: AdminNotificationRecord[] }> {
    requireSuperAdminUser();
    try {
      const snap = await getDocs(collection(db, 'admin_notifications'));
      const notifications = snap.docs
        .map((d) => d.data() as AdminNotificationRecord)
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      return { notifications };
    } catch (err) {
      if (isPermissionDeniedError(err)) {
        handleFirestoreError(err, OperationType.LIST, 'admin_notifications');
      }
      throw err;
    }
  },

  async sendAdminNotification(payload: {
    title: string;
    message: string;
    type: AdminNotificationRecord['type'];
    targetScope: AdminNotificationRecord['targetScope'];
    targetUid?: string | null;
    targetEmail?: string | null;
  }): Promise<{ notification: AdminNotificationRecord }> {
    const admin = requireSuperAdminUser();
    const title = payload.title.trim().slice(0, 120);
    const message = payload.message.trim().slice(0, 1000);
    if (!title || !message) {
      throw new Error('Titre et message requis.');
    }

    const { users } = await loadJoinedUserDirectory();
    let recipientCount = 0;
    if (payload.targetScope === 'all') {
      recipientCount = users.length;
    } else if (payload.targetScope === 'specific_user') {
      recipientCount = 1;
    } else {
      recipientCount = users.filter(
        (u) => u.subscription.effectivePlan === payload.targetScope
      ).length;
    }

    const id = createUniqueId('notif');
    const notification: AdminNotificationRecord = {
      id,
      title,
      message,
      type: payload.type,
      targetScope: payload.targetScope,
      targetUid: payload.targetUid?.trim() || null,
      targetEmail: payload.targetEmail?.trim() || null,
      createdBy: admin.email || admin.uid,
      createdAt: Date.now(),
      recipientCount,
      readByUids: [],
    };

    try {
      await setDoc(doc(db, 'admin_notifications', id), notification);
      await writeAuditLog({
        action: 'NOTIFICATION_SENT',
        category: 'notification',
        targetUid: notification.targetUid,
        targetEmail: notification.targetEmail,
        targetId: id,
        detail: `Notification "${title}" envoyée (${payload.targetScope}, ~${recipientCount} destinataires)`,
      });
      return { notification };
    } catch (err) {
      if (isPermissionDeniedError(err)) {
        handleFirestoreError(err, OperationType.WRITE, `admin_notifications/${id}`);
      }
      throw err;
    }
  },

  // ===============================================================
  // 9. Support Tickets, Business Quotes & Feedback
  // ===============================================================

  async getSupportOverview(): Promise<{
    tickets: SupportTicketRecord[];
    businessQuotes: BusinessQuoteRequest[];
    feedbacks: any[];
    incidentsCount: number;
    incidents: any[];
  }> {
    requireSuperAdminUser();
    const [ticketsSnap, quotesSnap, fbSnap, appFbSnap, incidentsSnap] = await Promise.all([
      getDocs(collection(db, 'support_tickets')).catch((err) => {
        if (isPermissionDeniedError(err)) {
          handleFirestoreError(err, OperationType.LIST, 'support_tickets');
        }
        return null;
      }),
      getDocs(collection(db, 'business_quotes')).catch(() => null),
      getDocs(collection(db, 'feedback')).catch(() => null),
      getDocs(collection(db, 'app_feedback')).catch(() => null),
      getDocs(collection(db, 'incidents')).catch(() => null),
    ]);

    const tickets: SupportTicketRecord[] = ticketsSnap
      ? ticketsSnap.docs
          .map((d) => {
            const raw = d.data() as Record<string, any>;
            return {
              ...(raw as SupportTicketRecord),
              id: raw.id || d.id,
              replies: Array.isArray(raw.replies) ? raw.replies : [],
              internalNotes: Array.isArray(raw.internalNotes) ? raw.internalNotes : [],
            };
          })
          .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0))
      : [];

    const businessQuotes: BusinessQuoteRequest[] = quotesSnap
      ? quotesSnap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) } as BusinessQuoteRequest))
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      : [];

    const feedbacks: any[] = [];
    fbSnap?.docs.forEach((d) => {
      const data = d.data() as any;
      feedbacks.push({
        id: d.id,
        userId: data.uid || 'user',
        rating: data.rating ?? null,
        comment: data.comment || data.recommendationText || '',
        vruType: data.context?.vruType || data.type || 'FEEDBACK',
        createdAt: toMs(data.timestamp) ?? Date.now(),
      });
    });
    appFbSnap?.docs.forEach((d) => {
      const data = d.data() as any;
      feedbacks.push({
        id: d.id,
        userId: data.userId || 'user',
        rating: data.rating ?? null,
        comment: data.comment || '',
        vruType: data.metadata?.vruType || 'APP',
        createdAt: toMs(data.createdAt) ?? Date.now(),
      });
    });
    feedbacks.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    const incidents = incidentsSnap
      ? incidentsSnap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) }))
          .filter((i) => i.status === 'active')
      : [];

    return {
      tickets,
      businessQuotes,
      feedbacks,
      incidentsCount: incidents.length,
      incidents,
    };
  },

  async replySupportTicket(id: string, message: string): Promise<{ ticket: SupportTicketRecord }> {
    const admin = requireSuperAdminUser();
    const clean = message.trim().slice(0, 2000);
    if (!clean) throw new Error('Message requis.');

    try {
      const ref = doc(db, 'support_tickets', id);
      const snap = await getDoc(ref);
      if (!snap.exists()) throw new Error('Ticket introuvable.');
      const raw = snap.data() as SupportTicketRecord;
      const now = Date.now();
      const nextReplies = [
        ...(Array.isArray(raw.replies) ? raw.replies : []),
        {
          id: createUniqueId('rep'),
          senderRole: 'admin' as const,
          senderEmail: admin.email || admin.uid,
          message: clean,
          createdAt: now,
        },
      ];
      const nextStatus: SupportTicketStatus =
        raw.status === 'open' ? 'in_progress' : raw.status;

      await updateDoc(ref, {
        replies: nextReplies,
        status: nextStatus,
        updatedAt: now,
      });

      await writeAuditLog({
        action: 'SUPPORT_TICKET_REPLIED',
        category: 'support',
        targetUid: raw.uid ?? null,
        targetEmail: raw.email,
        targetId: id,
        detail: `Réponse envoyée sur le ticket "${raw.subject}"`,
      });

      return {
        ticket: {
          ...raw,
          id: raw.id || id,
          replies: nextReplies,
          status: nextStatus,
          updatedAt: now,
        },
      };
    } catch (err) {
      if (isPermissionDeniedError(err)) {
        handleFirestoreError(err, OperationType.UPDATE, `support_tickets/${id}`);
      }
      throw err;
    }
  },

  async updateSupportTicketStatus(
    id: string,
    status: SupportTicketStatus,
    priority?: SupportTicketRecord['priority']
  ): Promise<{ ticket: SupportTicketRecord }> {
    requireSuperAdminUser();
    try {
      const ref = doc(db, 'support_tickets', id);
      const snap = await getDoc(ref);
      if (!snap.exists()) throw new Error('Ticket introuvable.');
      const raw = snap.data() as SupportTicketRecord;
      const now = Date.now();
      const patch: Record<string, any> = { status, updatedAt: now };
      if (priority) patch.priority = priority;
      await updateDoc(ref, patch);

      await writeAuditLog({
        action: 'SUPPORT_TICKET_STATUS',
        category: 'support',
        targetId: id,
        newValue: patch,
        detail: `Statut du ticket "${raw.subject}" -> ${status}`,
      });

      return {
        ticket: {
          ...raw,
          id: raw.id || id,
          status,
          priority: priority || raw.priority,
          updatedAt: now,
        },
      };
    } catch (err) {
      if (isPermissionDeniedError(err)) {
        handleFirestoreError(err, OperationType.UPDATE, `support_tickets/${id}`);
      }
      throw err;
    }
  },

  async addSupportNote(id: string, note: string): Promise<{ ticket: SupportTicketRecord }> {
    const admin = requireSuperAdminUser();
    const clean = note.trim().slice(0, 1000);
    if (!clean) throw new Error('Note requise.');

    try {
      const ref = doc(db, 'support_tickets', id);
      const snap = await getDoc(ref);
      if (!snap.exists()) throw new Error('Ticket introuvable.');
      const raw = snap.data() as SupportTicketRecord;
      const now = Date.now();
      const nextNotes = [
        ...(Array.isArray(raw.internalNotes) ? raw.internalNotes : []),
        {
          id: createUniqueId('note'),
          adminEmail: admin.email || admin.uid,
          note: clean,
          createdAt: now,
        },
      ];
      await updateDoc(ref, {
        internalNotes: nextNotes,
        updatedAt: now,
      });

      return {
        ticket: {
          ...raw,
          id: raw.id || id,
          internalNotes: nextNotes,
          updatedAt: now,
        },
      };
    } catch (err) {
      if (isPermissionDeniedError(err)) {
        handleFirestoreError(err, OperationType.UPDATE, `support_tickets/${id}`);
      }
      throw err;
    }
  },

  async updateBusinessQuote(
    id: string,
    payload: { status?: BusinessQuoteRequest['status']; internalNote?: string }
  ): Promise<{ quote: BusinessQuoteRequest }> {
    requireSuperAdminUser();
    try {
      const ref = doc(db, 'business_quotes', id);
      const snap = await getDoc(ref);
      if (!snap.exists()) throw new Error('Demande de devis introuvable.');
      const raw = snap.data() as BusinessQuoteRequest;
      const now = Date.now();
      const patch: Record<string, any> = { updatedAt: now };
      if (payload.status) patch.status = payload.status;
      if (payload.internalNote !== undefined) patch.internalNote = payload.internalNote;
      await updateDoc(ref, patch);

      await writeAuditLog({
        action: 'BUSINESS_QUOTE_UPDATED',
        category: 'support',
        targetId: id,
        newValue: patch,
        detail: `Devis Business ${raw.companyName} mis à jour (${payload.status || raw.status})`,
      });

      return {
        quote: {
          ...raw,
          id: raw.id || id,
          status: payload.status || raw.status,
          internalNote: payload.internalNote ?? raw.internalNote,
          updatedAt: now,
        },
      };
    } catch (err) {
      if (isPermissionDeniedError(err)) {
        handleFirestoreError(err, OperationType.UPDATE, `business_quotes/${id}`);
      }
      throw err;
    }
  },

  async submitSupportTicket(payload: {
    email: string;
    name: string;
    subject: string;
    category: SupportTicketRecord['category'];
    priority?: SupportTicketRecord['priority'];
    message: string;
  }): Promise<{ ticket: SupportTicketRecord }> {
    const currentUser = requireSignedInUser();
    const now = Date.now();
    const id = createUniqueId('tkt');
    const ticket: SupportTicketRecord = {
      id,
      uid: currentUser.uid,
      email: (payload.email || currentUser.email || '').trim().slice(0, 256),
      name: payload.name.trim().slice(0, 120),
      subject: payload.subject.trim().slice(0, 180),
      category: payload.category,
      priority: payload.priority || 'normal',
      message: payload.message.trim().slice(0, 3000),
      status: 'open',
      createdAt: now,
      updatedAt: now,
      replies: [],
      internalNotes: [],
    };
    if (!ticket.email || !ticket.subject || !ticket.message) {
      throw new Error('Email, sujet et message requis.');
    }

    try {
      await setDoc(doc(db, 'support_tickets', id), ticket);
      return { ticket };
    } catch (err) {
      if (isPermissionDeniedError(err)) {
        handleFirestoreError(err, OperationType.CREATE, `support_tickets/${id}`);
      }
      throw err;
    }
  },

  async getMySupportTickets(): Promise<{ tickets: SupportTicketRecord[] }> {
    const currentUser = auth.currentUser;
    if (!currentUser) return { tickets: [] };
    try {
      const snap = await getDocs(
        query(collection(db, 'support_tickets'), where('uid', '==', currentUser.uid))
      );
      const tickets = snap.docs
        .map((d) => {
          const raw = d.data() as Record<string, any>;
          return {
            ...(raw as SupportTicketRecord),
            id: raw.id || d.id,
            replies: Array.isArray(raw.replies) ? raw.replies : [],
            internalNotes: [],
          };
        })
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      return { tickets };
    } catch (err) {
      if (isPermissionDeniedError(err)) {
        handleFirestoreError(err, OperationType.LIST, 'support_tickets');
      }
      return { tickets: [] };
    }
  },

  async submitBusinessQuote(payload: {
    companyName: string;
    contactName: string;
    email: string;
    phone: string;
    teamSize: string;
    vehicleCount: string;
    needsApi: boolean;
    message: string;
  }): Promise<BusinessQuoteRequest> {
    const currentUser = requireSignedInUser();
    const now = Date.now();
    const id = createUniqueId('qt');
    const quote: BusinessQuoteRequest = {
      id,
      uid: currentUser.uid,
      companyName: payload.companyName.trim().slice(0, 150),
      contactName: payload.contactName.trim().slice(0, 120),
      email: payload.email.trim().slice(0, 256),
      phone: payload.phone.trim().slice(0, 40),
      teamSize: payload.teamSize.trim().slice(0, 40),
      vehicleCount: payload.vehicleCount.trim().slice(0, 40),
      needsApi: Boolean(payload.needsApi),
      message: payload.message.trim().slice(0, 2000),
      status: 'new',
      createdAt: now,
    };

    try {
      await setDoc(doc(db, 'business_quotes', id), quote);
      return quote;
    } catch (err) {
      if (isPermissionDeniedError(err)) {
        handleFirestoreError(err, OperationType.CREATE, `business_quotes/${id}`);
      }
      throw err;
    }
  },

  // ===============================================================
  // 10. Consents Admin View
  // ===============================================================

  async adminGetConsents(params?: {
    status?: string;
    platform?: string;
    search?: string;
  }): Promise<AdminConsentsOverviewResponse> {
    requireSuperAdminUser();
    const [{ users }, consentsSnap] = await Promise.all([
      loadJoinedUserDirectory(),
      getDocs(collection(db, 'user_consents')).catch((err) => {
        if (isPermissionDeniedError(err)) {
          handleFirestoreError(err, OperationType.LIST, 'user_consents');
        }
        return null;
      }),
    ]);

    const consentMap = new Map<string, Record<string, any>>();
    consentsSnap?.docs.forEach((d) => consentMap.set(d.id, d.data() as Record<string, any>));

    const allUids = new Set<string>([...users.map((u) => u.uid), ...consentMap.keys()]);
    const userByUid = new Map(users.map((u) => [u.uid, u]));

    const allRows: AdminConsentUserRow[] = [];
    for (const uid of allUids) {
      const u = userByUid.get(uid);
      const cRaw = consentMap.get(uid);
      const { status: st } = buildConsentStatusFromDoc(cRaw);

      allRows.push({
        uid,
        email: u?.email ?? cRaw?.email ?? null,
        displayName: u?.displayName ?? null,
        status: st.consentStatus,
        consentVersion: st.consentVersion,
        termsVersion: st.termsVersion,
        privacyVersion: st.privacyVersion,
        acceptedAt: st.acceptedAt,
        refusedAt: st.refusedAt,
        withdrawnAt: st.withdrawnAt,
        platform: st.platform,
        optionalConsents: st.optionalConsents,
        accessAllowed: st.accessAllowed,
        historyCount: st.historyCount,
        updatedAt: st.updatedAt,
        accountCreatedAt: u?.createdAt ?? null,
      });
    }

    const acceptedCount = allRows.filter((r) => r.status === 'accepted').length;
    const refusedCount = allRows.filter((r) => r.status === 'refused').length;
    const withdrawnCount = allRows.filter((r) => r.status === 'withdrawn').length;
    const pendingCount = allRows.filter((r) => r.status === 'pending').length;
    const lastAcceptedAt = allRows.reduce<number | null>(
      (max, r) => (r.acceptedAt && (!max || r.acceptedAt > max) ? r.acceptedAt : max),
      null
    );

    let filtered = allRows;
    if (params?.status && params.status !== 'ALL') {
      filtered = filtered.filter((r) => r.status === params.status);
    }
    if (params?.platform && params.platform !== 'ALL') {
      filtered = filtered.filter((r) => r.platform === params.platform);
    }
    if (params?.search && params.search.trim()) {
      const q = params.search.trim().toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.uid.toLowerCase().includes(q) ||
          (r.email || '').toLowerCase().includes(q) ||
          (r.displayName || '').toLowerCase().includes(q)
      );
    }

    filtered.sort((a, b) => (b.updatedAt || b.accountCreatedAt || 0) - (a.updatedAt || a.accountCreatedAt || 0));

    return {
      stats: {
        totalUsers: allRows.length,
        acceptedCount,
        refusedCount,
        pendingCount,
        withdrawnCount,
        acceptanceRatePct:
          allRows.length > 0 ? Math.round((acceptedCount / allRows.length) * 100) : 0,
        lastAcceptedAt,
        currentConsentVersion: CLIENT_CONSENT_VERSION,
        currentTermsVersion: CLIENT_TERMS_VERSION,
        currentPrivacyVersion: CLIENT_PRIVACY_VERSION,
      },
      users: filtered,
    };
  },

  async adminGetUserConsentDetail(uid: string): Promise<{
    status: ConsentStatusResponse;
    record: UserConsentRecord | null;
    email: string | null;
    displayName: string | null;
  }> {
    requireSuperAdminUser();
    try {
      const [consentSnap, userSnap] = await Promise.all([
        getDoc(doc(db, 'user_consents', uid)),
        getDoc(doc(db, 'users', uid)).catch(() => null),
      ]);
      const rawConsent = consentSnap.exists()
        ? (consentSnap.data() as Record<string, any>)
        : undefined;
      const rawUser = userSnap?.exists() ? (userSnap.data() as Record<string, any>) : undefined;
      const { status, record } = buildConsentStatusFromDoc(rawConsent);
      return {
        status,
        record,
        email: rawUser?.email ?? rawConsent?.email ?? null,
        displayName: rawUser?.displayName ?? null,
      };
    } catch (err) {
      if (isPermissionDeniedError(err)) {
        handleFirestoreError(err, OperationType.GET, `user_consents/${uid}`);
      }
      throw err;
    }
  },

  // ===============================================================
  // 11. Android App Releases & Settings
  // ===============================================================

  async getLatestAndroidRelease(
    currentVersionCode?: number | null
  ): Promise<AndroidLatestVersionResponse> {
    try {
      const [cfgSnap, relSnap] = await Promise.all([
        getDoc(doc(db, 'android_app_config', 'global')).catch(() => null),
        getDocs(query(collection(db, 'android_releases'), where('status', '==', 'published'))).catch(
          () => null
        ),
      ]);
      const settings = normalizeAndroidAppSettings(
        cfgSnap?.exists() ? (cfgSnap.data() as Record<string, any>) : null
      );
      const releases = relSnap
        ? relSnap.docs
            .map((d) => normalizeAndroidAppRelease(d.data() as Record<string, any>, d.id))
            .filter((r) => r.status === 'published')
            .sort((a, b) => (b.versionCode || 0) - (a.versionCode || 0))
        : [];
      const current = releases.find((r) => r.isCurrent) || releases[0] || null;
      const curCode =
        typeof currentVersionCode === 'number' && currentVersionCode > 0
          ? currentVersionCode
          : null;
      const minSupported = Math.max(
        settings.minSupportedVersionCode || 1,
        current?.minSupportedVersionCode || 1
      );
      const updateAvailable = Boolean(
        current && curCode !== null && current.versionCode > curCode
      );
      const mandatory = Boolean(
        current &&
          (current.updateType === 'mandatory' ||
            (curCode !== null && curCode < minSupported))
      );

      return {
        downloadsEnabled: settings.downloadsEnabled,
        available: Boolean(settings.downloadsEnabled && current),
        appName: current?.appName || settings.appName,
        packageName: current?.packageName || settings.packageName,
        description: settings.description,
        releaseId: current?.id ?? null,
        versionName: current?.versionName ?? null,
        versionCode: current?.versionCode ?? null,
        downloadUrl: current?.externalDownloadUrl ?? null,
        fileSize: current?.fileSize ?? null,
        sha256: current?.sha256 ?? null,
        releaseDate: current?.releaseDate ?? null,
        publishedAt: current?.publishedAt ?? null,
        whatsNew: current?.whatsNew ?? [],
        releaseDescription: current?.description ?? null,
        minAndroidVersion: current?.minAndroidVersion ?? null,
        minAndroidApi: current?.minAndroidApi ?? null,
        fileName: current?.fileName ?? null,
        disabledReason: settings.downloadsEnabled
          ? null
          : 'Téléchargement temporairement désactivé par l’administration.',
        updateType: current?.updateType ?? 'optional',
        mandatory,
        updateAvailable,
        minSupportedVersionCode: minSupported,
        mandatoryReason: mandatory
          ? 'Une mise à jour obligatoire de sécurité est disponible.'
          : null,
        storageMode: current?.storageMode,
        chunkCount: current?.chunkCount || 0,
      };
    } catch {
      const defaults = createDefaultAndroidAppSettings();
      return {
        downloadsEnabled: false,
        available: false,
        appName: defaults.appName,
        packageName: defaults.packageName,
        description: defaults.description,
        releaseId: null,
        versionName: null,
        versionCode: null,
        downloadUrl: null,
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
        minSupportedVersionCode: 1,
        mandatoryReason: null,
        chunkCount: 0,
      };
    }
  },

  async adminGetAndroidReleases(): Promise<{
    releases: AndroidAppRelease[];
    settings: AndroidAppSettings;
    stats: AndroidDownloadStats;
    currentRelease: AndroidAppRelease | null;
  }> {
    requireSuperAdminUser();
    try {
      const [cfgSnap, relSnap] = await Promise.all([
        getDoc(doc(db, 'android_app_config', 'global')).catch(() => null),
        getDocs(query(collection(db, 'android_releases'), orderBy('versionCode', 'desc'))).catch(
          async () => getDocs(collection(db, 'android_releases'))
        ),
      ]);
      const settings = normalizeAndroidAppSettings(
        cfgSnap?.exists() ? (cfgSnap.data() as Record<string, any>) : null
      );
      const releases = relSnap.docs
        .map((d) => normalizeAndroidAppRelease(d.data() as Record<string, any>, d.id))
        .sort((a, b) => (b.versionCode || 0) - (a.versionCode || 0));
      const currentRelease = releases.find((r) => r.isCurrent) || null;
      return {
        releases,
        settings,
        stats: buildAndroidStats(releases),
        currentRelease,
      };
    } catch (err) {
      if (isPermissionDeniedError(err)) {
        handleFirestoreError(err, OperationType.LIST, 'android_releases');
      }
      throw err;
    }
  },

  async adminGetAndroidReleaseById(id: string): Promise<AndroidAppRelease | null> {
    requireSuperAdminUser();
    const snap = await getDoc(doc(db, 'android_releases', id));
    if (!snap.exists()) return null;
    return normalizeAndroidAppRelease(snap.data() as Record<string, any>, snap.id);
  },

  async adminUploadApkToFirebase(
    payload: {
      file?: File | null;
      externalDownloadUrl?: string | null;
      appName: string;
      packageName?: string;
      versionName: string;
      versionCode: number;
      description: string;
      whatsNew: string;
      releaseDate: string;
      status: AndroidReleaseStatus;
      minAndroidVersion: string;
      minAndroidApi: number;
      updateType: AndroidUpdateType;
      minSupportedVersionCode?: number | null;
      setAsCurrent: boolean;
    },
    onProgress?: (percent: number, loadedBytes: number, totalBytes: number) => void
  ): Promise<{
    release: AndroidAppRelease;
    stats: AndroidDownloadStats;
    currentRelease: AndroidAppRelease | null;
  }> {
    const admin = requireSuperAdminUser();
    const trimmedExternalUrl = payload.externalDownloadUrl?.trim()
      ? validateExternalApkUrl(payload.externalDownloadUrl)
      : '';

    if (!payload.file && !trimmedExternalUrl) {
      throw new Error(
        'Sélectionnez un fichier .apk ou renseignez un lien de téléchargement APK externe (HTTPS).'
      );
    }

    const parsedCode = Math.floor(Number(payload.versionCode));
    if (!Number.isInteger(parsedCode) || parsedCode < 1) {
      throw new Error('Le code de version (versionCode) doit être un entier >= 1.');
    }
    const cleanVersionName = payload.versionName.trim().slice(0, 64);
    if (!cleanVersionName) {
      throw new Error('Le numéro de version (versionName) est requis.');
    }

    const [cfgSnap, existingReleasesSnap] = await Promise.all([
      getDoc(doc(db, 'android_app_config', 'global')).catch(() => null),
      getDocs(collection(db, 'android_releases')).catch((err) => {
        if (isPermissionDeniedError(err)) {
          handleFirestoreError(err, OperationType.LIST, 'android_releases');
        }
        throw err;
      }),
    ]);

    const settings = normalizeAndroidAppSettings(
      cfgSnap?.exists() ? (cfgSnap.data() as Record<string, any>) : null
    );

    const duplicate = existingReleasesSnap.docs
      .map((d) => d.data() as Record<string, any>)
      .find((r) => Number(r.versionCode) === parsedCode);
    if (duplicate) {
      throw new Error(
        `Le code de version ${parsedCode} existe déjà (v${duplicate.versionName || '?'}). Utilisez un code supérieur.`
      );
    }

    let fileSize = 0;
    let sha256 = '';
    const cleanAppName = (payload.appName.trim() || settings.appName || 'VruGuard').slice(0, 100);
    const cleanPkg = (payload.packageName?.trim() || settings.packageName || 'com.vruguard.sentinel').slice(
      0,
      120
    );
    const fallbackFileName = `${cleanAppName.replace(/[^a-zA-Z0-9._-]+/g, '-')}-v${cleanVersionName}.apk`;
    const fileName = (payload.file?.name || fallbackFileName).slice(0, 255);

    if (payload.file) {
      const maxBytes = settings.maxApkSizeBytes || 200 * 1024 * 1024;
      if (payload.file.size > maxBytes) {
        throw new Error(
          `Le fichier dépasse la taille maximale autorisée (${Math.round(maxBytes / (1024 * 1024))} Mo).`
        );
      }
      const inspected = await inspectApkAndComputeSha256(payload.file);
      fileSize = inspected.fileSize;
      sha256 = inspected.sha256;
      onProgress?.(5, 0, fileSize);
    }

    const releaseId = createUniqueId('apk');
    let finalDownloadUrl: string | null = trimmedExternalUrl || null;
    let pathInStorage: string | null = null;
    let resolvedStorageMode: AndroidAppRelease['storageMode'] = trimmedExternalUrl
      ? 'external_url'
      : 'firestore_chunks';
    let chunkCount = 0;

    if (!finalDownloadUrl && payload.file) {
      let storageUploadError: Error | null = null;
      const storageInstance = await getFirebaseStorage();

      if (storageInstance) {
        try {
          const { getDownloadURL, ref: storageRef, uploadBytesResumable } = await import(
            'firebase/storage'
          );
          const safeFile = fileName.replace(/[^a-zA-Z0-9._-]+/g, '_');
          const candidatePath = `android-releases/${releaseId}/${safeFile}`.slice(0, 512);
          const targetRef = storageRef(storageInstance, candidatePath);

          finalDownloadUrl = await new Promise<string>((resolve, reject) => {
            const task = uploadBytesResumable(targetRef, payload.file as File, {
              contentType: 'application/vnd.android.package-archive',
            });

            let lastBytes = -1;
            let stallTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
              try {
                task.cancel();
              } catch {
                // ignore
              }
              reject(new Error('STORAGE_STALL'));
            }, 6500);

            const clearStall = () => {
              if (stallTimer) {
                clearTimeout(stallTimer);
                stallTimer = null;
              }
            };

            task.on(
              'state_changed',
              (snapshot) => {
                if (snapshot.bytesTransferred > 0 && snapshot.bytesTransferred !== lastBytes) {
                  lastBytes = snapshot.bytesTransferred;
                  clearStall();
                }
                if (onProgress && snapshot.totalBytes > 0) {
                  const pct = Math.min(
                    98,
                    Math.max(5, Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 95) + 5)
                  );
                  onProgress(pct, snapshot.bytesTransferred, snapshot.totalBytes);
                }
              },
              (error) => {
                clearStall();
                const code = String((error as any)?.code || '');
                if (code === 'storage/canceled') {
                  return;
                }
                reject(error);
              },
              async () => {
                clearStall();
                try {
                  const url = await getDownloadURL(task.snapshot.ref);
                  resolve(url);
                } catch (err) {
                  reject(err);
                }
              }
            );
          });

          pathInStorage = candidatePath;
          resolvedStorageMode = 'firebase_storage';
          onProgress?.(100, fileSize, fileSize);
        } catch (err: any) {
          storageUploadError = err instanceof Error ? err : new Error(String(err));
          pathInStorage = null;
          finalDownloadUrl = null;
        }
      }

      // Serverless zero-backend fallback: store verified binary chunks directly in Firestore
      if (!finalDownloadUrl) {
        if (payload.file.size > MAX_FIRESTORE_CHUNKS_APK_BYTES) {
          const reason = storageUploadError?.message
            ? ` (${storageUploadError.message})`
            : '';
          throw new Error(
            `Ce fichier APK dépasse 45 Mo${reason}. Pour un APK > 45 Mo sans serveur backend, activez Firebase Storage ou collez le lien HTTPS d’une GitHub Release dans le champ « Lien de téléchargement APK externe ».`
          );
        }

        const totalChunks = Math.ceil(payload.file.size / APK_FIRESTORE_CHUNK_BYTES);
        const nowChunkTs = Date.now();
        const BATCH_LIMIT = 4;

        try {
          for (let startIdx = 0; startIdx < totalChunks; startIdx += BATCH_LIMIT) {
            const batch = writeBatch(db);
            const endIdx = Math.min(totalChunks, startIdx + BATCH_LIMIT);
            for (let idx = startIdx; idx < endIdx; idx++) {
              const byteStart = idx * APK_FIRESTORE_CHUNK_BYTES;
              const byteEnd = Math.min(payload.file.size, byteStart + APK_FIRESTORE_CHUNK_BYTES);
              const sliceBuf = await payload.file.slice(byteStart, byteEnd).arrayBuffer();
              const chunkId = `${releaseId}_${idx}`;
              batch.set(doc(db, 'android_release_chunks', chunkId), {
                id: chunkId,
                releaseId,
                index: idx,
                data: arrayBufferToBase64(sliceBuf),
                createdAt: nowChunkTs,
              });
            }
            await batch.commit();
            const uploadedBytes = Math.min(
              payload.file.size,
              endIdx * APK_FIRESTORE_CHUNK_BYTES
            );
            const pct = Math.min(
              95,
              Math.max(8, Math.round((uploadedBytes / payload.file.size) * 90) + 5)
            );
            onProgress?.(pct, uploadedBytes, payload.file.size);
          }

          chunkCount = totalChunks;
          resolvedStorageMode = 'firestore_chunks';
          onProgress?.(100, fileSize, fileSize);
        } catch (err) {
          if (isPermissionDeniedError(err)) {
            handleFirestoreError(err, OperationType.WRITE, 'android_release_chunks');
          }
          throw err;
        }
      }
    } else {
      onProgress?.(100, fileSize, fileSize);
    }

    const now = Date.now();
    const isPublished = payload.status === 'published';
    const isCurrent = Boolean(isPublished && payload.setAsCurrent);
    const whatsNew = payload.whatsNew
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 50);

    const hasApkPayload = Boolean(finalDownloadUrl || chunkCount > 0);
    const releaseDoc: Record<string, any> = {
      id: releaseId,
      appName: cleanAppName,
      packageName: cleanPkg,
      versionName: cleanVersionName,
      versionCode: parsedCode,
      description: payload.description.trim().slice(0, 2000),
      whatsNew,
      releaseDate: (payload.releaseDate || new Date(now).toISOString().slice(0, 10)).slice(0, 64),
      minAndroidVersion: (payload.minAndroidVersion || 'Android 8.0 Oreo (API 26)').slice(0, 40),
      minAndroidApi: Math.max(1, Number(payload.minAndroidApi) || 26),
      updateType: payload.updateType || 'optional',
      minSupportedVersionCode: payload.minSupportedVersionCode
        ? Math.max(1, Number(payload.minSupportedVersionCode))
        : null,
      fileName,
      storedFileName: fileName,
      mimeType: 'application/vnd.android.package-archive',
      fileSize,
      sha256,
      status: payload.status,
      isCurrent,
      isArchived: false,
      hasBackup: hasApkPayload,
      fileAvailable: hasApkPayload,
      downloadsInitiated: 0,
      downloadsCompleted: 0,
      lastDownloadedAt: null,
      uploadedBy: (admin.email || admin.uid).slice(0, 256),
      uploadedByUid: admin.uid.slice(0, 128),
      uploadedByEmail: (admin.email || admin.uid).slice(0, 256),
      storagePath: pathInStorage,
      storageMode: resolvedStorageMode,
      chunkCount,
      externalDownloadUrl: finalDownloadUrl,
      createdAt: now,
      updatedAt: now,
      publishedAt: isPublished ? now : null,
    };

    try {
      const batch = writeBatch(db);
      if (isCurrent) {
        existingReleasesSnap.docs.forEach((d) => {
          if ((d.data() as any).isCurrent) {
            batch.update(d.ref, { isCurrent: false, updatedAt: now });
          }
        });
      }
      batch.set(doc(db, 'android_releases', releaseId), releaseDoc);
      await batch.commit();

      await writeAuditLog({
        action: 'ANDROID_APK_UPLOADED',
        category: 'android_app',
        targetId: releaseId,
        newValue: {
          versionName: cleanVersionName,
          versionCode: parsedCode,
          status: payload.status,
          storageMode: resolvedStorageMode,
          chunkCount,
        },
        detail: `Version Android v${cleanVersionName} (${parsedCode}) ajoutée (${resolvedStorageMode})`,
      });

      const all = await this.adminGetAndroidReleases();
      return {
        release: normalizeAndroidAppRelease(releaseDoc, releaseId),
        stats: all.stats,
        currentRelease: all.currentRelease,
      };
    } catch (err) {
      if (isPermissionDeniedError(err)) {
        handleFirestoreError(err, OperationType.WRITE, `android_releases/${releaseId}`);
      }
      throw err;
    }
  },

  async downloadApkFromFirestoreChunks(
    releaseId: string,
    fallbackFileName?: string,
    onProgress?: (percent: number) => void
  ): Promise<void> {
    const relSnap = await getDoc(doc(db, 'android_releases', releaseId)).catch((err) => {
      if (isPermissionDeniedError(err)) {
        handleFirestoreError(err, OperationType.GET, `android_releases/${releaseId}`);
      }
      throw err;
    });

    if (!relSnap.exists()) {
      throw new Error('Version Android introuvable.');
    }

    const rel = normalizeAndroidAppRelease(relSnap.data() as Record<string, any>, relSnap.id);
    if (rel.externalDownloadUrl) {
      const a = document.createElement('a');
      a.href = rel.externalDownloadUrl;
      a.download = rel.fileName || fallbackFileName || `VruGuard-v${rel.versionName}.apk`;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    }

    const totalChunks = rel.chunkCount || 0;
    if (totalChunks < 1) {
      throw new Error('Aucun fichier APK disponible pour cette version.');
    }

    onProgress?.(5);
    const orderedParts: Uint8Array<ArrayBuffer>[] = new Array(totalChunks);
    const PARALLEL = 6;

    for (let start = 0; start < totalChunks; start += PARALLEL) {
      const indices: number[] = [];
      for (let idx = start; idx < Math.min(totalChunks, start + PARALLEL); idx++) {
        indices.push(idx);
      }

      const snaps = await Promise.all(
        indices.map((idx) =>
          getDoc(doc(db, 'android_release_chunks', `${releaseId}_${idx}`)).catch((err) => {
            if (isPermissionDeniedError(err)) {
              handleFirestoreError(
                err,
                OperationType.GET,
                `android_release_chunks/${releaseId}_${idx}`
              );
            }
            throw err;
          })
        )
      );

      snaps.forEach((snap, offset) => {
        const idx = indices[offset];
        if (!snap.exists()) {
          throw new Error(`Segment APK manquant (${idx + 1}/${totalChunks}).`);
        }
        const chunkData = (snap.data() as Record<string, any>)?.data;
        if (typeof chunkData !== 'string' || !chunkData) {
          throw new Error(`Segment APK corrompu (${idx + 1}/${totalChunks}).`);
        }
        orderedParts[idx] = base64ToUint8Array(chunkData);
      });

      const pct = Math.min(95, Math.round(((start + indices.length) / totalChunks) * 90) + 5);
      onProgress?.(pct);
    }

    const blob = new Blob(orderedParts, { type: 'application/vnd.android.package-archive' });

    if (rel.sha256) {
      const buf = await blob.arrayBuffer();
      const digest = await globalThis.crypto.subtle.digest('SHA-256', buf);
      const actualHex = Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      if (actualHex !== rel.sha256.toLowerCase()) {
        throw new Error('Vérification d’intégrité SHA-256 échouée lors de l’assemblage de l’APK.');
      }
    }

    onProgress?.(100);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = rel.fileName || fallbackFileName || `VruGuard-v${rel.versionName}.apk`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  },

  async adminUpdateAndroidSettings(
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
    >
  ): Promise<{ settings: AndroidAppSettings }> {
    const admin = requireSuperAdminUser();
    const cfgRef = doc(db, 'android_app_config', 'global');
    try {
      const prevSnap = await getDoc(cfgRef).catch(() => null);
      const prev = normalizeAndroidAppSettings(
        prevSnap?.exists() ? (prevSnap.data() as Record<string, any>) : null
      );
      const next: AndroidAppSettings = {
        ...prev,
        ...updates,
        updatedAt: Date.now(),
        updatedBy: admin.email || admin.uid,
      };
      await setDoc(cfgRef, next);
      await writeAuditLog({
        action: 'ANDROID_SETTINGS_UPDATED',
        category: 'android_app',
        detail: 'Paramètres de distribution Android mis à jour',
      });
      return { settings: next };
    } catch (err) {
      if (isPermissionDeniedError(err)) {
        handleFirestoreError(err, OperationType.WRITE, 'android_app_config/global');
      }
      throw err;
    }
  },

  async adminUpdateAndroidReleaseMetadata(
    id: string,
    updates: {
      appName?: string;
      versionName?: string;
      description?: string;
      whatsNew?: string[] | string;
      releaseDate?: string;
      minAndroidVersion?: string;
      minAndroidApi?: number;
      updateType?: AndroidUpdateType;
      minSupportedVersionCode?: number | null;
      externalDownloadUrl?: string | null;
    }
  ): Promise<{ release: AndroidAppRelease; currentRelease: AndroidAppRelease | null }> {
    requireSuperAdminUser();
    try {
      const relRef = doc(db, 'android_releases', id);
      const snap = await getDoc(relRef);
      if (!snap.exists()) throw new Error('Version Android introuvable.');
      const prevRaw = snap.data() as Record<string, any>;
      const prev = normalizeAndroidAppRelease(prevRaw, snap.id);
      const whatsNewArr =
        typeof updates.whatsNew === 'string'
          ? updates.whatsNew
              .split('\n')
              .map((s) => s.trim())
              .filter(Boolean)
              .slice(0, 50)
          : updates.whatsNew ?? prev.whatsNew;

      let nextExternalUrl = prevRaw.externalDownloadUrl ?? null;
      if (updates.externalDownloadUrl !== undefined) {
        const trimmed = (updates.externalDownloadUrl || '').trim();
        nextExternalUrl = trimmed ? validateExternalApkUrl(trimmed) : null;
      }

      const nextDoc: Record<string, any> = {
        ...prevRaw,
        id: prev.id,
        appName: (updates.appName !== undefined ? updates.appName : prev.appName).slice(0, 100),
        packageName: prev.packageName,
        versionName: (updates.versionName !== undefined ? updates.versionName : prev.versionName).slice(
          0,
          64
        ),
        versionCode: prev.versionCode,
        description: (updates.description !== undefined ? updates.description : prev.description).slice(
          0,
          2000
        ),
        releaseDate: (updates.releaseDate !== undefined ? updates.releaseDate : prev.releaseDate).slice(
          0,
          64
        ),
        minAndroidVersion: (updates.minAndroidVersion !== undefined
          ? updates.minAndroidVersion
          : prev.minAndroidVersion
        ).slice(0, 40),
        minAndroidApi: updates.minAndroidApi !== undefined ? updates.minAndroidApi : prev.minAndroidApi,
        updateType: updates.updateType !== undefined ? updates.updateType : prev.updateType,
        minSupportedVersionCode:
          updates.minSupportedVersionCode !== undefined
            ? updates.minSupportedVersionCode
            : prev.minSupportedVersionCode,
        externalDownloadUrl: nextExternalUrl,
        fileAvailable: Boolean(nextExternalUrl || prev.fileAvailable),
        hasBackup: Boolean(nextExternalUrl || prev.hasBackup),
        whatsNew: whatsNewArr,
        status: prev.status,
        isCurrent: prev.isCurrent,
        createdAt: prev.createdAt,
        updatedAt: Date.now(),
      };
      await setDoc(relRef, nextDoc);
      const all = await this.adminGetAndroidReleases();
      return {
        release: normalizeAndroidAppRelease(nextDoc, id),
        currentRelease: all.currentRelease,
      };
    } catch (err) {
      if (isPermissionDeniedError(err)) {
        handleFirestoreError(err, OperationType.UPDATE, `android_releases/${id}`);
      }
      throw err;
    }
  },

  async adminChangeAndroidReleaseStatus(
    id: string,
    action: 'publish' | 'unpublish' | 'disable' | 'restore'
  ): Promise<{
    release: AndroidAppRelease;
    releases: AndroidAppRelease[];
    currentRelease: AndroidAppRelease | null;
    stats: AndroidDownloadStats;
  }> {
    requireSuperAdminUser();
    try {
      const relRef = doc(db, 'android_releases', id);
      const snap = await getDoc(relRef);
      if (!snap.exists()) throw new Error('Version Android introuvable.');
      const targetRaw = snap.data() as Record<string, any>;
      const target = normalizeAndroidAppRelease(targetRaw, snap.id);
      const now = Date.now();
      const nextStatus: AndroidReleaseStatus =
        action === 'publish' || action === 'restore'
          ? 'published'
          : action === 'disable'
          ? 'disabled'
          : 'draft';

      const batch = writeBatch(db);
      if (action === 'publish' || action === 'restore') {
        const relSnap = await getDocs(collection(db, 'android_releases'));
        relSnap.docs.forEach((d) => {
          if (d.id !== id && (d.data() as any).isCurrent) {
            batch.update(d.ref, { isCurrent: false, updatedAt: now });
          }
        });
      }

      const updatedDoc: Record<string, any> = {
        ...targetRaw,
        id: target.id,
        status: nextStatus,
        isCurrent: action === 'publish' || action === 'restore',
        publishedAt:
          action === 'publish' || action === 'restore'
            ? target.publishedAt || now
            : target.publishedAt,
        updatedAt: now,
      };
      batch.set(relRef, updatedDoc);
      await batch.commit();

      const all = await this.adminGetAndroidReleases();
      return {
        release: normalizeAndroidAppRelease(updatedDoc, id),
        releases: all.releases,
        currentRelease: all.currentRelease,
        stats: all.stats,
      };
    } catch (err) {
      if (isPermissionDeniedError(err)) {
        handleFirestoreError(err, OperationType.UPDATE, `android_releases/${id}`);
      }
      throw err;
    }
  },

  async adminDeleteAndroidRelease(
    id: string
  ): Promise<{ deleted: boolean; releases: AndroidAppRelease[]; stats: AndroidDownloadStats }> {
    requireSuperAdminUser();
    try {
      const relRef = doc(db, 'android_releases', id);
      const snap = await getDoc(relRef).catch(() => null);
      const sp = snap?.exists() ? (snap.data() as Record<string, any>)?.storagePath : null;
      if (typeof sp === 'string' && sp.trim()) {
        const storageInstance = await getFirebaseStorage();
        if (storageInstance) {
          const { deleteObject, ref: storageRef } = await import('firebase/storage');
          await deleteObject(storageRef(storageInstance, sp.trim())).catch(() => {});
        }
      }
      const chunksSnap = await getDocs(
        query(collection(db, 'android_release_chunks'), where('releaseId', '==', id))
      ).catch(() => null);
      if (chunksSnap && !chunksSnap.empty) {
        const docs = chunksSnap.docs;
        for (let i = 0; i < docs.length; i += 200) {
          const delBatch = writeBatch(db);
          docs.slice(i, i + 200).forEach((d) => delBatch.delete(d.ref));
          await delBatch.commit().catch(() => {});
        }
      }
      await deleteDoc(relRef);
      const all = await this.adminGetAndroidReleases();
      return {
        deleted: true,
        releases: all.releases,
        stats: all.stats,
      };
    } catch (err) {
      if (isPermissionDeniedError(err)) {
        handleFirestoreError(err, OperationType.DELETE, `android_releases/${id}`);
      }
      throw err;
    }
  },
};
